/**
 * MCP Prompts — Pre-defined prompt templates for AI assistants.
 *
 * Prompts appear as slash-commands in Claude Desktop (e.g. /hysteria:audit_nodes).
 * Each prompt can accept arguments that get injected into the message template.
 */

const PROMPTS = [
    {
        name: 'panel_overview',
        description: 'Get a full overview of the panel: nodes, users, traffic, and system health. Use this as a starting point.',
        arguments: [],
        template: () => `You are managing a Hysteria/Xray VPN panel (C³ CELERITY).

Start by calling health_check to get system status, then query with resource="stats" for summary statistics, then query with resource="nodes" to see all nodes.

Present a structured overview:
1. System health (uptime, cache, sync status)
2. User statistics (total, enabled, disabled)
3. Node status (online/offline breakdown, per-node online users)
4. Any issues that need attention (offline nodes, errors)

Be concise and highlight anything that requires action.`,
    },

    {
        name: 'audit_nodes',
        description: 'Check all nodes for issues: offline nodes, errors, stale syncs. Suggests fixes.',
        arguments: [],
        template: () => `You are auditing VPN nodes on a Hysteria/Xray panel.

Steps:
1. Call query with resource="nodes" to get all nodes with their status
2. Call health_check for system-wide status
3. For any node with status="error" or status="offline", call query with resource="nodes", id=<nodeId>, includeUsers=false to get details including lastError

Analyze and report:
- Which nodes are offline or in error state
- What the last error messages say
- How long since last successful sync (lastSync field)
- How many users are affected (onlineUsers)

For each problematic node, suggest a specific action:
- If status="error" and it's a config issue → suggest manage_node with action="update_config"
- If it's been offline a long time → suggest manage_node with action="sync"
- If SSH is configured → offer to run execute_ssh to check the service status

Ask before taking any action.`,
    },

    {
        name: 'user_report',
        description: 'Detailed report for a specific user: traffic usage, nodes, subscription status, device activity.',
        arguments: [
            {
                name: 'userId',
                description: 'The user ID to report on',
                required: true,
            },
        ],
        template: ({ userId }) => `Generate a detailed report for VPN user "${userId}".

Steps:
1. Call query with resource="users", id="${userId}" to get full user data
2. Note their traffic usage (traffic.tx + traffic.rx vs trafficLimit)
3. Note expiry date, enabled status, max devices, groups, assigned nodes

Present the report:
- **Status**: enabled/disabled, expiry
- **Traffic**: used / limit (percentage), breakdown of upload vs download
- **Groups & Nodes**: which server groups and nodes they have access to
- **Subscription**: subscriptionToken presence

Flag any issues:
- Traffic near or over limit (>80%)
- Account expired or expiring within 7 days
- Account disabled

Ask if any action should be taken (extend, reset traffic, enable/disable).`,
    },

    {
        name: 'setup_new_node',
        description: 'Interactive guide to add and configure a new Hysteria or Xray node from scratch.',
        arguments: [
            {
                name: 'nodeType',
                description: 'Node type: "hysteria" or "xray" (default: hysteria)',
                required: false,
            },
        ],
        template: ({ nodeType = 'hysteria' }) => `You are helping set up a new ${nodeType} VPN node on C³ CELERITY panel.

Walk through these steps interactively, asking for missing info before each step:

**Step 1 — Gather info**
Ask the user for:
- Server IP address
- Domain name (optional, for TLS)
- Country/location (for display)
- SSH credentials (username, password or private key)
- Which server groups to assign

**Step 2 — Create the node**
Use manage_node with action="create" and the collected data.

**Step 3 — Auto-setup via SSH**
Ask if they want to run automatic setup (installs ${nodeType}, configures firewall, starts service).
If yes, use manage_node with action="setup" on the new node ID.
Stream the setup logs and explain each step.

**Step 4 — Verify**
After setup, call query with resource="nodes", id=<newNodeId> to check status.
If status is "online" — success!
If not — run execute_ssh to check: systemctl status ${nodeType === 'xray' ? 'xray' : 'hysteria-server'}

**Step 5 — Assign users**
Ask which users or groups should get access to this node.

Guide the user through each step, explaining what you're doing and why.`,
    },

    {
        name: 'troubleshoot_node',
        description: 'Diagnose a problematic node via SSH: check service status, logs, config, network.',
        arguments: [
            {
                name: 'nodeId',
                description: 'MongoDB _id of the node to troubleshoot',
                required: true,
            },
        ],
        template: ({ nodeId }) => `Troubleshoot VPN node with ID "${nodeId}".

Run these diagnostic checks in order using execute_ssh (confirm each command with the user first):

1. **Get node info** — call query with resource="nodes", id="${nodeId}" to see current status and lastError

2. **Service status**
   \`systemctl status hysteria-server 2>/dev/null || systemctl status xray 2>/dev/null\`

3. **Recent service logs** (last 50 lines)
   \`journalctl -u hysteria-server -n 50 --no-pager 2>/dev/null || journalctl -u xray -n 50 --no-pager\`

4. **Config file existence**
   \`ls -la /etc/hysteria/ 2>/dev/null || ls -la /usr/local/etc/xray/\`

5. **Port listening check**
   \`ss -tlunp | grep -E '443|8443|9999'\`

6. **Disk space**
   \`df -h /\`

7. **Memory**
   \`free -h\`

After each command, analyze the output and explain what it means.
If you find the issue, suggest a fix and ask permission before executing it.
Common fixes:
- Service not running → manage_node with action="setup" (restartService only)
- Config missing → manage_node with action="update_config"
- Port conflict → check what's using the port`,
    },

    {
        name: 'manage_expired_users',
        description: 'Find users with expired or near-expiry subscriptions and take bulk action.',
        arguments: [
            {
                name: 'daysAhead',
                description: 'Flag users expiring within N days (default: 7)',
                required: false,
            },
        ],
        template: ({ daysAhead = '7' }) => `Find and manage users with expired or soon-expiring subscriptions.

Steps:
1. Call query with resource="users", limit=500 to get all users
2. Filter locally:
   - **Expired**: expireAt is in the past
   - **Expiring soon**: expireAt is within the next ${daysAhead} days
   - **Already disabled**: enabled=false (may need cleanup)

Present a table:
| userId | username | Status | Expires | Traffic Used |
|--------|----------|--------|---------|-------------|

Then ask what action to take for each group:
- **Expired users**: disable them? delete them? extend?
- **Expiring soon**: notify admin? extend automatically?
- **High traffic users**: reset traffic?

Only take action after explicit confirmation. Process users one by one or in bulk based on user preference.`,
    },
];

/**
 * Returns the full prompts list (MCP prompts/list response).
 */
function listPrompts() {
    return PROMPTS.map(({ name, description, arguments: args }) => ({
        name,
        description,
        arguments: args || [],
    }));
}

/**
 * Renders a prompt by name with provided arguments.
 * Returns MCP-compatible messages array.
 */
function getPrompt(name, args = {}) {
    const prompt = PROMPTS.find(p => p.name === name);
    if (!prompt) {
        throw Object.assign(new Error(`Unknown prompt: ${name}`), { code: 404 });
    }

    // Check required args
    for (const argDef of (prompt.arguments || [])) {
        if (argDef.required && !args[argDef.name]) {
            throw Object.assign(
                new Error(`Missing required argument: ${argDef.name}`),
                { code: 400 }
            );
        }
    }

    const text = prompt.template(args);

    return {
        description: prompt.description,
        messages: [
            {
                role: 'user',
                content: { type: 'text', text },
            },
        ],
    };
}

module.exports = { listPrompts, getPrompt, PROMPTS };
