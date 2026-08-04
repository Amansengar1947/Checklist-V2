/**
 * server.js
 * Entry point for the MI Bot backend server.
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Ensure data directory ────────────────────────────────────────────────────
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(path.join(dataDir, 'users.json'))) fs.writeFileSync(path.join(dataDir, 'users.json'), '[]');
if (!fs.existsSync(path.join(dataDir, 'history.json'))) fs.writeFileSync(path.join(dataDir, 'history.json'), '[]');
if (!fs.existsSync(path.join(dataDir, 'telegram-store.json'))) fs.writeFileSync(path.join(dataDir, 'telegram-store.json'), '{}');

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json());

// ─── Auth Routes (public — no middleware) ────────────────────────────────────
const { router: authRouter, requireAuth } = require('./routes/auth');
app.use('/api/auth', authRouter);

// ─── Protected API ────────────────────────────────────────────────────────────
const apiRouter = require('./routes/api');
app.use('/api', requireAuth, apiRouter);

// ─── Serve Frontend ───────────────────────────────────────────────────────────
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    app.get('*', (req, res) => {
        res.sendFile(path.join(frontendDist, 'index.html'));
    });
} else {
    app.get('/', (req, res) => {
        res.json({ status: 'MI Bot API running', hint: 'Build the frontend first: cd frontend && npm run build' });
    });
}

// ─── Start ────────────────────────────────────────────────────────────────────
const { initScheduler } = require('./scheduler');
const { initTelegramBot } = require('./bot/telegram');

app.listen(PORT, () => {
    console.log(`\n╔══════════════════════════════════════╗`);
    console.log(`║   MI Bot Server → http://localhost:${PORT}  ║`);
    console.log(`╚══════════════════════════════════════╝\n`);
    initScheduler();
    initTelegramBot(process.env.TELEGRAM_BOT_TOKEN);
});
