/**
 * MCP Tools — System operations and health check
 * Tools: system_action, health_check
 */

const { z } = require('zod');
const cache = require('../../services/cacheService');
const backupService = require('../../services/backupService');
const logger = require('../../utils/logger');

// ─── Schemas ────────────────────────────────────────────────────────────────

const systemActionSchema = z.object({
    action: z.enum(['sync_all', 'clear_cache', 'backup', 'kick_user']),
    userId: z.string().optional().describe('Required for kick_user'),
});

const healthCheckSchema = z.object({});

// ─── Handlers ────────────────────────────────────────────────────────────────

async function systemAction(args, emit) {
    const parsed = systemActionSchema.parse(args);
    const { action, userId } = parsed;

    switch (action) {
        case 'sync_all': {
            const syncService = require('../../services/syncService');
            if (syncService.isSyncing) {
                return { error: 'Sync already in progress', code: 409 };
            }
            emit('progress', { message: 'Starting sync for all nodes...' });
            syncService.syncAllNodes().catch(err => {
                logger.error(`[MCP] Sync error: ${err.message}`);
            });
            return { success: true, message: 'Sync started for all nodes' };
        }

        case 'clear_cache': {
            emit('progress', { message: 'Clearing cache...' });
            await cache.flushAll();
            logger.info('[MCP] Cache cleared');
            return { success: true, message: 'Cache cleared' };
        }

        case 'backup': {
            emit('progress', { message: 'Creating database backup...' });
            const Settings = require('../../models/settingsModel');
            const settings = await Settings.get();
            const result = await backupService.createBackup(settings);
            logger.info(`[MCP] Backup created: ${result.filename}`);
            return {
                success: true,
                filename: result.filename,
                sizeMB: result.sizeMB,
                message: `Backup created: ${result.filename} (${result.sizeMB} MB)`,
            };
        }

        case 'kick_user': {
            if (!userId) throw new Error('userId is required for kick_user');
            const syncService = require('../../services/syncService');
            await syncService.kickUser(userId);
            await cache.clearDeviceIPs(userId);
            logger.info(`[MCP] Kicked user ${userId}`);
            return { success: true, message: `User '${userId}' kicked from all sessions` };
        }

        default:
            throw new Error(`Unknown action: ${action}`);
    }
}

async function healthCheck() {
    const cacheStats = await cache.getStats();
    const syncService = require('../../services/syncService');

    return {
        status: 'ok',
        uptime: process.uptime(),
        uptimeHuman: formatUptime(process.uptime()),
        lastSync: syncService.lastSyncTime,
        isSyncing: syncService.isSyncing,
        cache: cacheStats,
        memory: {
            heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
            rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + ' MB',
        },
    };
}

function formatUptime(seconds) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const parts = [];
    if (d) parts.push(`${d}d`);
    if (h) parts.push(`${h}h`);
    parts.push(`${m}m`);
    return parts.join(' ');
}

module.exports = {
    systemAction,
    healthCheck,
    schemas: {
        systemAction: systemActionSchema,
        healthCheck: healthCheckSchema,
    },
};
