/**
 * bot/session.js
 * Per-user session state management. Tracks active Playwright browsers,
 * SSE clients, logs, progress, and lifecycle status per credential ID.
 */

const { v4: uuidv4 } = require('uuid');

// sessionId → SessionState
const sessions = new Map();

// sessionId → Set<SSEClient>
const sseClients = new Map();

/**
 * Create or reset a session for a given credentialId.
 */
function createSession(credentialId, username) {
    const session = {
        id: credentialId,
        username,
        status: 'running',      // idle | running | done | error | stopped
        startTime: Date.now(),
        endTime: null,
        completed: 0,
        total: 0,
        currentTask: null,
        logs: [],
        browser: null,
        context: null,
        page: null,
        shouldStop: false,
    };
    sessions.set(credentialId, session);
    return session;
}

function getSession(credentialId) {
    return sessions.get(credentialId) || null;
}

function getAllSessions() {
    return [...sessions.values()];
}

function deleteSession(credentialId) {
    sessions.delete(credentialId);
}

/**
 * Append a log entry to the session and broadcast via SSE.
 */
function log(credentialId, level, message) {
    const session = sessions.get(credentialId);
    const entry = {
        id: uuidv4(),
        time: new Date().toLocaleTimeString('en-IN', { hour12: false }),
        level, // info | warn | error | success
        message,
    };
    if (session) {
        session.logs.push(entry);
        if (session.logs.length > 300) session.logs.shift(); // rolling buffer
    }
    broadcast(credentialId, 'log', entry);
    return entry;
}

/**
 * Broadcast a named SSE event to all subscribers of a session.
 */
function broadcast(credentialId, event, data) {
    const clients = sseClients.get(credentialId);
    if (!clients || clients.size === 0) return;
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of clients) {
        try { res.write(payload); } catch (_) {}
    }
}

/**
 * Broadcast a screenshot (base64 PNG) to the live feed.
 */
function broadcastScreenshot(credentialId, base64) {
    broadcast(credentialId, 'screenshot', { data: base64, time: Date.now() });
}

/**
 * Broadcast progress update.
 */
function broadcastProgress(credentialId, completed, total) {
    const session = sessions.get(credentialId);
    if (session) {
        session.completed = completed;
        session.total = total;
    }
    broadcast(credentialId, 'progress', { completed, total });
}

/**
 * Broadcast status change.
 */
function broadcastStatus(credentialId, status, extra = {}) {
    const session = sessions.get(credentialId);
    if (session) session.status = status;
    broadcast(credentialId, 'status', { status, ...extra });
}

/**
 * Register an SSE response object to a session.
 */
function addSSEClient(credentialId, res) {
    if (!sseClients.has(credentialId)) sseClients.set(credentialId, new Set());
    sseClients.get(credentialId).add(res);
}

/**
 * Remove an SSE client (on disconnect).
 */
function removeSSEClient(credentialId, res) {
    const clients = sseClients.get(credentialId);
    if (clients) clients.delete(res);
}

module.exports = {
    createSession,
    getSession,
    getAllSessions,
    deleteSession,
    log,
    broadcast,
    broadcastScreenshot,
    broadcastProgress,
    broadcastStatus,
    addSSEClient,
    removeSSEClient,
};
