import { getUserData } from "../controllers/AuthController.js";
import { getClientProjects } from "../controllers/ProjectController.js";
export const Clients = new Set();
export const users = new Map();
export const getUser = async (req, res) => {
    try {
        const email = req.params.email;
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');

        // Get initial data
        const initialUserData = await getUserData(email);
        if (!initialUserData) {
            throw new Error("USER_NOT_FOUND");
        }

        if (!users.has(email)) {
            users.set(email, new Set());
        }
        users.get(email).add(res);

        res.write(`event: initial_user_data\n`);
        res.write(`data: ${JSON.stringify(initialUserData)}\n\n`);
        console.log(`SSE client for ${email} connected. (getUser)`);

        const heartbeatInterval = setInterval(() => {
            res.write(`event: keep-alive\n\n`);
        }, 30000);

        req.on("close", () => {
            clearInterval(heartbeatInterval);
            const set = users.get(email);
            if (set) {
                set.delete(res);
                if (set.size === 0) {
                    users.delete(email);
                }
            }
            console.log(`SSE client for ${email} disconnected. (getUser)`);
        });

    } catch (error) {
        if (!res.headersSent) {
            return res.status(500).json({ success: false, message: 'Failed to establish SSE connection.' });
        } else {
            res.write(`event: error\n`);
            res.write(`data: ${JSON.stringify({ message: 'Failed to retrieve initial user data.', code: 'INITIAL_DATA_ERROR' })}\n\n`);
            res.end();
        }
    }
};

export const sendUserUpdater = async (email) => {
    try {
        await getUserData(email, true);
        const connections = users.get(email);
        if (connections && connections.size > 0) {
            const updatedUser = await getUserData(email);
            for (const res of connections) {
                res.write(`event: user_update\n`);
                res.write(`data: ${JSON.stringify(updatedUser)}\n\n`);
            }
            console.log(`Sent updated data to all connections for ${email}`);
        }
    } catch (error) {
        const connections = users.get(email);
        if (connections) {
            for (const res of connections) {
                res.write(`event: error\n`);
                res.write(`data: ${JSON.stringify({ message: 'Failed to retrieve user data.', code: 'SEND_UPDATE_ERROR' })}\n\n`);
                res.end();
            }
        }
    }
};

export const getProjectsClient = async (req, res) => {
    try {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        let client = false;
        if (req.user?.type === "Client") {
            client = true;
        }
        const initialData = await getClientProjects(req.user._id, client);
        res.write(`event: initial_data\n`);
        Clients.add(res);
        res.write(`data: ${JSON.stringify(initialData)}\n\n`);
        console.log(`SSE client for projects has been connected. Sent initial data.`);

        const heartbeatInterval = setInterval(() => {
            res.write('event: keep-alive\n\n');
        }, 30000);

        req.on('close', () => {
            clearInterval(heartbeatInterval);
        });

    } catch (error) {
        if (!res.headersSent) {
            return res.status(500).json({ success: false, message: 'Failed to establish SSE connection.' });
        } else {
            res.write(`event: error\n`);
            res.write(`data: ${JSON.stringify({ message: 'Failed to retrieve initial projects data.', code: 'INITIAL_DATA_ERROR' })}\n\n`);
            res.end();
        }
    }
}

export const sendProjectsClientUpdater = async (clientId) => {
    for (const client of Clients) {
        try {
            const updatedProjects = await getClientProjects(clientId, true);
            client.write(`event: projects_update\n`);
            client.write(`data: ${JSON.stringify(updatedProjects)}\n\n`);
            console.log(`Sent updated projects data`);
        } catch (err) {
            console.error("Failed to send SSE to a client. Removing.");
            client.write(`event: error\n`);
            client.write(`data: ${JSON.stringify({ message: 'Failed to retrieve projects data.', code: 'SEND_UPDATE_ERROR' })}\n\n`);
            Clients.delete(client);
        }
    }
}