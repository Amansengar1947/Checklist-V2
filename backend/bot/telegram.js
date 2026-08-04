/**
 * bot/telegram.js
 * Telegram Bot integration for MI Bot.
 * Handles user authentication via Telegram, real-time task notifications,
 * command handling (status, schedule, images, run, history).
 */

const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(__dirname, '..', 'data', 'telegram-store.json');
const USERS_PATH = path.join(__dirname, '..', 'data', 'users.json');

let bot = null;

const authState = new Map();

// ─── Interactive Schedule State ────────────────────────────────────────────────
const scheduleTimeState = new Map();
const scheduleDaysState = new Map();

// ─── Store helpers ───────────────────────────────────────────────────────────

function readStore() {
    try {
        if (fs.existsSync(STORE_PATH)) return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    } catch (_) {}
    return {};
}

function writeStore(store) {
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

function readUsers() {
    try {
        if (fs.existsSync(USERS_PATH)) return JSON.parse(fs.readFileSync(USERS_PATH, 'utf8'));
    } catch (_) {}
    return [];
}

function writeUsers(users) {
    fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2));
}

/**
 * Get all chat IDs linked to a specific credential ID.
 */
function getChatsForCredential(credentialId) {
    const store = readStore();
    const chats = [];
    for (const [chatId, data] of Object.entries(store)) {
        if (data.credentialId === credentialId) {
            chats.push({ chatId, ...data });
        }
    }
    return chats;
}

/**
 * Check if a chat is authenticated and return its data.
 */
function getChatData(chatId) {
    const store = readStore();
    return store[String(chatId)] || null;
}

// ─── Notification functions (called by engine.js) ────────────────────────────

/**
 * Send a text message to all Telegram chats linked to a credential.
 */
async function notifyTelegram(credentialId, message) {
    if (!bot) return;
    const chats = getChatsForCredential(credentialId);
    for (const chat of chats) {
        try {
            await bot.sendMessage(chat.chatId, message, { parse_mode: 'HTML' });
        } catch (err) {
            console.error(`[Telegram] Failed to send to ${chat.chatId}:`, err.message);
        }
    }
}

/**
 * Send a screenshot (base64 PNG) to all Telegram chats that have images enabled.
 */
async function notifyTelegramScreenshot(credentialId, base64Png, caption = '') {
    if (!bot) return;
    const chats = getChatsForCredential(credentialId);
    for (const chat of chats) {
        if (!chat.imagesEnabled) continue;
        try {
            const buffer = Buffer.from(base64Png, 'base64');
            await bot.sendPhoto(chat.chatId, buffer, {
                caption: caption || '📸 Task Screenshot',
                parse_mode: 'HTML',
            }, {
                filename: 'screenshot.png',
                contentType: 'image/png',
            });
        } catch (err) {
            console.error(`[Telegram] Failed to send screenshot to ${chat.chatId}:`, err.message);
        }
    }
}

// ─── Bot initialization ──────────────────────────────────────────────────────

function initTelegramBot(token) {
    if (!token || token === 'YOUR_BOT_TOKEN_HERE') {
        console.log('[Telegram] ⚠️  No bot token configured. Telegram notifications disabled.');
        console.log('[Telegram]    Set TELEGRAM_BOT_TOKEN in backend/.env');
        return null;
    }

    try {
        bot = new TelegramBot(token, { polling: true });

        // Set official Telegram Bot Command Menu (shows in [/] button)
        bot.setMyCommands([
            { command: 'start', description: 'Open Main Menu / Login' },
            { command: 'status', description: 'Check task status' },
            { command: 'run', description: 'Run tasks manually now' },
            { command: 'schedule', description: 'View or change schedule' },
            { command: 'images', description: 'Toggle task screenshots' },
            { command: 'history', description: 'View recent run history' },
            { command: 'logout', description: 'Log out from account' },
            { command: 'help', description: 'Show command list & help' },
        ]).catch(err => console.warn('[Telegram] Could not set bot commands:', err.message));

        console.log('[Telegram] 🤖 Bot started successfully! Listening for messages...');

        setupHandlers();
        return bot;
    } catch (err) {
        console.error('[Telegram] ❌ Failed to start bot:', err.message);
        return null;
    }
}

