# Testing UI Session Updates

## Quick Test Instructions

1. **Open the Dashboard**
   ```bash
   # Open in your browser
   http://localhost:3001
   ```

2. **Open Browser Console**
   - Press F12 or right-click → Inspect → Console tab
   - Clear the console for a fresh start

3. **Expected Console Logs**
   You should see these logs in order:

   ```
   [WebSocket] Attempting to connect to ws://localhost:8080
   [WebSocket] Connected successfully
   [WebSocket] Sending authentication...
   [Dashboard] Received WebSocket message: {type: 'auth', data: {authenticated: true, message: 'Authentication successful'}}
   [Dashboard] Authentication successful
   [WebSocket] Subscribing to topics: ['session.status', 'context.status', ...]
   [WebSocket] Sending subscribe request for topic: session.status
   ```

4. **Click "Quick Start Session"**
   - Look for these logs:
   ```
   [SessionOverview] Starting new session...
   [ToolHandler] Mapping UI tool 'startSession' to MCP tool 'session_start'
   [ToolHandler] Starting new session with params: {...}
   [SessionManager] Session created, updating observables: {...}
   [WebSocket] Observable emitted session update for client...
   [WebSocket] Sending event to client...
   [Dashboard] Event for topic: session.status {...}
   [Dashboard] Session status update: {...}
   [SessionOverview] Session started successfully: {...}
   ```

5. **Check UI Updates**
   - The "No Active Session" card should change to show:
     - Project name: MyProject
     - Session type: feature (with ✨ icon)
     - Status: active (green indicator)
     - Progress bars and metrics

## Debugging Tips

### If UI doesn't update:

1. **Check WebSocket Connection**
   ```javascript
   // In browser console:
   const ws = new WebSocket('ws://localhost:8080');
   ws.onopen = () => {
     ws.send(JSON.stringify({ type: 'authenticate', auth: 'dev-secret-key-123' }));
     setTimeout(() => {
       ws.send(JSON.stringify({ type: 'subscribe', topic: 'session.status' }));
     }, 100);
   };
   ws.onmessage = (e) => console.log('Direct WS:', JSON.parse(e.data));
   ```

2. **Check Server Logs**
   ```bash
   docker-compose logs -f websocket-server | grep -E "\[SessionManager\]|\[WebSocket\]|\[ToolHandler\]"
   ```

3. **Check Database**
   ```bash
   # See if session was created
   docker exec coachntt-websocket-dev ls -la /app/data/
   ```

## Manual Session Creation Test

If the UI button doesn't work, try creating a session directly:

```javascript
// In browser console after page loads:
const ws = window.__dashboardContext?.ws;
if (ws) {
  ws.executeTool('startSession', {
    projectName: 'TestProject',
    type: 'feature',
    estimatedLines: 100,
    estimatedTests: 80,
    contextBudget: 150000
  }).then(result => console.log('Session created:', result))
    .catch(err => console.error('Failed:', err));
}
```

## Expected Data Structure

When successful, the session object should look like:
```javascript
{
  id: "session_xxx",
  project_name: "MyProject",
  type: "feature",              // UI expects 'type' not 'session_type'
  status: "active",
  actual_lines: 0,
  estimated_lines: 100,
  actual_tests: 0,
  estimated_tests: 80,
  start_time: 1234567890,
  metrics: {
    lines_written: 0,
    tests_written: 0,
    tests_passing: 0,
    context_used: 0,
    velocity_score: 0
  }
}
```

## Success Indicators

✅ WebSocket connects and authenticates
✅ Topics are subscribed to
✅ Tool execution maps correctly (startSession → session_start)
✅ Session is created in database
✅ Observable emits the new session
✅ WebSocket broadcasts the update
✅ Dashboard receives and processes the message
✅ UI updates to show active session

## Common Issues

1. **"WebSocket connection failed"**
   - Check if server is running: `docker-compose ps`
   - Check server logs: `docker-compose logs websocket-server`

2. **"Authentication failed"**
   - The auth token was fixed to accept 'dev-secret-key-123'

3. **"Tool execution failed"**
   - Check if the tool name mapping is working
   - Look for [ToolHandler] logs in server output

4. **Session created but UI not updating**
   - Check for [Dashboard] logs showing message receipt
   - Verify the session object structure matches UI expectations