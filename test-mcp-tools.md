# MCP Tools Test Guide

## Testing MCP Integration via WebSocket

### 1. Health Check
Test the health check tool to verify basic connectivity:
```
Tool: health_check
Parameters: {}
```

Expected: Should return health status with database, websocket, mcpBridge all healthy.

### 2. Session Management
Create a new session:
```
Tool: session_start
Parameters: {
  "project_name": "test-project",
  "description": "Testing MCP tools via WebSocket"
}
```

Expected: Should create a new session and return session details.

### 3. Session Status
Check the current session:
```
Tool: session_status
Parameters: {}
```

Expected: Should return the active session created in step 2.

### 4. Context Status
Check context usage:
```
Tool: context_status
Parameters: {}
```

Expected: Should return context usage stats for the current session.

### 5. Agent Status
Check agent status:
```
Tool: agent_status
Parameters: {}
```

Expected: Should return status of all agents (Symbol Contractor, Session Orchestrator, Context Guardian).

### 6. Create Checkpoint
Create a session checkpoint:
```
Tool: session_checkpoint
Parameters: {
  "description": "Test checkpoint after initial setup"
}
```

Expected: Should create a checkpoint and return checkpoint details.

## Verification Steps

1. The UI Dashboard at http://localhost:5273 should show:
   - Active session information
   - Context usage metrics
   - Real-time updates as tools are executed

2. WebSocket logs should show:
   - Tool execution events
   - State update broadcasts
   - Client subscriptions working

3. Database should contain:
   - New session record
   - Checkpoint record
   - Tool execution history

## Troubleshooting

If tools aren't working:
1. Check `docker logs coachntt-websocket` for errors
2. Verify MCP bridge initialized: look for "MCP-WebSocket bridge initialized successfully"
3. Check tool registration: should see "Registering MCP tool: [toolname]" for each tool
4. Verify WebSocket connection in UI: Network tab should show active WS connection