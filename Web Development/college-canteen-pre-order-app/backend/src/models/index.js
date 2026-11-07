import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const userSchema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  studentId: { type: String, unique: true, sparse: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['student', 'admin'], default: 'student' },
  phone: { type: String, default: '' },
  favorites: [{ type: Schema.Types.ObjectId, ref: 'FoodItem' }],
  createdAt: { type: Date, default: Date.now }
});

const foodSchema = new Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  price: { type: Number, required: true, min: 0 },
  category: { type: String, required: true, index: true },
  image: { type: String, default: '' },
  veg: { type: Boolean, default: true },
  available: { type: Boolean, default: true, index: true },
  stock: { type: Number, default: 50, min: 0 },
  prepTime: { type: Number, default: 10 },
  rating: { type: Number, default: 4.5 },
  ratingCount: { type: Number, default: 0 },
  popularity: { type: Number, default: 0 },
  featured: { type: Boolean, default: false },
  ingredients: [{ type: String }],
  customizations: [{ type: String }],
  keywords: [{ type: String }]
}, { timestamps: true });
foodSchema.index({ name: 'text', description: 'text', category: 'text', keywords: 'text' });

const orderItemSchema = new Schema({
  foodId: { type: Schema.Types.ObjectId, ref: 'FoodItem', required: true },
  name: { type: String, required: true },
  image: String,
  unitPrice: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
  customization: { type: String, default: '' }
}, { _id: false });

const orderSchema = new Schema({
  token: { type: String, required: true, unique: true },
  dayKey: { type: String, required: true, index: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  studentName: String,
  studentId: String,
  items: { type: [orderItemSchema], required: true },
  subtotal: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  promoCode: { type: String, default: '' },
  serviceFee: { type: Number, default: 0 },
  total: { type: Number, required: true },
  pickupAt: { type: Date, required: true },
  pickupLabel: String,
  orderType: { type: String, enum: ['regular', 'express'], default: 'regular' },
  status: { type: String, enum: ['placed', 'confirmed', 'preparing', 'ready', 'called', 'completed', 'cancelled'], default: 'placed', index: true },
  note: { type: String, default: '' },
  idempotencyKey: { type: String, default: undefined },
  statusHistory: [{ status: String, at: { type: Date, default: Date.now }, by: String }]
}, { timestamps: true });
orderSchema.index({ dayKey: 1, token: 1 });
orderSchema.index({ user: 1, idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } });

const counterSchema = new Schema({ dayKey: { type: String, unique: true }, sequence: { type: Number, default: 0 } });
const notificationSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  role: { type: String, enum: ['student', 'admin'], default: 'student' },
  title: String,
  body: String,
  order: { type: Schema.Types.ObjectId, ref: 'Order' },
  readAt: Date
}, { timestamps: true });
const promotionSchema = new Schema({
  title: { type: String, required: true },
  code: { type: String, required: true, unique: true, uppercase: true },
  description: String,
  discountPercent: { type: Number, min: 1, max: 100, default: 10 },
  active: { type: Boolean, default: true },
  startsAt: Date,
  endsAt: Date
}, { timestamps: true });
const settingSchema = new Schema({
  key: { type: String, unique: true },
  isOpen: { type: Boolean, default: true },
  openingTime: { type: String, default: '08:00' },
  closingTime: { type: String, default: '18:00' },
  announcement: { type: String, default: 'Fresh picks, faster pickups. Order ahead and skip the line.' },
  expressEnabled: { type: Boolean, default: true },
  serviceFee: { type: Number, default: 0 }
}, { timestamps: true });

export const User = model('User', userSchema);
export const FoodItem = model('FoodItem', foodSchema);
export const Order = model('Order', orderSchema);
export const TokenCounter = model('TokenCounter', counterSchema);
export const Notification = model('Notification', notificationSchema);
export const Promotion = model('Promotion', promotionSchema);
export const Setting = model('Setting', settingSchema);
