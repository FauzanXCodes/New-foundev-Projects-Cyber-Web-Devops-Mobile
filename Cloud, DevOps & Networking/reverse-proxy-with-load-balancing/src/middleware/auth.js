/**
 * Auth middleware
 *
 * Supports two authentication methods (in order):
 * 1. API Key via X-API-Key header or Authorization: Bearer <key>
 * 2. Session cookie (existing behaviour)
 *
 * Also exports requireScope(scope) for granular permission checks.
 */

const logger = require('../utils/logger');
const cache = require('../services/cacheService');

/**
 * Extract API key string from request headers.
 * Accepts: X-API-Key: <key>  OR  Authorization: Bearer <key>
 */
function extractApiKey(req) {
    const xApiKey = req.headers['x-api-key'];
    if (xApiKey) return xApiKey.trim();

    const auth = req.headers['authorization'];
    if (auth && auth.toLowerCase().startsWith('bearer ')) {
        const key = auth.slice(7).trim();
        return key || null; // explicit null for empty "Bearer " headers
    }

    return null;
}

/**
 * Check if the client IP is allowed for this key.
 * Empty allowedIPs = allow all.
 */
function isIpAllowed(req, allowedIPs) {
    if (!allowedIPs || allowedIPs.length === 0) return true;

    const forwardedFor = req.headers['x-forwarded-for'];
    const clientIp = (forwardedFor
        ? forwardedFor.split(',')[0].trim()
        : (req.ip || '')
    ).replace(/^::ffff:/, '');

    return allowedIPs.includes(clientIp);
}

/**
 * Update lastUsedAt and lastUsedIP asynchronously (fire-and-forget).
 * Does not block the request.
 */
function touchApiKey(apiKey, req) {
    const forwardedFor = req.headers['x-forwarded-for'];
    const clientIp = (forwardedFor
        ? forwardedFor.split(',')[0].trim()
        : (req.ip || '')
    ).replace(/^::ffff:/, '');

    // Lazy-load to avoid circular deps at startup
    const ApiKey = require('../models/apiKeyModel');
    ApiKey.findByIdAndUpdate(apiKey._id, {
        lastUsedAt: new Date(),
        lastUsedIP: clientIp,
    }).catch(() => {});
}

/**
 * Main auth middleware.
 * Tries API key first, falls back to session.
 * Sets req.apiKey when authenticated via API key.
 */
async function requireAuth(req, res, next) {
    const rawKey = extractApiKey(req);

    if (rawKey) {
        // ── API Key path ──
        try {
            const ApiKey = require('../models/apiKeyModel');
            const apiKey = await ApiKey.findByKey(rawKey);

            if (!apiKey) {
                logger.warn(`[Auth] Invalid API key attempt from ${req.ip} on ${req.method} ${req.path}`);
                return res.status(401).json({ error: 'Invalid or expired API key' });
            }

            // IP allowlist check
            if (!isIpAllowed(req, apiKey.allowedIPs)) {
                logger.warn(`[Auth] API key ${apiKey.keyPrefix} rejected: IP ${req.ip} not in allowlist`);
                return res.status(403).json({ error: 'IP address not allowed for this API key' });
            }

            // Per-key rate limit
            const rl = await cache.checkApiKeyRateLimit(apiKey.keyPrefix, apiKey.rateLimit);
            if (!rl.allowed) {
                res.set('X-RateLimit-Limit', rl.limit);
                res.set('X-RateLimit-Remaining', 0);
                logger.warn(`[Auth] API key ${apiKey.keyPrefix} rate limited (${rl.count}/${rl.limit})`);
                return res.status(429).json({ error: 'Rate limit exceeded for this API key' });
            }

            res.set('X-RateLimit-Limit', rl.limit);
            res.set('X-RateLimit-Remaining', Math.max(0, rl.limit - rl.count));

            req.apiKey = apiKey;

            // Update usage stats without blocking
            touchApiKey(apiKey, req);

            return next();
        } catch (err) {
            logger.error(`[Auth] API key validation error: ${err.message}`);
            return res.status(500).json({ error: 'Authentication error' });
        }
    }

    // ── Session path (existing behaviour) ──
    if (!req.session || !req.session.authenticated) {
        logger.warn(`[Auth] Unauthorized request: ${req.method} ${req.path} (IP: ${req.ip})`);
        return res.status(401).json({ error: 'Authentication required' });
    }

    next();
}

/**
 * Scope-based permission check middleware.
 *
 * Admin sessions (req.session.authenticated) bypass scope checks — full access.
 * API key requests must have the specific scope in their key.scopes array.
 *
 * Usage: router.get('/users', requireAuth, requireScope('users:read'), handler)
 */
function requireScope(scope) {
    return (req, res, next) => {
        // Admin session = full access
        if (req.session && req.session.authenticated) return next();

        if (req.apiKey && req.apiKey.scopes && req.apiKey.scopes.includes(scope)) {
            return next();
        }

        logger.warn(`[Auth] API key ${req.apiKey?.keyPrefix || '?'} missing scope: ${scope}`);
        return res.status(403).json({
            error: 'Insufficient permissions',
            required: scope,
        });
    };
}

module.exports = requireAuth;
module.exports.requireScope = requireScope;
