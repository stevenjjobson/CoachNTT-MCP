/**
 * Base interface for all sub-agents in the MyWorkFlow system
 */

export interface AgentContext {
  sessionId: string;
  projectId: string;
  currentPhase: string;
  contextUsagePercent: number;
  timestamp: number;
}

export interface AgentDecision {
  agentName: string;
  actionType: string;
  inputContext: string;
  decisionMade: string;
  confidence: number;
  reasoning?: string;
}

export interface AgentSuggestion {
  id: string;
  agentName: string;
  type: 'naming' | 'checkpoint' | 'context' | 'quality';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  actionRequired: boolean;
  suggestedAction?: {
    tool: string;
    params: Record<string, any>;
  };
}

export interface AgentExecutionResult {
  success: boolean;
  decision?: AgentDecision;
  suggestions?: AgentSuggestion[];
  error?: string;
  executionTimeMs: number;
}

/**
 * Base interface that all agents must implement
 */
export interface Agent {
  readonly name: string;
  readonly type: 'symbol_contractor' | 'session_orchestrator' | 'context_guardian';
  readonly maxContextAllocation: number; // Percentage of total context (0-100)
  
  /**
   * Initialize the agent with any necessary setup
   */
  initialize(): Promise<void>;
  
  /**
   * Execute the agent's logic given the current context
   * Should be stateless and return quickly (<200ms)
   */
  execute(context: AgentContext): Promise<AgentExecutionResult>;
  
  /**
   * Check if the agent should run given the current context
   * Helps avoid unnecessary executions
   */
  shouldRun(context: AgentContext): boolean;
  
  /**
   * Get the agent's current health status
   */
  getHealthStatus(): {
    healthy: boolean;
    lastExecutionTime?: number;
    errorCount: number;
    averageExecutionTimeMs: number;
  };
}

/**
 * Base abstract class providing common functionality
 */
export abstract class BaseAgent implements Agent {
  abstract readonly name: string;
  abstract readonly type: Agent['type'];
  abstract readonly maxContextAllocation: number;
  
  protected executionTimes: number[] = [];
  protected errorCount: number = 0;
  protected lastExecutionTime?: number;
  
  async initialize(): Promise<void> {
    // Base initialization - can be overridden
  }
  
  abstract execute(context: AgentContext): Promise<AgentExecutionResult>;
  
  shouldRun(context: AgentContext): boolean {
    // Default: run if context usage is below 90%
    return context.contextUsagePercent < 90;
  }
  
  getHealthStatus() {
    const avgTime = this.executionTimes.length > 0
      ? this.executionTimes.reduce((a, b) => a + b, 0) / this.executionTimes.length
      : 0;
      
    return {
      healthy: this.errorCount < 5 && avgTime < 500,
      lastExecutionTime: this.lastExecutionTime,
      errorCount: this.errorCount,
      averageExecutionTimeMs: avgTime
    };
  }
  
  protected recordExecution(timeMs: number, success: boolean) {
    this.lastExecutionTime = Date.now();
    this.executionTimes.push(timeMs);
    
    // Keep only last 100 execution times
    if (this.executionTimes.length > 100) {
      this.executionTimes.shift();
    }
    
    if (!success) {
      this.errorCount++;
    }
  }
}