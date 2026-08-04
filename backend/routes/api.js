/**
 * routes/api.js
 * REST API + SSE endpoint for the MI Bot dashboard.
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { startBot, stopBot, getStatus, getAllStatuses, readHistory } = require('../bot/engine');
const { addSSEClient, removeSSEClient, getSession } = require('../bot/session');

const USERS_PATH = path.join(__dirname, '..', 'data', 'users.json');
const HISTORY_PATH = path.join(__dirname, '..', 'data', 'history.json');

// ─── Data helpers ─────────────────────────────────────────────────────────────

function readUsers() {
    try {
        if (fs.existsSync(USERS_PATH)) return JSON.parse(fs.readFileSync(USERS_PATH, 'utf8'));
    } catch (_) {}
    return [];
}

function writeUsers(users) {
    fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2));
}

// ─── Users (Bot Credentials) ──────────────────────────────────────────────────

// GET /api/users — list all (passwords masked)
router.get('/users', (req, res) => {
    const users = readUsers().map(u => ({
        id: u.id,
        username: u.username,
        label: u.label || u.username,
        scheduleTime: u.scheduleTime || null,
        scheduleDays: u.scheduleDays || [],
        createdAt: u.createdAt,
    }));
    res.json(users);
});

// POST /api/users — add new credential
router.post('/users', (req, res) => {
    const { username, password, label, scheduleTime, scheduleDays } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username and password are required' });

    const users = readUsers();
    if (users.find(u => u.username === username)) {
        return res.status(409).json({ error: 'A user with that username already exists' });
    }

    const newUser = {
        id: uuidv4(),
        username,
        password,
        label: label || username,
        scheduleTime: scheduleTime || null,
        scheduleDays: Array.isArray(scheduleDays) ? scheduleDays : [],
        createdAt: new Date().toISOString(),
    };
    users.push(newUser);
    writeUsers(users);

    // Refresh cron if needed
    const { refreshAllJobs } = require('../scheduler');
    refreshAllJobs();

    res.status(201).json({ id: newUser.id, username: newUser.username, label: newUser.label });
});

// PUT /api/users/:id — update schedule
router.put('/users/:id', (req, res) => {
    const users = readUsers();
    const user = users.find(u => u.id === req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { label, scheduleTime, scheduleDays, password } = req.body;
    if (label !== undefined) user.label = label;
    if (scheduleTime !== undefined) user.scheduleTime = scheduleTime || null;
    if (scheduleDays !== undefined) user.scheduleDays = Array.isArray(scheduleDays) ? scheduleDays : [];
    if (password) user.password = password;

    writeUsers(users);
    const { refreshAllJobs } = require('../scheduler');
    refreshAllJobs();

    res.json({ ok: true });
});

// DELETE /api/users/:id
router.delete('/users/:id', (req, res) => {
    const users = readUsers();
    const filtered = users.filter(u => u.id !== req.params.id);
    writeUsers(filtered);

    // Stop any running session
    stopBot(req.params.id);

    const { cancelJob } = require('../scheduler');
    cancelJob(req.params.id);

    res.json({ ok: true });
});

// ─── Bot Control ──────────────────────────────────────────────────────────────

// POST /api/bot/start/:id
router.post('/bot/start/:id', async (req, res) => {
    const users = readUsers();
    const user = users.find(u => u.id === req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const headless = req.body.headless !== false; // default headless
    const result = await startBot(user, headless);
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json({ ok: true, message: `Bot started for ${user.username}` });
});

// POST /api/bot/stop/:id
router.post('/bot/stop/:id', (req, res) => {
    const result = stopBot(req.params.id);
    res.json(result);
});

// GET /api/bot/status — all sessions
router.get('/bot/status', (req, res) => {
    res.json(getAllStatuses());
});

// GET /api/bot/status/:id — single session
router.get('/bot/status/:id', (req, res) => {
    res.json(getStatus(req.params.id));
});

// ─── SSE Stream ───────────────────────────────────────────────────────────────

// GET /api/stream/:id — real-time event stream
router.get('/stream/:id', (req, res) => {
    const { id } = req.params;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    // Send a heartbeat immediately so the browser registers the connection
    res.write(`event: heartbeat\ndata: ${JSON.stringify({ time: Date.now() })}\n\n`);

    // Send any buffered logs from an active session
    const session = getSession(id);
    if (session && session.logs.length > 0) {
        for (const entry of session.logs.slice(-30)) {
            res.write(`event: log\ndata: ${JSON.stringify(entry)}\n\n`);
        }
        res.write(`event: progress\ndata: ${JSON.stringify({ completed: session.completed, total: session.total })}\n\n`);
        res.write(`event: status\ndata: ${JSON.stringify({ status: session.status })}\n\n`);
    }

    addSSEClient(id, res);

    // Heartbeat every 20s to keep connection alive
    const heartbeat = setInterval(() => {
        try { res.write(`event: heartbeat\ndata: ${JSON.stringify({ time: Date.now() })}\n\n`); } catch (_) {}
    }, 20000);

    req.on('close', () => {
        clearInterval(heartbeat);
        removeSSEClient(id, res);
    });
});

// ─── History ──────────────────────────────────────────────────────────────────

router.get('/history', (req, res) => {
    res.json(readHistory());
});

router.delete('/history', (req, res) => {
    fs.writeFileSync(HISTORY_PATH, '[]');
    res.json({ ok: true });
});

module.exports = router;
