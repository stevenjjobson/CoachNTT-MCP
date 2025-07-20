import { BehaviorSubject, Observable } from 'rxjs';
import { DatabaseConnection } from '../database';
import {
  RealityCheckParams,
  RealityCheckResponse,
  MetricValidateParams,
  ValidatedMetric,
  Discrepancy,
  Session,
} from '../interfaces';
import { execSync } from 'child_process';
import { existsSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import * as glob from 'glob';

interface RealitySnapshot {
  id: string;
  session_id: string;
  timestamp: number;
  file_states: FileState[];
  test_results: TestResult[];
  metric_validations: ValidatedMetric[];
  discrepancies: Discrepancy[];
}

interface FileState {
  path: string;
  exists: boolean;
  size?: number;
  lastModified?: number;
  hash?: string;
}

interface TestResult {
  suite: string;
  passed: number;
  failed: number;
  skipped: number;
  errors: string[];
}

export class RealityChecker {
  private db: DatabaseConnection;
  private discrepancies$ = new BehaviorSubject<Discrepancy[]>([]);

  constructor() {
    this.db = DatabaseConnection.getInstance();
  }

  getDiscrepancies(): Observable<Discrepancy[]> {
    return this.discrepancies$.asObservable();
  }

  async performCheck(params: RealityCheckParams): Promise<RealityCheckResponse> {
    const { session_id, check_type, focus_areas = [] } = params;
    
    try {
      // Get session details
      const session = this.db.get<Session>(
        `SELECT * FROM sessions WHERE id = ?`,
        session_id
      );
      
      if (!session) {
        throw new Error(`Session ${session_id} not found`);
      }
      
      const snapshotId = `${session_id}-reality-${Date.now()}`;
      const timestamp = Date.now();
      const discrepancies: Discrepancy[] = [];
      
      // Perform checks based on type
      if (check_type === 'comprehensive' || check_type === 'quick') {
        const fileDiscrepancies = await this.checkFileSystem(session, focus_areas);
        discrepancies.push(...fileDiscrepancies);
        
        if (check_type === 'comprehensive') {
          const testDiscrepancies = await this.checkTests(session);
          discrepancies.push(...testDiscrepancies);
          
          const docDiscrepancies = await this.checkDocumentation(session);
          discrepancies.push(...docDiscrepancies);
        }
      } else if (check_type === 'specific' && focus_areas.length > 0) {
        // Check only specific areas
        for (const area of focus_areas) {
          if (area === 'files') {
            const fileDiscrepancies = await this.checkFileSystem(session, []);
            discrepancies.push(...fileDiscrepancies);
          } else if (area === 'tests') {
            const testDiscrepancies = await this.checkTests(session);
            discrepancies.push(...testDiscrepancies);
          } else if (area === 'docs') {
            const docDiscrepancies = await this.checkDocumentation(session);
            discrepancies.push(...docDiscrepancies);
          }
        }
      }
      
      // Calculate confidence score
      const confidenceScore = this.calculateConfidenceScore(discrepancies);
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(discrepancies, session);
      
      // Store snapshot in database
      this.storeSnapshot({
        id: snapshotId,
        session_id,
        timestamp,
        discrepancies,
        confidence_score: confidenceScore,
      });
      
      // Update observable
      this.discrepancies$.next(discrepancies);
      
      return {
        snapshot_id: snapshotId,
        timestamp,
        discrepancies,
        confidence_score: confidenceScore,
        recommendations,
      };
    } catch (error) {
      console.error('Reality check failed:', error);
      throw error;
    }
  }

  async validateMetrics(params: MetricValidateParams): Promise<ValidatedMetric[]> {
    const { session_id, reported_metrics } = params;
    const validatedMetrics: ValidatedMetric[] = [];
    
    try {
      // Count actual lines of code
      if (reported_metrics.lines_written !== undefined) {
        const actualLines = this.countLinesOfCode(session_id);
        const variance = this.calculateVariance(reported_metrics.lines_written, actualLines);
        
        validatedMetrics.push({
          name: 'lines_written',
          reported_value: reported_metrics.lines_written,
          actual_value: actualLines,
          variance_percent: variance,
          status: this.getVarianceStatus(variance),
        });
      }
      
      // Validate test metrics
      if (reported_metrics.tests_written !== undefined || reported_metrics.tests_passing !== undefined) {
        const testMetrics = await this.getActualTestMetrics();
        
        if (reported_metrics.tests_written !== undefined) {
          const variance = this.calculateVariance(
            reported_metrics.tests_written,
            testMetrics.total
          );
          
          validatedMetrics.push({
            name: 'tests_written',
            reported_value: reported_metrics.tests_written,
            actual_value: testMetrics.total,
            variance_percent: variance,
            status: this.getVarianceStatus(variance),
          });
        }
        
        if (reported_metrics.tests_passing !== undefined) {
          const variance = this.calculateVariance(
            reported_metrics.tests_passing,
            testMetrics.passing
          );
          
          validatedMetrics.push({
            name: 'tests_passing',
            reported_value: reported_metrics.tests_passing,
            actual_value: testMetrics.passing,
            variance_percent: variance,
            status: this.getVarianceStatus(variance),
          });
        }
      }
      
      // Validate documentation metrics
      if (reported_metrics.docs_updated !== undefined) {
        const actualDocs = this.countDocumentationFiles();
        const variance = this.calculateVariance(reported_metrics.docs_updated, actualDocs);
        
        validatedMetrics.push({
          name: 'docs_updated',
          reported_value: reported_metrics.docs_updated,
          actual_value: actualDocs,
          variance_percent: variance,
          status: this.getVarianceStatus(variance),
        });
      }
      
      return validatedMetrics;
    } catch (error) {
      console.error('Metric validation failed:', error);
      throw error;
    }
  }

  async applyFixes(params: { snapshot_id: string; fix_ids: string[]; auto_commit?: boolean }): Promise<{
    applied: string[];
    failed: Array<{ fix_id: string; error: string }>;
    commit_hash?: string;
  }> {
    const { snapshot_id, fix_ids, auto_commit = false } = params;
    const applied: string[] = [];
    const failed: Array<{ fix_id: string; error: string }> = [];
    
    try {
      // Get snapshot details
      const snapshot = this.db.get<any>(
        `SELECT * FROM reality_snapshots WHERE id = ?`,
        snapshot_id
      );
      
      if (!snapshot) {
        throw new Error(`Snapshot ${snapshot_id} not found`);
      }
      
      const discrepancies: Discrepancy[] = JSON.parse(snapshot.discrepancies);
      
      // Apply each requested fix
      for (const fixId of fix_ids) {
        const discrepancy = discrepancies.find((d, idx) => `fix-${idx}` === fixId);
        
        if (!discrepancy || !discrepancy.auto_fixable) {
          failed.push({ fix_id: fixId, error: 'Fix not available or not auto-fixable' });
          continue;
        }
        
        try {
          await this.applyIndividualFix(discrepancy);
          applied.push(fixId);
        } catch (error) {
          failed.push({ fix_id: fixId, error: String(error) });
        }
      }
      
      // Create commit if requested
      let commitHash: string | undefined;
      if (auto_commit && applied.length > 0) {
        try {
          const commitMessage = `Fix: Applied ${applied.length} automated fixes from reality check`;
          commitHash = execSync(`git add -A && git commit -m "${commitMessage}"`, {
            encoding: 'utf8',
          }).trim();
        } catch (error) {
          console.warn('Failed to create commit:', error);
        }
      }
      
      return { applied, failed, commit_hash: commitHash };
    } catch (error) {
      console.error('Failed to apply fixes:', error);
      throw error;
    }
  }

  private async checkFileSystem(session: Session, focusAreas: string[]): Promise<Discrepancy[]> {
    const discrepancies: Discrepancy[] = [];
    
    try {
      // Get claimed files from checkpoints
      const checkpoints = this.db.all<any>(
        `SELECT * FROM checkpoints WHERE session_id = ? ORDER BY checkpoint_number`,
        session.id
      );
      
      const claimedFiles = new Set<string>();
      checkpoints.forEach(cp => {
        const components = JSON.parse(cp.completed_components || '[]');
        components.forEach((comp: string) => {
          // Extract file paths from component descriptions
          const fileMatches = comp.match(/(\b\w+\/[\w\/]+\.\w+)/g);
          if (fileMatches) {
            fileMatches.forEach(f => claimedFiles.add(f));
          }
        });
      });
      
      // Check if claimed files exist
      claimedFiles.forEach(file => {
        if (!existsSync(file)) {
          discrepancies.push({
            type: 'file_mismatch',
            severity: 'critical',
            description: `Claimed file does not exist: ${file}`,
            location: file,
            suggested_fix: `Create the missing file or update documentation`,
            auto_fixable: false,
            ui_priority: 1,
          });
        }
      });
      
      // Check for uncommitted changes
      try {
        const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });
        const modifiedFiles = gitStatus.split('\n').filter(line => line.trim());
        
        if (modifiedFiles.length > 5) {
          discrepancies.push({
            type: 'state_drift',
            severity: 'warning',
            description: `${modifiedFiles.length} files have uncommitted changes`,
            suggested_fix: 'Consider creating a checkpoint with git commit',
            auto_fixable: false,
            ui_priority: 2,
          });
        }
      } catch (error) {
        // Git not available or not a git repo
      }
      
      return discrepancies;
    } catch (error) {
      console.error('File system check failed:', error);
      return discrepancies;
    }
  }

  private async checkTests(session: Session): Promise<Discrepancy[]> {
    const discrepancies: Discrepancy[] = [];
    
    try {
      // Try to run tests
      let testCommand = 'npm test';
      const packageJsonPath = join(process.cwd(), 'package.json');
      
      if (existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
        if (packageJson.scripts?.test) {
          testCommand = `npm run test`;
        }
      }
      
      try {
        const testOutput = execSync(testCommand, {
          encoding: 'utf8',
          env: { ...process.env, CI: 'true' },
        });
        
        // Parse test results
        const failureMatch = testOutput.match(/(\d+) failing/);
        const passingMatch = testOutput.match(/(\d+) passing/);
        
        if (failureMatch && parseInt(failureMatch[1]) > 0) {
          discrepancies.push({
            type: 'test_failure',
            severity: 'critical',
            description: `${failureMatch[1]} tests are failing`,
            suggested_fix: 'Fix failing tests before proceeding',
            auto_fixable: false,
            ui_priority: 1,
          });
        }
        
        // Check if test count matches claims
        const claimedTests = session.metrics?.tests_written || 0;
        const actualTests = passingMatch ? parseInt(passingMatch[1]) : 0;
        
        if (claimedTests > 0 && Math.abs(claimedTests - actualTests) > 5) {
          discrepancies.push({
            type: 'test_failure',
            severity: 'warning',
            description: `Test count mismatch: claimed ${claimedTests}, found ${actualTests}`,
            suggested_fix: 'Update test metrics or add missing tests',
            auto_fixable: false,
            ui_priority: 3,
          });
        }
      } catch (error) {
        // Tests failed to run
        if (session.metrics?.tests_written && session.metrics.tests_written > 0) {
          discrepancies.push({
            type: 'test_failure',
            severity: 'critical',
            description: 'Tests failed to execute',
            location: 'test suite',
            suggested_fix: 'Ensure test environment is properly configured',
            auto_fixable: false,
            ui_priority: 1,
          });
        }
      }
      
      return discrepancies;
    } catch (error) {
      console.error('Test check failed:', error);
      return discrepancies;
    }
  }

  private async checkDocumentation(session: Session): Promise<Discrepancy[]> {
    const discrepancies: Discrepancy[] = [];
    
    try {
      // Check for README
      if (!existsSync('README.md')) {
        discrepancies.push({
          type: 'documentation_gap',
          severity: 'warning',
          description: 'No README.md file found',
          suggested_fix: 'Create a README.md with project documentation',
          auto_fixable: true,
          ui_priority: 4,
        });
      }
      
      // Check for documentation of new features
      const checkpoints = this.db.all<any>(
        `SELECT * FROM checkpoints WHERE session_id = ?`,
        session.id
      );
      
      let featuresAdded = 0;
      checkpoints.forEach(cp => {
        const components = JSON.parse(cp.completed_components || '[]');
        featuresAdded += components.filter((c: string) => 
          c.toLowerCase().includes('implement') || 
          c.toLowerCase().includes('feature')
        ).length;
      });
      
      if (featuresAdded > 3 && session.metrics?.docs_updated === 0) {
        discrepancies.push({
          type: 'documentation_gap',
          severity: 'info',
          description: `${featuresAdded} features added but no documentation updated`,
          suggested_fix: 'Update documentation to reflect new features',
          auto_fixable: false,
          ui_priority: 5,
        });
      }
      
      return discrepancies;
    } catch (error) {
      console.error('Documentation check failed:', error);
      return discrepancies;
    }
  }

  private calculateConfidenceScore(discrepancies: Discrepancy[]): number {
    let score = 100;
    
    // Deduct points based on discrepancy severity
    discrepancies.forEach(d => {
      switch (d.severity) {
        case 'critical':
          score -= 20;
          break;
        case 'warning':
          score -= 10;
          break;
        case 'info':
          score -= 5;
          break;
      }
    });
    
    return Math.max(0, Math.min(100, score));
  }

  private generateRecommendations(discrepancies: Discrepancy[], session: Session): string[] {
    const recommendations: string[] = [];
    
    // Group discrepancies by type
    const criticalCount = discrepancies.filter(d => d.severity === 'critical').length;
    const warningCount = discrepancies.filter(d => d.severity === 'warning').length;
    
    if (criticalCount > 0) {
      recommendations.push(`Address ${criticalCount} critical issues before continuing`);
    }
    
    if (warningCount > 2) {
      recommendations.push('Consider creating a checkpoint to preserve current state');
    }
    
    // Check for auto-fixable issues
    const autoFixable = discrepancies.filter(d => d.auto_fixable);
    if (autoFixable.length > 0) {
      recommendations.push(`${autoFixable.length} issues can be automatically fixed`);
    }
    
    // Phase-specific recommendations
    if (session.current_phase === 'implementation' && discrepancies.some(d => d.type === 'test_failure')) {
      recommendations.push('Fix failing tests before moving to next phase');
    }
    
    return recommendations;
  }

  private storeSnapshot(data: {
    id: string;
    session_id: string;
    timestamp: number;
    discrepancies: Discrepancy[];
    confidence_score: number;
  }): void {
    const insert = this.db.prepare(`
      INSERT INTO reality_snapshots (
        id, session_id, timestamp, discrepancies,
        confidence_score, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    insert.run(
      data.id,
      data.session_id,
      data.timestamp,
      JSON.stringify(data.discrepancies),
      data.confidence_score,
      Date.now()
    );
  }

  private async applyIndividualFix(discrepancy: Discrepancy): Promise<void> {
    switch (discrepancy.type) {
      case 'documentation_gap':
        if (discrepancy.description.includes('README.md')) {
          // Create basic README
          const readme = `# Project\n\nThis project was developed using AI assistance.\n\n## Getting Started\n\nTODO: Add project documentation\n`;
          require('fs').writeFileSync('README.md', readme);
        }
        break;
        
      case 'file_mismatch':
        // Cannot auto-fix missing files
        throw new Error('Cannot automatically create missing implementation files');
        
      case 'test_failure':
        // Cannot auto-fix failing tests
        throw new Error('Cannot automatically fix failing tests');
        
      case 'state_drift':
        // Cannot auto-fix uncommitted changes
        throw new Error('Cannot automatically handle uncommitted changes');
    }
  }

  private countLinesOfCode(sessionId: string): number {
    try {
      // Get created/modified files from session
      const srcFiles = glob.sync('src/**/*.{ts,js,tsx,jsx}', { ignore: ['**/*.test.*', '**/*.spec.*'] });
      
      let totalLines = 0;
      srcFiles.forEach(file => {
        const content = readFileSync(file, 'utf8');
        const lines = content.split('\n').filter(line => 
          line.trim() && !line.trim().startsWith('//') && !line.trim().startsWith('*')
        );
        totalLines += lines.length;
      });
      
      return totalLines;
    } catch (error) {
      console.error('Failed to count lines:', error);
      return 0;
    }
  }

  private async getActualTestMetrics(): Promise<{ total: number; passing: number }> {
    try {
      const testFiles = glob.sync('**/*.{test,spec}.{ts,js,tsx,jsx}');
      const testCount = testFiles.length * 5; // Rough estimate
      
      // Try to get actual test results
      try {
        const output = execSync('npm test -- --listTests', { encoding: 'utf8' });
        const tests = output.split('\n').filter(line => line.includes('test') || line.includes('spec'));
        return { total: tests.length, passing: tests.length }; // Assume all pass if command succeeds
      } catch {
        return { total: testCount, passing: 0 };
      }
    } catch (error) {
      return { total: 0, passing: 0 };
    }
  }

  private countDocumentationFiles(): number {
    try {
      const docFiles = glob.sync('**/*.md', { ignore: ['node_modules/**'] });
      return docFiles.length;
    } catch (error) {
      return 0;
    }
  }

  private calculateVariance(reported: number, actual: number): number {
    if (actual === 0) return reported === 0 ? 0 : 100;
    return Math.abs(((reported - actual) / actual) * 100);
  }

  private getVarianceStatus(variance: number): 'accurate' | 'minor_variance' | 'major_variance' {
    if (variance <= 5) return 'accurate';
    if (variance <= 20) return 'minor_variance';
    return 'major_variance';
  }
}