// ─── Command & message handlers ──────────────────────────────────────────────

function setupHandlers() {
    // /start command
    bot.onText(/\/start/, (msg) => {
        const chatId = msg.chat.id;
        const existing = getChatData(chatId);

        if (existing) {
            // Already authenticated
            sendMainMenu(chatId, existing.username);
            return;
        }

        // Start auth flow
        authState.set(chatId, { step: 'awaiting_username' });
        bot.sendMessage(chatId,
            `🤖 <b>Welcome to MI Bot!</b>\n\n` +
            `I'll send you real-time updates when your tasks are being processed.\n\n` +
            `To get started, please enter your <b>Username</b>:`,
            { parse_mode: 'HTML' }
        );
    });

    // /status command
    bot.onText(/\/status/, async (msg) => {
        const chatId = msg.chat.id;
        const chatData = getChatData(chatId);
        if (!chatData) return askToLogin(chatId);
        await handleStatus(chatId, chatData);
    });

    // /history command
    bot.onText(/\/history/, async (msg) => {
        const chatId = msg.chat.id;
        const chatData = getChatData(chatId);
        if (!chatData) return askToLogin(chatId);
        await handleHistory(chatId, chatData);
    });

    // /schedule command
    bot.onText(/\/schedule/, async (msg) => {
        const chatId = msg.chat.id;
        const chatData = getChatData(chatId);
        if (!chatData) return askToLogin(chatId);
        await handleSchedule(chatId, chatData);
    });

    // /images command
    bot.onText(/\/images/, async (msg) => {
        const chatId = msg.chat.id;
        const chatData = getChatData(chatId);
        if (!chatData) return askToLogin(chatId);
        await handleToggleImages(chatId, chatData);
    });

    // /run command
    bot.onText(/\/run/, async (msg) => {
        const chatId = msg.chat.id;
        const chatData = getChatData(chatId);
        if (!chatData) return askToLogin(chatId);
        await handleRun(chatId, chatData);
    });

    // /logout command
    bot.onText(/\/logout/, async (msg) => {
        const chatId = msg.chat.id;
        const store = readStore();
        if (store[String(chatId)]) {
            const username = store[String(chatId)].username;
            delete store[String(chatId)];
            writeStore(store);
            bot.sendMessage(chatId,
                `👋 Logged out from <b>${username}</b>.\n\nSend /start to login again.`,
                { parse_mode: 'HTML' }
            );
        } else {
            bot.sendMessage(chatId, `You're not logged in. Send /start to begin.`);
        }
    });

    // /help command
    bot.onText(/\/help/, (msg) => {
        const chatId = msg.chat.id;
        sendHelpMessage(chatId);
    });

    // Handle callback queries (inline keyboard buttons)
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const data = query.data;
        const chatData = getChatData(chatId);

        try {
            await bot.answerCallbackQuery(query.id);
        } catch (_) {}

        if (!chatData && data !== 'login') {
            return askToLogin(chatId);
        }

        if (data === 'status') return handleStatus(chatId, chatData);
        if (data === 'history') return handleHistory(chatId, chatData);
        if (data === 'schedule') return handleSchedule(chatId, chatData);
        if (data === 'images') return handleToggleImages(chatId, chatData);
        if (data === 'run') return handleRun(chatId, chatData);
        if (data === 'help') return sendHelpMessage(chatId);
        if (data === 'menu') return sendMainMenu(chatId, chatData.username);

        // Schedule time change
        if (data.startsWith('settime_')) {
            const time = data.replace('settime_', '');
            return handleSetTime(chatId, chatData, time);
        }

        // Interactive Schedule Time
        if (data === 'sch_edit_time') return sendTimeEditor(chatId, chatData, query.message.message_id);
        if (data.startsWith('sch_time_')) return handleTimeEdit(chatId, chatData, data, query.message.message_id);
        
        // Interactive Schedule Days
        if (data === 'sch_edit_days') return sendDaysEditor(chatId, chatData, query.message.message_id);
        if (data.startsWith('sch_day_')) return handleDaysEdit(chatId, chatData, data, query.message.message_id);
    });

    // Handle free-text messages (for auth flow and persistent keyboard buttons)
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const text = msg.text;

        if (!text) return;

        // Skip command messages (handled by bot.onText)
        if (text.startsWith('/')) return;

        const state = authState.get(chatId);

        // If user is in middle of auth flow
        if (state) {
            if (state.step === 'awaiting_username') {
                handleAuthUsername(chatId, text);
            } else if (state.step === 'awaiting_password') {
                handleAuthPassword(chatId, text, state.username);
            }
            return;
        }

        // Check if user is authenticated for persistent menu button clicks
        const chatData = getChatData(chatId);
        if (!chatData) return askToLogin(chatId);

        const cleanText = text.trim();

        if (cleanText.includes('Status')) return handleStatus(chatId, chatData);
        if (cleanText.includes('Run Now')) return handleRun(chatId, chatData);
        if (cleanText.includes('Schedule')) return handleSchedule(chatId, chatData);
        if (cleanText.includes('Images')) return handleToggleImages(chatId, chatData);
        if (cleanText.includes('History')) return handleHistory(chatId, chatData);
        if (cleanText.includes('Help')) return sendHelpMessage(chatId);
    });

    // Error handling
    bot.on('polling_error', (err) => {
        // Only log significant errors, not network hiccups
        if (err.code !== 'ETELEGRAM' || !err.message.includes('409')) {
            console.error('[Telegram] Polling error:', err.message);
        }
    });
}

