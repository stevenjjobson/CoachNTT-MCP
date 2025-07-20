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
      expect(project.sessions_count).toBe(1);

      // 3. Monitor context usage
      const contextStatus = await contextMonitor.trackUsage({
        session_id: session.id,
        tokens_used: 1000,
        operation: 'initial_setup',
        metadata: { phase: 'planning' },
      });

      expect(contextStatus.used).toBe(1000);
      expect(contextStatus.remaining).toBe(99000);

      // 4. Check reality of the project
      const realityCheck = await realityChecker.check({
        session_id: session.id,
        project_path: testProjectPath,
      });

      expect(realityCheck.confidence_score).toBeGreaterThan(0.5);
      expect(realityCheck.discrepancies).toHaveLength(0);
      expect(realityCheck.metrics.file_count).toBe(3);

      // 5. Create checkpoint
      const checkpoint = await sessionManager.createCheckpoint({
        session_id: session.id,
        progress: {
          completed_tasks: ['setup', 'initial_files'],
          pending_tasks: ['tests', 'documentation'],
          blockers: [],
        },
        metadata: { milestone: 'initial_setup_complete' },
      });

      expect(checkpoint.number).toBe(1);
      expect(checkpoint.context_at_checkpoint).toBe(1000);

      // 6. Generate documentation
      const docResult = await documentationEngine.generate({
        session_id: session.id,
        doc_type: 'readme',
        include_sections: ['overview', 'installation', 'usage'],
      });

      expect(docResult.success).toBe(true);
      expect(docResult.file_path).toContain('test-project_readme');

      // 7. Report a blocker
      const blocker = await projectTracker.reportBlocker({
        session_id: session.id,
        type: 'technical',
        description: 'Need to refactor authentication module',
        impact_score: 6,
      });

      expect(blocker.status).toBe('active');
      expect(blocker.project_id).toBe(project.id);

      // 8. Track more context usage
      await contextMonitor.trackUsage({
        session_id: session.id,
        tokens_used: 5000,
        operation: 'implementation',
        metadata: { phase: 'coding' },
      });

      // 9. Create another checkpoint
      await sessionManager.createCheckpoint({
        session_id: session.id,
        progress: {
          completed_tasks: ['setup', 'initial_files', 'core_logic'],
          pending_tasks: ['tests', 'documentation'],
          blockers: [blocker.id],
        },
      });

      // 10. Resolve the blocker
      const resolved = await projectTracker.resolveBlocker({
        blocker_id: blocker.id,
        resolution: 'Refactored auth module to use JWT tokens',
      });

      expect(resolved.status).toBe('resolved');

      // 11. Complete the session
      const completed = await sessionManager.completeSession({
        session_id: session.id,
        final_summary: 'Successfully implemented feature with tests and documentation',
        next_steps: ['Deploy to staging', 'Performance testing'],
      });

      expect(completed.status).toBe('completed');
      expect(completed.context_used).toBe(6000);

      // 12. Generate project report
      const report = await projectTracker.generateReport({
        project_id: project.id,
        include_predictions: true,
      });

      expect(report.project.sessions_count).toBe(1);
      expect(report.active_blockers).toHaveLength(0); // All resolved
      expect(report.velocity_metrics).toBeDefined();
      expect(report.predictions).toBeDefined();
    });
  });

  describe('Context Management Throughout Session', () => {
    it('should track context correctly across operations', async () => {
      const session = await sessionManager.startSession({
        project_name: 'context-test',
        session_type: 'bugfix',
        estimated_scope: { lines_of_code: 100 },
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
        const status = await contextMonitor.trackUsage({
          session_id: session.id,
          tokens_used: op.tokens,
          operation: op.operation,
        });

        totalUsed += op.tokens;
        expect(status.used).toBe(totalUsed);
      }

      // Check warnings
      const warnings = await contextMonitor.checkWarnings({ session_id: session.id });
      expect(warnings.status).toBe('green'); // 3000/100000 = 3%

      // Predict usage
      const prediction = await contextMonitor.predictUsage({
        session_id: session.id,
        planned_operations: [
          { operation: 'refactoring', estimated_tokens: 2000 },
          { operation: 'final_tests', estimated_tokens: 1000 },
        ],
      });

      expect(prediction.predicted_total).toBe(6000);
      expect(prediction.will_exceed_budget).toBe(false);
    });
  });

  describe('Reality Checks with File Changes', () => {
    it('should detect discrepancies after file modifications', async () => {
      const session = await sessionManager.startSession({
        project_name: 'reality-test',
        session_type: 'feature',
      });

      // Initial reality check
      const check1 = await realityChecker.check({
        session_id: session.id,
        project_path: testProjectPath,
      });

      expect(check1.discrepancies).toHaveLength(0);
      const initialFileCount = check1.metrics.file_count;

      // Add a new file
      writeFileSync(join(testProjectPath, 'newfile.ts'), 'export const newFunc = () => {}');

      // Check again
      const check2 = await realityChecker.check({
        session_id: session.id,
        project_path: testProjectPath,
      });

      expect(check2.metrics.file_count).toBe(initialFileCount + 1);
      expect(check2.discrepancies).toHaveLength(0); // No discrepancies, just new file

      // Simulate session claiming fewer files
      await sessionManager.createCheckpoint({
        session_id: session.id,
        progress: {
          completed_tasks: ['added_files'],
          pending_tasks: [],
          blockers: [],
        },
        metadata: { files_created: 0 }, // Claim no files created
      });

      // Validate should detect mismatch
      const validation = await realityChecker.validate({
        session_id: session.id,
        project_path: testProjectPath,
        expected_metrics: {
          file_count: initialFileCount, // Expect original count
          test_coverage: 0,
          documentation_completeness: 0,
        },
      });

      expect(validation.is_valid).toBe(false);
      expect(validation.discrepancies).toContain('file_count');
    });
  });

  describe('Documentation Lifecycle', () => {
    it('should generate and update documentation throughout session', async () => {
      const session = await sessionManager.startSession({
        project_name: 'docs-test',
        session_type: 'feature',
      });

      // Generate initial README
      const readme = await documentationEngine.generate({
        session_id: session.id,
        doc_type: 'readme',
      });

      expect(readme.success).toBe(true);
      expect(existsSync(readme.file_path)).toBe(true);

      // Check status
      const status1 = await documentationEngine.checkStatus({
        file_paths: [readme.file_path],
      });

      expect(status1[0].exists).toBe(true);
      expect(status1[0].in_sync).toBe(true);

      // Update with new content
      const updated = await documentationEngine.update({
        doc_id: readme.metadata.id,
        update_mode: 'append',
        custom_content: '\n## New Features\n- Added awesome functionality',
      });

      expect(updated.in_sync).toBe(true);

      // Generate API docs
      const apiDocs = await documentationEngine.generate({
        session_id: session.id,
        doc_type: 'api',
      });

      expect(apiDocs.success).toBe(true);

      // Generate handoff document at session end
      await sessionManager.createCheckpoint({
        session_id: session.id,
        progress: {
          completed_tasks: ['feature_complete'],
          pending_tasks: [],
          blockers: [],
        },
      });

      const handoff = await documentationEngine.generate({
        session_id: session.id,
        doc_type: 'handoff',
      });

      expect(handoff.success).toBe(true);
      expect(handoff.metadata.sections).toContain('Current State');
      expect(handoff.metadata.sections).toContain('Completed Work');
    });
  });

  describe('Project Velocity Analysis', () => {
    it('should track velocity across multiple sessions', async () => {
      // Create first session
      const session1 = await sessionManager.startSession({
        project_name: 'velocity-test',
        session_type: 'feature',
      });

      const project = await projectTracker.track({
        project_name: 'velocity-test',
        session_id: session1.id,
      });

      // Simulate work
      await contextMonitor.trackUsage({
        session_id: session1.id,
        tokens_used: 15000,
        operation: 'implementation',
      });

      await sessionManager.completeSession({
        session_id: session1.id,
        final_summary: 'Completed feature A',
      });

      // Create second session
      const session2 = await sessionManager.startSession({
        project_name: 'velocity-test',
        session_type: 'feature',
      });

      await projectTracker.track({
        project_name: 'velocity-test',
        session_id: session2.id,
      });

      await contextMonitor.trackUsage({
        session_id: session2.id,
        tokens_used: 12000,
        operation: 'implementation',
      });

      // Analyze velocity
      const velocity = await projectTracker.analyzeVelocity({
        project_id: project.id,
      });

      expect(velocity.sessions_in_window).toBe(2);
      expect(velocity.average_context_per_session).toBe(13500); // (15000 + 12000) / 2
      expect(velocity.trend).toBeDefined();

      // Generate report with predictions
      const report = await projectTracker.generateReport({
        project_id: project.id,
        include_predictions: true,
      });

      expect(report.predictions).toBeDefined();
      expect(report.predictions?.estimated_sessions_remaining).toBeGreaterThan(0);
    });
  });

  describe('Error Recovery', () => {
    it('should handle session recovery after errors', async () => {
      const session = await sessionManager.startSession({
        project_name: 'error-test',
        session_type: 'bugfix',
      });

      // Create checkpoint before "error"
      const checkpoint = await sessionManager.createCheckpoint({
        session_id: session.id,
        progress: {
          completed_tasks: ['initial_analysis'],
          pending_tasks: ['fix_implementation'],
          blockers: [],
        },
      });

      // Simulate some work
      await contextMonitor.trackUsage({
        session_id: session.id,
        tokens_used: 5000,
        operation: 'debugging',
      });

      // "Recover" by creating handoff
      const handoff = await sessionManager.prepareHandoff({
        session_id: session.id,
        handoff_type: 'emergency',
        context: {
          reason: 'System error simulation',
          current_state: 'Debugging in progress',
          next_steps: ['Continue debugging', 'Implement fix'],
        },
      });

      expect(handoff.checkpoint_number).toBe(checkpoint.number);
      expect(handoff.context_used).toBe(5000);

      // New session can continue from handoff
      const newSession = await sessionManager.startSession({
        project_name: 'error-test',
        session_type: 'bugfix',
        context: { continuing_from: session.id },
      });

      expect(newSession.id).not.toBe(session.id);
      expect(newSession.metadata?.continuing_from).toBe(session.id);
    });
  });
});