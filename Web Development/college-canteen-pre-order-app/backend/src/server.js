import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { FoodItem, Notification, Order, Promotion, Setting, TokenCounter, User } from './models/index.js';
import { requireAuth, requireRole } from './middleware/auth.js';

const app = express();
const port = process.env.PORT || 4000;
const tz = 'Asia/Kolkata';
const clientOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map(value => value.trim());
const isPrivateIpv4 = hostname => {
  const octets = hostname.split('.').map(Number);
  if (octets.length !== 4 || octets.some(value => !Number.isInteger(value) || value < 0 || value > 255)) return false;
  return octets[0] === 10 || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) || (octets[0] === 192 && octets[1] === 168);
};
const isLocalDevelopmentOrigin = origin => {
  if (process.env.NODE_ENV === 'production') return false;
  try {
    const url = new URL(origin);
    const localHost = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || isPrivateIpv4(url.hostname);
    return ['http:', 'https:'].includes(url.protocol) && localHost;
  } catch { return false; }
};
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: (origin, callback) => callback(null, !origin || clientOrigins.includes(origin) || isLocalDevelopmentOrigin(origin)), credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 80, standardHeaders: 'draft-7', legacyHeaders: false }));

const dayKey = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const safeUser = user => ({ id: user._id, name: user.name, email: user.email, studentId: user.studentId || '', phone: user.phone || '', role: user.role, favorites: user.favorites || [] });
const tokenFor = user => jwt.sign({ sub: user._id.toString(), role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
const notify = (user, role, title, body, order) => Notification.create({ user: user || undefined, role, title, body, order: order?._id });
const settings = async () => (await Setting.findOne({ key: 'canteen' }).lean()) || { isOpen: true, openingTime: '08:00', closingTime: '18:00', announcement: 'Fresh picks, faster pickups. Order ahead and skip the line.', expressEnabled: true, serviceFee: 0 };

app.get('/api/health', (_req, res) => res.json({ ok: true, database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected', time: new Date().toISOString() }));

app.post('/api/auth/register', async (req, res, next) => {
  try {
    const { name, email, password, studentId, phone } = req.body;
    if (!name?.trim() || !email?.trim() || !password || password.length < 8 || !studentId?.trim()) return res.status(400).json({ message: 'Name, student ID, email, and a password of at least 8 characters are required.' });
    const exists = await User.findOne({ $or: [{ email: email.trim().toLowerCase() }, { studentId: studentId.trim() }] });
    if (exists) return res.status(409).json({ message: exists.email === email.trim().toLowerCase() ? 'An account with this email already exists.' : 'This student ID is already registered.' });
    const user = await User.create({ name: name.trim(), email: email.trim().toLowerCase(), studentId: studentId.trim().toUpperCase(), phone: phone?.trim(), passwordHash: await bcrypt.hash(password, 12), role: 'student' });
    res.status(201).json({ token: tokenFor(user), user: safeUser(user) });
  } catch (error) { next(error); }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const { email, password, role } = req.body;
    const user = await User.findOne({ email: String(email || '').trim().toLowerCase() });
    if (!user || !(await bcrypt.compare(String(password || ''), user.passwordHash))) return res.status(401).json({ message: 'Email or password doesn’t match.' });
    if (role && user.role !== role) return res.status(403).json({ message: user.role === 'admin' ? 'Use the staff sign-in to access the canteen console.' : 'This account does not have staff access.' });
    res.json({ token: tokenFor(user), user: safeUser(user) });
  } catch (error) { next(error); }
});

app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: safeUser(req.user) }));
app.patch('/api/auth/me', requireAuth, async (req, res, next) => {
  try {
    const { name, phone } = req.body;
    if (name !== undefined && !String(name).trim()) return res.status(400).json({ message: 'Name cannot be empty.' });
    if (name !== undefined) req.user.name = String(name).trim();
    if (phone !== undefined) req.user.phone = String(phone).trim();
    await req.user.save();
    res.json({ user: safeUser(req.user) });
  } catch (error) { next(error); }
});

app.get('/api/menu', async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.category && req.query.category !== 'All') filter.category = req.query.category;
    if (req.query.available === 'true') filter.available = true;
    if (req.query.veg === 'true') filter.veg = true;
    if (req.query.featured === 'true') filter.featured = true;
    if (req.query.q) filter.$text = { $search: String(req.query.q) };
    let items = await FoodItem.find(filter).lean();
    if (req.query.minPrice) items = items.filter(x => x.price >= Number(req.query.minPrice));
    if (req.query.maxPrice) items = items.filter(x => x.price <= Number(req.query.maxPrice));
    if (req.query.popular === 'true') items = items.filter(x => x.popularity > 0);
    const sorters = { priceAsc: (a,b) => a.price-b.price, priceDesc: (a,b) => b.price-a.price, popular: (a,b) => b.popularity-a.popularity, rating: (a,b) => b.rating-a.rating, fastest: (a,b) => a.prepTime-b.prepTime };
    if (sorters[req.query.sort]) items.sort(sorters[req.query.sort]);
    res.json({ items, categories: [...new Set(items.map(i => i.category))].sort() });
  } catch (error) { next(error); }
});

