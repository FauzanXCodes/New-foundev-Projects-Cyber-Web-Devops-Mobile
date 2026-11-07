/**
 * HWID-based devices registered per subscription user (Happ / v2RayTun / etc.)
 */

const mongoose = require('mongoose');

const userDeviceSchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true },
    hwid: { type: String, required: true },
    platform: { type: String, default: '' },
    osVersion: { type: String, default: '' },
    deviceModel: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now, index: true },
}, { timestamps: false });

userDeviceSchema.index({ userId: 1, hwid: 1 }, { unique: true });
userDeviceSchema.index({ userId: 1, lastSeenAt: -1 });

module.exports = mongoose.model('UserDevice', userDeviceSchema);
