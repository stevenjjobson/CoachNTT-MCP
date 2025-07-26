# CoachNTT-MCP Security Guidelines

## Overview

This document outlines basic security practices for the CoachNTT-MCP server and its sub-agents. These guidelines focus on practical, low-complexity security measures.

## Authentication

### WebSocket Authentication
- All WebSocket connections require authentication
- Use the shared secret configured in environment variables
- Authentication happens during the connection handshake

```typescript
// Example authentication check
if (request.headers.authorization !== `Bearer ${process.env.WS_AUTH_SECRET}`) {
  throw new Error('Unauthorized');
}
```

### MCP Server Security
- MCP servers run with the permissions of the host process
- Claude Code handles user authorization for tool execution
- No additional OAuth implementation needed (handled by MCP protocol)

## Input Validation

### Tool Parameters
- Validate all tool parameters before execution
- Use TypeScript types for compile-time safety
- Runtime validation with Zod schemas

```typescript
// Example validation
const schema = z.object({
  session_id: z.string().uuid(),
  message: z.string().max(1000),
  force: z.boolean().optional()
});
```

### SQL Injection Prevention
- Always use parameterized queries
- Never concatenate user input into SQL strings
- Use prepared statements for all database operations

```typescript
// Good
db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);

// Bad - Never do this
db.exec(`SELECT * FROM sessions WHERE id = '${sessionId}'`);
```

## Data Protection

### Sensitive Data
- Never log authentication tokens or secrets
- Avoid storing sensitive code content in logs
- Use environment variables for all secrets
- Rotate WebSocket secrets regularly

### Database Security
- Database files should have restricted permissions (600)
- Regular backups stored securely
- No sensitive data in database without encryption

## Agent Security

### Agent Isolation
- Each agent operates in its own context
- Agents cannot modify each other's memory
- Read-only access to shared data
- No direct file system access from agents

### Agent Decisions
- Log all agent decisions for audit trail
- User must approve critical actions
- Agents cannot execute system commands
- Limited to defined tool interfaces only

## Session Security

### Context Isolation
- Each session has isolated context
- No cross-session data leakage
- Temporary data cleaned up after session ends
- Session IDs are UUIDs (not sequential)

### Checkpoint Security
- Checkpoints don't include sensitive data
- Git commits use user's configured credentials
- No hardcoded credentials in checkpoints

## WebSocket Security

### Connection Security
- Use WSS (WebSocket Secure) in production
- Implement connection rate limiting
- Maximum connection limits enforced
- Automatic timeout for idle connections

```yaml
# config/config.yaml
websocket:
  maxConnections: 10
  connectionTimeout: 300000  # 5 minutes
  rateLimitPerIP: 5  # connections per minute
```

## Error Handling

### Information Disclosure
- Generic error messages to clients
- Detailed errors only in server logs
- Stack traces never sent to clients
- Sanitize all error outputs

```typescript
// Good error handling
try {
  // ... operation
} catch (error) {
  logger.error('Detailed error:', error);
  return { error: 'Operation failed' };  // Generic message
}
```

## Logging and Monitoring

### Audit Logging
- Log all tool executions
- Track authentication attempts
- Monitor unusual patterns
- Regular log rotation

### What to Log
- Tool executions with parameters (sanitized)
- Authentication success/failures
- Agent decisions and conflicts
- Session lifecycle events

### What NOT to Log
- Passwords or secrets
- Full file contents
- Personal information
- Detailed stack traces in production

## Development vs Production

### Development Mode
```env
NODE_ENV=development
LOG_LEVEL=debug
WS_AUTH_SECRET=dev-secret-change-in-prod
```

### Production Mode
```env
NODE_ENV=production
LOG_LEVEL=warn
WS_AUTH_SECRET=<strong-random-secret>
ENABLE_CORS=false
```

## Security Checklist

Before deployment:
- [ ] Change all default secrets
- [ ] Enable HTTPS/WSS for production
- [ ] Set proper file permissions
- [ ] Configure firewall rules
- [ ] Enable rate limiting
- [ ] Set up log rotation
- [ ] Remove debug endpoints
- [ ] Validate all environment variables
- [ ] Test authentication flow
- [ ] Review error messages

## Incident Response

If a security issue is discovered:
1. Stop affected services immediately
2. Assess the scope of the issue
3. Apply necessary patches
4. Rotate all secrets
5. Review logs for exploitation
6. Document the incident
7. Update security practices

## Regular Maintenance

- Monthly: Review and rotate secrets
- Weekly: Check logs for anomalies
- Daily: Monitor connection patterns
- Per deployment: Run security checklist

Remember: Security is about layers. No single measure is perfect, but combined they provide strong protection.