app.post('/api/menu', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const body = req.body;
    if (!body.name?.trim() || !body.category || !Number.isFinite(Number(body.price)) || Number(body.price) <= 0) return res.status(400).json({ message: 'Add a name, category, and price above zero.' });
    const item = await FoodItem.create({ ...body, name: body.name.trim(), price: Number(body.price), stock: Math.max(0, Number(body.stock ?? 50)), prepTime: Math.max(1, Number(body.prepTime ?? 10)) });
    res.status(201).json({ item });
  } catch (error) { next(error); }
});
app.patch('/api/menu/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const item = await FoodItem.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ message: 'Menu item not found.' });
    res.json({ item });
  } catch (error) { next(error); }
});
app.delete('/api/menu/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const item = await FoodItem.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: 'Menu item not found.' });
    res.json({ success: true });
  } catch (error) { next(error); }
});

app.get('/api/favorites', requireAuth, async (req, res, next) => {
  try { await req.user.populate('favorites'); res.json({ items: req.user.favorites }); } catch (error) { next(error); }
});
app.post('/api/favorites/:foodId/toggle', requireAuth, async (req, res, next) => {
  try {
    if (!(await FoodItem.exists({ _id: req.params.foodId }))) return res.status(404).json({ message: 'Menu item not found.' });
    const id = req.params.foodId;
    const exists = req.user.favorites.some(x => x.toString() === id);
    req.user.favorites = exists ? req.user.favorites.filter(x => x.toString() !== id) : [...req.user.favorites, id];
    await req.user.save();
    res.json({ favorited: !exists, favorites: req.user.favorites });
  } catch (error) { next(error); }
});

