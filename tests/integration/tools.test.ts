import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { SessionManager } from '../../src/managers/SessionManager';
import { ContextMonitor } from '../../src/managers/ContextMonitor';
import { RealityChecker } from '../../src/managers/RealityChecker';
import { DocumentationEngine } from '../../src/managers/DocumentationEngine';
import { ProjectTracker } from '../../src/managers/ProjectTracker';
import { DatabaseConnection } from '../../src/database';
import { rmSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { setupTestDatabase, cleanupTestDatabase } from '../helpers/database';

describe('Integration Tests - Full Workflow', () => {
  let sessionManager: SessionManager;
  let contextMonitor: ContextMonitor;
  let realityChecker: RealityChecker;
  let documentationEngine: DocumentationEngine;
  let projectTracker: ProjectTracker;
  
  const testProjectPath = join(process.cwd(), 'test-project');
  const testDocsPath = join(process.cwd(), 'docs', 'generated', 'test-project');

  beforeEach(() => {
    // Setup test database
    setupTestDatabase();
    
    // Create test project directory
    if (!existsSync(testProjectPath)) {
      mkdirSync(testProjectPath, { recursive: true });
    }
    
    // Create some test files
    writeFileSync(join(testProjectPath, 'index.ts'), 'export const hello = () => "world";');
    writeFileSync(join(testProjectPath, 'utils.ts'), 'export const add = (a: number, b: number) => a + b;');
    writeFileSync(join(testProjectPath, 'test.spec.ts'), 'describe("test", () => { it("works", () => {}); });');
    
    // Initialize all managers
    sessionManager = new SessionManager();
    contextMonitor = new ContextMonitor();
    realityChecker = new RealityChecker();
    documentationEngine = new DocumentationEngine();
    projectTracker = new ProjectTracker();
  });

  afterEach(() => {
    // Clean up test database
    cleanupTestDatabase();
    
    // Clean up test files
    if (existsSync(testProjectPath)) {
      rmSync(testProjectPath, { recursive: true });
    }
    if (existsSync(testDocsPath)) {
      rmSync(testDocsPath, { recursive: true });
    }
  });

  describe('Complete Session Workflow', () => {
    it('should handle full session lifecycle with all managers', async () => {
      // 1. Start a new session
      const session = await sessionManager.startSession({
        project_name: 'test-project',
        session_type: 'feature',
        estimated_scope: {
          lines_of_code: 500,
          test_coverage: 200,
          documentation: 100,
        },
      });

      expect(session.id).toBeDefined();
      expect(session.status).toBe('active');

      // 2. Track the project
      const project = await projectTracker.track({
        project_name: 'test-project',
        session_id: session.id,
      });

      expect(project.name).toBe('test-project');
      expect(project.total_sessions).toBe(1);

      // 3. Monitor context usage
      await contextMonitor.trackUsage(session.id, 'planning', 1000, 'initial_setup');
      
      const contextStatus = await contextMonitor.getStatus({ session_id: session.id });

      expect(contextStatus.used_tokens).toBe(1000);
      expect(contextStatus.total_tokens - contextStatus.used_tokens).toBe(99000);

      // 4. Check reality of the project
      const realityCheck = await realityChecker.performCheck({
        session_id: session.id,
        check_type: 'comprehensive',
        focus_areas: [],
      });

      expect(realityCheck.confidence_score).toBeGreaterThan(50);
      expect(realityCheck.discrepancies).toBeDefined();

      // 5. Create checkpoint
      const checkpoint = await sessionManager.createCheckpoint({
        session_id: session.id,
        completed_components: ['setup', 'initial_files'],
        metrics: {
          lines_written: 50,
          tests_passing: 0,
          context_used_percent: 1,
        },
        commit_message: 'Initial setup complete',
      });

      expect(checkpoint.checkpoint_id).toBeDefined();
      expect(checkpoint.context_snapshot.context_used).toBe(1000);

      // 6. Generate documentation
      const docResult = await documentationEngine.generate({
        session_id: session.id,
        doc_type: 'readme',
        include_sections: ['overview', 'installation', 'usage'],
      });

      expect(docResult.document_path).toContain('test-project_readme');
      expect(docResult.sections_generated).toContain('Overview');

      // 7. Report a blocker
      const blocker = await projectTracker.reportBlocker({
        session_id: session.id,
        type: 'technical',
        description: 'Need to refactor authentication module',
        impact_score: 6,
      });

      expect(blocker.type).toBe('technical');
      expect(blocker.session_id).toBe(session.id);

      // 8. Track more context usage
      await contextMonitor.trackUsage(session.id, 'implementation', 5000, 'coding');

      // 9. Create another checkpoint
      await sessionManager.createCheckpoint({
        session_id: session.id,
        completed_components: ['setup', 'initial_files', 'core_logic'],
        metrics: {
          lines_written: 200,
          tests_passing: 0,
          context_used_percent: 6,
        },
      });

      // 10. Resolve the blocker
      const resolved = await projectTracker.resolveBlocker({
        blocker_id: blocker.id,
        resolution: 'Refactored auth module to use JWT tokens',
      });

      expect(resolved.resolution).toBe('Refactored auth module to use JWT tokens');

      // 11. Complete the session with handoff
      const handoff = await sessionManager.createHandoff({
        session_id: session.id,
        next_session_goals: ['Deploy to staging', 'Performance testing'],
      });
      
      // Session should be in handoff status after createHandoff
      const sessionAfterHandoff = await sessionManager.getActiveSession();
      expect(sessionAfterHandoff).toBeNull(); // No active session after handoff

      // 12. Generate project report
      const report = await projectTracker.generateReport({
        project_id: project.id,
        include_predictions: true,
      });

      expect(report.project.total_sessions).toBe(1);
      expect(report.blockers_summary.resolved).toBe(report.blockers_summary.total); // All resolved
      expect(report.velocity_analysis).toBeDefined();
      expect(report.predictions).toBeDefined();
    });
  });

  describe('Context Management Throughout Session', () => {
    it('should track context correctly across operations', async () => {
      const session = await sessionManager.startSession({
        project_name: 'context-test',
        session_type: 'bugfix',
        estimated_scope: {
          lines_of_code: 100,
          test_coverage: 50,
          documentation: 20,
        },
      });

      // Track multiple operations
      const operations = [
        { tokens: 500, operation: 'analysis' },
        { tokens: 1500, operation: 'implementation' },
        { tokens: 800, operation: 'testing' },
        { tokens: 200, operation: 'documentation' },
      ];

      let totalUsed = 0;
      for (const op of operations) {
        await contextMonitor.trackUsage(session.id, 'implementation', op.tokens, op.operation);
        const status = await contextMonitor.getStatus({ session_id: session.id });

        totalUsed += op.tokens;
        expect(status.used_tokens).toBe(totalUsed);
      }

      // Check status
      const status = await contextMonitor.getStatus({ session_id: session.id });
      expect(status.trend).toBe('stable'); // 3000/100000 = 3%

      // Predict usage
      const prediction = await contextMonitor.predict({
        session_id: session.id,
        planned_tasks: ['refactoring', 'final_tests'],
      });

      expect(prediction.remaining_capacity).toBeGreaterThan(0);
      expect(prediction.recommended_checkpoint).toBe(false);
    });
  });

  describe('Reality Checks with File Changes', () => {
    it('should detect discrepancies after file modifications', async () => {
      const session = await sessionManager.startSession({
        project_name: 'reality-test',
        session_type: 'feature',
        estimated_scope: {
          lines_of_code: 100,
          test_coverage: 50,
          documentation: 20,
        },
      });

      // Initial reality check
      const check1 = await realityChecker.performCheck({
        session_id: session.id,
        check_type: 'quick',
        focus_areas: [],
      });

      expect(check1.discrepancies).toBeDefined();
      const initialDiscrepancies = check1.discrepancies.length;

      // Add a new file
      writeFileSync(join(testProjectPath, 'newfile.ts'), 'export const newFunc = () => {}');

      // Check again
      const check2 = await realityChecker.performCheck({
        session_id: session.id,
        check_type: 'quick',
        focus_areas: [],
      });

      // May have discrepancies for uncommitted files
      expect(check2.discrepancies).toBeDefined();

      // Simulate session claiming fewer files
      await sessionManager.createCheckpoint({
        session_id: session.id,
        completed_components: ['added_files'],
        metrics: {
          lines_written: 0,
          tests_passing: 0,
          context_used_percent: 1,
        },
        commit_message: 'No files created', // Claim no files created
      });

      // Validate metrics
      const validation = await realityChecker.validateMetrics({
        session_id: session.id,
        reported_metrics: {
          lines_written: 0,
          tests_written: 0,
          tests_passing: 0,
          docs_updated: 0,
        },
      });

      // Should detect lines written mismatch
      const linesMetric = validation.find(m => m.name === 'lines_written');
      expect(linesMetric?.variance_percent).toBeGreaterThan(0);
    });
  });

  describe('Documentation Lifecycle', () => {
    it('should generate and update documentation throughout session', async () => {
      const session = await sessionManager.startSession({
        project_name: 'docs-test',
        session_type: 'feature',
        estimated_scope: {
          lines_of_code: 100,
          test_coverage: 50,
          documentation: 20,
        },
      });

      // Generate initial README
      const readme = await documentationEngine.generate({
        session_id: session.id,
        doc_type: 'readme',
      });

      expect(readme.document_path).toBeDefined();
      expect(existsSync(readme.document_path)).toBe(true);

      // Check status
      const status1 = await documentationEngine.checkStatus({
        file_paths: [readme.document_path],
      });

      expect(status1[0].last_updated).toBeGreaterThan(0);
      expect(status1[0].sync_status).toBe('current');

      // Update with new content
      const updated = await documentationEngine.update({
        file_path: readme.document_path,
        update_type: 'append',
        context: { newSection: '\n## New Features\n- Added awesome functionality' },
      });

      expect(updated.sync_status).toBe('current');

      // Generate API docs
      const apiDocs = await documentationEngine.generate({
        session_id: session.id,
        doc_type: 'api',
      });

      expect(apiDocs.document_path).toBeDefined();

      // Generate handoff document at session end
      await sessionManager.createCheckpoint({
        session_id: session.id,
        completed_components: ['feature_complete'],
        metrics: {
          lines_written: 100,
          tests_passing: 5,
          context_used_percent: 10,
        },
      });

      const handoff = await documentationEngine.generate({
        session_id: session.id,
        doc_type: 'handoff',
      });

      expect(handoff.document_path).toBeDefined();
      expect(handoff.sections_generated).toContain('Session Summary');
      expect(handoff.sections_generated).toContain('Completed Work');
    });
  });

  describe('Project Velocity Analysis', () => {
    it('should track velocity across multiple sessions', async () => {
      // Create first session
      const session1 = await sessionManager.startSession({
        project_name: 'velocity-test',
        session_type: 'feature',
        estimated_scope: {
          lines_of_code: 500,
          test_coverage: 200,
          documentation: 100,
        },
      });

      const project = await projectTracker.track({
        project_name: 'velocity-test',
        session_id: session1.id,
      });

      // Simulate work
      await contextMonitor.trackUsage(session1.id, 'implementation', 15000, 'feature_development');

      await sessionManager.createHandoff({
        session_id: session1.id,
        next_session_goals: ['Continue development'],
      });

      // Create second session
      const session2 = await sessionManager.startSession({
        project_name: 'velocity-test',
        session_type: 'feature',
        estimated_scope: {
          lines_of_code: 500,
          test_coverage: 200,
          documentation: 100,
        },
      });

      await projectTracker.track({
        project_name: 'velocity-test',
        session_id: session2.id,
      });

      await contextMonitor.trackUsage(session2.id, 'implementation', 12000, 'feature_development');

      // Get project report to check velocity
      const projectReport = await projectTracker.generateReport({
        project_id: project.id,
        include_predictions: false,
      });

      expect(projectReport.project.total_sessions).toBe(2);
      expect(projectReport.velocity_analysis).toBeDefined();

      // Generate report with predictions
      const report = await projectTracker.generateReport({
        project_id: project.id,
        include_predictions: true,
      });

      expect(report.predictions).toBeDefined();
      expect(report.predictions?.estimated_completion).toBeGreaterThan(0);
    });
  });

  describe('Error Recovery', () => {
    it('should handle session recovery after errors', async () => {
      const session = await sessionManager.startSession({
        project_name: 'error-test',
        session_type: 'bugfix',
        estimated_scope: {
          lines_of_code: 100,
          test_coverage: 50,
          documentation: 20,
        },
      });

      // Create checkpoint before "error"
      const checkpoint = await sessionManager.createCheckpoint({
        session_id: session.id,
        completed_components: ['initial_analysis'],
        metrics: {
          lines_written: 20,
          tests_passing: 0,
          context_used_percent: 5,
        },
      });

      // Simulate some work
      await contextMonitor.trackUsage(session.id, 'implementation', 5000, 'debugging');

      // "Recover" by creating handoff
      const handoff = await sessionManager.createHandoff({
        session_id: session.id,
        next_session_goals: ['Continue debugging', 'Implement fix'],
        include_context_dump: true,
      });

      expect(handoff.context_requirements).toBeDefined();
      expect(handoff.prerequisite_checks).toBeDefined();

      // New session can continue from handoff
      const newSession = await sessionManager.startSession({
        project_name: 'error-test',
        session_type: 'bugfix',
        estimated_scope: {
          lines_of_code: 80,
          test_coverage: 40,
          documentation: 10,
        },
        context_budget: 95000, // Continue with remaining budget
      });

      expect(newSession.id).not.toBe(session.id);
      expect(newSession.project_name).toBe('error-test');
    });
  });
});