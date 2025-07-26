import { BaseAgent, AgentContext, AgentExecutionResult, AgentSuggestion } from './base/Agent';
import { AgentMemory } from './AgentMemory';

interface ContextPattern {
  pattern: 'spike' | 'steady' | 'plateau' | 'exponential';
  rateOfChange: number; // percent per minute
  projectedExhaustion: number; // minutes until 100%
}

interface ContextOptimization {
  strategy: string;
  potentialSavings: number; // percentage
  implementation: string;
}

/**
 * Context Guardian Agent
 * Monitors token usage patterns and suggests optimization strategies
 */
export class ContextGuardian extends BaseAgent {
  readonly name = 'Context Guardian';
  readonly type = 'context_guardian' as const;
  readonly maxContextAllocation = 10; // 10% of total context
  
  private agentMemory: AgentMemory;
  private contextHistory: Map<string, number[]> = new Map(); // sessionId -> usage percentages
  
  // Thresholds for warnings
  private readonly WARNING_THRESHOLD = 40;
  private readonly DANGER_THRESHOLD = 60;
  private readonly CRITICAL_THRESHOLD = 80;
  
  constructor(agentMemory: AgentMemory) {
    super();
    this.agentMemory = agentMemory;
  }
  
  async initialize(): Promise<void> {
    await super.initialize();
    console.log(`[${this.name}] Initialized with warning thresholds: ${this.WARNING_THRESHOLD}%, ${this.DANGER_THRESHOLD}%, ${this.CRITICAL_THRESHOLD}%`);
  }
  
