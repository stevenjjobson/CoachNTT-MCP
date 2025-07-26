#!/bin/bash

# CoachNTT-MCP UI Startup Script
# This script starts the WebSocket server and UI dashboard

echo "=========================================="
echo "CoachNTT-MCP UI Startup"
echo "=========================================="
echo ""

# Function to cleanup on exit
cleanup() {
    echo -e "\n\nShutting down services..."
    kill $SERVER_PID $UI_PID 2>/dev/null
    exit 0
}

# Set up trap for clean exit
trap cleanup EXIT INT TERM

# Kill any existing processes on our ports
echo "Cleaning up any existing processes..."
pkill -f "node.*dist/server.js" 2>/dev/null
pkill -f "vite.*5173" 2>/dev/null
sleep 1

# Start the WebSocket server
echo "Starting WebSocket server on port 8080..."
npm run start:server &
SERVER_PID=$!

# Wait for server to start
echo "Waiting for server to initialize..."
sleep 3

# Check if server started successfully
if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo "❌ Error: WebSocket server failed to start"
    echo "Check if port 8080 is already in use"
    exit 1
fi

# Start the UI development server
echo "Starting UI dashboard..."
cd ui && npm run dev &
UI_PID=$!

# Wait for UI to start
sleep 3

# Check if UI started successfully
if ! kill -0 $UI_PID 2>/dev/null; then
    echo "❌ Error: UI dashboard failed to start"
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ CoachNTT-MCP UI Ready!"
echo "=========================================="
echo ""
echo "📊 UI Dashboard:  http://localhost:5173"
echo "🔌 WebSocket:     ws://localhost:8080"
echo "❤️  Health Check:  http://localhost:8081/health"
echo ""
echo "🎯 Session 17 Features:"
echo "  • Real-time agent suggestions"
echo "  • Accept/reject agent recommendations"
echo "  • Live context monitoring"
echo ""
echo "💡 Tips:"
echo "  • If port 5173 is busy, check console for actual port"
echo "  • Open Chrome/Edge to view the dashboard"
echo "  • Press Ctrl+C to stop all services"
echo ""
echo "Logs will appear below..."
echo "=========================================="
echo ""

# Wait for processes
wait