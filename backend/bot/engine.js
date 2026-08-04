/**
 * bot/engine.js
 * Main automation engine. Launches Playwright, runs the full checklist loop,
 * streams screenshots + logs via SSE, and saves results to history.
 */

const { chromium } = require('playwright');
const path = require('path');
const { notifyTelegram, notifyTelegramScreenshot } = require('./telegram');
const fs = require('fs');

const {
    createSession,
    getSession,
    deleteSession,
    log,
    broadcastScreenshot,
    broadcastProgress,
    broadcastStatus,
} = require('./session');

const {
    sleep,
    captureScreenshot,
    stepLogin,
    stepScanTasks,
    stepCompleteTask,
    stepRefreshDashboard,
} = require('./steps');

const HISTORY_PATH = path.join(__dirname, '..', 'data', 'history.json');

// ─── History helpers ─────────────────────────────────────────────────────────

function readHistory() {
    try {
        if (fs.existsSync(HISTORY_PATH)) return JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
    } catch (_) {}
    return [];
}

function appendHistory(record) {
    const history = readHistory();
    history.unshift(record); // newest first
    if (history.length > 200) history.pop();
    fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
}

// ─── Screenshot streamer ─────────────────────────────────────────────────────

/**
 * Continuously captures and broadcasts screenshots while the session is running.
 * Runs every 2 seconds in the background.
 */
async function startScreenshotStreamer(session) {
    while (session.status === 'running') {
        try {
            if (session.page && !session.page.isClosed()) {
                const b64 = await captureScreenshot(session.page);
                if (b64) broadcastScreenshot(session.id, b64);
            }
        } catch (_) {}
        await sleep(2000);
    }
}

// ─── Main automation runner ───────────────────────────────────────────────────

/**
 * Start the automation for a specific credential.
 * @param {object} credential - { id, username, password }
 * @param {boolean} headless
 * @param {object} options - { isFailsafe: boolean }
 */
async function startBot(credential, headless = true, options = {}) {
    const { id, username, password } = credential;
    const isFailsafe = !!options.isFailsafe;

    // Prevent double-starts
    const existing = getSession(id);
    if (existing && existing.status === 'running') {
        return { ok: false, error: 'Bot already running for this user.' };
    }

    // Cancel any pending failsafe timer while a new run starts
    const { cancelFailsafe } = require('../scheduler');
    cancelFailsafe(id);

    const session = createSession(id, username);
    broadcastStatus(id, 'running');

    // Run in background (non-blocking)
    runBot(session, credential, headless, isFailsafe).catch(err => {
        log(id, 'error', `Unhandled engine error: ${err.message}`);
    });

    return { ok: true };
}

