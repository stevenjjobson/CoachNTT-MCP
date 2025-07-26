import { BaseAgent, AgentContext, AgentExecutionResult, AgentSuggestion } from './base/Agent';
import { AgentMemory } from './AgentMemory';

interface SessionMetrics {
  startTime: number;
  contextUsedAtStart: number;
  contextUsageRate: number; // tokens per minute
  estimatedTimeRemaining: number; // minutes
  checkpointsCreated: number;
}

/**
 * Session Orchestrator Agent
 * Monitors context usage and suggests checkpoints at key thresholds
 */
export class SessionOrchestrator extends BaseAgent {
  readonly name = 'Session Orchestrator';
  readonly type = 'session_orchestrator' as const;
  readonly maxContextAllocation = 20; // 20% of total context
  
  private agentMemory: AgentMemory;
  private sessionMetrics: Map<string, SessionMetrics> = new Map();
  
  // Checkpoint thresholds
  private readonly CHECKPOINT_THRESHOLDS = [30, 50, 70];
  private readonly CRITICAL_THRESHOLD = 85;
  
  constructor(agentMemory: AgentMemory) {
    super();
    this.agentMemory = agentMemory;
  }
  
  async initialize(): Promise<void> {
    await super.initialize();
    console.log(`[${this.name}] Initialized with checkpoint thresholds: ${this.CHECKPOINT_THRESHOLDS.join('%, ')}%`);
  }
  
  async execute(context: AgentContext): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    
    try {
      const suggestions: AgentSuggestion[] = [];
      
      // Initialize or update session metrics
      this.updateSessionMetrics(context);
      
      // Check if we're approaching a checkpoint threshold
      const checkpointSuggestion = this.checkCheckpointThreshold(context);
      if (checkpointSuggestion) {
        suggestions.push(checkpointSuggestion);
      }
      
      // Check for rapid context consumption
      const metrics = this.sessionMetrics.get(context.sessionId);
      if (metrics && metrics.contextUsageRate > 100) { // More than 100 tokens per minute
        suggestions.push({
          id: `session_rapid_context_${Date.now()}`,
          agentName: this.name,
          type: 'context',
          priority: 'medium',
          title: 'Rapid context consumption detected',
          description: `Context usage rate: ${Math.round(metrics.contextUsageRate)} tokens/min. Consider breaking down complex tasks.`,
          actionRequired: false
        });
      }
      
      // Suggest session planning if in early stages
      if (context.currentPhase === 'planning' && context.contextUsagePercent < 10) {
        suggestions.push({
          id: `session_planning_${Date.now()}`,
          agentName: this.name,
          type: 'checkpoint',
          priority: 'low',
          title: 'Session planning recommended',
          description: 'Consider outlining major milestones for this session to optimize context usage.',
          actionRequired: false
        });
      }
      
      // Record decision
      const decision = {
        agentName: this.name,
        actionType: 'session_monitoring',
        inputContext: JSON.stringify({
          sessionId: context.sessionId,
          contextPercent: context.contextUsagePercent,
          phase: context.currentPhase
        }),
        decisionMade: `Generated ${suggestions.length} suggestions`,
        confidence: 0.9,
        reasoning: `Monitoring context usage at ${context.contextUsagePercent}%`
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
    // Only run when context usage is above 25%
    return context.contextUsagePercent >= 25 && context.contextUsagePercent < 90;
  }
  
  private updateSessionMetrics(context: AgentContext): void {
    const now = Date.now();
    
    if (!this.sessionMetrics.has(context.sessionId)) {
      // Initialize metrics
      this.sessionMetrics.set(context.sessionId, {
        startTime: now,
        contextUsedAtStart: context.contextUsagePercent,
        contextUsageRate: 0,
        estimatedTimeRemaining: 0,
        checkpointsCreated: 0
      });
    } else {
      // Update metrics
      const metrics = this.sessionMetrics.get(context.sessionId)!;
      const elapsedMinutes = (now - metrics.startTime) / 60000;
      
      if (elapsedMinutes > 0) {
        const contextUsed = context.contextUsagePercent - metrics.contextUsedAtStart;
        metrics.contextUsageRate = contextUsed / elapsedMinutes;
        
        // Estimate time remaining
        if (metrics.contextUsageRate > 0) {
          const remainingContext = 100 - context.contextUsagePercent;
          metrics.estimatedTimeRemaining = remainingContext / metrics.contextUsageRate;
        }
      }
    }
  }
  
  private checkCheckpointThreshold(context: AgentContext): AgentSuggestion | null {
    const metrics = this.sessionMetrics.get(context.sessionId);
    if (!metrics) return null;
    
    // Find the next threshold
    const nextThreshold = this.CHECKPOINT_THRESHOLDS.find(
      threshold => context.contextUsagePercent >= threshold - 5 && 
                   context.contextUsagePercent < threshold + 5
    );
    
    if (nextThreshold) {
      const priority = nextThreshold >= 70 ? 'high' : 'medium';
      const actionRequired = nextThreshold >= 70;
      
      return {
        id: `checkpoint_${nextThreshold}_${Date.now()}`,
        agentName: this.name,
        type: 'checkpoint',
        priority,
        title: `Checkpoint recommended at ${context.contextUsagePercent}% context usage`,
        description: `You've reached ${context.contextUsagePercent}% context usage. Consider creating a checkpoint to preserve progress.`,
        actionRequired,
        suggestedAction: {
          tool: 'session_checkpoint',
          params: {
            session_id: context.sessionId,
            completed_components: [`Phase: ${context.currentPhase}`],
            metrics: {
              context_used_percent: context.contextUsagePercent,
              lines_written: 0, // Would need actual metrics
              tests_passing: 0
            }
          }
        }
      };
    }
    
    // Critical threshold warning
    if (context.contextUsagePercent >= this.CRITICAL_THRESHOLD) {
      return {
        id: `critical_context_${Date.now()}`,
        agentName: this.name,
        type: 'context',
        priority: 'critical',
        title: 'Critical context usage - immediate checkpoint required',
        description: `Context usage at ${context.contextUsagePercent}%. Create checkpoint immediately to avoid context exhaustion.`,
        actionRequired: true,
        suggestedAction: {
          tool: 'session_checkpoint',
          params: {
            session_id: context.sessionId,
            force: true,
            completed_components: ['Emergency checkpoint'],
            metrics: {
              context_used_percent: context.contextUsagePercent,
              lines_written: 0,
              tests_passing: 0
            }
          }
        }
      };
    }
    
    return null;
  }
  
  /**
   * Clean up old session metrics to prevent memory leaks
   */
  private cleanupOldMetrics(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    for (const [sessionId, metrics] of this.sessionMetrics) {
      if (now - metrics.startTime > maxAge) {
        this.sessionMetrics.delete(sessionId);
      }
    }
  }
}