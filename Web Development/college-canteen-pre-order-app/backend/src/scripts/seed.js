import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { FoodItem, Notification, Order, Promotion, Setting, TokenCounter, User } from '../models/index.js';

const photo = (id, w = 900) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=82`;
const menu = [
  { name: 'Masala dosa', description: 'Crisp golden dosa with a gently spiced potato masala, coconut chutney and sambar.', price: 85, category: 'Breakfast', image: photo('photo-1668236543090-82eba5ee5976'), veg: true, prepTime: 12, rating: 4.9, popularity: 182, featured: true, ingredients: ['Rice & lentil batter', 'Potato masala', 'Coconut chutney'], customizations: ['Extra chutney', 'Extra masala'], keywords: ['crispy', 'south indian', 'dosa'] },
  { name: 'Idli sambar', description: 'Three soft, cloud-like idlis served with warm sambar and house coconut chutney.', price: 55, category: 'Breakfast', image: photo('photo-1589301760014-d929f3979dbc'), veg: true, prepTime: 7, rating: 4.7, popularity: 138, featured: true, ingredients: ['Steamed rice cake', 'Sambar', 'Coconut chutney'], customizations: ['Extra sambar'], keywords: ['south indian', 'steamed'] },
  { name: 'Paneer tikka wrap', description: 'Smoky tandoori paneer, crunchy greens, mint yogurt and pickled onion in a toasted wrap.', price: 125, category: 'Fast Food', image: photo('photo-1626700051175-6818013e1d4f'), veg: true, prepTime: 11, rating: 4.8, popularity: 156, featured: true, ingredients: ['Paneer', 'Mint yogurt', 'Lettuce', 'Whole wheat wrap'], customizations: ['Extra paneer', 'No onion'], keywords: ['wrap', 'lunch', 'paneer'] },
  { name: 'Campus chicken bowl', description: 'Juicy pepper chicken, fragrant rice, fresh slaw and a bright coriander-lime drizzle.', price: 165, category: 'Meals', image: photo('photo-1547592180-85f173990554'), veg: false, prepTime: 18, rating: 4.8, popularity: 121, featured: true, ingredients: ['Chicken', 'Basmati rice', 'Seasonal slaw'], customizations: ['Extra chicken', 'Spice on the side'], keywords: ['rice', 'protein', 'lunch'] },
  { name: 'Chilli garlic noodles', description: 'Wok-tossed noodles with crisp vegetables, garlic and a glossy chilli sauce.', price: 115, category: 'Meals', image: photo('photo-1569718212165-3a8278d5f624'), veg: true, prepTime: 14, rating: 4.6, popularity: 99, featured: false, ingredients: ['Noodles', 'Bell pepper', 'Garlic', 'Scallion'], customizations: ['Add egg', 'Extra spicy'], keywords: ['noodles', 'wok', 'spicy'] },
  { name: 'Classic veg burger', description: 'Crispy potato and veggie patty, sharp cheddar, tomato and our tangy house sauce.', price: 105, category: 'Fast Food', image: photo('photo-1568901346375-23c9450c58cd'), veg: true, prepTime: 13, rating: 4.5, popularity: 94, featured: false, ingredients: ['Veg patty', 'Cheddar', 'Lettuce', 'House sauce'], customizations: ['Add cheese', 'No onion'], keywords: ['burger', 'snack'] },
  { name: 'Peri peri fries', description: 'Golden, crunchy fries tossed with our smoky peri peri blend.', price: 70, category: 'Snacks', image: photo('photo-1573080496219-bb080dd4f877'), veg: true, prepTime: 8, rating: 4.6, popularity: 141, featured: false, ingredients: ['Potato', 'Peri peri spice'], customizations: ['Classic salt', 'Extra spicy'], keywords: ['fries', 'potato', 'crispy'] },
  { name: 'Filter coffee', description: 'Strong South Indian filter coffee, slow brewed and served with silky steamed milk.', price: 35, category: 'Beverages', image: photo('photo-1509042239860-f550ce710b93'), veg: true, prepTime: 4, rating: 4.9, popularity: 207, featured: false, ingredients: ['Filter coffee', 'Milk'], customizations: ['Less sugar', 'No sugar'], keywords: ['coffee', 'caffeine', 'hot'] },
  { name: 'Mango lassi', description: 'A chilled, creamy yogurt lassi blended with ripe mango and a hint of cardamom.', price: 65, category: 'Beverages', image: photo('photo-1571167765156-4ad62391e7b5'), veg: true, prepTime: 5, rating: 4.7, popularity: 89, featured: false, ingredients: ['Mango', 'Yogurt', 'Cardamom'], customizations: ['Less sweet'], keywords: ['mango', 'drink', 'cold'] },
  { name: 'Samosa pair', description: 'Flaky, golden pastry filled with spiced potato and peas. Served with tamarind chutney.', price: 40, category: 'Snacks', image: photo('photo-1601050690597-df0568f70950'), veg: true, prepTime: 6, rating: 4.6, popularity: 164, featured: false, ingredients: ['Potato', 'Peas', 'Pastry', 'Tamarind chutney'], customizations: [], keywords: ['samosa', 'tea time', 'crispy'] },
  { name: 'Brownie & ice cream', description: 'Warm dark chocolate brownie with a scoop of vanilla bean ice cream.', price: 95, category: 'Desserts', image: photo('photo-1606313564200-e75d5e30476c'), veg: true, prepTime: 6, rating: 4.8, popularity: 83, featured: true, ingredients: ['Dark chocolate', 'Vanilla ice cream'], customizations: ['No ice cream'], keywords: ['chocolate', 'sweet'] },
  { name: 'The study combo', description: 'A classic veg burger, peri peri fries and a chilled lemonade. Good focus fuel.', price: 179, category: 'Combos', image: photo('photo-1550547660-d9450f859349'), veg: true, prepTime: 16, rating: 4.7, popularity: 188, featured: true, ingredients: ['Veg burger', 'Peri peri fries', 'Lemonade'], customizations: ['Classic fries', 'Extra spicy fries'], keywords: ['combo', 'deal', 'lunch'] },
  { name: 'Garden grain bowl', description: 'Brown rice, roasted seasonal vegetables, cucumber and lemon tahini.', price: 145, category: 'Healthy Food', image: photo('photo-1512621776951-a57141f2eefd'), veg: true, prepTime: 12, rating: 4.6, popularity: 51, featured: false, ingredients: ['Brown rice', 'Seasonal vegetables', 'Tahini'], customizations: ['Add paneer'], keywords: ['healthy', 'salad', 'vegan'] },
  { name: 'Masala chai', description: 'Campus-favourite chai simmered with ginger, cardamom and a little nostalgia.', price: 25, category: 'Beverages', image: photo('photo-1571934811356-5cc061b6821f'), veg: true, prepTime: 4, rating: 4.8, popularity: 233, featured: false, ingredients: ['Tea', 'Milk', 'Ginger', 'Cardamom'], customizations: ['Less sugar', 'No sugar'], keywords: ['tea', 'chai', 'hot'] },
  { name: 'Egg bhurji toast', description: 'Soft, spiced scrambled eggs with toasted sourdough and fresh coriander.', price: 90, category: 'Breakfast', image: photo('photo-1525351484163-7529414344d8'), veg: false, prepTime: 10, rating: 4.5, popularity: 72, featured: false, ingredients: ['Eggs', 'Sourdough', 'Tomato', 'Coriander'], customizations: ['Extra spicy'], keywords: ['egg', 'toast', 'protein'] }
];

const dayKey = date => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/campus_bite');
  const admin = await User.findOneAndUpdate({ email: 'admin@campusbite.edu' }, { $set: { name: 'Canteen Manager', studentId: undefined, role: 'admin', phone: '+91 98765 43210', passwordHash: await bcrypt.hash('admin123', 12) } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  const student = await User.findOneAndUpdate({ email: 'student@campusbite.edu' }, { $set: { name: 'Aarav Mehta', studentId: 'CB24CS108', role: 'student', phone: '+91 98765 01234', passwordHash: await bcrypt.hash('password123', 12) } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  await User.findOneAndUpdate({ email: 'isha@campusbite.edu' }, { $setOnInsert: { name: 'Isha Nair', studentId: 'CB24EC042', role: 'student', phone: '', passwordHash: await bcrypt.hash('password123', 12) } }, { upsert: true, new: true });
  await User.findOneAndUpdate({ email: 'rohan@campusbite.edu' }, { $setOnInsert: { name: 'Rohan Das', studentId: 'CB23ME019', role: 'student', phone: '', passwordHash: await bcrypt.hash('password123', 12) } }, { upsert: true, new: true });
  const foods = [];
  for (const item of menu) foods.push(await FoodItem.findOneAndUpdate({ name: item.name }, { $set: { ...item, available: true, stock: 30 } }, { upsert: true, new: true, setDefaultsOnInsert: true }));
  await Setting.findOneAndUpdate({ key: 'canteen' }, { $setOnInsert: { isOpen: true, openingTime: '08:00', closingTime: '18:00', announcement: 'Fresh picks, faster pickups. Order ahead and skip the line.', expressEnabled: true, serviceFee: 0 } }, { upsert: true, new: true });
  await Promotion.findOneAndUpdate({ code: 'FRESH10' }, { $setOnInsert: { title: 'A little something for lunch', code: 'FRESH10', description: 'Take 10% off your first order over ₹150.', discountPercent: 10, active: true } }, { upsert: true, new: true });
  await Promotion.findOneAndUpdate({ code: 'CAMPUS15' }, { $setOnInsert: { title: 'Campus combo perk', code: 'CAMPUS15', description: 'Save 15% on your next study break.', discountPercent: 15, active: true } }, { upsert: true, new: true });

  if (await Order.countDocuments() === 0) {
    const now = new Date();
    const demoUsers = [student, await User.findOne({ email: 'isha@campusbite.edu' }), await User.findOne({ email: 'rohan@campusbite.edu' })];
    const sample = [
      { day: 0, user: 0, status: 'preparing', idx: 0, qty: 1, hour: 9 },
      { day: 0, user: 1, status: 'ready', idx: 2, qty: 1, hour: 10 },
      { day: 0, user: 2, status: 'confirmed', idx: 1, qty: 2, hour: 10 },
      { day: 0, user: 0, status: 'placed', idx: 6, qty: 1, hour: 11 },
      { day: 0, user: 1, status: 'called', idx: 7, qty: 2, hour: 11 },
      { day: 0, user: 2, status: 'completed', idx: 11, qty: 1, hour: 8 },
      { day: 0, user: 0, status: 'completed', idx: 0, qty: 1, hour: 8 },
      { day: 1, user: 1, status: 'completed', idx: 3, qty: 1, hour: 12 },
      { day: 1, user: 2, status: 'completed', idx: 10, qty: 2, hour: 13 },
      { day: 2, user: 0, status: 'completed', idx: 4, qty: 1, hour: 12 },
      { day: 2, user: 1, status: 'completed', idx: 12, qty: 2, hour: 9 },
      { day: 3, user: 2, status: 'completed', idx: 5, qty: 1, hour: 14 },
      { day: 4, user: 0, status: 'completed', idx: 9, qty: 2, hour: 11 },
      { day: 5, user: 1, status: 'completed', idx: 8, qty: 1, hour: 13 },
      { day: 6, user: 2, status: 'completed', idx: 11, qty: 2, hour: 10 }
    ];
    const counters = new Map();
    const orders = [];
    for (const [index, s] of sample.entries()) {
      const day = new Date(now.getTime() - s.day * 86400_000);
      const key = dayKey(day); const sequence = (counters.get(key) || 0) + 1; counters.set(key, sequence);
      const user = demoUsers[s.user]; const food = foods[s.idx];
      const created = new Date(day); created.setHours(s.hour, 0, 0, 0);
      const pickup = new Date(created.getTime() + 25 * 60000);
      const subtotal = food.price * s.qty;
      const history = [{ status: 'placed', at: created, by: user.name }];
      if (s.status !== 'placed') history.push({ status: s.status, at: new Date(created.getTime() + 5 * 60000), by: 'Canteen Manager' });
      orders.push({ token: `B-${String(sequence).padStart(3, '0')}`, dayKey: key, user: user._id, studentName: user.name, studentId: user.studentId, items: [{ foodId: food._id, name: food.name, image: food.image, unitPrice: food.price, quantity: s.qty }], subtotal, total: subtotal, serviceFee: 0, pickupAt: pickup, pickupLabel: '12:30 PM', orderType: 'regular', status: s.status, statusHistory: history, createdAt: created, updatedAt: created });
    }
    await Order.insertMany(orders);
    for (const [key, sequence] of counters) await TokenCounter.findOneAndUpdate({ dayKey: key }, { $set: { sequence } }, { upsert: true });
    await Notification.insertMany([
      { user: student._id, role: 'student', title: 'Order in the kitchen', body: 'Your order B-001 is being prepared. Pickup is coming up!', order: orders[0]._id, createdAt: new Date(now.getTime() - 15 * 60000) },
      { user: student._id, role: 'student', title: 'Welcome to Campus Bite', body: 'Skip the queue next time: order ahead and follow your token right here.', createdAt: new Date(now.getTime() - 86400_000) },
      { role: 'admin', title: 'Ready for pickup', body: 'Token B-002 is ready at the counter.', order: orders[1]._id, createdAt: new Date(now.getTime() - 10 * 60000) },
      { role: 'admin', title: 'New order in the queue', body: 'Aarav Mehta placed B-004 · ₹70.', order: orders[3]._id, createdAt: new Date(now.getTime() - 5 * 60000) }
    ]);
    console.log('Seeded realistic demo orders and notifications.');
  }
  console.log('Campus Bite seed complete.');
  console.log('Student: student@campusbite.edu / password123');
  console.log('Staff:   admin@campusbite.edu / admin123');
  await mongoose.disconnect();
}

seed().catch(error => { console.error(error); process.exit(1); });
