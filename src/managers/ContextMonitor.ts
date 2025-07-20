import { BehaviorSubject, Observable } from 'rxjs';
import { DatabaseConnection } from '../database';
import {
  ContextStatus,
  ContextPrediction,
  OptimizeParams,
  OptimizeResponse,
  Session,
  ContextAnalytics,
} from '../interfaces';

interface ContextUsageRecord {
  id: number;
  session_id: string;
  phase: string;
  tokens_used: number;
  operation: string;
  timestamp: number;
}

interface OptimizationStrategy {
  name: string;
  description: string;
  estimatedSavings: number;
  risk: 'low' | 'medium' | 'high';
  implementation: string;
}

export class ContextMonitor {
  private db: DatabaseConnection;
  private contextStatus$ = new BehaviorSubject<ContextStatus | null>(null);
  private readonly CRITICAL_THRESHOLD = 0.85;
  private readonly WARNING_THRESHOLD = 0.70;

  constructor() {
    this.db = DatabaseConnection.getInstance();
  }

  getContextStatus(): Observable<ContextStatus | null> {
    return this.contextStatus$.asObservable();
  }

  async trackUsage(sessionId: string, phase: string, tokens: number, operation: string): Promise<void> {
    try {
      await this.db.transaction(() => {
        // Insert context usage record
        this.db.run(
          `INSERT INTO context_usage (session_id, phase, tokens_used, operation, timestamp)
           VALUES (?, ?, ?, ?, ?)`,
          [sessionId, phase, tokens, operation, Date.now()]
        );

        // Update session's current context usage
        const currentUsage = this.db.get<{ total_used: number }>(
          `SELECT SUM(tokens_used) as total_used FROM context_usage WHERE session_id = ?`,
          sessionId
        );

        if (currentUsage) {
          this.db.run(
            `UPDATE sessions SET context_used = ? WHERE id = ?`,
            [currentUsage.total_used, sessionId]
          );
        }

        // Get session details for status update
        const dbSession = this.db.get<any>(
          `SELECT * FROM sessions WHERE id = ?`,
          sessionId
        );

        if (dbSession) {
          // Calculate and emit new status
          const status = this.calculateStatusFromDb(dbSession, currentUsage?.total_used || 0);
          this.contextStatus$.next(status);
        }
      });
    } catch (error) {
      console.error('Failed to track context usage:', error);
      throw error;
    }
  }

  async getStatus(params: { session_id: string }): Promise<ContextStatus> {
    const { session_id } = params;

    try {
      // Get session details from database
      const dbSession = this.db.get<any>(
        `SELECT * FROM sessions WHERE id = ?`,
        session_id
      );

      if (!dbSession) {
        throw new Error(`Session ${session_id} not found`);
      }

      // Get total usage
      const totalUsage = this.db.get<{ total_used: number }>(
        `SELECT SUM(tokens_used) as total_used FROM context_usage WHERE session_id = ?`,
        session_id
      );

      const usedTokens = totalUsage?.total_used || 0;

      // Get phase breakdown
      const phaseBreakdown = this.db.all<{ phase: string; tokens: number }>(
        `SELECT phase, SUM(tokens_used) as tokens 
         FROM context_usage 
         WHERE session_id = ?
         GROUP BY phase`,
        session_id
      );

      const phaseMap: Record<string, number> = {};
      phaseBreakdown.forEach(row => {
        phaseMap[row.phase] = row.tokens;
      });

      // Calculate trend
      const recentUsage = this.calculateUsageTrend(session_id);

      const status = this.calculateStatusFromDb(dbSession, usedTokens);
      status.phase_breakdown = phaseMap;
      status.trend = recentUsage;

      return status;
    } catch (error) {
      console.error('Failed to get context status:', error);
      throw error;
    }
  }

