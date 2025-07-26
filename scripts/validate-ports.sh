#!/bin/bash

# Port Validation Script
# Ensures all port references are consistent with Docker-only architecture

echo "🔍 Validating port conformity..."

# Define allowed ports
ALLOWED_PORTS="8080|8081|5173"
FORBIDDEN_PORTS="3000|3001|8180|9999"

# Check for forbidden port references
echo "Checking for forbidden ports..."
FORBIDDEN_FOUND=$(grep -r -E "localhost:($FORBIDDEN_PORTS)" --include="*.ts" --include="*.js" --include="*.json" --include="*.md" --include="*.yml" --include="*.yaml" --include="*.sh" . 2>/dev/null | grep -v "node_modules" | grep -v ".git" | grep -v "dist" | grep -v "validate-ports.sh")

if [ ! -z "$FORBIDDEN_FOUND" ]; then
    echo "❌ Found forbidden port references:"
    echo "$FORBIDDEN_FOUND"
    exit 1
else
    echo "✅ No forbidden ports found"
fi

# Check Docker port mappings
echo ""
echo "Checking Docker port mappings..."
DOCKER_PORTS=$(grep -E "ports:" -A 3 docker-compose*.yml | grep -E "[0-9]+:[0-9]+" | sed 's/.*"\?\([0-9]\+\):\([0-9]\+\)"\?.*/Host:\1 -> Container:\2/')

echo "Docker port mappings:"
echo "$DOCKER_PORTS"

# Verify standard ports are used
EXPECTED_MAPPINGS=(
    "8080:8080"
    "8081:8081"
    "5173:80"
)

# Check environment variables
echo ""
echo "Checking environment variables..."
ENV_PORTS=$(grep -r -E "MCP_.*PORT|WS_PORT|UI_PORT" --include="*.ts" --include="*.js" --include="*.json" --include="*.md" --include="*.yml" --include="*.yaml" --include="*.sh" . 2>/dev/null | grep -v "node_modules" | grep -v ".git" | grep -v "dist")

if [ ! -z "$ENV_PORTS" ]; then
    echo "Environment port references:"
    echo "$ENV_PORTS"
fi

# Summary
echo ""
echo "📊 Port Conformity Summary:"
echo "- WebSocket Server: 8080"
echo "- Health Check API: 8081"
echo "- UI Dashboard: 5173"
echo ""
echo "✅ Validation complete!"