// ─── Auth flow handlers ──────────────────────────────────────────────────────

function handleAuthUsername(chatId, text) {
    if (!text || text.trim().length === 0) {
        bot.sendMessage(chatId, `Please enter a valid username.`);
        return;
    }

    const username = text.trim();
    const users = readUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());

    if (!user) {
        authState.delete(chatId);
        bot.sendMessage(chatId,
            `❌ <b>User not registered!</b>\n\n` +
            `No account found for <code>${username}</code>.\n` +
            `Please check the username and try /start again.`,
            { parse_mode: 'HTML' }
        );
        return;
    }

    authState.set(chatId, { step: 'awaiting_password', username: user.username });
    bot.sendMessage(chatId,
        `✅ User <b>${user.label || user.username}</b> found!\n\n` +
        `Now please enter your <b>password</b>:`,
        { parse_mode: 'HTML' }
    );
}

function handleAuthPassword(chatId, text, username) {
    if (!text || text.trim().length === 0) {
        bot.sendMessage(chatId, `Please enter your password.`);
        return;
    }

    const password = text.trim();
    const users = readUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());

    if (!user || user.password !== password) {
        bot.sendMessage(chatId,
            `❌ <b>Invalid password!</b>\n\nPlease try again:`,
            { parse_mode: 'HTML' }
        );
        return; // Keep awaiting_password state
    }

    // Authentication successful!
    authState.delete(chatId);

    const store = readStore();
    store[String(chatId)] = {
        credentialId: user.id,
        username: user.username,
        label: user.label || user.username,
        imagesEnabled: false,
        authenticatedAt: new Date().toISOString(),
    };
    writeStore(store);

    // Delete the password message for security
    try {
        bot.deleteMessage(chatId, text.message_id).catch(() => {});
    } catch (_) {}

    bot.sendMessage(chatId,
        `🎉 <b>Authentication Successful!</b>\n\n` +
        `Welcome, <b>${user.label || user.username}</b>!\n` +
        `You'll now receive real-time notifications when tasks are processed.\n\n` +
        `Here's what you can do:`,
        { parse_mode: 'HTML' }
    ).then(() => {
        sendMainMenu(chatId, user.username);
    });
}

// ─── Main menu ───────────────────────────────────────────────────────────────

