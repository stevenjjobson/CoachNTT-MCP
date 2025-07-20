# CoachNTT-MCP Session 2 Plan: Session Management Implementation

## Session Overview
**Objective**: Implement complete SessionManager with persistence, lifecycle management, and UI state tracking  
**Estimated Output**: ~2,000 lines  
**Context Budget**: 70% maximum (increased due to complexity)  
**Build On**: Session 1 foundation (interfaces, database, server structure)

## Prerequisites from Session 1 ✅
- [x] All interfaces defined and type-safe
- [x] Database schema with sessions table
- [x] Core MCP server with tool routing
- [x] SessionManager skeleton with Observable
- [x] TypeScript compilation working

## Session 2 Goals

### 1. Core SessionManager Implementation (35% context, ~700 lines)
- [ ] Implement session lifecycle methods:
  - [ ] `startSession()` - Create session with context planning
  - [ ] `createCheckpoint()` - Save progress with git integration
  - [ ] `createHandoff()` - Generate continuation documentation
  - [ ] `completeSession()` - Finalize and archive
- [ ] Session state management:
  - [ ] Active session tracking
  - [ ] Session query methods
  - [ ] Status transitions with validation
- [ ] Database operations:
  - [ ] CRUD operations with transactions
  - [ ] Session history queries
  - [ ] Checkpoint management
- [ ] Observable updates:
  - [ ] Emit session state changes
  - [ ] Progress notifications
  - [ ] Error state handling

### 2. Context Planning Engine (25% context, ~500 lines)
- [ ] Smart context allocation:
  - [ ] Calculate optimal phase budgets
  - [ ] Dynamic reallocation based on progress
  - [ ] Buffer management for safety
- [ ] Usage tracking:
  - [ ] Real-time token counting
  - [ ] Phase-based breakdown
  - [ ] Trend analysis
- [ ] Checkpoint triggers:
  - [ ] Percentage-based triggers
  - [ ] Phase completion triggers
  - [ ] Emergency saves

### 3. Session Metrics & Analytics (20% context, ~400 lines)
- [ ] Velocity calculations:
  - [ ] Lines per hour tracking
  - [ ] Test coverage progress
  - [ ] Documentation updates
- [ ] Progress analytics:
  - [ ] Completion percentage
  - [ ] Time estimates
  - [ ] Burndown tracking
- [ ] Performance metrics:
  - [ ] Session efficiency scores
  - [ ] Context usage efficiency
  - [ ] Quality indicators

### 4. UI State Management (10% context, ~200 lines)
- [ ] State persistence:
  - [ ] Save UI preferences to session
  - [ ] Layout configuration
  - [ ] Refresh intervals
- [ ] State synchronization:
  - [ ] Database sync methods
  - [ ] Default state handling
  - [ ] Migration support
- [ ] WebSocket preparation:
  - [ ] Connection state tracking
  - [ ] Message queue structure
  - [ ] Event emitter setup

### 5. Quick Actions Integration (10% context, ~200 lines)
- [ ] Action execution:
  - [ ] Load action definitions
  - [ ] Parameter validation
  - [ ] Execution pipeline
- [ ] Suggestion engine:
  - [ ] Context-based suggestions
  - [ ] Usage pattern learning
  - [ ] Confidence scoring
- [ ] Custom actions:
  - [ ] Definition storage
  - [ ] Validation logic
  - [ ] Execution tracking

## Implementation Order

### Phase 1: Core Session Methods (Morning)
1. Start with `startSession()` implementation
2. Add database persistence
3. Implement Observable updates
4. Test with basic scenarios

### Phase 2: Context Planning (Midday)
1. Build allocation algorithm
2. Add tracking infrastructure
3. Implement checkpoint logic
4. Integrate with SessionManager

### Phase 3: Metrics & UI State (Afternoon)
1. Add metrics calculations
2. Implement UI state methods
3. Create quick action framework
4. Integration testing

## Checkpoint Triggers
- **Checkpoint 1**: After core session methods (35% context)
- **Checkpoint 2**: After context planning complete (60% context)
- **Checkpoint 3**: After full implementation (70% context)

## Key Implementation Details

### From AI_QUICK_REFERENCE.md:
```typescript
// Context planning algorithm
const allocateContextBudget = (estimatedScope: EstimatedScope): ContextPlan => {
  const baseTokensPerLine = 10;
  const testOverhead = 1.5;
  const docOverhead = 1.2;
  
  const totalEstimate = 
    (estimatedScope.lines_of_code * baseTokensPerLine) +
    (estimatedScope.test_coverage * baseTokensPerLine * testOverhead) +
    (estimatedScope.documentation * baseTokensPerLine * docOverhead);
    
  return {
    total_budget: totalEstimate * 1.2, // 20% buffer
    phase_allocation: calculatePhaseAllocation(totalEstimate),
    checkpoint_triggers: generateTriggers(totalEstimate)
  };
};
```

### Database Transaction Pattern:
```typescript
async startSession(params: SessionStartParams): Promise<Session> {
  return this.db.transaction(() => {
    // Create session record
    // Create initial checkpoint
    // Initialize metrics
    // Return complete session
  });
}
```

### Observable Pattern:
```typescript
private updateSession(session: Session): void {
  this.currentSession$.next(session);
  this.emitMetricsUpdate(session.metrics);
  this.checkTriggers(session);
}
```

## Testing Requirements
- [ ] Unit tests for context allocation
- [ ] Integration tests for session lifecycle
- [ ] Observable emission tests
- [ ] Database transaction tests
- [ ] Error handling scenarios

## Success Criteria
- [ ] All SessionManager methods implemented
- [ ] Database operations with proper transactions
- [ ] Observable patterns working correctly
- [ ] Context tracking accurate to ±5%
- [ ] TypeScript compilation in strict mode
- [ ] At least 10 integration tests passing

## Risks & Mitigations
- **Risk**: Complex state management
  - **Mitigation**: Clear state transition rules
- **Risk**: Context calculation accuracy
  - **Mitigation**: Conservative estimates with buffers
- **Risk**: Database transaction complexity
  - **Mitigation**: Well-defined transaction boundaries

## Next Session Preview
Session 3 will focus on:
- Complete ContextMonitor implementation
- WebSocket server setup
- Real-time event streaming
- UI integration preparation

## Notes for Implementation
- Prioritize core functionality over optimization
- Use existing patterns from Session 1
- Keep WebSocket integration points in mind
- Document complex algorithms inline
- Create helper methods for reusable logic