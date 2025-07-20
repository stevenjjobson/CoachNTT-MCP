import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ProjectTracker } from '../src/managers/ProjectTracker';
import { DatabaseConnection } from '../src/database';
import { Project, VelocityMetrics, Blocker } from '../src/interfaces';
import { setupTestDatabase, cleanupTestDatabase } from './helpers/database';

describe('ProjectTracker', () => {
  let projectTracker: ProjectTracker;

  // Mock data
  const mockSession = {
    id: 'session-123',
    project_name: 'test-project',
    session_type: 'feature',
    status: 'active',
    started_at: Date.now() - 3600000, // 1 hour ago
    context_budget: 100000,
    context_used: 25000,
    progress: {
      completed_files: 15,
      test_files: 8,
      documentation_files: 3,
    },
  };

  const mockProject: Project = {
    id: 'project-123',
    name: 'test-project',
    tech_stack: 'TypeScript, Node.js, Jest',
    status: 'active',
    sessions_count: 5,
    total_context: 250000,
    file_count: 150,
    created_at: Date.now() - 86400000 * 7, // 7 days ago
    updated_at: Date.now(),
  };

  const mockSessions = [
    { ...mockSession, id: 'session-1', context_used: 20000, progress: { completed_files: 10 } },
    { ...mockSession, id: 'session-2', context_used: 30000, progress: { completed_files: 20 } },
    { ...mockSession, id: 'session-3', context_used: 25000, progress: { completed_files: 15 } },
  ];

  beforeEach(() => {
    // Setup test database
    setupTestDatabase();
    
    // Create fresh project tracker
    projectTracker = new ProjectTracker();

    // Setup database mocks
    const dbMock = DatabaseConnection.getInstance();
    
    jest.spyOn(dbMock, 'get').mockImplementation((query: string) => {
      if (query.includes('sessions') && query.includes('WHERE id')) return mockSession;
      if (query.includes('projects') && query.includes('WHERE name')) return mockProject;
      if (query.includes('projects') && query.includes('WHERE id')) return mockProject;
      if (query.includes('blockers')) return null;
      return null;
    });

    jest.spyOn(dbMock, 'all').mockImplementation((query: string) => {
      if (query.includes('sessions') && query.includes('ORDER BY started_at')) return mockSessions;
      if (query.includes('blockers') && query.includes('WHERE project_id')) return [];
      if (query.includes('context_snapshots')) return [];
      return [];
    });

    jest.spyOn(dbMock, 'run').mockImplementation(() => ({ lastInsertRowid: 1, changes: 1 }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    cleanupTestDatabase();
  });

  describe('track', () => {
    it('should track existing project and update session', async () => {
      const params = {
        project_name: 'test-project',
        session_id: 'session-123',
      };

      const result = await projectTracker.track(params);

      expect(result.name).toBe('test-project');
      expect(result.status).toBe('active');
      
      // Should update session with project_id
      const runSpy = jest.spyOn(DatabaseConnection.getInstance(), 'run');
      expect(runSpy).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE sessions SET project_id'),
        'project-123',
        'session-123'
      );
    });

    it('should create new project if not exists', async () => {
      jest.spyOn(DatabaseConnection.getInstance(), 'get').mockImplementation((query) => {
        if (query.includes('projects')) return null;
        if (query.includes('sessions')) return mockSession;
        return null;
      });

      const params = {
        project_name: 'new-project',
        session_id: 'session-123',
      };

      const result = await projectTracker.track(params);

      expect(result.name).toBe('new-project');
      
      const runSpy = jest.spyOn(DatabaseConnection.getInstance(), 'run');
      expect(runSpy).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO projects'),
        expect.any(String), // id
        'new-project',
        expect.any(String), // tech_stack
        'active',
        1, // sessions_count
        expect.any(Number), // total_context
        expect.any(Number), // file_count
        expect.any(Number), // created_at
        expect.any(Number)  // updated_at
      );
    });

    it('should update project metrics from session', async () => {
      const params = {
        project_name: 'test-project',
        session_id: 'session-123',
      };

      await projectTracker.track(params);

      const runSpy = jest.spyOn(DatabaseConnection.getInstance(), 'run');
      expect(runSpy).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE projects SET'),
        expect.any(Number), // total_context
        expect.any(Number), // file_count
        expect.any(Number), // updated_at
        'project-123'
      );
    });

    it('should update observable status', async () => {
      const statusUpdates: (Project | null)[] = [];
      const subscription = projectTracker.getProjectStatus().subscribe(status => {
        statusUpdates.push(status);
      });

      await projectTracker.track({
        project_name: 'test-project',
        session_id: 'session-123',
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(statusUpdates.length).toBeGreaterThan(0);
      const lastUpdate = statusUpdates[statusUpdates.length - 1];
      expect(lastUpdate?.name).toBe('test-project');

      subscription.unsubscribe();
    });

    it('should throw error if session not found', async () => {
      jest.spyOn(DatabaseConnection.getInstance(), 'get').mockImplementation((query) => {
        if (query.includes('sessions')) return null;
        return mockProject;
      });

      await expect(projectTracker.track({
        project_name: 'test-project',
        session_id: 'invalid-session',
      })).rejects.toThrow('Session invalid-session not found');
    });
  });

  describe('analyzeVelocity', () => {
    it('should calculate velocity metrics for default time window', async () => {
      const params = {
        project_id: 'project-123',
      };

      const result = await projectTracker.analyzeVelocity(params);

      expect(result.average_context_per_session).toBe(25000); // (20k + 30k + 25k) / 3
      expect(result.average_files_per_session).toBe(15); // (10 + 20 + 15) / 3
      expect(result.sessions_in_window).toBe(3);
      expect(result.trend).toBeDefined();
    });

    it('should calculate velocity with custom time window', async () => {
      // Mock only recent sessions
      jest.spyOn(DatabaseConnection.getInstance(), 'all').mockImplementation(() => {
        return [mockSessions[2]]; // Only last session
      });

      const params = {
        project_id: 'project-123',
        time_window: 1, // 1 day
      };

      const result = await projectTracker.analyzeVelocity(params);

      expect(result.sessions_in_window).toBe(1);
      expect(result.average_context_per_session).toBe(25000);
    });

    it('should detect improving velocity trend', async () => {
      // Mock sessions with improving metrics
      const improvingSessions = [
        { ...mockSession, id: 's1', context_used: 30000, progress: { completed_files: 10 } },
        { ...mockSession, id: 's2', context_used: 25000, progress: { completed_files: 15 } },
        { ...mockSession, id: 's3', context_used: 20000, progress: { completed_files: 20 } },
      ];

      jest.spyOn(DatabaseConnection.getInstance(), 'all').mockReturnValue(improvingSessions);

      const result = await projectTracker.analyzeVelocity({ project_id: 'project-123' });

      expect(result.trend).toBe('improving');
      expect(result.trend_factors).toContain('efficiency');
    });

    it('should detect declining velocity trend', async () => {
      // Mock sessions with declining metrics
      const decliningSessions = [
        { ...mockSession, id: 's1', context_used: 20000, progress: { completed_files: 20 } },
        { ...mockSession, id: 's2', context_used: 25000, progress: { completed_files: 15 } },
        { ...mockSession, id: 's3', context_used: 30000, progress: { completed_files: 10 } },
      ];

      jest.spyOn(DatabaseConnection.getInstance(), 'all').mockReturnValue(decliningSessions);

      const result = await projectTracker.analyzeVelocity({ project_id: 'project-123' });

      expect(result.trend).toBe('declining');
    });

    it('should handle no sessions in window', async () => {
      jest.spyOn(DatabaseConnection.getInstance(), 'all').mockReturnValue([]);

      const result = await projectTracker.analyzeVelocity({ project_id: 'project-123' });

      expect(result.sessions_in_window).toBe(0);
      expect(result.average_context_per_session).toBe(0);
      expect(result.average_files_per_session).toBe(0);
      expect(result.trend).toBe('stable');
    });

    it('should update velocity metrics observable', async () => {
      const metricsUpdates: (VelocityMetrics | null)[] = [];
      const subscription = projectTracker.getVelocityMetrics().subscribe(metrics => {
        metricsUpdates.push(metrics);
      });

      await projectTracker.analyzeVelocity({ project_id: 'project-123' });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(metricsUpdates.length).toBeGreaterThan(0);
      const lastUpdate = metricsUpdates[metricsUpdates.length - 1];
      expect(lastUpdate?.average_context_per_session).toBe(25000);

      subscription.unsubscribe();
    });
  });

  describe('reportBlocker', () => {
    it('should create new blocker', async () => {
      const params = {
        session_id: 'session-123',
        type: 'technical' as const,
        description: 'Database connection issues',
        impact_score: 8,
      };

      const result = await projectTracker.reportBlocker(params);

      expect(result.type).toBe('technical');
      expect(result.description).toBe('Database connection issues');
      expect(result.impact_score).toBe(8);
      expect(result.status).toBe('active');

      const runSpy = jest.spyOn(DatabaseConnection.getInstance(), 'run');
      expect(runSpy).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO blockers'),
        expect.any(String), // id
        'project-123',
        'session-123',
        'technical',
        'Database connection issues',
        8,
        'active',
        expect.any(Number), // reported_at
        null // resolved_at
      );
    });

    it('should throw error for invalid session', async () => {
      jest.spyOn(DatabaseConnection.getInstance(), 'get').mockReturnValue(null);

      await expect(projectTracker.reportBlocker({
        session_id: 'invalid',
        type: 'technical',
        description: 'Test',
        impact_score: 5,
      })).rejects.toThrow('Session invalid not found');
    });

    it('should validate impact score range', async () => {
      const params = {
        session_id: 'session-123',
        type: 'technical' as const,
        description: 'Test blocker',
        impact_score: 15, // Out of range
      };

      await expect(projectTracker.reportBlocker(params)).rejects.toThrow('Impact score must be between 1 and 10');
    });
  });

  describe('resolveBlocker', () => {
    const mockBlocker: Blocker = {
      id: 'blocker-123',
      project_id: 'project-123',
      session_id: 'session-123',
      type: 'technical',
      description: 'Database issues',
      impact_score: 8,
      status: 'active',
      reported_at: Date.now() - 3600000,
      resolved_at: null,
    };

    it('should resolve active blocker', async () => {
      jest.spyOn(DatabaseConnection.getInstance(), 'get').mockImplementation((query) => {
        if (query.includes('blockers')) return mockBlocker;
        return null;
      });

      const params = {
        blocker_id: 'blocker-123',
        resolution: 'Fixed connection pooling',
      };

      const result = await projectTracker.resolveBlocker(params);

      expect(result.status).toBe('resolved');
      expect(result.resolved_at).toBeDefined();

      const runSpy = jest.spyOn(DatabaseConnection.getInstance(), 'run');
      expect(runSpy).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE blockers SET status'),
        'resolved',
        expect.any(Number), // resolved_at
        'blocker-123'
      );
    });

    it('should throw error for missing blocker', async () => {
      jest.spyOn(DatabaseConnection.getInstance(), 'get').mockReturnValue(null);

      await expect(projectTracker.resolveBlocker({
        blocker_id: 'missing',
        resolution: 'Test',
      })).rejects.toThrow('Blocker missing not found');
    });

    it('should throw error for already resolved blocker', async () => {
      jest.spyOn(DatabaseConnection.getInstance(), 'get').mockReturnValue({
        ...mockBlocker,
        status: 'resolved',
      });

      await expect(projectTracker.resolveBlocker({
        blocker_id: 'blocker-123',
        resolution: 'Test',
      })).rejects.toThrow('Blocker is already resolved');
    });
  });

  describe('generateReport', () => {
    it('should generate basic project report', async () => {
      const params = {
        project_id: 'project-123',
      };

      const result = await projectTracker.generateReport(params);

      expect(result.project).toEqual(mockProject);
      expect(result.recent_sessions).toHaveLength(3);
      expect(result.active_blockers).toEqual([]);
      expect(result.velocity_metrics).toBeDefined();
      expect(result.velocity_metrics?.average_context_per_session).toBe(25000);
    });

    it('should include predictions when requested', async () => {
      const params = {
        project_id: 'project-123',
        include_predictions: true,
      };

      const result = await projectTracker.generateReport(params);

      expect(result.predictions).toBeDefined();
      expect(result.predictions?.estimated_sessions_remaining).toBeGreaterThan(0);
      expect(result.predictions?.estimated_context_remaining).toBeGreaterThan(0);
      expect(result.predictions?.completion_date).toBeDefined();
      expect(result.predictions?.confidence_factors).toBeDefined();
    });

    it('should filter sessions by time range', async () => {
      const recentSession = { ...mockSession, id: 'recent', started_at: Date.now() - 3600000 };
      const oldSession = { ...mockSession, id: 'old', started_at: Date.now() - 86400000 * 10 };

      jest.spyOn(DatabaseConnection.getInstance(), 'all').mockReturnValue([recentSession, oldSession]);

      const params = {
        project_id: 'project-123',
        time_range: {
          start: Date.now() - 86400000 * 7, // 7 days ago
          end: Date.now(),
        },
      };

      const result = await projectTracker.generateReport(params);

      // Should only include recent session
      expect(result.recent_sessions).toHaveLength(1);
      expect(result.recent_sessions[0].id).toBe('recent');
    });

    it('should include active blockers in report', async () => {
      const activeBlockers = [
        {
          id: 'b1',
          type: 'technical',
          description: 'API integration issues',
          impact_score: 7,
          status: 'active',
        },
        {
          id: 'b2',
          type: 'context',
          description: 'Running out of context budget',
          impact_score: 9,
          status: 'active',
        },
      ];

      jest.spyOn(DatabaseConnection.getInstance(), 'all').mockImplementation((query) => {
        if (query.includes('blockers')) return activeBlockers;
        if (query.includes('sessions')) return mockSessions;
        return [];
      });

      const result = await projectTracker.generateReport({ project_id: 'project-123' });

      expect(result.active_blockers).toHaveLength(2);
      expect(result.active_blockers[0].impact_score).toBe(7);
    });

    it('should throw error for missing project', async () => {
      jest.spyOn(DatabaseConnection.getInstance(), 'get').mockReturnValue(null);

      await expect(projectTracker.generateReport({
        project_id: 'missing',
      })).rejects.toThrow('Project missing not found');
    });
  });

  describe('observables', () => {
    it('should provide project status observable', () => {
      const observable = projectTracker.getProjectStatus();
      expect(observable).toBeDefined();
      expect(observable.subscribe).toBeDefined();
    });

    it('should provide velocity metrics observable', () => {
      const observable = projectTracker.getVelocityMetrics();
      expect(observable).toBeDefined();
      expect(observable.subscribe).toBeDefined();
    });

    it('should emit initial null values', (done) => {
      let count = 0;
      projectTracker.getProjectStatus().subscribe(status => {
        expect(status).toBeNull();
        count++;
        if (count === 2) done();
      });

      projectTracker.getVelocityMetrics().subscribe(metrics => {
        expect(metrics).toBeNull();
        count++;
        if (count === 2) done();
      });
    });
  });
});