#!/bin/bash

# Build Docker images for production
set -e

echo "🔨 Building CoachNTT-MCP Docker Images..."

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Set defaults
DOCKER_REGISTRY=${DOCKER_REGISTRY:-ghcr.io}
DOCKER_ORG=${DOCKER_ORG:-yourusername}
VERSION=${VERSION:-latest}

# Build TypeScript first
echo "📦 Building TypeScript..."
npm run build

# Build WebSocket server image
echo "🔨 Building WebSocket server image..."
docker build -f Dockerfile.server -t coachntt-websocket:${VERSION} .
docker tag coachntt-websocket:${VERSION} ${DOCKER_REGISTRY}/${DOCKER_ORG}/coachntt-websocket:${VERSION}

# Build UI image
echo "🔨 Building UI dashboard image..."
docker build -f ui/Dockerfile -t coachntt-ui:${VERSION} ./ui
docker tag coachntt-ui:${VERSION} ${DOCKER_REGISTRY}/${DOCKER_ORG}/coachntt-ui:${VERSION}

echo ""
echo "✅ Build complete!"
echo "📦 Images built:"
echo "  - coachntt-websocket:${VERSION}"
echo "  - coachntt-ui:${VERSION}"
echo ""
echo "📤 To push to registry:"
echo "  docker push ${DOCKER_REGISTRY}/${DOCKER_ORG}/coachntt-websocket:${VERSION}"
echo "  docker push ${DOCKER_REGISTRY}/${DOCKER_ORG}/coachntt-ui:${VERSION}"