async function nextToken(key = dayKey()) {
  const existingOrders = await Order.find({ token: /^B-(\d+)$/i }).select('token').lean();
  const highestExistingSequence = existingOrders.reduce((highest, order) => {
    const sequence = /^B-(\d+)$/i.exec(order.token)?.[1];
    return sequence ? Math.max(highest, Number(sequence)) : highest;
  }, 0);
  try {
    await TokenCounter.updateOne(
      { dayKey: key },
      { $max: { sequence: highestExistingSequence }, $setOnInsert: { dayKey: key } },
      { upsert: true }
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
    await TokenCounter.updateOne({ dayKey: key }, { $max: { sequence: highestExistingSequence } });
  }
  let counter;
  try { counter = await TokenCounter.findOneAndUpdate({ dayKey: key }, { $inc: { sequence: 1 }, $setOnInsert: { dayKey: key } }, { new: true, upsert: true, setDefaultsOnInsert: true }); }
  catch (error) {
    if (error.code !== 11000) throw error;
    counter = await TokenCounter.findOneAndUpdate({ dayKey: key }, { $inc: { sequence: 1 } }, { new: true });
  }
  return `B-${String(counter.sequence).padStart(3, '0')}`;
}

app.post('/api/orders', requireAuth, requireRole('student'), async (req, res, next) => {
  try {
    const { items, pickupAt, pickupLabel, orderType = 'regular', note = '', idempotencyKey, promoCode = '' } = req.body;
    if (idempotencyKey) {
      const prior = await Order.findOne({ idempotencyKey, user: req.user._id });
      if (prior) return res.status(200).json({ order: prior, duplicate: true });
    }
    if (!Array.isArray(items) || !items.length || items.length > 30) return res.status(400).json({ message: 'Your cart is empty or contains too many items.' });
    const pickup = new Date(pickupAt);
    if (!Number.isFinite(pickup.getTime()) || pickup < new Date(Date.now() + 60_000) || pickup > new Date(Date.now() + 7 * 86400_000)) return res.status(400).json({ message: 'Choose a pickup time in the next 7 days.' });
    if (!['regular', 'express'].includes(orderType)) return res.status(400).json({ message: 'Choose a valid pickup type.' });
    const config = await settings();
    if (!config.isOpen) return res.status(409).json({ message: 'The canteen is closed right now. Please try during opening hours.' });
    if (orderType === 'express' && !config.expressEnabled) return res.status(409).json({ message: 'Express pickup is unavailable right now.' });
    const quantities = new Map();
    for (const line of items) {
      const qty = Number(line.quantity);
      if (!line.foodId || !Number.isInteger(qty) || qty < 1 || qty > 20) return res.status(400).json({ message: 'One of the item quantities is invalid.' });
      quantities.set(String(line.foodId), (quantities.get(String(line.foodId)) || 0) + qty);
    }
    const catalog = await FoodItem.find({ _id: { $in: [...quantities.keys()] } });
    if (catalog.length !== quantities.size) return res.status(400).json({ message: 'One or more menu items are no longer available.' });
    const orderLines = [];
    for (const food of catalog) {
      const qty = quantities.get(food._id.toString());
      if (!food.available || food.stock < qty) return res.status(409).json({ message: `${food.name} is sold out or there isn’t enough stock.` });
      const selected = items.find(x => String(x.foodId) === food._id.toString());
      orderLines.push({ foodId: food._id, name: food.name, image: food.image, unitPrice: food.price, quantity: qty, customization: String(selected?.customization || '').slice(0, 120) });
    }
    const subtotal = orderLines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
    let appliedCode = '';
    let discount = 0;
    if (promoCode) {
      const code = String(promoCode).trim().toUpperCase();
      const now = new Date();
      const promo = await Promotion.findOne({ code, active: true, $and: [{ $or: [{ startsAt: null }, { startsAt: { $lte: now } }] }, { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] }] });
      if (!promo) return res.status(400).json({ message: 'That offer code is invalid or no longer active.' });
      appliedCode = promo.code;
      discount = Math.round(subtotal * promo.discountPercent) / 100;
    }
    const serviceFee = Number(config.serviceFee || 0) + (orderType === 'express' ? 20 : 0);
    const orderDayKey = dayKey();
    const orderDetails = { dayKey: orderDayKey, user: req.user._id, studentName: req.user.name, studentId: req.user.studentId, items: orderLines, subtotal, discount, promoCode: appliedCode, serviceFee, total: subtotal - discount + serviceFee, pickupAt: pickup, pickupLabel: String(pickupLabel || ''), orderType, note: String(note).slice(0, 300), idempotencyKey, statusHistory: [{ status: 'placed', by: req.user.name }] };
    let order;
    for (let attempt = 0; attempt < 20 && !order; attempt++) {
      const token = await nextToken(orderDayKey);
      try {
        order = await Order.create({ ...orderDetails, token });
      } catch (error) {
        const tokenCollision = error.code === 11000 && (error.keyPattern?.token || error.keyValue?.token === token);
        if (tokenCollision) {
          const sequence = Number(/^B-(\d+)$/i.exec(token)?.[1] || 0);
          await TokenCounter.updateOne({ dayKey: orderDetails.dayKey }, { $max: { sequence } });
          continue;
        }
        if (error.code === 11000 && idempotencyKey) {
          const prior = await Order.findOne({ idempotencyKey, user: req.user._id });
          if (prior) return res.status(200).json({ order: prior, duplicate: true });
        }
        throw error;
      }
    }
    if (!order) return res.status(503).json({ message: 'We couldn’t reserve a pickup token. Please try placing your order again.' });
    await Promise.all(catalog.map(food => FoodItem.updateOne({ _id: food._id }, { $inc: { stock: -quantities.get(food._id.toString()), popularity: quantities.get(food._id.toString()) } })));
    const notificationResults = await Promise.allSettled([
      notify(req.user._id, 'student', 'Order received', `Order ${order.token} is in the kitchen queue. We’ll keep you posted.`, order),
      notify(null, 'admin', 'New order in the queue', `${req.user.name} placed ${order.token} · ₹${order.total}.`, order)
    ]);
    for (const result of notificationResults) {
      if (result.status === 'rejected') console.error('Order notification failed:', result.reason);
    }
    res.status(201).json({ order });
  } catch (error) { next(error); }
});