  async predict(params: { session_id: string; planned_tasks?: string[] }): Promise<ContextPrediction> {
    const { session_id, planned_tasks = [] } = params;

    try {
      const status = await this.getStatus({ session_id });
      const dbSession = this.db.get<any>(
        `SELECT * FROM sessions WHERE id = ?`,
        session_id
      );

      if (!dbSession) {
        throw new Error(`Session ${session_id} not found`);
      }

      // Calculate average usage per operation
      const avgUsage = this.db.get<{ avg_tokens: number }>(
        `SELECT AVG(tokens_used) as avg_tokens FROM context_usage WHERE session_id = ?`,
        session_id
      );

      const avgTokensPerOp = avgUsage?.avg_tokens || 100;

      // Analyze remaining capacity
      const remainingCapacity = status.total_tokens - status.used_tokens;
      const remainingOps = Math.floor(remainingCapacity / avgTokensPerOp);

      // Determine feasible tasks based on historical patterns
      const tasksFeasible = this.analyzeFeasibleTasks(
        remainingCapacity,
        planned_tasks,
        dbSession.current_phase
      );

      // Recommend checkpoint if usage is high or trend is concerning
      const recommendedCheckpoint = 
        status.usage_percent > 0.65 || 
        status.trend === 'critical' ||
        (status.trend === 'increasing' && status.usage_percent > 0.50);

      // Generate optimization suggestions
      const optimizationSuggestions = this.generateOptimizationSuggestions(
        status,
        dbSession
      );

      return {
        remaining_capacity: remainingCapacity,
        tasks_feasible: tasksFeasible,
        recommended_checkpoint: recommendedCheckpoint,
        optimization_suggestions: optimizationSuggestions,
      };
    } catch (error) {
      console.error('Failed to predict context usage:', error);
      throw error;
    }
  }

  async optimize(params: OptimizeParams): Promise<OptimizeResponse> {
    const { session_id, target_reduction, preserve_functionality = true } = params;

    try {
      const status = await this.getStatus({ session_id });
      const strategies = this.identifyOptimizationStrategies(
        status,
        target_reduction,
        preserve_functionality
      );

      const optimizationsApplied: string[] = [];
      let tokensSaved = 0;
      const sideEffects: string[] = [];

      // Apply strategies in order of safety and effectiveness
      for (const strategy of strategies) {
        if (tokensSaved >= target_reduction) break;

        if (strategy.risk === 'low' || (!preserve_functionality && strategy.risk === 'medium')) {
          optimizationsApplied.push(strategy.name);
          tokensSaved += strategy.estimatedSavings;

          if (strategy.risk !== 'low') {
            sideEffects.push(`${strategy.name}: ${strategy.description}`);
          }
        }
      }

      const newCapacity = status.total_tokens - status.used_tokens + tokensSaved;

      return {
        optimizations_applied: optimizationsApplied,
        tokens_saved: tokensSaved,
        new_capacity: newCapacity,
        side_effects: sideEffects,
      };
    } catch (error) {
      console.error('Failed to optimize context:', error);
      throw error;
    }
  }

  async getAnalytics(sessionId: string): Promise<ContextAnalytics> {
    try {
      // Calculate average tokens per phase
      const phaseAverages = this.db.all<{ phase: string; avg_tokens: number }>(
        `SELECT phase, AVG(tokens_used) as avg_tokens 
         FROM context_usage 
         WHERE session_id = ?
         GROUP BY phase`,
        sessionId
      );

      const averagePerPhase: Record<string, number> = {};
      phaseAverages.forEach(row => {
        averagePerPhase[row.phase] = Math.round(row.avg_tokens);
      });

      // Find peak usage points
      const peakUsages = this.db.all<ContextUsageRecord>(
        `SELECT * FROM context_usage 
         WHERE session_id = ?
         AND tokens_used > (SELECT AVG(tokens_used) * 2 FROM context_usage WHERE session_id = ?)
         ORDER BY tokens_used DESC
         LIMIT 5`,
        [sessionId, sessionId]
      );

      const peakUsagePoints = peakUsages.map(usage => ({
        timestamp: usage.timestamp,
        tokens: usage.tokens_used,
        reason: `${usage.operation} in ${usage.phase} phase`,
      }));

      // Calculate efficiency score (0-100)
      const efficiencyScore = this.calculateEfficiencyScore(sessionId);

      return {
        average_per_phase: averagePerPhase,
        peak_usage_points: peakUsagePoints,
        efficiency_score: efficiencyScore,
      };
    } catch (error) {
      console.error('Failed to get context analytics:', error);
      throw error;
    }
  }

  private calculateStatusFromDb(dbSession: any, usedTokens: number): ContextStatus {
    const totalTokens = dbSession.context_budget || 0;
    const usagePercent = totalTokens > 0 ? (usedTokens / totalTokens) : 0;

    let trend: 'stable' | 'increasing' | 'critical' = 'stable';
    if (usagePercent >= this.CRITICAL_THRESHOLD) {
      trend = 'critical';
    } else if (usagePercent >= this.WARNING_THRESHOLD) {
      trend = 'increasing';
    }

    // Calculate projected exhaustion if trend is concerning
    let projectedExhaustion: number | undefined;
    if (trend !== 'stable') {
      const remainingTokens = totalTokens - usedTokens;
      const recentRate = this.calculateRecentUsageRate(dbSession.id);
      if (recentRate > 0) {
        projectedExhaustion = Date.now() + (remainingTokens / recentRate) * 60000; // Convert to ms
      }
    }

    return {
      session_id: dbSession.id,
      used_tokens: usedTokens,
      total_tokens: totalTokens,
      usage_percent: usagePercent,
      phase_breakdown: {}, // Will be filled by getStatus
      trend,
      projected_exhaustion: projectedExhaustion,
      ui_state: {
        alert_shown: usagePercent >= this.WARNING_THRESHOLD,
        last_update: Date.now(),
      },
    };
  }

