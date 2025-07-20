# Session 3 Continuation Prompt

Copy and paste the following prompt to begin Session 3:

---

I need to continue with Session 3 of the CoachNTT-MCP project. Please:

1. Review the Session 2 summary at `SESSION_2_SUMMARY.md`
2. Check current implementation with `git log --oneline -5`
3. Review the codebase structure with `find src -name "*.ts" | head -20`

## Reference Documentation
Please reference these key documents as needed:
- **Technical Reference**: `docs/reference/AI_QUICK_REFERENCE.md` - All interfaces, tool schemas, configuration patterns
- **Implementation Guide**: `docs/guides/implementation-guide.md` - Step-by-step implementation details
- **UI Integration Guide**: `docs/guides/ui-integration-guide.md` - WebSocket and real-time patterns
- **UI Contract**: `docs/contracts/ui-contract.md` - Frontend integration specifications
- **Session 2 Summary**: `docs/planning/SESSION_2_SUMMARY.md` - What was completed in Session 2

## Key Implementation Files
- **Completed**: `src/managers/SessionManager.ts` - Full session lifecycle implementation
- **To Implement**: `src/managers/ContextMonitor.ts` - Context tracking and optimization
- **To Implement**: `src/managers/RealityChecker.ts` - Discrepancy detection
- **To Implement**: `src/managers/DocumentationEngine.ts` - Template system
- **Database**: `src/database/schema.ts` - All table definitions
- **Tests**: `tests/SessionManager.test.ts` - Reference for test patterns

## Current State
- Session 2 complete with ~2,450 lines
- SessionManager fully implemented with 18 passing tests
- Database operations and Observable patterns established
- Ready for ContextMonitor and remaining managers

## Session 3 Goals

### Priority 1: ContextMonitor Implementation (40% context)
1. Implement `trackUsage()` method for real-time token tracking
2. Create `getStatus()` with usage analytics and predictions
3. Implement `optimize()` for context reduction suggestions
4. Add `predict()` for usage forecasting
5. Integration with SessionManager for automatic tracking

### Priority 2: RealityChecker Implementation (30% context)
1. Implement `performCheck()` for discrepancy detection
2. Create validation methods for claims vs reality
3. Add automated fix suggestions
4. Implement metric validation

### Priority 3: Core MCP Tool Handlers (30% context)
1. Wire up SessionManager tool handlers in server
2. Implement context monitoring tools
3. Add reality check tools
4. Create basic documentation tools

Target: ~2,000 lines with focus on integration

Remember to:
- Follow established patterns from SessionManager
- Write tests for critical functionality
- Use transaction patterns for database operations
- Implement Observable updates for real-time features
- Create checkpoint when reaching 40% context usage

Let's start with implementing the ContextMonitor's trackUsage method.