function sendMainMenu(chatId, username) {
    const chatData = getChatData(chatId);
    const imagesStatus = chatData?.imagesEnabled ? '🟢 ON' : '🔴 OFF';

    bot.sendMessage(chatId,
        `📋 <b>MI Bot Menu</b> — <code>${username}</code>\n\nSelect an option below or use the keyboard buttons at the bottom:`,
        {
            parse_mode: 'HTML',
            reply_markup: {
                keyboard: [
                    [{ text: '📊 Status' }, { text: '▶️ Run Now' }],
                    [{ text: '⏰ Schedule' }, { text: '🖼 Toggle Images' }],
                    [{ text: '📜 History' }, { text: '❓ Help' }],
                ],
                resize_keyboard: true,
            },
        }
    );
}

// ─── Command handlers ────────────────────────────────────────────────────────

async function handleStatus(chatId, chatData) {
    try {
        const { getStatus } = require('./engine');
        const status = getStatus(chatData.credentialId);

        let emoji = '⚪';
        if (status.status === 'running') emoji = '🟢';
        else if (status.status === 'done') emoji = '✅';
        else if (status.status === 'error') emoji = '❌';
        else if (status.status === 'stopped') emoji = '🟡';

        let msg = `${emoji} <b>Status for ${chatData.username}</b>\n\n`;
        msg += `State: <b>${status.status.toUpperCase()}</b>\n`;

        if (status.completed !== undefined && status.total !== undefined) {
            msg += `Progress: <b>${status.completed}/${status.total}</b> tasks\n`;
        }

        if (status.startTime) {
            const start = new Date(status.startTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
            msg += `Started: ${start}\n`;
        }

        // Show schedule info
        const users = readUsers();
        const user = users.find(u => u.id === chatData.credentialId);
        if (user && user.scheduleTime) {
            const daysMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const days = (user.scheduleDays || []).map(d => daysMap[d]).join(', ') || 'Every day';
            msg += `\n⏰ Schedule: <b>${user.scheduleTime}</b> (${days})`;
        } else {
            msg += `\n⏰ Schedule: <i>Not set</i>`;
        }

        msg += `\n🖼 Images: <b>${chatData.imagesEnabled ? 'ON' : 'OFF'}</b>`;

        bot.sendMessage(chatId, msg, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔙 Back to Menu', callback_data: 'menu' }],
                ],
            },
        });
    } catch (err) {
        bot.sendMessage(chatId, `❌ Error fetching status: ${err.message}`);
    }
}

async function handleHistory(chatId, chatData) {
    try {
        const { readHistory } = require('./engine');
        const allHistory = readHistory();
        const userHistory = allHistory
            .filter(h => h.credentialId === chatData.credentialId)
            .slice(0, 5);

        if (userHistory.length === 0) {
            bot.sendMessage(chatId, `📜 <b>No history found</b> for ${chatData.username}.`, {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [[{ text: '🔙 Back to Menu', callback_data: 'menu' }]],
                },
            });
            return;
        }

        let msg = `📜 <b>Recent History — ${chatData.username}</b>\n\n`;

        for (const h of userHistory) {
            const start = new Date(h.startTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
            const statusEmoji = h.status === 'done' ? '✅' : h.status === 'error' ? '❌' : '🟡';
            const failsafe = h.isFailsafe ? ' 🛡️' : '';
            msg += `${statusEmoji} ${start}${failsafe}\n`;
            msg += `   Tasks: ${h.completed}/${h.total} — ${h.status.toUpperCase()}\n\n`;
        }

        bot.sendMessage(chatId, msg, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [[{ text: '🔙 Back to Menu', callback_data: 'menu' }]],
            },
        });
    } catch (err) {
        bot.sendMessage(chatId, `❌ Error fetching history: ${err.message}`);
    }
}

