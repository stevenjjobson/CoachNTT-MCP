# Session 5 Quick Reference

## Priority Tasks

### 1. Test Suite (Priority: HIGH)
```bash
# Files to create
tests/DocumentationEngine.test.ts  # ~250 lines
tests/ProjectTracker.test.ts      # ~250 lines
tests/WebSocketServer.test.ts      # ~150 lines
tests/integration/tools.test.ts   # ~200 lines
```

### 2. Configuration System (Priority: HIGH)
```bash
# Files to create
src/config/index.ts      # Types and interfaces
src/config/loader.ts     # Configuration loading
src/config/defaults.ts   # Default values
```

### 3. Server Setup (Priority: MEDIUM)
```bash
# Files to create
src/server.ts           # Main server entry
src/utils/logger.ts     # Logging system
src/utils/errors.ts     # Error handling
```

## Key Test Scenarios

### DocumentationEngine Tests
- Generate each doc type (readme, api, architecture, handoff)
- Update with each mode (sync, append, restructure)
- Check document status validation
- Test template substitution
- Verify Observable updates

### ProjectTracker Tests
- Track new and existing projects
- Analyze velocity with different windows
- Report and resolve blockers
- Generate reports with predictions
- Test metric calculations

### WebSocket Tests
- Connection lifecycle
- Authentication flow
- Subscription management
- Event delivery
- Error scenarios

### Integration Tests
- Full session workflow
- Context tracking through session
- Reality checks with metrics
- Documentation generation
- Project updates

## Configuration Schema
```typescript
interface MCPConfig {
  database: {
    path: string;
    poolSize?: number;
  };
  websocket: {
    port: number;
    authToken?: string;
  };
  context: {
    defaultBudget: number;
    warningThreshold: number;
    criticalThreshold: number;
  };
  paths: {
    projects: string;
    documentation: string;
    logs: string;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    file?: string;
  };
}
```

## Test Utilities
```typescript
// Common test helpers
function createTestSession(): Session
function mockFileSystem(): void
function createTestProject(): Project
function waitForObservable<T>(obs: Observable<T>): Promise<T>
```

## WebSocket Test Client
```typescript
// For WebSocket testing
class TestWebSocketClient {
  connect(url: string): Promise<void>
  authenticate(token: string): Promise<boolean>
  subscribe(topic: string): Promise<void>
  waitForEvent(topic: string): Promise<any>
  disconnect(): void
}
```

## MCP Tool Checklist
- [ ] session_start
- [ ] session_checkpoint
- [ ] session_handoff
- [ ] session_complete
- [ ] context_status
- [ ] context_predict
- [ ] context_optimize
- [ ] reality_check
- [ ] reality_validate
- [ ] reality_fix
- [ ] doc_generate
- [ ] doc_update
- [ ] doc_status
- [ ] project_track
- [ ] project_velocity
- [ ] project_report
- [ ] blocker_report
- [ ] blocker_resolve
- [ ] quick_action

## Environment Variables
```bash
# .env.example
MCP_DATABASE_PATH=./data/myworkflow.db
MCP_WEBSOCKET_PORT=8080
MCP_WEBSOCKET_AUTH=your-secret-token
MCP_LOG_LEVEL=info
MCP_LOG_FILE=./logs/mcp.log
MCP_PROJECTS_PATH=./projects
MCP_DOCS_PATH=./docs/generated
MCP_CONTEXT_BUDGET=100000
MCP_CONTEXT_WARNING=0.7
MCP_CONTEXT_CRITICAL=0.85
```

## Testing Commands
```bash
# Run all tests
npm test

# Run specific test suite
npm test DocumentationEngine

# Run with coverage
npm test -- --coverage

# Run integration tests
npm test -- integration

# Watch mode
npm test -- --watch
```

## Server Commands
```bash
# Start server
npm start

# Start with custom config
npm start -- --config ./config.json

# Start in development mode
npm run dev

# Check health
curl http://localhost:8080/health
```

## Quick Validation
After implementing each component:
1. Run TypeScript compiler: `npx tsc --noEmit`
2. Run relevant tests: `npm test <component>`
3. Check coverage: `npm test -- --coverage`
4. Verify integration: `npm test integration`

## Common Issues & Solutions

### Issue: Database locked
```typescript
// Solution: Ensure single instance
DatabaseConnection.resetInstance();
```

### Issue: WebSocket connection refused
```typescript
// Solution: Check port availability
netstat -an | grep 8080
```

### Issue: Observable not emitting
```typescript
// Solution: Check subscription timing
await new Promise(resolve => setTimeout(resolve, 100));
```

### Issue: File system mocks failing
```typescript
// Solution: Reset mocks between tests
jest.clearAllMocks();
jest.resetModules();
```

## Final Checklist
- [ ] All tests passing
- [ ] TypeScript compilation clean
- [ ] Configuration working
- [ ] Server starts successfully
- [ ] WebSocket connections stable
- [ ] Integration tests pass
- [ ] Documentation complete
- [ ] Examples working