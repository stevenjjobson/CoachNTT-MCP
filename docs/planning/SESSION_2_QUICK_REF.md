# Session 2 Quick Reference Card

## 🎯 Primary Goal
Implement complete SessionManager with persistence and lifecycle management (~2,000 lines)

## 📊 Context Budget Allocation
- Core Session Methods: 35% (~700 lines)
- Context Planning: 25% (~500 lines)
- Metrics & Analytics: 20% (~400 lines)
- UI State: 10% (~200 lines)
- Quick Actions: 10% (~200 lines)

## 🔧 Key Implementation Tasks

### 1. Session Lifecycle Methods
```typescript
startSession(params: SessionStartParams): Promise<Session>
createCheckpoint(params: CheckpointParams): Promise<CheckpointResponse>
createHandoff(params: HandoffParams): Promise<HandoffResponse>
completeSession(sessionId: string): Promise<Session>
```

### 2. Context Planning Algorithm
```typescript
// Base calculation
totalTokens = (lines * 10) + (tests * 15) + (docs * 12)
contextBudget = totalTokens * 1.2 // 20% buffer

// Phase allocation
phases = {
  'planning': 10%,
  'implementation': 50%,
  'testing': 25%,
  'documentation': 15%
}
```

### 3. Database Operations
- Use transactions for all multi-table operations
- JSON serialization for arrays/objects
- Prepared statements for performance
- Proper error handling with rollback

### 4. Observable Patterns
```typescript
// Emit updates
this.currentSession$.next(session);
this.sessionMetrics$.next(metrics);
this.contextStatus$.next(status);
```

## 🚨 Checkpoint Triggers
1. **35% Context**: Core session methods complete
2. **60% Context**: Context planning integrated
3. **70% Context**: Full implementation done

## 📝 Testing Checklist
- [ ] Session creation with context planning
- [ ] Checkpoint creation with metrics
- [ ] Handoff document generation
- [ ] Context allocation accuracy
- [ ] Observable emissions
- [ ] Database transactions
- [ ] Error scenarios

## 🔗 Integration Points
- ContextMonitor (usage tracking)
- RealityChecker (metric validation)
- DocumentationEngine (handoff generation)
- ProjectTracker (velocity updates)

## ⚡ Quick Commands
```bash
npm run build      # Compile TypeScript
npm run test       # Run tests
npm run typecheck  # Check types only
npm run dev        # Start dev server
```

## 🎨 Code Patterns

### Transaction Pattern
```typescript
return this.db.transaction(() => {
  const result = this.db.run(sql, params);
  // More operations...
  return buildResponse(result);
});
```

### Error Handling
```typescript
try {
  const result = await operation();
  this.updateObservables(result);
  return result;
} catch (error) {
  this.handleError(error);
  throw new SessionError(error.message);
}
```

### Metric Updates
```typescript
private updateMetrics(session: Session, changes: Partial<SessionMetrics>): void {
  session.metrics = { ...session.metrics, ...changes };
  this.db.run(updateMetricsSQL, session);
  this.sessionMetrics$.next(session.metrics);
}
```

## 📈 Progress Indicators
- Database records created
- Observable subscriptions active
- Tool handlers returning data
- TypeScript compilation passing
- Integration tests green

## 🚀 Session 2 Deliverables
1. Fully functional session lifecycle
2. Intelligent context planning
3. Real-time metrics tracking
4. UI state persistence
5. Quick action framework
6. Foundation for WebSocket