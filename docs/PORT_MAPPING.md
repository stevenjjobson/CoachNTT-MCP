# Port Mapping and Service Architecture

## Overview
This document defines the standard port allocations for all services in the CoachNTT-MCP ecosystem to avoid port conflicts.

## Port Allocations

### Core Services (Updated Session 20)
- **8180**: WebSocket Server (MyWorkFlowWebSocketServer)
  - Primary communication channel between MCP and UI
  - Handles real-time events and state synchronization
  - Changed from 8080 to avoid common conflicts
  
- **8181**: Health Check API
  - HTTP endpoint for service health monitoring
  - Configured via MCP_HEALTH_PORT environment variable
  
- **5273**: UI Dashboard (Vite Dev Server)
  - Primary port for UI development server
  - Changed from 5173 to avoid Vite default conflicts
  - Strict port mode enabled (no auto-increment)

### Test Services
- **9999**: WebSocket Test Server
  - Used only during test execution
  - Automatically cleaned up after tests

### Future Services (Reserved)
- **8082**: Metrics/Prometheus endpoint (if needed)
- **8083**: Admin API (if needed)
- **3000**: Production UI build server (if needed)
- **3001**: Alternative WebSocket port (fallback)

## Environment Variables
```bash
# Core ports
MCP_WEBSOCKET_PORT=8080        # WebSocket server
MCP_HEALTH_PORT=8081           # Health check API
MCP_UI_PORT=5173               # UI development server

# Optional overrides
MCP_WEBSOCKET_HOST=localhost   # WebSocket host
MCP_UI_HOST=localhost          # UI host
```

## Service Dependencies
```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   UI Dashboard  │────▶│ WebSocket Server │────▶│   MCP Server    │
│   Port: 5173    │     │   Port: 8080     │     │   (stdio)       │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │  Health Check    │
                        │   Port: 8081     │
                        └──────────────────┘
```

## Port Conflict Resolution

### Detection Script
```bash
#!/bin/bash
# Check if ports are available
check_port() {
  local port=$1
  if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
    echo "Port $port is in use"
    return 1
  else
    echo "Port $port is available"
    return 0
  fi
}

# Check all required ports
check_port 8080
check_port 8081
check_port 5173
```

### Kill Existing Services
```bash
# Kill services by port
kill_port() {
  local port=$1
  local pid=$(lsof -ti:$port)
  if [ ! -z "$pid" ]; then
    kill -9 $pid
    echo "Killed process $pid on port $port"
  fi
}

# Clean up all ports
kill_port 8080
kill_port 8081
kill_port 5173
```

## Docker Port Mappings
When running in Docker, use these host:container mappings:
```yaml
services:
  server:
    ports:
      - "8080:8080"  # WebSocket
      - "8081:8081"  # Health check
  
  ui:
    ports:
      - "5173:5173"  # UI Dashboard
```

## Production Deployment
In production, typically behind nginx:
- External ports 80/443 → nginx
- nginx proxies /ws → localhost:8080
- nginx proxies /health → localhost:8081
- nginx serves static UI files (no Vite server)

## Troubleshooting

### Common Issues
1. **EADDRINUSE**: Port already in use
   - Run the kill script above
   - Check for zombie processes: `ps aux | grep node`
   
2. **Connection refused**: Service not started
   - Check service logs
   - Verify port configuration matches
   
3. **WebSocket connection failed**: Proxy misconfiguration
   - Verify Vite proxy settings
   - Check CORS/origin settings

### Debug Commands
```bash
# Show all listening ports
netstat -tuln | grep LISTEN

# Show process using specific port
lsof -i :8080

# Test WebSocket connection
wscat -c ws://localhost:8080

# Test health endpoint
curl http://localhost:8081/health
```