async function handleSchedule(chatId, chatData, messageId = null) {
    const users = readUsers();
    const user = users.find(u => u.id === chatData.credentialId);

    if (!user) {
        bot.sendMessage(chatId, `❌ User not found.`);
        return;
    }

    const currentTime = user.scheduleTime || 'Not set';
    const daysMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const days = (user.scheduleDays || []).map(d => daysMap[d]).join(', ') || 'Every day';

    const text = `⏰ <b>Schedule Settings</b>\n\n` +
        `Current Time: <b>${currentTime}</b>\n` +
        `Current Days: <b>${days}</b>\n\n` +
        `What would you like to change?`;
        
    const keyboard = {
        inline_keyboard: [
            [
                { text: '🕒 Set Custom Time', callback_data: 'sch_edit_time' }
            ],
            [
                { text: '📅 Select Days', callback_data: 'sch_edit_days' }
            ],
            [
                { text: '❌ Remove Schedule', callback_data: 'settime_none' },
            ],
            [{ text: '🔙 Back to Menu', callback_data: 'menu' }],
        ],
    };

    if (messageId) {
        bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'HTML',
            reply_markup: keyboard
        }).catch(() => {});
    } else {
        bot.sendMessage(chatId, text, {
            parse_mode: 'HTML',
            reply_markup: keyboard
        });
    }
}

async function handleSetTime(chatId, chatData, time) {
    const users = readUsers();
    const user = users.find(u => u.id === chatData.credentialId);

    if (!user) {
        bot.sendMessage(chatId, `❌ User not found.`);
        return;
    }

    if (time === 'none') {
        user.scheduleTime = null;
        user.scheduleDays = [];
    } else {
        user.scheduleTime = time;
        // Default to weekdays if no days set
        if (!user.scheduleDays || user.scheduleDays.length === 0) {
            user.scheduleDays = [1, 2, 3, 4, 5]; // Mon-Fri
        }
    }

    writeUsers(users);

    // Refresh scheduler
    try {
        const { refreshAllJobs } = require('../scheduler');
        refreshAllJobs();
    } catch (_) {}

    if (time === 'none') {
        bot.sendMessage(chatId,
            `✅ Schedule <b>removed</b> for ${chatData.username}.`,
            {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [[{ text: '🔙 Back to Menu', callback_data: 'menu' }]],
                },
            }
        );
    } else {
        bot.sendMessage(chatId,
            `✅ Schedule set to <b>${time} IST</b> (Mon-Fri) for ${chatData.username}.`,
            {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [[{ text: '🔙 Back to Menu', callback_data: 'menu' }]],
                },
            }
        );
    }
}

// ─── Interactive Schedule UI Handlers ────────────────────────────────────────

function sendTimeEditor(chatId, chatData, messageId = null) {
    let state = scheduleTimeState.get(chatId);
    if (!state) {
        const users = readUsers();
        const user = users.find(u => u.id === chatData.credentialId);
        let h = 9, m = 0, ampm = 'AM';
        if (user && user.scheduleTime) {
            const match = user.scheduleTime.match(/(\d{2}):(\d{2})/);
            if (match) {
                h = parseInt(match[1], 10);
                m = parseInt(match[2], 10);
                if (h >= 12) {
                    ampm = 'PM';
                    if (h > 12) h -= 12;
                } else {
                    ampm = 'AM';
                    if (h === 0) h = 12;
                }
            }
        }
        state = { hour: h, minute: m, ampm };
        scheduleTimeState.set(chatId, state);
    }
    
    const hStr = state.hour.toString().padStart(2, '0');
    const mStr = state.minute.toString().padStart(2, '0');
    
    const text = `🕒 <b>Set Custom Time</b>\n\nUse the buttons to adjust the time, then click Save.`;
    const keyboard = {
        inline_keyboard: [
            [
                { text: '🔼 H', callback_data: 'sch_time_h_up' },
                { text: '🔼 M', callback_data: 'sch_time_m_up' },
                { text: '🔼 AM/PM', callback_data: 'sch_time_ampm' }
            ],
            [
                { text: hStr, callback_data: 'sch_time_ignore' },
                { text: mStr, callback_data: 'sch_time_ignore' },
                { text: state.ampm, callback_data: 'sch_time_ignore' }
            ],
            [
                { text: '🔽 H', callback_data: 'sch_time_h_down' },
                { text: '🔽 M', callback_data: 'sch_time_m_down' },
                { text: '🔽 AM/PM', callback_data: 'sch_time_ampm' }
            ],
            [
                { text: '💾 Save Time', callback_data: 'sch_time_save' }
            ],
            [{ text: '🔙 Back', callback_data: 'schedule' }]
        ]
    };
    
    if (messageId) {
        bot.editMessageText(text, { chat_id: chatId, message_id: messageId, parse_mode: 'HTML', reply_markup: keyboard }).catch(()=>{});
    } else {
        bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: keyboard });
    }
}

