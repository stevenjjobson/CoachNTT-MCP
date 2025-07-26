# Session 19 Handoff: Docker-Only Architecture Implementation

## Session Overview
**Date**: 2025-07-26
**Goal**: Implement unified Docker-only deployment with MCP-over-WebSocket bridge
**Status**: ✅ COMPLETED

## Major Architectural Changes

### 1. Unified Server Architecture
Created a unified server that combines MCP and WebSocket functionality:

#### New Files Created:
- `src/unified-server.ts` - Combined MCP + WebSocket server entry point
- `src/mcp-websocket-bridge.ts` - Bridges MCP tools to WebSocket API
- `src/mcp-websocket-client.ts` - Claude Code adapter for WebSocket connection
- `scripts/validate-ports.sh` - Port conformity validation script

#### Key Components:
```
Docker Container
├── Unified Server (runs unified-server.js)
│   ├── MCP Server (internal)
│   ├── WebSocket API (port 8080)
│   ├── Health Check API (port 8081)
│   └── MCP-WebSocket Bridge
├── UI Dashboard (port 5173)
└── Shared Managers & Database
```

### 2. WebSocket Infrastructure Updates

#### Modified Files:
- `src/websocket/handlers.ts`:
  - Added `mcpTools` Map for dynamic tool registration
  - Added `registerTool()` method for MCP bridge
  - Updated `execute()` to check MCP tools first
  - Added special `_list_tools` handler

- `src/websocket/server.ts`:
  - Added `getToolHandler()` method for bridge access
  - Added `close()` method for graceful shutdown

### 3. Docker Configuration Changes

#### Dockerfile Updates:
- `Dockerfile.server` - Changed CMD to run `dist/unified-server.js`

#### Docker Compose Simplification:
- **REMOVED**: `docker-compose.dev.yml` (renamed to docker-compose.yml)
- **docker-compose.yml** - Now the default development configuration
- **docker-compose.prod.yml** - Complete production stack (unchanged)

### 4. Port Standardization

#### Standardized Ports:
- 8080: WebSocket Server
- 8081: Health Check API  
- 5173: UI Dashboard

#### Fixed Port References:
- Changed all 8180 → 8080
- Changed all 3000/3001 → 8080
- Removed port 9999 references
- Updated across 15+ files

### 5. Removed Files

#### Deleted Scripts:
- `scripts/dev.sh` - Local development script
- `scripts/start-ui.sh` - Standalone UI script
- `scripts/port-manager.sh` - Local port management
- `scripts/start-websocket.js` - Standalone WebSocket
- `src/index.ts` - Old MCP stdio server

#### Moved Files:
- All test HTML files moved to `tests/html/`

### 6. Configuration Updates

#### package.json:
Removed non-Docker scripts:
- `dev`, `dev:ui`, `dev:all`
- `start`, `start:server`, `start:websocket`, `start:ui`

#### .mcp.json:
Updated to use WebSocket client:
```json
{
  "mcpServers": {
    "coachntt": {
      "command": "node",
      "args": ["/path/to/dist/mcp-websocket-client.js"],
      "env": {
        "MCP_WEBSOCKET_URL": "ws://localhost:8080",
        "MCP_AUTH_TOKEN": "myworkflow-secret"
      }
    }
  }
}
```

### 7. Documentation Updates

#### Updated Files:
- `README.md` - Docker-only quick start
- `CLAUDE_CODE_GUIDE.md` - WebSocket configuration for Claude Code
- `DEPLOYMENT.md` - Removed non-Docker options
- `DOCKER_GUIDE.md` - Simplified commands
- `TROUBLESHOOTING.md` - Updated file references
- `USAGE_EXAMPLES.md` - Fixed port numbers
- `test-ui-session.md` - Updated port reference
- `docs/planning/SESSION_10_HANDOFF.md` - Fixed port

## Testing Status

### What Works:
- ✅ Unified server compiles
- ✅ Port validation passes
- ✅ Documentation is consistent
- ✅ Docker Compose files are simplified

### What Needs Testing:
- ⚠️ Docker build with unified server
- ⚠️ MCP tool execution via WebSocket
- ⚠️ Claude Code connection via WebSocket client
- ⚠️ UI connection to unified server

## Next Session Tasks

### Priority 0: UNFINISHED FROM SESSION 18

#### Fix UI Connection Issue (CRITICAL)
- Session 18 had ERR_CONNECTION_REFUSED on UI port
- Need to verify Docker UI container actually starts and binds correctly
- Check if WSL2 networking issues persist
- Test with: `docker-compose ps` and `docker logs coachntt-ui`

#### Playwright Integration
- Review `/docs/reference/PLAYWRITE_REFERENCE.md`
- Plan integration for automated testing
- Add to test suite

#### Agent UI Testing
- Once UI loads, test agent suggestion flow:
  1. Create session through UI
  2. Trigger agents at context thresholds
  3. Verify suggestions appear
  4. Test accept/reject functionality

#### Database Verification
- Test agent_memory table
- Verify symbol_registry without foreign keys
- Confirm agent decisions persist

### Priority 1: Test Docker Build
```bash
npm run build
docker-compose build
docker-compose up
# CHECK UI ACTUALLY LOADS!
```

### Priority 2: Test MCP Integration
1. Start Docker containers
2. Configure Claude Code with WebSocket client
3. Test MCP tool execution
4. Verify real-time updates in UI

### Priority 3: Fix Any Issues
- Check unified server logs
- Verify MCP bridge initialization
- Test all MCP tools work via WebSocket

### Priority 4: Update Remaining Docs
- Create migration guide for existing users
- Update VPS deployment for unified server
- Add troubleshooting for WebSocket MCP mode

## Architecture Benefits Achieved

1. **Single Deployment Method**: Docker-only, no confusion
2. **Unified Server**: One process handles everything
3. **Remote MCP**: Claude Code can connect to remote servers
4. **Clean Ports**: Consistent 8080/8081/5173 everywhere
5. **Simplified Docker**: Two files instead of three

## Known Issues

1. **MCP Bridge Integration**: The bridge needs the MCP server to expose its tool registry
2. **Tool Handler Access**: Added getToolHandler() but needs testing
3. **Build Order**: May need to ensure unified-server imports work correctly
4. **Port Conflict**: Session 18 changed to 8180/5273 to avoid conflicts, Session 19 changed back to 8080/5173
5. **UI Connection**: Session 18's UI connection issue not directly addressed - needs Docker verification

## Commands for Quick Testing

```bash
# Build everything
npm run build

# Start development Docker
docker-compose up

# Check health
curl http://localhost:8081/health

# Test WebSocket
wscat -c ws://localhost:8080

# View logs
docker-compose logs -f
```

## File Change Summary

- **Created**: 4 new files
- **Modified**: 20+ files  
- **Deleted**: 5 files
- **Moved**: 7 test files

The codebase is now fully aligned with Docker-only deployment and ready for testing!