app.get('/api/orders', requireAuth, async (req, res, next) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { user: req.user._id };
    if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;
    if (req.query.q) filter.$or = [{ token: new RegExp(String(req.query.q), 'i') }, { studentName: new RegExp(String(req.query.q), 'i') }, { studentId: new RegExp(String(req.query.q), 'i') }];
    const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(150).populate('user', 'name email studentId').lean();
    res.json({ orders });
  } catch (error) { next(error); }
});
app.get('/api/orders/:id', requireAuth, async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate('user', 'name email studentId');
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    if (req.user.role !== 'admin' && order.user._id.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'This order belongs to another account.' });
    res.json({ order });
  } catch (error) { next(error); }
});

const transitions = { placed: ['confirmed', 'cancelled'], confirmed: ['preparing', 'cancelled'], preparing: ['ready'], ready: ['called'], called: ['completed'] };
app.patch('/api/orders/:id/status', requireAuth, async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    const target = String(req.body.status || '');
    if (target === 'cancelled' && req.user.role === 'student') {
      if (order.user.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'This order belongs to another account.' });
    } else if (req.user.role !== 'admin') return res.status(403).json({ message: 'Only canteen staff can update this order.' });
    if (!transitions[order.status]?.includes(target)) return res.status(409).json({ message: `Order cannot move from ${order.status} to ${target}.` });
    order.status = target;
    order.statusHistory.push({ status: target, by: req.user.name });
    await order.save();
    if (target === 'cancelled') {
      await Promise.all(order.items.map(line => FoodItem.updateOne({ _id: line.foodId }, { $inc: { stock: line.quantity } })));
    }
    const message = { confirmed: 'The kitchen accepted your order.', preparing: 'Your food is being prepared.', ready: 'Your order is ready for pickup.', called: 'Your token has been called. Head to the pickup counter.', completed: 'Order complete. Enjoy your meal!', cancelled: 'Your order was cancelled.' }[target];
    await notify(order.user, 'student', `Order ${order.token} ${target}`, message, order);
    if (target === 'confirmed') await notify(null, 'admin', 'Order confirmed', `${order.token} is accepted and ready for the kitchen.`, order);
    res.json({ order });
  } catch (error) { next(error); }
});