function handleTimeEdit(chatId, chatData, data, messageId) {
    if (data === 'sch_time_ignore') return;
    
    let state = scheduleTimeState.get(chatId) || { hour: 9, minute: 0, ampm: 'AM' };
    
    if (data === 'sch_time_h_up') {
        state.hour = state.hour === 12 ? 1 : state.hour + 1;
    } else if (data === 'sch_time_h_down') {
        state.hour = state.hour === 1 ? 12 : state.hour - 1;
    } else if (data === 'sch_time_m_up') {
        state.minute = (state.minute + 5) % 60;
    } else if (data === 'sch_time_m_down') {
        state.minute = state.minute - 5 < 0 ? 55 : state.minute - 5;
    } else if (data === 'sch_time_ampm') {
        state.ampm = state.ampm === 'AM' ? 'PM' : 'AM';
    } else if (data === 'sch_time_save') {
        const users = readUsers();
        const user = users.find(u => u.id === chatData.credentialId);
        if (user) {
            let h24 = state.hour;
            if (state.ampm === 'PM' && h24 < 12) h24 += 12;
            if (state.ampm === 'AM' && h24 === 12) h24 = 0;
            
            const timeStr = `${h24.toString().padStart(2, '0')}:${state.minute.toString().padStart(2, '0')}`;
            user.scheduleTime = timeStr;
            if (!user.scheduleDays || user.scheduleDays.length === 0) {
                user.scheduleDays = [1, 2, 3, 4, 5];
            }
            writeUsers(users);
            
            try {
                const { refreshAllJobs } = require('../scheduler');
                refreshAllJobs();
            } catch (_) {}
            
            bot.editMessageText(`✅ Schedule time updated to <b>${timeStr} IST</b>.`, { chat_id: chatId, message_id: messageId, parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🔙 Back to Schedule', callback_data: 'schedule' }]] } }).catch(()=>{});
            scheduleTimeState.delete(chatId);
            return;
        }
    }
    
    scheduleTimeState.set(chatId, state);
    sendTimeEditor(chatId, chatData, messageId);
}

function sendDaysEditor(chatId, chatData, messageId = null) {
    let state = scheduleDaysState.get(chatId);
    if (!state) {
        const users = readUsers();
        const user = users.find(u => u.id === chatData.credentialId);
        state = user && user.scheduleDays ? [...user.scheduleDays] : [1, 2, 3, 4, 5];
        scheduleDaysState.set(chatId, state);
    }
    
    const daysMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    const text = `📅 <b>Select Schedule Days</b>\n\nClick on the days to toggle them, then click Save.`;
    
    const getBtn = (idx) => {
        const isSelected = state.includes(idx);
        return { text: `${isSelected ? '✅' : '❌'} ${daysMap[idx]}`, callback_data: `sch_day_toggle_${idx}` };
    };
    
    const keyboard = {
        inline_keyboard: [
            [getBtn(1), getBtn(2), getBtn(3)], // Mon, Tue, Wed
            [getBtn(4), getBtn(5), getBtn(6)], // Thu, Fri, Sat
            [getBtn(0)],                       // Sun
            [{ text: '💾 Save Days', callback_data: 'sch_day_save' }],
            [{ text: '🔙 Back', callback_data: 'schedule' }]
        ]
    };
    
    if (messageId) {
        bot.editMessageText(text, { chat_id: chatId, message_id: messageId, parse_mode: 'HTML', reply_markup: keyboard }).catch(()=>{});
    } else {
        bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: keyboard });
    }
}

