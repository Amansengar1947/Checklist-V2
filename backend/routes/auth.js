/**
 * routes/auth.js
 * Authentication routes for admin login and Telegram user verification.
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const USERS_PATH = path.join(__dirname, '..', 'data', 'users.json');

// ─── Hardcoded admin credentials ──────────────────────────────────────────────
const ADMIN_USERNAME = 'Mrthakur947';
const ADMIN_PASSWORD = 'Tannu@524';

// ─── In-memory session tokens ────────────────────────────────────────────────
const activeSessions = new Map(); // token → { username, createdAt }

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

function readUsers() {
    try {
        if (fs.existsSync(USERS_PATH)) return JSON.parse(fs.readFileSync(USERS_PATH, 'utf8'));
    } catch (_) {}
    return [];
}

// ─── Admin Login ──────────────────────────────────────────────────────────────

/**
 * POST /api/auth/login
 * Body: { username, password }
 * Returns: { ok, token } or { error }
 */
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }

    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = generateToken();
    activeSessions.set(token, {
        username,
        createdAt: Date.now(),
    });

    // Clean up old sessions (older than 24 hours)
    const ONE_DAY = 24 * 60 * 60 * 1000;
    for (const [t, s] of activeSessions.entries()) {
        if (Date.now() - s.createdAt > ONE_DAY) activeSessions.delete(t);
    }

    res.json({ ok: true, token, username });
});

/**
 * GET /api/auth/check
 * Header: Authorization: Bearer <token>
 * Returns: { ok, username } or 401
 */
router.get('/check', (req, res) => {
    const token = extractToken(req);
    if (!token || !activeSessions.has(token)) {
        return res.status(401).json({ error: 'Not authenticated.' });
    }
    const session = activeSessions.get(token);
    res.json({ ok: true, username: session.username });
});

/**
 * POST /api/auth/logout
 * Header: Authorization: Bearer <token>
 */
router.post('/logout', (req, res) => {
    const token = extractToken(req);
    if (token) activeSessions.delete(token);
    res.json({ ok: true });
});

// ─── Telegram User Verification ──────────────────────────────────────────────

/**
 * POST /api/auth/verify-user
 * Body: { username }
 * Returns: { exists, userId, label }
 * Used by Telegram bot to check if a VFP user exists.
 */
router.post('/verify-user', (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username is required.' });

    const users = readUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());

    if (!user) {
        return res.json({ exists: false });
    }

    res.json({
        exists: true,
        userId: user.id,
        label: user.label || user.username,
        username: user.username,
    });
});

/**
 * POST /api/auth/verify-password
 * Body: { username, password }
 * Returns: { ok, userId, label } or { ok: false }
 * Used by Telegram bot to verify VFP user password.
 */
router.post('/verify-password', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });

    const users = readUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());

    if (!user || user.password !== password) {
        return res.json({ ok: false });
    }

    res.json({
        ok: true,
        userId: user.id,
        label: user.label || user.username,
        username: user.username,
    });
});

// ─── Auth middleware ──────────────────────────────────────────────────────────

function extractToken(req) {
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
    return null;
}

/**
 * Middleware to protect routes. Attach to routes that require admin auth.
 */
function requireAuth(req, res, next) {
    const token = extractToken(req);
    if (!token || !activeSessions.has(token)) {
        return res.status(401).json({ error: 'Authentication required.' });
    }
    req.adminUser = activeSessions.get(token);
    next();
}

module.exports = { router, requireAuth };
