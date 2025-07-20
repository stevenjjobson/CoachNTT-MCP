# CoachNTT-MCP Session 1 Plan: Foundation & Core Implementation

## Session Overview
**Objective**: Initialize the CoachNTT-MCP project and implement core MCP server foundation  
**Estimated Output**: ~1,500 lines  
**Context Budget**: 60% maximum  

## Prerequisites Completed ✅
- [x] Complete technical specifications in AI_QUICK_REFERENCE.md
- [x] All interface definitions documented
- [x] MCP tool endpoints specified (30+ tools)
- [x] Configuration schemas defined
- [x] Documentation organized

## Session 1 Goals

### 1. Project Initialization (20% context)
- [ ] Initialize npm project with TypeScript
- [ ] Install MCP SDK and dependencies
- [ ] Create TypeScript configuration
- [ ] Set up project structure
- [ ] Create all interface files from reference

### 2. Core MCP Server (40% context)
- [ ] Implement MyWorkFlowServer class
- [ ] Set up MCP request handlers
- [ ] Implement tool registration system
- [ ] Create server initialization logic
- [ ] Add WebSocket support structure

### 3. Database Setup (20% context)
- [ ] Implement SQLite database connection
- [ ] Create all table schemas
- [ ] Add database initialization logic
- [ ] Create basic migration system

### 4. Foundation Classes (20% context)
- [ ] Create SessionManager skeleton
- [ ] Create ContextMonitor skeleton
- [ ] Create RealityChecker skeleton
- [ ] Set up Observable patterns

## Key Implementation Notes

### From AI_QUICK_REFERENCE.md:
- Use correct MCP handler pattern: `ListToolsRequestSchema`, `CallToolRequestSchema`
- Tools return JSON in text content format
- Type conversions may need `as unknown as Record<string, unknown>`
- Follow exact interface definitions from reference

### Critical Files to Create:
1. `src/interfaces/core.ts` - All core interfaces
2. `src/interfaces/tools.ts` - Tool interfaces
3. `src/interfaces/ui-contracts.ts` - UI integration interfaces
4. `src/core/server.ts` - Main MCP server
5. `src/database/schema.ts` - Database setup

## Checkpoint Triggers
- After project initialization complete
- After core MCP server working
- After database tables created
- Before starting manager implementations

## Context Monitoring
- Check at 25% intervals
- Create checkpoint if >50% and component complete
- Emergency save if >85%

## Success Criteria
- [ ] Project compiles with TypeScript
- [ ] MCP server starts without errors
- [ ] Database tables created successfully
- [ ] All interfaces match reference exactly
- [ ] Ready for Session 2 (managers implementation)

## Next Session Preview
Session 2 will focus on implementing:
- Complete SessionManager with persistence
- Full session lifecycle management
- UI state tracking
- Real-time update streams