function handleDaysEdit(chatId, chatData, data, messageId) {
    let state = scheduleDaysState.get(chatId) || [1, 2, 3, 4, 5];
    
    if (data.startsWith('sch_day_toggle_')) {
        const dayIdx = parseInt(data.split('_').pop(), 10);
        if (state.includes(dayIdx)) {
            state = state.filter(d => d !== dayIdx);
        } else {
            state.push(dayIdx);
            state.sort();
        }
        scheduleDaysState.set(chatId, state);
        sendDaysEditor(chatId, chatData, messageId);
    } else if (data === 'sch_day_save') {
        const users = readUsers();
        const user = users.find(u => u.id === chatData.credentialId);
        if (user) {
            user.scheduleDays = state;
            writeUsers(users);
            
            try {
                const { refreshAllJobs } = require('../scheduler');
                refreshAllJobs();
            } catch (_) {}
            
            bot.editMessageText(`✅ Schedule days updated.`, { chat_id: chatId, message_id: messageId, parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🔙 Back to Schedule', callback_data: 'schedule' }]] } }).catch(()=>{});
            scheduleDaysState.delete(chatId);
        }
    }
}

async function handleToggleImages(chatId, chatData) {
    const store = readStore();
    const key = String(chatId);

    if (!store[key]) return askToLogin(chatId);

    store[key].imagesEnabled = !store[key].imagesEnabled;
    writeStore(store);

    const status = store[key].imagesEnabled ? '🟢 ON' : '🔴 OFF';

    bot.sendMessage(chatId,
        `🖼 <b>Task Images: ${status}</b>\n\n` +
        (store[key].imagesEnabled
            ? `You will now receive screenshots after each task is completed.`
            : `Screenshots are now disabled. You'll only get text notifications.`),
        {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [[{ text: '🔙 Back to Menu', callback_data: 'menu' }]],
            },
        }
    );
}

async function handleRun(chatId, chatData) {
    try {
        const { startBot } = require('./engine');
        const users = readUsers();
        const user = users.find(u => u.id === chatData.credentialId);

        if (!user) {
            bot.sendMessage(chatId, `❌ User not found in system.`);
            return;
        }

        const result = await startBot(user, true);

        if (!result.ok) {
            bot.sendMessage(chatId,
                `⚠️ <b>Cannot start:</b> ${result.error}`,
                { parse_mode: 'HTML' }
            );
            return;
        }

        bot.sendMessage(chatId,
            `▶️ <b>Bot started!</b> Running tasks for ${chatData.username}...\n\n` +
            `You'll receive live updates as tasks are completed.`,
            {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [[{ text: '📊 Check Status', callback_data: 'status' }]],
                },
            }
        );
    } catch (err) {
        bot.sendMessage(chatId, `❌ Error starting bot: ${err.message}`);
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function askToLogin(chatId) {
    bot.sendMessage(chatId,
        `🔒 You need to log in first.\n\nSend /start to begin.`,
        { parse_mode: 'HTML' }
    );
}

function sendHelpMessage(chatId) {
    bot.sendMessage(chatId,
        `❓ <b>MI Bot Commands</b>\n\n` +
        `/start — Login or show menu\n` +
        `/status — Check current task status\n` +
        `/history — View last 5 task runs\n` +
        `/schedule — View or change run schedule\n` +
        `/images — Toggle task screenshots\n` +
        `/run — Run tasks manually now\n` +
        `/logout — Disconnect your account\n` +
        `/help — Show this help message`,
        {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [[{ text: '🔙 Back to Menu', callback_data: 'menu' }]],
            },
        }
    );
}

module.exports = {
    initTelegramBot,
    notifyTelegram,
    notifyTelegramScreenshot,
    getChatsForCredential,
    getChatData,
    getBot: () => bot,
};
