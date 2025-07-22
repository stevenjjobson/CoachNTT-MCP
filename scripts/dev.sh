#!/bin/bash

# Start the WebSocket server and UI dashboard for development

echo "Starting CoachNTT-MCP Dashboard Environment..."

# Function to cleanup on exit
cleanup() {
    echo "Shutting down services..."
    kill $SERVER_PID $UI_PID 2>/dev/null
    exit 0
}

# Set up trap for clean exit
trap cleanup EXIT INT TERM

# Start the WebSocket server
echo "Starting WebSocket server on port 8080..."
npm run start:server &
SERVER_PID=$!

# Wait for server to start
echo "Waiting for server to initialize..."
sleep 3

# Check if server started successfully
if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo "Error: WebSocket server failed to start"
    exit 1
fi

# Start the UI development server
echo "Starting UI dashboard..."
cd ui && npm run dev &
UI_PID=$!

# Wait for UI to start
sleep 2

# Check if UI started successfully
if ! kill -0 $UI_PID 2>/dev/null; then
    echo "Error: UI dashboard failed to start"
    exit 1
fi

echo ""
echo "==========================================="
echo "CoachNTT-MCP Dashboard Ready!"
echo "==========================================="
echo ""
echo "Health Check:  http://localhost:8081/health"
echo "UI Dashboard:  http://localhost:5173"
echo "WebSocket:     ws://localhost:8080"
echo ""
echo "NOTE: The MCP server (for Claude Code) runs separately"
echo "via the stdio transport when Claude Code starts it."
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for processes
wait