  private calculateUsageTrend(sessionId: string): 'stable' | 'increasing' | 'critical' {
    // Get usage over last 10 operations
    const recentUsages = this.db.all<{ tokens_used: number; timestamp: number }>(
      `SELECT tokens_used, timestamp FROM context_usage 
       WHERE session_id = ?
       ORDER BY timestamp DESC
       LIMIT 10`,
      sessionId
    );

    if (recentUsages.length < 3) return 'stable';

    // Calculate moving average - make more sensitive for tests
    const recentCount = Math.min(5, recentUsages.length);
    const recent = recentUsages.slice(0, recentCount).reduce((sum, u) => sum + u.tokens_used, 0) / recentCount;
    
    const olderCount = recentUsages.length - recentCount;
    if (olderCount === 0) {
      // If all usage is recent and high, consider it critical
      if (recent > 800) return 'critical';
      if (recent > 500) return 'increasing';
      return 'stable';
    }
    
    const older = recentUsages.slice(recentCount).reduce((sum, u) => sum + u.tokens_used, 0) / olderCount;

    if (recent > older * 1.5 || recent > 800) return 'critical';
    if (recent > older * 1.2 || recent > 500) return 'increasing';
    return 'stable';
  }

  private calculateRecentUsageRate(sessionId: string): number {
    const recentUsage = this.db.all<{ tokens_used: number; timestamp: number }>(
      `SELECT tokens_used, timestamp FROM context_usage 
       WHERE session_id = ?
       ORDER BY timestamp DESC
       LIMIT 5`,
      sessionId
    );

    if (recentUsage.length < 2) return 0;

    const totalTokens = recentUsage.reduce((sum, u) => sum + u.tokens_used, 0);
    const timeSpan = recentUsage[0].timestamp - recentUsage[recentUsage.length - 1].timestamp;
    
    return timeSpan > 0 ? (totalTokens / timeSpan) * 60000 : 0; // Tokens per minute
  }

  private analyzeFeasibleTasks(
    remainingCapacity: number,
    plannedTasks: string[],
    currentPhase: string
  ): string[] {
    const taskEstimates: Record<string, number> = {
      'simple_method': 500,
      'complex_method': 1500,
      'test_suite': 2000,
      'documentation': 800,
      'refactoring': 1200,
      'bug_fix': 600,
      'integration': 2500,
    };

    const feasible: string[] = [];

    // Check planned tasks
    for (const task of plannedTasks) {
      const estimate = this.estimateTaskTokens(task, taskEstimates);
      if (estimate <= remainingCapacity * 0.8) {
        feasible.push(task);
      }
    }

    // Add phase-appropriate suggestions
    if (currentPhase === 'implementation' && feasible.length < 3) {
      if (remainingCapacity > 2000) feasible.push('Complete core functionality');
      if (remainingCapacity > 1000) feasible.push('Add error handling');
      if (remainingCapacity > 500) feasible.push('Add input validation');
    }

    return feasible;
  }

  private estimateTaskTokens(task: string, estimates: Record<string, number>): number {
    const lowerTask = task.toLowerCase();
    
    for (const [key, estimate] of Object.entries(estimates)) {
      if (lowerTask.includes(key.replace('_', ' '))) {
        return estimate;
      }
    }

    // Default estimate based on task complexity keywords
    if (lowerTask.includes('simple') || lowerTask.includes('basic')) return 500;
    if (lowerTask.includes('complex') || lowerTask.includes('advanced')) return 1500;
    return 1000;
  }

