/**
 * scheduler.js
 * node-cron based scheduler. Reads user credentials and sets up cron jobs.
 * Re-initialized any time users are added/updated/deleted.
 */

const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { startBot } = require('./bot/engine');

const USERS_PATH = path.join(__dirname, 'data', 'users.json');

// credentialId → cron.ScheduledTask
const activeJobs = new Map();
// credentialId → Timeout handle
const failsafeTimers = new Map();

function readUsers() {
    try {
        if (fs.existsSync(USERS_PATH)) return JSON.parse(fs.readFileSync(USERS_PATH, 'utf8'));
    } catch (_) {}
    return [];
}

function scheduleUser(user) {
    // Cancel existing job if any
    cancelJob(user.id);

    if (!user.scheduleTime) return;

    const [hour, minute] = user.scheduleTime.split(':').map(Number);
    if (isNaN(hour) || isNaN(minute)) return;

    // Build cron day-of-week string
    let dow = '*';
    if (Array.isArray(user.scheduleDays) && user.scheduleDays.length > 0) {
        // Convert Sunday=0..Saturday=6 → cron format (0=Sun, 6=Sat)
        dow = user.scheduleDays.join(',');
    }

    const expression = `${minute} ${hour} * * ${dow}`;
    if (!cron.validate(expression)) {
        console.warn(`[Scheduler] Invalid cron expression for ${user.username}: "${expression}"`);
        return;
    }

    console.log(`[Scheduler] Scheduling ${user.username} → ${expression}`);
    const job = cron.schedule(expression, () => {
        console.log(`[Scheduler] ⏰ Firing scheduled run for ${user.username}`);
        startBot(user, true).catch(err =>
            console.error(`[Scheduler] Error starting bot for ${user.username}:`, err.message)
        );
    }, { scheduled: true, timezone: 'Asia/Kolkata' });

    activeJobs.set(user.id, job);
}

function cancelJob(userId) {
    if (activeJobs.has(userId)) {
        activeJobs.get(userId).stop();
        activeJobs.delete(userId);
    }
    cancelFailsafe(userId);
}

/**
 * Schedule a Failsafe run for a user after delayMs (default 20 minutes)
 */
function scheduleFailsafe(user, delayMs = 20 * 60 * 1000) {
    cancelFailsafe(user.id);

    const minutes = Math.round(delayMs / 60000);
    console.log(`[Failsafe] 🛡️ Scheduling failsafe check for ${user.username} in ${minutes} minutes.`);

    const timer = setTimeout(() => {
        failsafeTimers.delete(user.id);
        console.log(`[Failsafe] 🛡️ Firing failsafe verification check for ${user.username}...`);
        startBot(user, true, { isFailsafe: true }).catch(err => {
            console.error(`[Failsafe] Error during failsafe check for ${user.username}:`, err.message);
        });
    }, delayMs);

    failsafeTimers.set(user.id, timer);
}

/**
 * Cancel pending failsafe timer for a user
 */
function cancelFailsafe(userId) {
    if (failsafeTimers.has(userId)) {
        clearTimeout(failsafeTimers.get(userId));
        failsafeTimers.delete(userId);
    }
}

function refreshAllJobs() {
    // Stop all existing
    for (const job of activeJobs.values()) job.stop();
    activeJobs.clear();

    for (const timer of failsafeTimers.values()) clearTimeout(timer);
    failsafeTimers.clear();

    // Re-schedule all users
    const users = readUsers();
    for (const user of users) {
        scheduleUser(user);
    }
}

function initScheduler() {
    console.log('[Scheduler] Initializing...');
    refreshAllJobs();
}

module.exports = { initScheduler, scheduleUser, cancelJob, refreshAllJobs, scheduleFailsafe, cancelFailsafe };
