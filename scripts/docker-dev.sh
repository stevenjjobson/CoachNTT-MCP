#!/bin/bash

# Development environment startup script for Docker
# Starts both WebSocket server and UI with hot reload

set -e

echo "🚀 Starting CoachNTT-MCP Docker Development Environment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop."
    exit 1
fi

# Load environment variables if .env exists
if [ -f .env ]; then
    echo "📋 Loading environment variables from .env"
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "⚠️  No .env file found. Using default values."
    echo "💡 Tip: Copy .env.example to .env and customize it."
fi

# Build images if needed
echo "🔨 Building Docker images..."
docker-compose -f docker-compose.yml -f docker-compose.dev.yml build

# Start services
echo "🎯 Starting services..."
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
sleep 5

# Check service health
echo "🏥 Checking service health..."
if curl -f http://localhost:8081/health > /dev/null 2>&1; then
    echo "✅ WebSocket server is healthy"
else
    echo "⚠️  WebSocket server health check failed"
fi

# Display access information
echo ""
echo "🎉 CoachNTT-MCP Docker Development Environment Ready!"
echo "=================================================="
echo "📊 Dashboard UI:    http://localhost:5174"
echo "🔌 WebSocket:       ws://localhost:8080"
echo "🏥 Health Check:    http://localhost:8081/health"
echo "📝 Logs:            docker-compose logs -f"
echo "🛑 Stop:            docker-compose down"
echo "=================================================="
echo ""
echo "💡 The UI has hot reload enabled. Edit files in ./ui/src"
echo "💡 The MCP server (for Claude Code) runs separately via stdio"

# Optionally tail logs
read -p "📜 Follow logs? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs -f
fi