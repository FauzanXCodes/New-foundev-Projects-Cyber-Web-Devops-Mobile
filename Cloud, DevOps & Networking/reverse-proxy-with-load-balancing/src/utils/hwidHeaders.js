/**
 * Extract HWID-related headers from subscription requests (Happ / v2RayTun style).
 */

const HWID_MIN = 4;
const HWID_MAX = 128;
const META_MAX = 200;

/**
 * @param {import('express').Request} req
 * @returns {{ hwid: string, platform: string, osVersion: string, deviceModel: string, userAgent: string } | null}
 */
function extractHwidHeaders(req) {
    const raw = req.headers['x-hwid'];
    const hwid = raw != null ? String(raw).trim() : '';
    if (!hwid || hwid.length < HWID_MIN || hwid.length > HWID_MAX) {
        return null;
    }

    const clip = (v) => {
        const s = v != null ? String(v).trim() : '';
        return s.length > META_MAX ? s.slice(0, META_MAX) : s;
    };

    return {
        hwid,
        platform: clip(req.headers['x-device-os']),
        osVersion: clip(req.headers['x-ver-os']),
        deviceModel: clip(req.headers['x-device-model']),
        userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : '',
    };
}

module.exports = {
    extractHwidHeaders,
    HWID_MIN,
    HWID_MAX,
};
