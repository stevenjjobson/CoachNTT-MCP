import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { SessionManager } from '../src/managers/SessionManager';
import { DatabaseConnection } from '../src/database';
import { SessionStartParams, Session, CheckpointParams } from '../src/interfaces';
import { rmSync, existsSync } from 'fs';
import { join } from 'path';
import { setupTestDatabase, cleanupTestDatabase } from './helpers/database';

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  const testDbPath = join(process.cwd(), 'test-data', 'test.db');
  const testDbDir = join(process.cwd(), 'test-data');

  beforeEach(() => {
    // Set up test database
    setupTestDatabase();
    
    // Create fresh session manager
    sessionManager = new SessionManager();
  });

  afterEach(() => {
    // Clean up test database
    cleanupTestDatabase();
  });

  describe('startSession', () => {
    it('should create a new session with proper initialization', async () => {
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

      expect(session.id).toBeDefined();
      expect(session.project_name).toBe('test-project');
      expect(session.session_type).toBe('feature');
      expect(session.status).toBe('active');
      expect(session.current_phase).toBe('planning');
      expect(session.context_plan.total_budget).toBeGreaterThan(0);
      expect(session.metrics.lines_written).toBe(0);
      expect(session.metrics.tests_written).toBe(0);
    });

    it('should calculate context budget correctly', async () => {
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
      
      // Base calculation: (1000 * 10) + (500 * 10 * 1.5) + (200 * 10 * 1.2) = 19,900
      // With 20% buffer: 19,900 * 1.2 = 23,880
      expect(session.context_plan.total_budget).toBe(23880);
      expect(session.context_plan.phase_allocation.planning).toBe(2388);
      expect(session.context_plan.phase_allocation.implementation).toBe(11940);
      expect(session.context_plan.phase_allocation.testing).toBe(5970);
      expect(session.context_plan.phase_allocation.documentation).toBe(3582);
    });

    it('should create initial checkpoint', async () => {
      const params: SessionStartParams = {
        project_name: 'test-project',
        session_type: 'feature',
        estimated_scope: {
          lines_of_code: 100,
          test_coverage: 50,
          documentation: 20,
        },
      };

      const session = await sessionManager.startSession(params);
      
      // Verify initial checkpoint was created
      const db = DatabaseConnection.getInstance();
      const checkpoints = db.all(
        'SELECT * FROM checkpoints WHERE session_id = ?',
        session.id
      );
      
      expect(checkpoints).toHaveLength(1);
      expect((checkpoints[0] as any).checkpoint_number).toBe(0);
      expect((checkpoints[0] as any).context_used).toBe(0);
    });

    it('should emit session to observables', async () => {
      let emittedSession: Session | null = null;
      
      sessionManager.getCurrentSession().subscribe(session => {
        emittedSession = session;
      });

      const params: SessionStartParams = {
        project_name: 'test-project',
        session_type: 'feature',
        estimated_scope: {
          lines_of_code: 100,
          test_coverage: 50,
          documentation: 20,
        },
      };

      await sessionManager.startSession(params);
      
      expect(emittedSession).not.toBeNull();
      expect(emittedSession!.status).toBe('active');
    });
  });

  describe('createCheckpoint', () => {
    let activeSession: Session;

    beforeEach(async () => {
      const params: SessionStartParams = {
        project_name: 'test-project',
        session_type: 'feature',
        estimated_scope: {
          lines_of_code: 1000,
          test_coverage: 500,
          documentation: 200,
        },
      };
      activeSession = await sessionManager.startSession(params);
    });

    it('should create checkpoint with metrics', async () => {
      const checkpointParams: CheckpointParams = {
        session_id: activeSession.id,
        completed_components: ['SessionManager core', 'Database integration'],
        metrics: {
          lines_written: 500,
          tests_passing: 10,
          context_used_percent: 35,
        },
      };

      const checkpoint = await sessionManager.createCheckpoint(checkpointParams);

      expect(checkpoint.checkpoint_id).toContain(activeSession.id);
      expect(checkpoint.context_snapshot.context_used).toBe(8358); // 35% of 23880
      expect(checkpoint.context_snapshot.important_files).toContain('src/managers/SessionManager.ts');
      expect(checkpoint.continuation_plan.remaining_tasks).toContain('Context planning');
    });

    it('should update session metrics after checkpoint', async () => {
      const checkpointParams: CheckpointParams = {
        session_id: activeSession.id,
        completed_components: ['Core implementation'],
        metrics: {
          lines_written: 700,
          tests_passing: 15,
          context_used_percent: 40,
        },
      };

      await sessionManager.createCheckpoint(checkpointParams);
      
      const updatedSession = await sessionManager.getSessionStatus({ 
        session_id: activeSession.id 
      });
      
      expect(updatedSession.metrics.lines_written).toBe(700);
      expect(updatedSession.metrics.tests_passing).toBe(15);
      expect(updatedSession.current_phase).toBe('implementation');
    });

    it('should fail if session is not active', async () => {
      // Complete the session first
      await sessionManager.completeSession(activeSession.id);
      
      const checkpointParams: CheckpointParams = {
        session_id: activeSession.id,
        completed_components: ['test'],
        metrics: {
          lines_written: 100,
          tests_passing: 5,
          context_used_percent: 10,
        },
      };

      await expect(
        sessionManager.createCheckpoint(checkpointParams)
      ).rejects.toThrow('is not active');
    });
  });

  describe('createHandoff', () => {
    let activeSession: Session;

    beforeEach(async () => {
      const params: SessionStartParams = {
        project_name: 'test-project',
        session_type: 'feature',
        estimated_scope: {
          lines_of_code: 1000,
          test_coverage: 500,
          documentation: 200,
        },
      };
      activeSession = await sessionManager.startSession(params);
      
      // Add some progress
      await sessionManager.createCheckpoint({
        session_id: activeSession.id,
        completed_components: ['Core features'],
        metrics: {
          lines_written: 600,
          tests_passing: 20,
          context_used_percent: 60,
        },
      });
    });

    it('should generate handoff document', async () => {
      const handoff = await sessionManager.createHandoff({
        session_id: activeSession.id,
        next_session_goals: ['Complete testing', 'Add documentation'],
      });

      expect(handoff.handoff_document).toContain('Session Handoff Document');
      expect(handoff.handoff_document).toContain('test-project');
      expect(handoff.handoff_document).toContain('600/1000');
      expect(handoff.handoff_document).toContain('Next Session Goals');
      expect(handoff.handoff_document).toContain('Complete testing');
    });

    it('should include context requirements', async () => {
      const handoff = await sessionManager.createHandoff({
        session_id: activeSession.id,
      });

      expect(handoff.context_requirements.length).toBeGreaterThanOrEqual(2);
      expect(handoff.context_requirements[0].file_path).toBe('src/managers/SessionManager.ts');
      expect(handoff.context_requirements[0].priority).toBe('critical');
    });

    it('should estimate next session', async () => {
      const handoff = await sessionManager.createHandoff({
        session_id: activeSession.id,
        next_session_goals: ['Implement remaining features', 'Complete test suite'],
      });

      expect(handoff.estimated_next_session.estimated_lines).toBeGreaterThan(400);
      expect(handoff.estimated_next_session.complexity_score).toBeGreaterThan(50);
    });

    it('should clear active session observable', async () => {
      let currentSession: Session | null = activeSession;
      
      sessionManager.getCurrentSession().subscribe(session => {
        currentSession = session;
      });

      await sessionManager.createHandoff({
        session_id: activeSession.id,
      });

      expect(currentSession).toBeNull();
    });
  });

  describe('completeSession', () => {
    let activeSession: Session;

    beforeEach(async () => {
      const params: SessionStartParams = {
        project_name: 'test-project',
        session_type: 'feature',
        estimated_scope: {
          lines_of_code: 1000,
          test_coverage: 500,
          documentation: 200,
        },
      };
      activeSession = await sessionManager.startSession(params);
    });

    it('should mark session as complete', async () => {
      const completedSession = await sessionManager.completeSession(activeSession.id);
      
      expect(completedSession.status).toBe('complete');
      expect(completedSession.id).toBe(activeSession.id);
    });

    it('should update project statistics', async () => {
      await sessionManager.completeSession(activeSession.id);
      
      const db = DatabaseConnection.getInstance();
      const projectStats = db.get<any>(
        'SELECT * FROM projects WHERE name = ?',
        'test-project'
      );
      
      expect(projectStats).toBeDefined();
      expect(projectStats.total_sessions).toBe(1);
    });

    it('should clear all observables', async () => {
      let currentSession: Session | null = activeSession;
      let currentMetrics: any = activeSession.metrics;
      let currentContext: any = { used: 0, total: 1, percent: 0 };
      
      sessionManager.getCurrentSession().subscribe(s => currentSession = s);
      sessionManager.getSessionMetrics().subscribe(m => currentMetrics = m);
      sessionManager.getContextStatus().subscribe(c => currentContext = c);
      
      await sessionManager.completeSession(activeSession.id);
      
      expect(currentSession).toBeNull();
      expect(currentMetrics).toBeNull();
      expect(currentContext).toBeNull();
    });
  });

  describe('session queries', () => {
    beforeEach(async () => {
      // Create multiple sessions
      for (let i = 0; i < 3; i++) {
        const session = await sessionManager.startSession({
          project_name: `project-${i}`,
          session_type: 'feature',
          estimated_scope: {
            lines_of_code: 100 * (i + 1),
            test_coverage: 50,
            documentation: 20,
          },
        });
        
        if (i < 2) {
          await sessionManager.completeSession(session.id);
        }
      }
    });

    it('should get active session', async () => {
      const activeSession = await sessionManager.getActiveSession();
      
      expect(activeSession).not.toBeNull();
      expect(activeSession?.project_name).toBe('project-2');
      expect(activeSession?.status).toBe('active');
    });

    it('should get session history', async () => {
      const history = await sessionManager.getSessionHistory();
      
      expect(history).toHaveLength(3);
      expect(history[0].project_name).toBe('project-2'); // Most recent first
    });

    it('should filter session history by project', async () => {
      const history = await sessionManager.getSessionHistory({
        project_name: 'project-1',
      });
      
      expect(history).toHaveLength(1);
      expect(history[0].project_name).toBe('project-1');
    });

    it('should limit session history results', async () => {
      const history = await sessionManager.getSessionHistory({
        limit: 2,
      });
      
      expect(history).toHaveLength(2);
    });
  });
});