app.get('/api/queue', async (_req, res, next) => {
  try {
    const today = dayKey();
    const orders = await Order.find({ dayKey: today, status: { $in: ['placed', 'confirmed', 'preparing', 'ready', 'called'] } }).sort({ createdAt: 1 }).select('token studentName status pickupAt createdAt items').lean();
    const nowServing = orders.find(o => o.status === 'called') || null;
    const settingsDoc = await settings();
    const avgPrep = await FoodItem.aggregate([{ $match: { available: true } }, { $group: { _id: null, value: { $avg: '$prepTime' } } }]);
    res.json({ orders, nowServing, next: orders.filter(o => o._id !== nowServing?._id).slice(0, 4), activeCount: orders.length, waitMinutes: Math.max(5, Math.round((avgPrep[0]?.value || 12) * Math.max(1, orders.length) * 0.38)), settings: settingsDoc });
  } catch (error) { next(error); }
});

app.get('/api/notifications', requireAuth, async (req, res, next) => {
  try {
    const filter = req.user.role === 'admin' ? { role: 'admin' } : { user: req.user._id };
    const notifications = await Notification.find(filter).sort({ createdAt: -1 }).limit(60).lean();
    res.json({ notifications, unread: notifications.filter(n => !n.readAt).length });
  } catch (error) { next(error); }
});
app.patch('/api/notifications/read', requireAuth, async (req, res, next) => {
  try {
    const filter = req.user.role === 'admin' ? { role: 'admin', readAt: null } : { user: req.user._id, readAt: null };
    await Notification.updateMany(filter, { $set: { readAt: new Date() } });
    res.json({ success: true });
  } catch (error) { next(error); }
});
app.delete('/api/notifications/:id', requireAuth, async (req, res, next) => {
  try {
    const scope = req.user.role === 'admin' ? { role: 'admin' } : { user: req.user._id };
    const notification = await Notification.findOneAndDelete({ _id: req.params.id, ...scope });
    if (!notification) return res.status(404).json({ message: 'Notification not found.' });
    res.json({ success: true });
  } catch (error) { next(error); }
});

app.get('/api/settings', async (_req, res, next) => { try { res.json({ settings: await settings() }); } catch (error) { next(error); } });
app.patch('/api/settings', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const allowed = ['isOpen', 'openingTime', 'closingTime', 'announcement', 'expressEnabled', 'serviceFee'];
    const update = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
    const config = await Setting.findOneAndUpdate({ key: 'canteen' }, { $set: update, $setOnInsert: { key: 'canteen' } }, { upsert: true, new: true, runValidators: true });
    res.json({ settings: config });
  } catch (error) { next(error); }
});

app.get('/api/admin/analytics', requireAuth, requireRole('admin'), async (_req, res, next) => {
  try {
    const today = dayKey();
    const start = new Date(); start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0);
    const all = await Order.find({ createdAt: { $gte: start }, status: { $ne: 'cancelled' } }).lean();
    const todayOrders = all.filter(o => o.dayKey === today);
    const paidToday = todayOrders.filter(o => o.status === 'completed');
    const prepDurations = todayOrders.map(order => {
      const started = order.statusHistory.find(entry => entry.status === 'preparing')?.at;
      const ready = order.statusHistory.find(entry => entry.status === 'ready')?.at;
      return started && ready && ready > started ? (new Date(ready) - new Date(started)) / 60000 : null;
    }).filter(value => value !== null);
    const gross = orders => orders.filter(order => order.status === 'completed').reduce((sum, order) => sum + order.total, 0);
    const weekly = Array.from({ length: 7 }, (_, index) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - index));
      const key = dayKey(d);
      const matches = all.filter(o => o.dayKey === key);
      return { label: new Intl.DateTimeFormat('en', { weekday: 'short', timeZone: tz }).format(d), date: key, revenue: gross(matches), orders: matches.length };
    });
    const top = new Map(); const hours = Array.from({ length: 12 }, (_, i) => ({ label: `${String(i + 8).padStart(2, '0')}:00`, orders: 0 }));
    for (const order of all) {
      const hour = Number(new Intl.DateTimeFormat('en-US', { hour: '2-digit', hourCycle: 'h23', timeZone: tz }).format(new Date(order.createdAt)));
      if (hours[hour - 8]) hours[hour - 8].orders++;
    }
    for (const order of all.filter(order => order.status === 'completed')) {
      for (const line of order.items) { const entry = top.get(line.name) || { name: line.name, sold: 0, revenue: 0 }; entry.sold += line.quantity; entry.revenue += line.quantity * line.unitPrice; top.set(line.name, entry); }
    }
    const statusCounts = await Order.aggregate([{ $match: { dayKey: today } }, { $group: { _id: '$status', count: { $sum: 1 } } }]);
    const active = await Order.countDocuments({ dayKey: today, status: { $in: ['placed', 'confirmed', 'preparing', 'ready', 'called'] } });
    res.json({ today: { revenue: gross(paidToday), orders: todayOrders.length, active, avgOrder: paidToday.length ? Math.round(gross(paidToday) / paidToday.length) : 0, avgPrepMinutes: prepDurations.length ? Math.round(prepDurations.reduce((sum, value) => sum + value, 0) / prepDurations.length) : null, completed: paidToday.length }, weekly, peakHours: hours, topItems: [...top.values()].sort((a,b) => b.sold-a.sold).slice(0, 6), statusCounts: Object.fromEntries(statusCounts.map(x => [x._id, x.count])) });
  } catch (error) { next(error); }
});

