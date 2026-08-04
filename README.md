# MI Bot (Checklist Automation Bot)

MI Bot is an automation system designed to handle checklist tasks with a robust backend, an interactive Telegram bot, and a modern web dashboard.

## Features

- **Automated Checklists**: Automate your daily checklist workflows using Playwright.
- **Telegram Bot Integration**: Get real-time notifications, screenshots, and manage schedules directly from Telegram.
- **Interactive Scheduling**: Customize the bot's run schedule (time and specific days) via an interactive Telegram inline keyboard.
- **Web Dashboard**: Monitor the bot's activity, view historical logs, and manage configuration from a React frontend.

## Technologies

- **Backend**: Node.js, Express, Playwright, node-telegram-bot-api, node-cron
- **Frontend**: React, Vite
- **Database**: Local JSON storage (for users, history, and bot state)

## Prerequisites

- Node.js (v16 or higher)
- npm (Node Package Manager)
- A Telegram Bot Token (You can get one from [@BotFather](https://t.me/botfather) on Telegram)

## Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone git@github.com:Amansengar1947/Checklist-V2.git
   cd Checklist-V2
   ```

2. **Configure Environment Variables:**
   Create a `.env` file inside the `backend/` directory and add your Telegram bot token:
   ```env
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
   ```

## Running the Application

The project includes a convenient startup script that installs dependencies, builds the frontend, and starts the server.

1. **Make the start script executable (if not already):**
   ```bash
   chmod +x start.sh
   ```

2. **Start the application:**
   ```bash
   ./start.sh
   ```
   
   *This will:*
   - Check if port 3001 is available.
   - Install backend dependencies (`npm install`).
   - Install frontend dependencies and build the static files using Vite.
   - Start the Node.js server.

3. **Access the Dashboard:**
   Open your browser and navigate to: `http://localhost:3001`

## Using the Telegram Bot

Once the backend is running, you can interact with your Telegram bot.

- `/start` - Start the bot, authenticate, and open the main menu.
- `/status` - Check the current task status.
- `/run` - Run tasks manually immediately.
- `/schedule` - View or change your automated run schedule using an interactive UI.
- `/images` - Toggle task screenshots (on/off).
- `/history` - View the history of recent task runs.

## Deployment (PM2)

If you are running this on a production server (like an Ubuntu VM), it's recommended to use PM2 to keep the bot alive.

```bash
# Install PM2 globally
npm install -g pm2

# Start the bot using PM2
cd backend
pm2 start server.js --name mi-bot

# Save the PM2 list
pm2 save
```