async function runBot(session, credential, headless, isFailsafe = false) {
    const { id, username } = session;
    const password = credential.password;

    try {
        if (isFailsafe) {
            log(id, 'info', `🛡️ Failsafe Mode Activated: Checking task completion for ${username}...`);
            notifyTelegram(id, `🛡️ <b>Failsafe Check</b>\nVerifying task completion for <b>${username}</b>...`);
        } else {
            log(id, 'info', `Starting browser (headless: ${headless})...`);
            notifyTelegram(id, `🚀 <b>Bot Started</b>\nRunning tasks for <b>${username}</b>...`);
        }

        const browser = await chromium.launch({ headless });
        const context = await browser.newContext({
            viewport: { width: 1280, height: 800 },
            userAgent:
                'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        });
        const page = await context.newPage();

        session.browser = browser;
        session.context = context;
        session.page = page;

        // Start background screenshot streamer
        startScreenshotStreamer(session); // intentionally not awaited

        // ── Login ──────────────────────────────────────────────────────────
        await stepLogin(session, username, password);

        if (session.shouldStop) throw new Error('Stopped by user');

        // ── Main task loop ─────────────────────────────────────────────────
        let completed = 0;
        let total = 0;
        let firstScan = true;

        while (!session.shouldStop) {
            const { count: rawCount, taskCount, btnLocator } = await stepScanTasks(session);

            if (firstScan) {
                total = taskCount;
                firstScan = false;
                broadcastProgress(id, completed, total);
                notifyTelegram(id, `🔍 <b>Found ${taskCount} pending task${taskCount !== 1 ? 's' : ''}</b>`);
            }

            if (rawCount === 0) {
                if (isFailsafe) {
                    log(id, 'success', `🛡️ Failsafe Check Passed: All tasks completed! Failsafe cycle finished.`);
                } else {
                    log(id, 'success', `All tasks completed! Total: ${completed}`);
                }
                break;
            }

            if (isFailsafe && completed === 0) {
                log(id, 'warn', `🛡️ Failsafe Alert: Found ${taskCount} remaining task(s). Completing now...`);
            }

            // Always grab the first button (list re-renders after each completion)
            const btn = btnLocator.first();
            const taskIndex = completed + 1;

            await stepCompleteTask(session, btn, taskIndex);
            completed++;
            broadcastProgress(id, completed, total || completed);
            notifyTelegram(id, `✅ <b>Completed task ${completed}/${total || completed}</b>`);

            // Send screenshot to Telegram if images enabled
            try {
                if (session.page && !session.page.isClosed()) {
                    const { captureScreenshot } = require('./steps');
                    const b64 = await captureScreenshot(session.page);
                    if (b64) notifyTelegramScreenshot(id, b64, `📸 Task ${completed}/${total || completed} completed`);
                }
            } catch (_) {}

            if (session.shouldStop) break;

            await stepRefreshDashboard(session);
            await sleep(2000);
        }

        session.status = session.shouldStop ? 'stopped' : 'done';
        broadcastStatus(id, session.status, { completed, total: total || completed });
        log(id, session.shouldStop ? 'warn' : 'success',
            session.shouldStop ? `Automation stopped by user.` : `🎉 All ${completed} tasks completed successfully!`
        );

        if (session.shouldStop) {
            notifyTelegram(id, `🟡 <b>Bot Stopped</b>\nAutomation stopped by user.`);
        } else {
            notifyTelegram(id, `🎉 <b>All ${completed} tasks completed successfully!</b>\n\nGreat job, ${username}!`);
        }

    } catch (err) {
        session.status = session.shouldStop ? 'stopped' : 'error';
        log(id, 'error', `Error: ${err.message}`);
        broadcastStatus(id, session.status, { error: err.message });
        notifyTelegram(id, `❌ <b>Error</b>\n<code>${err.message}</code>`);
    } finally {
        session.endTime = Date.now();

        // Save to history
        appendHistory({
            id: `${id}-${session.startTime}`,
            credentialId: id,
            username,
            startTime: new Date(session.startTime).toISOString(),
            endTime: new Date(session.endTime).toISOString(),
            completed: session.completed,
            total: session.total,
            status: session.status,
            isFailsafe,
        });

        // Close browser
        try {
            if (session.browser) await session.browser.close();
        } catch (_) {}

        // Failsafe auto-scheduler:
        // If run completed cleanly:
        // - If it was a Failsafe check and 0 tasks were found: Failsafe cycle is complete for today.
        // - If tasks were completed or it was a normal run: schedule a verification Failsafe check in 20 minutes!
        if (session.status === 'done' && !session.shouldStop) {
            const { scheduleFailsafe } = require('../scheduler');
            if (isFailsafe && session.completed === 0) {
                log(id, 'info', `🛡️ Failsafe check complete. All tasks done.`);
            } else {
                log(id, 'info', `🛡️ Failsafe active: Auto-scheduling verification check in 20 minutes.`);
                scheduleFailsafe(credential, 20 * 60 * 1000); // 20 minutes
            }
        }

        log(id, 'info', `Session ended. Duration: ${Math.round((session.endTime - session.startTime) / 1000)}s`);
    }
}

// ─── Stop ─────────────────────────────────────────────────────────────────────

function stopBot(credentialId) {
    const session = getSession(credentialId);
    if (!session) return { ok: false, error: 'No active session.' };
    session.shouldStop = true;
    log(credentialId, 'warn', `Stop requested by user.`);
    return { ok: true };
}

// ─── Status ───────────────────────────────────────────────────────────────────

function getStatus(credentialId) {
    const session = getSession(credentialId);
    if (!session) return { status: 'idle', completed: 0, total: 0 };
    return {
        status: session.status,
        completed: session.completed,
        total: session.total,
        startTime: session.startTime,
        endTime: session.endTime,
        logs: session.logs.slice(-50),
    };
}

function getAllStatuses() {
    const { getAllSessions } = require('./session');
    const result = {};
    for (const s of getAllSessions()) {
        result[s.id] = {
            status: s.status,
            completed: s.completed,
            total: s.total,
            username: s.username,
            startTime: s.startTime,
            endTime: s.endTime,
        };
    }
    return result;
}

module.exports = { startBot, stopBot, getStatus, getAllStatuses, readHistory };
