import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ContextMonitor } from '../src/managers/ContextMonitor';
import { SessionManager } from '../src/managers/SessionManager';
import { DatabaseConnection } from '../src/database';
import { SessionStartParams } from '../src/interfaces';
import { setupTestDatabase, cleanupTestDatabase } from './helpers/database';
import { execSync } from 'child_process';

// Mock child_process module
jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

describe('ContextMonitor', () => {
  let contextMonitor: ContextMonitor;
  let sessionManager: SessionManager;
  let sessionId: string;
  const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

  beforeEach(async () => {
    // Setup test database
    setupTestDatabase();
    
    // Reset mocks
    mockExecSync.mockReset();
    mockExecSync.mockImplementation((cmd: string) => {
      // Mock git operations
      if (cmd.includes('git status')) {
        return 'On branch main\nnothing to commit' as any;
      }
      if (cmd.includes('git add') || cmd.includes('git commit')) {
        return '' as any;
      }
      return '' as any;
    });
    
    // Create managers
    contextMonitor = new ContextMonitor();
    sessionManager = new SessionManager();
    
    // Create a test session
    const params: SessionStartParams = {
      project_name: 'test-project',
      session_type: 'feature',
      estimated_scope: {
        lines_of_code: 1000,
        test_coverage: 500,
        documentation: 200,
      },
    };
    
    const session = await sessionManager.startSession(params);
    sessionId = session.id;
  });

  afterEach(() => {
    // Clean up test database
    cleanupTestDatabase();
  });

  describe('trackUsage', () => {
    it('should track context usage in database', async () => {
      await contextMonitor.trackUsage(sessionId, 'implementation', 500, 'Created component');
      
      const status = await contextMonitor.getStatus({ session_id: sessionId });
      expect(status.used_tokens).toBe(500);
      expect(status.phase_breakdown['implementation']).toBe(500);
    });

    it('should accumulate usage across multiple calls', async () => {
      await contextMonitor.trackUsage(sessionId, 'implementation', 300, 'Method 1');
      await contextMonitor.trackUsage(sessionId, 'implementation', 200, 'Method 2');
      await contextMonitor.trackUsage(sessionId, 'testing', 150, 'Test suite');
      
      const status = await contextMonitor.getStatus({ session_id: sessionId });
      expect(status.used_tokens).toBe(650);
      expect(status.phase_breakdown['implementation']).toBe(500);
      expect(status.phase_breakdown['testing']).toBe(150);
    });

    it('should emit status updates via observable', async () => {
      let emittedStatus: any = null;
      
      contextMonitor.getContextStatus().subscribe(status => {
        emittedStatus = status;
      });
      
      await contextMonitor.trackUsage(sessionId, 'planning', 100, 'Initial planning');
      
      expect(emittedStatus).not.toBeNull();
      expect(emittedStatus.used_tokens).toBe(100);
      expect(emittedStatus.usage_percent).toBeCloseTo(0.0042, 3);
    });
  });

  describe('getStatus', () => {
    beforeEach(async () => {
      // Add some usage data
      await contextMonitor.trackUsage(sessionId, 'planning', 2000, 'Planning phase');
      await contextMonitor.trackUsage(sessionId, 'implementation', 8000, 'Core implementation');
      await contextMonitor.trackUsage(sessionId, 'testing', 5000, 'Test suite');
    });

    it('should calculate correct usage percentages', async () => {
      const status = await contextMonitor.getStatus({ session_id: sessionId });
      
      expect(status.used_tokens).toBe(15000);
      expect(status.total_tokens).toBe(23880); // From Session 2 tests
      expect(status.usage_percent).toBeCloseTo(0.628, 2);
    });

    it('should provide phase breakdown', async () => {
      const status = await contextMonitor.getStatus({ session_id: sessionId });
      
      expect(status.phase_breakdown).toEqual({
        planning: 2000,
        implementation: 8000,
        testing: 5000,
      });
    });

    it('should detect usage trends', async () => {
      // Add more recent high usage
      for (let i = 0; i < 5; i++) {
        await contextMonitor.trackUsage(sessionId, 'implementation', 1000, `Operation ${i}`);
      }
      
      const status = await contextMonitor.getStatus({ session_id: sessionId });
      expect(status.trend).toBe('critical'); // High recent usage should trigger critical
    });
  });

  describe('predict', () => {
    beforeEach(async () => {
      await contextMonitor.trackUsage(sessionId, 'implementation', 10000, 'Implementation work');
    });

    it('should predict remaining capacity', async () => {
      const prediction = await contextMonitor.predict({
        session_id: sessionId,
        planned_tasks: ['Add error handling', 'Write documentation'],
      });
      
      expect(prediction.remaining_capacity).toBe(13880); // 23880 - 10000
      expect(prediction.tasks_feasible).toContain('Add error handling');
    });

    it('should recommend checkpoint when usage is high', async () => {
      // Use up more context
      await contextMonitor.trackUsage(sessionId, 'testing', 6000, 'Test coverage');
      
      const prediction = await contextMonitor.predict({ session_id: sessionId });
      expect(prediction.recommended_checkpoint).toBe(true);
      expect(prediction.optimization_suggestions.length).toBeGreaterThan(0);
    });

    it('should analyze task feasibility', async () => {
      const prediction = await contextMonitor.predict({
        session_id: sessionId,
        planned_tasks: [
          'simple method implementation',
          'complex integration work',
          'comprehensive test suite',
        ],
      });
      
      expect(prediction.tasks_feasible).toContain('simple method implementation');
      // Complex tasks might not be feasible with limited remaining capacity
      if (prediction.remaining_capacity < 4000) {
        expect(prediction.tasks_feasible).not.toContain('complex integration work');
      }
    });
  });

  describe('optimize', () => {
    beforeEach(async () => {
      await contextMonitor.trackUsage(sessionId, 'planning', 2000, 'Planning');
      await contextMonitor.trackUsage(sessionId, 'implementation', 10000, 'Implementation');
      await contextMonitor.trackUsage(sessionId, 'testing', 5000, 'Testing');
    });

    it('should suggest low-risk optimizations first', async () => {
      const result = await contextMonitor.optimize({
        session_id: sessionId,
        target_reduction: 1000,
        preserve_functionality: true,
      });
      
      expect(result.optimizations_applied).toContain('Remove comments');
      expect(result.optimizations_applied).toContain('Consolidate imports');
      expect(result.tokens_saved).toBeGreaterThan(0);
      expect(result.side_effects.length).toBe(0); // Low risk = no side effects
    });

    it('should apply medium-risk optimizations when needed', async () => {
      const result = await contextMonitor.optimize({
        session_id: sessionId,
        target_reduction: 5000,
        preserve_functionality: false,
      });
      
      expect(result.optimizations_applied.length).toBeGreaterThan(2);
      expect(result.side_effects.length).toBeGreaterThan(0);
      expect(result.tokens_saved).toBeGreaterThanOrEqual(5000);
    });

    it('should calculate new capacity after optimization', async () => {
      const result = await contextMonitor.optimize({
        session_id: sessionId,
        target_reduction: 2000,
      });
      
      const expectedNewCapacity = (23880 - 17000) + result.tokens_saved;
      expect(result.new_capacity).toBe(expectedNewCapacity);
    });
  });

  describe('getAnalytics', () => {
    beforeEach(async () => {
      // Create varied usage patterns
      await contextMonitor.trackUsage(sessionId, 'planning', 500, 'Small planning');
      await contextMonitor.trackUsage(sessionId, 'planning', 1500, 'Large planning');
      await contextMonitor.trackUsage(sessionId, 'implementation', 200, 'Small impl');
      await contextMonitor.trackUsage(sessionId, 'implementation', 5000, 'Large impl'); // Peak
      await contextMonitor.trackUsage(sessionId, 'testing', 1000, 'Tests');
    });

    it('should calculate phase averages', async () => {
      const analytics = await contextMonitor.getAnalytics(sessionId);
      
      expect(analytics.average_per_phase['planning']).toBe(1000); // (500 + 1500) / 2
      expect(analytics.average_per_phase['implementation']).toBe(2600); // (200 + 5000) / 2
      expect(analytics.average_per_phase['testing']).toBe(1000);
    });

    it('should identify peak usage points', async () => {
      const analytics = await contextMonitor.getAnalytics(sessionId);
      
      expect(analytics.peak_usage_points.length).toBeGreaterThan(0);
      expect(analytics.peak_usage_points[0].tokens).toBe(5000);
      expect(analytics.peak_usage_points[0].reason).toContain('Large impl');
    });

    it('should calculate efficiency score', async () => {
      const analytics = await contextMonitor.getAnalytics(sessionId);
      
      expect(analytics.efficiency_score).toBeGreaterThan(0);
      expect(analytics.efficiency_score).toBeLessThanOrEqual(100);
    });
  });

  describe('integration with SessionManager', () => {
    it('should track usage when creating checkpoints', async () => {
      let statusBefore = await contextMonitor.getStatus({ session_id: sessionId });
      const usedBefore = statusBefore.used_tokens;
      
      await sessionManager.createCheckpoint({
        session_id: sessionId,
        completed_components: ['Feature A', 'Feature B'],
        metrics: {
          lines_written: 500,
          tests_passing: 10,
          context_used_percent: 25,
        },
      });
      
      const statusAfter = await contextMonitor.getStatus({ session_id: sessionId });
      expect(statusAfter.used_tokens).toBeGreaterThan(usedBefore);
    });
  });
});