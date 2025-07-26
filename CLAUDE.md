# Project: CoachNTT-MCP

## Development Rules
- Always run tests before committing
- Use TypeScript strict mode
- Log all agent decisions for debugging
- Keep context usage under 50% for agent pool
- Follow existing code patterns and conventions
- Maintain comprehensive error handling
- Document all agent interactions

## Sub-Agent Priorities
1. **Fix tool execution visibility first** - Critical for debugging
2. **Symbol Contractor**: Focus on naming consistency across codebase
3. **Session Orchestrator**: Simple checkpoint suggestions based on context usage
4. **Context Guardian**: Basic token counting and warnings only

## Testing Commands
```bash
# Run all tests
npm test

# Lint check
npm run lint

# Type checking
npm run typecheck

# Build project
npm run build

# Development mode (all components)
npm run dev:all
```

## Key Architecture Decisions
- Simple SQLite database (no vector DBs)
- Sequential agent execution (no complex orchestration)
- Direct SQL queries for memory recall
- Read-only memory sharing between agents
- Basic heuristics for predictions (no ML models)

## Agent Context Allocation
- Main development: 50-55% of total context
- Symbol Contractor: 15% maximum
- Session Orchestrator: 20% maximum  
- Context Guardian: 10% maximum
- Emergency buffer: 5-10%

## Common Issues and Solutions
- **Tool execution not visible**: Check WebSocket connection and event subscriptions
- **Context exhaustion**: Create checkpoint and start new session
- **Symbol conflicts**: Use Symbol Contractor for resolution
- **Database locks**: Restart WebSocket server

## Code Style Guidelines
- Functional components preferred in UI
- Async/await over promises
- Comprehensive error boundaries
- Detailed logging with context
- Type safety with strict TypeScript

## Session Management Best Practices
- Start every coding session with `session_start`
- Create checkpoints at natural boundaries
- Monitor context usage regularly
- Use reality checks before major refactors
- Generate handoff documents for breaks

## Sub-Agent Implementation Notes
- Agents should be stateless where possible
- All decisions must be logged to agent_memory
- Symbol registry is source of truth for naming
- Conflicts between agents require user intervention
- Performance target: <200ms response time per agent