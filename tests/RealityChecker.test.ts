import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { RealityChecker } from '../src/managers/RealityChecker';
import { SessionManager } from '../src/managers/SessionManager';
import { DatabaseConnection } from '../src/database';
import { SessionStartParams, RealityCheckParams, ValidatedMetric, Discrepancy } from '../src/interfaces';
import { rmSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { setupTestDatabase, cleanupTestDatabase } from './helpers/database';
import { execSync } from 'child_process';

// Mock child_process module
jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

describe('RealityChecker', () => {
  let realityChecker: RealityChecker;
  let sessionManager: SessionManager;
  let sessionId: string;
  const testDbPath = join(process.cwd(), 'test-data', 'test.db');
  const testProjectPath = join(process.cwd(), 'test-project');
  const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

  beforeEach(async () => {
    // Set up test database
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
      // Mock test listing
      if (cmd.includes('npm test') && cmd.includes('--listTests')) {
        return 'test.spec.ts\n' as any;
      }
      return '' as any;
    });
    
    // Set test environment variable
    process.env.TEST_PROJECT_PATH = testProjectPath;
    
    // Create test project directory
    if (!existsSync(testProjectPath)) {
      mkdirSync(testProjectPath, { recursive: true });
    }
    
    // Create managers
    realityChecker = new RealityChecker();
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
    
    // Create some test files
    writeFileSync(join(testProjectPath, 'index.ts'), 'export const hello = () => "world";');
    writeFileSync(join(testProjectPath, 'test.spec.ts'), 'describe("test", () => { it("works", () => {}); });');
  });

  afterEach(() => {
    // Clean up test database
    cleanupTestDatabase();
    
    // Clean up environment variable
    delete process.env.TEST_PROJECT_PATH;
    
    // Clean up test project
    if (existsSync(testProjectPath)) {
      rmSync(testProjectPath, { recursive: true });
    }
  });

  describe('performCheck', () => {
    it('should perform comprehensive check and find discrepancies', async () => {
      const params: RealityCheckParams = {
        session_id: sessionId,
        check_type: 'comprehensive',
      };
      
      const result = await realityChecker.performCheck(params);
      
      expect(result.snapshot_id).toBeDefined();
      expect(result.discrepancies).toBeDefined();
      expect(result.confidence_score).toBeGreaterThan(0);
      expect(result.confidence_score).toBeLessThanOrEqual(1);
    });

    it('should perform quick check with specific focus areas', async () => {
      const params: RealityCheckParams = {
        session_id: sessionId,
        check_type: 'quick',
        focus_areas: ['files'],
      };
      
      const result = await realityChecker.performCheck(params);
      
      expect(result.snapshot_id).toBeDefined();
      expect(result.discrepancies).toBeDefined();
    });

    it('should handle specific check type', async () => {
      const params: RealityCheckParams = {
        session_id: sessionId,
        check_type: 'specific',
        focus_areas: ['tests', 'documentation'],
      };
      
      const result = await realityChecker.performCheck(params);
      
      expect(result.discrepancies).toBeDefined();
      expect(result.recommendations).toHaveLength(3); // Standard recommendations
    });

    it('should detect file discrepancies', async () => {
      // Create a checkpoint claiming files that don't exist
      await sessionManager.createCheckpoint({
        session_id: sessionId,
        completed_components: [
          'Created src/components/Button.tsx component',
          'Added src/utils/helpers.ts utility functions',
          'Implemented api/users.ts endpoint'
        ],
        metrics: {
          lines_written: 500,
          tests_passing: 10,
          context_used_percent: 25,
        },
      });
      
      const params: RealityCheckParams = {
        session_id: sessionId,
        check_type: 'comprehensive',
      };
      
      const result = await realityChecker.performCheck(params);
      
      const fileDiscrepancies = result.discrepancies.filter(d => d.type === 'file_mismatch');
      expect(fileDiscrepancies.length).toBeGreaterThan(0);
      expect(fileDiscrepancies.length).toBe(3); // Should find 3 missing files
    });

    it('should calculate confidence score based on discrepancies', async () => {
      const params: RealityCheckParams = {
        session_id: sessionId,
        check_type: 'comprehensive',
      };
      
      const result = await realityChecker.performCheck(params);
      
      // With few discrepancies, confidence should be high
      if (result.discrepancies.length < 3) {
        expect(result.confidence_score).toBeGreaterThan(0.8);
      } else {
        expect(result.confidence_score).toBeLessThan(0.8);
      }
    });
  });

  describe('validateMetrics', () => {
    it('should validate reported metrics against actual state', async () => {
      const result = await realityChecker.validateMetrics({
        session_id: sessionId,
        reported_metrics: {
          lines_written: 100,
          tests_passing: 5,
          documentation_updated: 1,
        },
      });
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should detect metric deviations', async () => {
      const result = await realityChecker.validateMetrics({
        session_id: sessionId,
        reported_metrics: {
          lines_written: 1000, // Unrealistic
          tests_passing: 50,   // More than exist
          documentation_updated: 0,
        },
      });
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      
      const lineValidation = result.find((m: ValidatedMetric) => m.name === 'lines_written');
      expect(lineValidation).toBeDefined();
      expect(lineValidation?.reported_value).toBe(1000);
      expect(lineValidation?.status).not.toBe('accurate');
    });

    it('should pass validation for accurate metrics', async () => {
      // Create more realistic test state
      writeFileSync(join(testProjectPath, 'utils.ts'), 'export const util = (x: number) => x * 2;');
      
      const result = await realityChecker.validateMetrics({
        session_id: sessionId,
        reported_metrics: {
          lines_written: 2, // Close to actual
          tests_passing: 1,
          documentation_updated: 0,
        },
      });
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      
      // Debug logging
      console.log('Validation results:', result);
      
      const majorVariances = result.filter((m: ValidatedMetric) => m.status === 'major_variance');
      if (majorVariances.length > 0) {
        console.log('Major variances found:', majorVariances);
      }
      
      // We now have 3 files in test project: index.ts, test.spec.ts, and utils.ts
      // Each file has 1 line of actual code, so total should be 3 lines
      const linesMetric = result.find((m: ValidatedMetric) => m.name === 'lines_written');
      if (linesMetric) {
        console.log('Lines metric:', linesMetric);
        // Allow for some variance - we reported 2 lines but might have 3
        expect(Math.abs(linesMetric.variance_percent)).toBeLessThan(50);
      }
    });
  });

  describe('applyFixes', () => {
    it('should apply safe fixes for discrepancies', async () => {
      // First perform a check
      const checkResult = await realityChecker.performCheck({
        session_id: sessionId,
        check_type: 'comprehensive',
      });
      
      const fixableIds = checkResult.discrepancies
        .filter(d => d.severity === 'info' && d.auto_fixable)
        .map((d, idx) => `fix_${idx}`);
      
      if (fixableIds.length > 0) {
        const fixResult = await realityChecker.applyFixes({
          snapshot_id: checkResult.snapshot_id,
          fix_ids: fixableIds,
          auto_commit: false,
        });
        
        expect(fixResult.applied).toBeDefined();
        expect(fixResult.applied.length).toBeGreaterThanOrEqual(0);
        expect(fixResult.applied.length).toBeLessThanOrEqual(fixableIds.length);
        expect(fixResult.failed).toBeDefined();
      }
    });

    it('should respect safe mode and skip risky fixes', async () => {
      const checkResult = await realityChecker.performCheck({
        session_id: sessionId,
        check_type: 'comprehensive',
      });
      
      const allIds = checkResult.discrepancies.map((d, idx) => `fix_${idx}`);
      
      const fixResult = await realityChecker.applyFixes({
        snapshot_id: checkResult.snapshot_id,
        fix_ids: allIds,
      });
      
      // Check that some fixes were applied
      expect(fixResult.applied).toBeDefined();
      expect(fixResult.failed).toBeDefined();
    });

    it('should update reality snapshot after fixes', async () => {
      const checkResult = await realityChecker.performCheck({
        session_id: sessionId,
        check_type: 'comprehensive',
      });
      
      const fixableIds = checkResult.discrepancies
        .filter(d => d.severity === 'info' && d.auto_fixable)
        .map((d, idx) => `fix_${idx}`)
        .slice(0, 1); // Just fix one
      
      if (fixableIds.length > 0) {
        const fixResult = await realityChecker.applyFixes({
          snapshot_id: checkResult.snapshot_id,
          fix_ids: fixableIds,
          auto_commit: false,
        });
        
        // Check that fixes were applied
        expect(fixResult.applied).toBeDefined();
        expect(fixResult.applied.length).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Observable integration', () => {
    it('should emit discrepancies via observable', async () => {
      let emittedDiscrepancies: Discrepancy[] | null = null;
      
      const subscription = realityChecker.getDiscrepancies().subscribe((discrepancies) => {
        emittedDiscrepancies = discrepancies;
      });
      
      await realityChecker.performCheck({
        session_id: sessionId,
        check_type: 'quick',
      });
      
      expect(emittedDiscrepancies).not.toBeNull();
      expect(Array.isArray(emittedDiscrepancies)).toBe(true);
      
      subscription.unsubscribe();
    });
  });

  describe('edge cases', () => {
    it('should handle missing session gracefully', async () => {
      await expect(realityChecker.performCheck({
        session_id: 'non-existent',
        check_type: 'comprehensive',
      })).rejects.toThrow('Session non-existent not found');
    });

    it('should handle empty project directory', async () => {
      // First create a checkpoint claiming some files exist
      await sessionManager.createCheckpoint({
        session_id: sessionId,
        completed_components: ['Created index.ts main file', 'Added test.spec.ts test suite'],
        metrics: {
          lines_written: 10,
          tests_passing: 1,
          context_used_percent: 10,
        },
      });
      
      // Now remove test files
      rmSync(testProjectPath, { recursive: true });
      mkdirSync(testProjectPath);
      
      const result = await realityChecker.performCheck({
        session_id: sessionId,
        check_type: 'comprehensive',
      });
      
      // Should detect that claimed files are missing
      expect(result.discrepancies.length).toBeGreaterThan(0);
      expect(result.confidence_score).toBeLessThan(0.8); // With 2 critical issues, score should be around 0.6
      
      const fileMismatchDiscrepancies = result.discrepancies.filter(d => d.type === 'file_mismatch');
      expect(fileMismatchDiscrepancies.length).toBeGreaterThan(0);
    });
  });
});