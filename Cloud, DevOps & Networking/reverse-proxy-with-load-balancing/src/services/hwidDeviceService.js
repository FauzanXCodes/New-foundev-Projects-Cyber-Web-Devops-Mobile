/**
 * HWID device registry: MongoDB persistence + Redis count cache + upsert throttle.
 */

const UserDevice = require('../models/userDeviceModel');
const cache = require('./cacheService');
const logger = require('../utils/logger');

const COUNT_PREFIX = 'hwidCount:';
const UPSERT_PREFIX = 'hwidUpsert:';
const COUNT_TTL_SEC = 60;

/** @type {{ upsertCooldownSec: number }} */
const runtime = {
    upsertCooldownSec: 60,
};

/**
 * Called from reloadSettings() with panel document.
 * @param {object} settings
 */
function updateFromSettings(settings) {
    const perMin = settings?.subscription?.happ?.hwid?.upsertRateLimitPerMinute;
    const n = parseInt(perMin, 10);
    // Cooldown derived from per-minute cap: at least 1s between heavy upserts per device
    if (Number.isFinite(n) && n > 0) {
        runtime.upsertCooldownSec = Math.min(3600, Math.max(5, Math.floor(60 / n)));
    } else {
        runtime.upsertCooldownSec = 60;
    }
}

/**
 * Effective HWID policy for this request.
 * @param {object} user HyUser doc or plain object
 * @param {object} settings panel settings plain object
 * @returns {'off'|'permissive'|'strict'}
 */
function resolveMode(user, settings) {
    const g = settings?.subscription?.happ?.hwid?.mode || 'off';
    const u = user?.hwidMode || 'inherit';
    if (u === 'off') return 'off';
    if (u === 'strict') return 'strict';
    return g === 'permissive' || g === 'strict' ? g : 'off';
}

/**
 * Same logic as HTTP auth: maxDevices with group fallback (-1 unlimited, 0 = no cap from groups).
 * @param {object} user
 * @returns {number}
 */
function effectiveDeviceLimit(user) {
    let maxDevices = user.maxDevices;

    if (maxDevices === 0 && user.groups?.length > 0) {
        const groupLimits = user.groups
            .filter(g => g && g.maxDevices > 0)
            .map(g => g.maxDevices);
        if (groupLimits.length > 0) {
            maxDevices = Math.min(...groupLimits);
        }
    }
    return maxDevices;
}

function countKey(userId) {
    return `${COUNT_PREFIX}${userId}`;
}

async function invalidateCountCache(userId) {
    try {
        if (cache.isConnected() && cache.redis) {
            await cache.redis.del(countKey(userId));
        }
    } catch (e) {
        logger.warn(`[HwidDevice] Count cache invalidate: ${e.message}`);
    }
}

/**
 * @param {string} userId
 * @returns {Promise<number>}
 */
async function getDeviceCount(userId) {
    try {
        if (cache.isConnected() && cache.redis) {
            const raw = await cache.redis.get(countKey(userId));
            if (raw != null && raw !== '') {
                return parseInt(raw, 10) || 0;
            }
        }
    } catch (e) {
        logger.warn(`[HwidDevice] Count cache read: ${e.message}`);
    }

    const n = await UserDevice.countDocuments({ userId });

    try {
        if (cache.isConnected() && cache.redis) {
            await cache.redis.setex(countKey(userId), COUNT_TTL_SEC, String(n));
        }
    } catch (e) {
        logger.warn(`[HwidDevice] Count cache write: ${e.message}`);
    }

    return n;
}

/**
 * @param {object} params
 * @param {string} params.userId
 * @param {{ hwid: string, platform: string, osVersion: string, deviceModel: string, userAgent: string }} params.headers
 * @param {number} params.limit
 * @param {boolean} params.enforce
 * @returns {Promise<{ allowed: boolean, exceeded?: boolean, exists?: boolean, isNew?: boolean, rateLimited?: boolean }>}
 */
async function checkAndUpsert({ userId, headers, limit, enforce }) {
    const { hwid } = headers;
    const patch = {
        platform: headers.platform,
        osVersion: headers.osVersion,
        deviceModel: headers.deviceModel,
        userAgent: headers.userAgent,
        lastSeenAt: new Date(),
    };

    const existing = await UserDevice.findOne({ userId, hwid }).select('_id').lean();
    if (existing) {
        await UserDevice.updateOne({ _id: existing._id }, { $set: patch });
        return { allowed: true, exists: true };
    }

    const upsertKey = `${UPSERT_PREFIX}${userId}:${hwid}`;
    try {
        if (cache.isConnected() && cache.redis) {
            const nx = await cache.redis.set(upsertKey, '1', 'EX', runtime.upsertCooldownSec, 'NX');
            if (nx !== 'OK') {
                return { allowed: true, exists: false, rateLimited: true };
            }
        }
    } catch (e) {
        logger.warn(`[HwidDevice] Upsert throttle: ${e.message}`);
    }

    const n = await UserDevice.countDocuments({ userId });
    if (enforce && n >= limit) {
        return { allowed: false, exceeded: true };
    }

    try {
        await UserDevice.create({
            userId,
            hwid,
            ...patch,
            firstSeenAt: new Date(),
        });
    } catch (e) {
        if (e && e.code === 11000) {
            await UserDevice.updateOne({ userId, hwid }, { $set: patch });
            return { allowed: true, exists: true };
        }
        throw e;
    }

    const n2 = await UserDevice.countDocuments({ userId });
    if (enforce && n2 > limit) {
        await UserDevice.deleteOne({ userId, hwid });
        await invalidateCountCache(userId);
        return { allowed: false, exceeded: true };
    }

    await invalidateCountCache(userId);
    return { allowed: true, exists: false, isNew: true };
}

/**
 * @param {number} inactiveDays
 * @returns {Promise<number>} deleted count
 */
async function cleanupStale(inactiveDays) {
    const d = Math.max(7, Math.min(3650, inactiveDays || 90));
    const cutoff = new Date(Date.now() - d * 864e5);
    const r = await UserDevice.deleteMany({ lastSeenAt: { $lt: cutoff } });
    const deleted = r.deletedCount || 0;
    if (deleted > 0) {
        logger.info(`[HwidDevice] Cleanup removed ${deleted} stale device rows (older than ${d}d)`);
        // Count cache entries expire via TTL; no Redis KEYS scan
    }
    return deleted;
}

/**
 * @param {string} userId
 * @returns {Promise<object[]>}
 */
async function listDevices(userId) {
    return UserDevice.find({ userId })
        .sort({ lastSeenAt: -1 })
        .lean();
}

/**
 * @param {string} userId
 * @returns {Promise<{ userId: string, count: number }[]>}
 */
async function topUsersByDeviceCount(limit = 10) {
    const lim = Math.max(1, Math.min(50, limit));
    const agg = await UserDevice.aggregate([
        { $group: { _id: '$userId', n: { $sum: 1 } } },
        { $sort: { n: -1 } },
        { $limit: lim },
    ]);
    return agg.map(row => ({ userId: row._id, count: row.n }));
}

module.exports = {
    updateFromSettings,
    resolveMode,
    effectiveDeviceLimit,
    getDeviceCount,
    checkAndUpsert,
    cleanupStale,
    listDevices,
    topUsersByDeviceCount,
    invalidateCountCache,
};
