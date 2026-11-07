/**
 * MCP Tools — Log access (included in query tool)
 */

const { z } = require('zod');
const logger = require('../../utils/logger');

// ─── Schema ──────────────────────────────────────────────────────────────────

const queryLogsSchema = z.object({
    level: z.enum(['error', 'warn', 'info', 'debug', 'all']).default('all'),
    limit: z.number().int().min(1).max(500).default(100),
    filter: z.string().optional().describe('Filter logs by message substring'),
});

// ─── Handler ─────────────────────────────────────────────────────────────────

async function queryLogs(args) {
    const parsed = queryLogsSchema.parse(args);
    let logs = logger.getRecentLogs();

    if (parsed.level !== 'all') {
        logs = logs.filter(l => l.level === parsed.level);
    }

    if (parsed.filter) {
        const f = parsed.filter.toLowerCase();
        logs = logs.filter(l => l.message && l.message.toLowerCase().includes(f));
    }

    // Return newest first, limited
    const result = logs.slice(-parsed.limit).reverse();

    return { logs: result, total: logs.length };
}

module.exports = {
    queryLogs,
    schemas: { queryLogs: queryLogsSchema },
};
