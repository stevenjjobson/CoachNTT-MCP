# Session 2 Continuation Prompt

Copy and paste the following prompt to begin Session 2:

---

I need to continue with Session 2 of the CoachNTT-MCP project. Please:

1. Review the session plan at `docs/planning/SESSION_2_PLAN.md`
2. Check the quick reference at `docs/planning/SESSION_2_QUICK_REF.md`
3. Review current state with `git log --oneline -5`

## Reference Documentation
Please also reference these key documents as needed:
- **Technical Reference**: `docs/reference/AI_QUICK_REFERENCE.md` - All interfaces, tool schemas, configuration patterns
- **Implementation Guide**: `docs/guides/implementation-guide.md` - Step-by-step implementation details
- **UI Integration Guide**: `docs/guides/ui-integration-guide.md` - WebSocket and real-time patterns
- **UI Contract**: `docs/contracts/ui-contract.md` - Frontend integration specifications
- **Product Requirements**: `docs/planning/PRD.md` - Original product vision
- **Session 1 Summary**: `SESSION_1_SUMMARY.md` - What was completed in Session 1

## Key Implementation Files
- **Interfaces**: `src/interfaces/session.ts`, `src/interfaces/context.ts`, `src/interfaces/tools.ts`
- **Database Schema**: `src/database/schema.ts` - All table definitions
- **Current Skeleton**: `src/managers/SessionManager.ts` - To be implemented
- **Tool Registry**: `src/core/tools.ts` - All 30+ tool definitions

Current state:
- Session 1 complete with ~1,500 lines
- All interfaces and database schema ready
- Manager skeletons in place
- Ready for SessionManager implementation

Please begin Session 2 focusing on:
1. Core SessionManager implementation (35% context)
   - Session lifecycle methods
   - Database persistence
   - Observable patterns
2. Context planning engine (25% context)
   - Smart allocation algorithm
   - Usage tracking
   - Checkpoint triggers
3. Metrics, UI state, and quick actions (40% context)

Target: ~2,000 lines with 70% context budget

Remember to:
- Use transaction patterns for database operations
- Implement Observable updates for real-time features
- Follow exact interface definitions from Session 1
- Create checkpoints at 35%, 60%, and 70% context usage
- Write at least basic tests for critical functionality

Let's start with implementing the core session lifecycle methods in SessionManager.