  async execute(context: AgentContext): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    
    try {
      const suggestions: AgentSuggestion[] = [];
      
      // Track context usage history
      this.updateContextHistory(context);
      
      // Analyze usage pattern
      const pattern = this.analyzeContextPattern(context);
      
      // Generate warnings based on current usage
      const warningLevel = this.getWarningLevel(context.contextUsagePercent);
      if (warningLevel) {
        suggestions.push(this.createWarning(warningLevel, context, pattern));
      }
      
      // Suggest optimizations if usage is high
      if (context.contextUsagePercent >= this.WARNING_THRESHOLD) {
        const optimizations = this.suggestOptimizations(context, pattern);
        for (const opt of optimizations) {
          suggestions.push({
            id: `optimization_${opt.strategy}_${Date.now()}`,
            agentName: this.name,
            type: 'context',
            priority: 'medium',
            title: `Optimization: ${opt.strategy}`,
            description: `${opt.implementation} Could save ~${opt.potentialSavings}% context.`,
            actionRequired: false
          });
        }
      }
      
      // Predict exhaustion if pattern is concerning
      if (pattern.pattern === 'exponential' || pattern.rateOfChange > 5) {
        suggestions.push({
          id: `exhaustion_prediction_${Date.now()}`,
          agentName: this.name,
          type: 'context',
          priority: 'high',
          title: 'Context exhaustion predicted',
          description: `At current rate (${pattern.rateOfChange.toFixed(1)}%/min), context will be exhausted in ~${Math.round(pattern.projectedExhaustion)} minutes.`,
          actionRequired: true,
          suggestedAction: {
            tool: 'session_checkpoint',
            params: {
              session_id: context.sessionId,
              force: true,
              completed_components: ['Context optimization needed'],
              metrics: {
                context_used_percent: context.contextUsagePercent
              }
            }
          }
        });
      }
      
      // Record decision
      const decision = {
        agentName: this.name,
        actionType: 'context_monitoring',
        inputContext: JSON.stringify({
          contextPercent: context.contextUsagePercent,
          pattern: pattern.pattern,
          rateOfChange: pattern.rateOfChange
        }),
        decisionMade: `Generated ${suggestions.length} suggestions`,
        confidence: 0.85,
        reasoning: `Monitoring context at ${context.contextUsagePercent}% with ${pattern.pattern} pattern`
      };
      
      const executionTime = Date.now() - startTime;
      this.recordExecution(executionTime, true);
      
      return {
        success: true,
        decision,
        suggestions,
        executionTimeMs: executionTime
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.recordExecution(executionTime, false);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTimeMs: executionTime
      };
    }
  }
  
  shouldRun(context: AgentContext): boolean {
    // Only run when context usage is above 40%
    return context.contextUsagePercent >= 40 && context.contextUsagePercent < 95;
  }
  
  private updateContextHistory(context: AgentContext): void {
    if (!this.contextHistory.has(context.sessionId)) {
      this.contextHistory.set(context.sessionId, []);
    }
    
    const history = this.contextHistory.get(context.sessionId)!;
    history.push(context.contextUsagePercent);
    
    // Keep only last 20 measurements
    if (history.length > 20) {
      history.shift();
    }
  }
  
  private analyzeContextPattern(context: AgentContext): ContextPattern {
    const history = this.contextHistory.get(context.sessionId) || [context.contextUsagePercent];
    
    if (history.length < 2) {
      return {
        pattern: 'steady',
        rateOfChange: 0,
        projectedExhaustion: Infinity
      };
    }
    
    // Calculate rate of change
    const recentHistory = history.slice(-5); // Last 5 measurements
    const avgChange = recentHistory.reduce((sum, val, idx) => {
      if (idx === 0) return sum;
      return sum + (val - recentHistory[idx - 1]);
    }, 0) / (recentHistory.length - 1);
    
    // Determine pattern
    let pattern: ContextPattern['pattern'] = 'steady';
    if (Math.abs(avgChange) < 1) {
      pattern = 'plateau';
    } else if (avgChange > 0 && avgChange < 3) {
      pattern = 'steady';
    } else if (avgChange >= 3 && avgChange < 8) {
      pattern = 'spike';
    } else if (avgChange >= 8) {
      pattern = 'exponential';
    }
    
    // Project exhaustion
    const remaining = 100 - context.contextUsagePercent;
    const projectedExhaustion = avgChange > 0 ? remaining / avgChange : Infinity;
    
    return {
      pattern,
      rateOfChange: avgChange,
      projectedExhaustion
    };
  }
  
  private getWarningLevel(contextPercent: number): 'warning' | 'danger' | 'critical' | null {
    if (contextPercent >= this.CRITICAL_THRESHOLD) return 'critical';
    if (contextPercent >= this.DANGER_THRESHOLD) return 'danger';
    if (contextPercent >= this.WARNING_THRESHOLD) return 'warning';
    return null;
  }
  
  private createWarning(
    level: 'warning' | 'danger' | 'critical',
    context: AgentContext,
    pattern: ContextPattern
  ): AgentSuggestion {
    const messages = {
      warning: {
        title: 'Context usage approaching limits',
        description: `Context at ${context.contextUsagePercent}%. Consider simplifying approach or creating checkpoint.`,
        priority: 'low' as const
      },
      danger: {
        title: 'High context usage detected',
        description: `Context at ${context.contextUsagePercent}%. Recommend immediate optimization or checkpoint.`,
        priority: 'medium' as const
      },
      critical: {
        title: 'Critical context usage',
        description: `Context at ${context.contextUsagePercent}%! Immediate action required to avoid exhaustion.`,
        priority: 'critical' as const
      }
    };
    
    const msg = messages[level];
    
    return {
      id: `context_${level}_${Date.now()}`,
      agentName: this.name,
      type: 'context',
      priority: msg.priority,
      title: msg.title,
      description: msg.description,
      actionRequired: level === 'critical',
      suggestedAction: level === 'critical' ? {
        tool: 'context_optimize',
        params: {
          session_id: context.sessionId,
          target_reduction: 20,
          preserve_functionality: true
        }
      } : undefined
    };
  }
  
  private suggestOptimizations(
    context: AgentContext,
    pattern: ContextPattern
  ): ContextOptimization[] {
    const optimizations: ContextOptimization[] = [];
    
    // Phase-specific optimizations
    if (context.currentPhase === 'implementation') {
      optimizations.push({
        strategy: 'Focused implementation',
        potentialSavings: 15,
        implementation: 'Focus on core functionality only. Defer edge cases and optimizations.'
      });
    }
    
    if (context.currentPhase === 'testing') {
      optimizations.push({
        strategy: 'Targeted testing',
        potentialSavings: 10,
        implementation: 'Test critical paths only. Use unit tests over integration tests.'
      });
    }
    
    // Pattern-based optimizations
    if (pattern.pattern === 'spike' || pattern.pattern === 'exponential') {
      optimizations.push({
        strategy: 'Batch operations',
        potentialSavings: 20,
        implementation: 'Group similar tasks together to reduce context switching.'
      });
    }
    
    // General optimizations
    if (context.contextUsagePercent > 60) {
      optimizations.push({
        strategy: 'Context pruning',
        potentialSavings: 25,
        implementation: 'Remove completed file contents from context. Keep only active files.'
      });
    }
    
    return optimizations.slice(0, 2); // Return top 2 suggestions
  }
  
  /**
   * Clean up old history to prevent memory leaks
   */
  private cleanupOldHistory(): void {
    // Remove history for sessions older than 24 hours
    const maxAge = 24 * 60 * 60 * 1000;
    const now = Date.now();
    
    for (const [sessionId, history] of this.contextHistory) {
      // Simple heuristic: if we haven't updated in a while, remove
      if (history.length === 0) {
        this.contextHistory.delete(sessionId);
      }
    }
  }
}