app.get('/api/admin/students', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const students = await User.find({ role: 'student', ...(req.query.q ? { $or: [{ name: new RegExp(String(req.query.q), 'i') }, { studentId: new RegExp(String(req.query.q), 'i') }, { email: new RegExp(String(req.query.q), 'i') }] } : {}) }).select('name email studentId phone createdAt').sort({ createdAt: -1 }).limit(100).lean();
    const stats = await Order.aggregate([{ $group: { _id: '$user', orders: { $sum: { $cond: [{ $ne: ['$status', 'cancelled'] }, 1, 0] } }, spend: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$total', 0] } } } }]);
    const byId = new Map(stats.map(x => [String(x._id), x]));
    res.json({ students: students.map(s => ({ ...s, ...byId.get(String(s._id)), orders: byId.get(String(s._id))?.orders || 0, spend: byId.get(String(s._id))?.spend || 0 })) });
  } catch (error) { next(error); }
});

app.get('/api/promotions', async (_req, res, next) => { try { res.json({ promotions: await Promotion.find().sort({ createdAt: -1 }).lean() }); } catch (error) { next(error); } });
app.post('/api/promotions', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    if (!req.body.title?.trim() || !req.body.code?.trim()) return res.status(400).json({ message: 'Promotion name and code are required.' });
    const promo = await Promotion.create({ ...req.body, title: req.body.title.trim(), code: req.body.code.trim().toUpperCase(), discountPercent: Number(req.body.discountPercent || 10) });
    res.status(201).json({ promotion: promo });
  } catch (error) { next(error); }
});
app.patch('/api/promotions/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try { const promo = await Promotion.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }); if (!promo) return res.status(404).json({ message: 'Promotion not found.' }); res.json({ promotion: promo }); }
  catch (error) { next(error); }
});
app.delete('/api/promotions/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try { const result = await Promotion.findByIdAndDelete(req.params.id); if (!result) return res.status(404).json({ message: 'Promotion not found.' }); res.json({ success: true }); } catch (error) { next(error); }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  if (error.code === 11000) return res.status(409).json({ message: 'That value is already in use.' });
  if (error.name === 'ValidationError' || error.name === 'CastError') return res.status(400).json({ message: error.message });
  res.status(500).json({ message: 'Something went wrong on our side. Please try again.' });
});

if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required. Copy backend/.env.example to backend/.env and set a secret.');
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/campus_bite')
  .then(() => app.listen(port, () => console.log(`Campus Bite API ready on http://localhost:${port}`)))
  .catch(error => { console.error('Could not connect to MongoDB:', error.message); process.exit(1); });