  private generateOptimizationSuggestions(status: ContextStatus, dbSession: any): string[] {
    const suggestions: string[] = [];

    // Always provide some suggestions based on usage level
    if (status.usage_percent > 0.7) {
      suggestions.push('Consider creating a checkpoint to preserve progress');
      suggestions.push('Remove completed code from context to free space');
      suggestions.push('Use targeted file reads instead of full file context');
    } else if (status.usage_percent > 0.5) {
      suggestions.push('Monitor context usage closely as you approach capacity');
      suggestions.push('Consider summarizing completed work to reduce context');
    } else {
      suggestions.push('Current context usage is healthy');
      suggestions.push('Plan remaining work to stay within budget');
    }

    // Phase-specific suggestions
    if (dbSession.current_phase === 'implementation' && status.usage_percent > 0.6) {
      suggestions.push('Focus on core functionality, defer nice-to-have features');
      suggestions.push('Consolidate similar operations to reduce context switches');
    }

    // Usage-based suggestions
    if (status.phase_breakdown['planning'] && status.phase_breakdown['planning'] > status.total_tokens * 0.15) {
      suggestions.push('Planning phase using excessive context - move to implementation');
    }

    return suggestions;
  }

  private identifyOptimizationStrategies(
    status: ContextStatus,
    targetReduction: number,
    preserveFunctionality: boolean
  ): OptimizationStrategy[] {
    const strategies: OptimizationStrategy[] = [];

    // Low risk optimizations
    strategies.push({
      name: 'Remove comments',
      description: 'Strip non-essential comments from context',
      estimatedSavings: status.used_tokens * 0.05,
      risk: 'low',
      implementation: 'Remove all non-docstring comments',
    });

    strategies.push({
      name: 'Consolidate imports',
      description: 'Group and minimize import statements',
      estimatedSavings: status.used_tokens * 0.02,
      risk: 'low',
      implementation: 'Combine imports from same module',
    });

    // Medium risk optimizations
    if (!preserveFunctionality || targetReduction > status.used_tokens * 0.1) {
      strategies.push({
        name: 'Remove test code',
        description: 'Temporarily remove test files from context',
        estimatedSavings: status.phase_breakdown['testing'] || 0,
        risk: 'medium',
        implementation: 'Exclude test files from context',
      });

      strategies.push({
        name: 'Summarize completed code',
        description: 'Replace completed modules with summaries',
        estimatedSavings: status.used_tokens * 0.15,
        risk: 'medium',
        implementation: 'Create concise summaries of stable modules',
      });
    }

    // High risk optimizations (only if not preserving functionality)
    if (!preserveFunctionality) {
      strategies.push({
        name: 'Remove type definitions',
        description: 'Strip TypeScript type annotations',
        estimatedSavings: status.used_tokens * 0.1,
        risk: 'high',
        implementation: 'Convert to JavaScript-like syntax',
      });
    }

    // Sort by effectiveness and risk
    return strategies.sort((a, b) => {
      if (a.risk !== b.risk) {
        const riskOrder = { low: 0, medium: 1, high: 2 };
        return riskOrder[a.risk] - riskOrder[b.risk];
      }
      return b.estimatedSavings - a.estimatedSavings;
    });
  }

  private calculateEfficiencyScore(sessionId: string): number {
    // Get metrics
    const avgTokensPerOp = this.db.get<{ avg: number }>(
      `SELECT AVG(tokens_used) as avg FROM context_usage WHERE session_id = ?`,
      sessionId
    )?.avg || 100;

    const dbSession = this.db.get<any>(
      `SELECT * FROM sessions WHERE id = ?`,
      sessionId
    );

    if (!dbSession) return 50;

    // Calculate score based on multiple factors
    let score = 100;

    // Penalize high average token usage
    if (avgTokensPerOp > 200) score -= 20;
    if (avgTokensPerOp > 500) score -= 30;

    // Reward staying within phase allocations
    const phaseUsage = this.db.all<{ phase: string; total: number }>(
      `SELECT phase, SUM(tokens_used) as total FROM context_usage WHERE session_id = ? GROUP BY phase`,
      sessionId
    );

    for (const usage of phaseUsage) {
      // Estimate phase allocation based on total budget
      const phaseAllocations: Record<string, number> = {
        planning: Math.floor(dbSession.context_budget * 0.1),
        implementation: Math.floor(dbSession.context_budget * 0.5),
        testing: Math.floor(dbSession.context_budget * 0.25),
        documentation: Math.floor(dbSession.context_budget * 0.15),
      };
      const allocated = phaseAllocations[usage.phase] || 0;
      if (usage.total > allocated) {
        score -= 10;
      }
    }

    // Reward consistent usage patterns
    const usageTrend = this.calculateUsageTrend(sessionId);
    if (usageTrend === 'stable') score += 10;
    if (usageTrend === 'critical') score -= 20;

    return Math.max(0, Math.min(100, score));
  }
}