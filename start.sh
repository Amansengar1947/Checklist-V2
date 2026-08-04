#!/bin/bash
# MI Bot — Start Script
# Run this to start the automation server

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

echo ""
echo "  ╔══════════════════════════════════╗"
echo "  ║       MI Bot — Starting...       ║"
echo "  ╚══════════════════════════════════╝"
echo ""

# Check if already running
if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "  ⚠  Port 3001 already in use. Server may already be running."
    echo "     Open: http://localhost:3001"
    exit 0
fi

# Install backend deps if needed
if [ ! -d "$BACKEND_DIR/node_modules" ]; then
    echo "  → Installing backend dependencies..."
    cd "$BACKEND_DIR" && npm install --silent
fi

# Check for .env file
if [ ! -f "$BACKEND_DIR/.env" ]; then
    echo "  ⚠  No .env file found in backend/"
    echo "     Creating default .env — you'll need to add your TELEGRAM_BOT_TOKEN"
    echo "TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN_HERE" > "$BACKEND_DIR/.env"
elif grep -q "YOUR_BOT_TOKEN_HERE" "$BACKEND_DIR/.env" 2>/dev/null; then
    echo "  ⚠  Telegram bot token not configured in backend/.env"
    echo "     Telegram notifications will be disabled."
fi

# Build frontend if dist doesn't exist
if [ ! -d "$FRONTEND_DIR/dist" ]; then
    echo "  → Building frontend..."
    if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
        cd "$FRONTEND_DIR" && npm install --silent
    fi
    cd "$FRONTEND_DIR" && npm run build --silent
fi

echo "  → Starting server on http://localhost:3001"
echo "  → Press Ctrl+C to stop."
echo ""

cd "$BACKEND_DIR" && node server.js
