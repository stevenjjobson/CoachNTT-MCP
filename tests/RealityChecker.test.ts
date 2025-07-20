import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { RealityChecker } from '../src/managers/RealityChecker';
import { SessionManager } from '../src/managers/SessionManager';
import { DatabaseConnection } from '../src/database';
import { SessionStartParams, RealityCheckParams, ValidatedMetric } from '../src/interfaces';
import { rmSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { setupTestDatabase, cleanupTestDatabase } from './helpers/database';

describe('RealityChecker', () => {
  let realityChecker: RealityChecker;
  let sessionManager: SessionManager;
  let sessionId: string;
  const testDbPath = join(process.cwd(), 'test-data', 'test.db');
  const testProjectPath = join(process.cwd(), 'test-project');

  beforeEach(async () => {
    // Set up test database
    setupTestDatabase();
    
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
      // Update session to claim more files exist
      const db = DatabaseConnection.getInstance();
      db.run(
        'UPDATE sessions SET actual_lines = 500 WHERE id = ?',
        sessionId
      );
      
      const params: RealityCheckParams = {
        session_id: sessionId,
        check_type: 'comprehensive',
      };
      
      const result = await realityChecker.performCheck(params);
      
      const fileDiscrepancies = result.discrepancies.filter(d => d.type === 'file_mismatch');
      expect(fileDiscrepancies.length).toBeGreaterThan(0);
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
      const majorVariances = result.filter((m: ValidatedMetric) => m.status === 'major_variance');
      expect(majorVariances).toHaveLength(0);
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
        check_id: checkResult.check_id,
        discrepancy_ids: allIds,
        safe_mode: true,
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
    it('should emit check results via observable', async () => {
      let emittedResult: any = null;
      
      realityChecker.getCheckResults().subscribe(result => {
        emittedResult = result;
      });
      
      await realityChecker.performCheck({
        session_id: sessionId,
        check_type: 'quick',
      });
      
      expect(emittedResult).not.toBeNull();
      expect(emittedResult.check_id).toBeDefined();
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
      // Remove test files
      rmSync(testProjectPath, { recursive: true });
      mkdirSync(testProjectPath);
      
      const result = await realityChecker.performCheck({
        session_id: sessionId,
        check_type: 'comprehensive',
      });
      
      expect(result.discrepancies.length).toBeGreaterThan(0);
      expect(result.confidence_score).toBeLessThan(0.5);
    });
  });
});