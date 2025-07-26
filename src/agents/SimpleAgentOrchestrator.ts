import { Agent, AgentContext, AgentSuggestion, AgentExecutionResult } from './base/Agent';
import { AgentMemory } from './AgentMemory';
import { EventEmitter } from 'events';

export interface OrchestratorConfig {
  maxTotalContextPercent: number; // Default: 50%
  executionTimeoutMs: number; // Default: 200ms per agent
  enabledAgents: string[]; // Which agents to run
}

export interface OrchestratorEvent {
  type: 'agent:started' | 'agent:completed' | 'agent:error' | 'orchestration:complete';
  agentName?: string;
  result?: AgentExecutionResult;
  error?: Error;
  timestamp: number;
}

/**
 * Simple sequential orchestrator for sub-agents
 * Executes agents one at a time based on priority and context availability
 */
export class SimpleAgentOrchestrator extends EventEmitter {
  private agents: Map<string, Agent> = new Map();
  private agentMemory: AgentMemory;
  private config: OrchestratorConfig;
  private isRunning: boolean = false;
  
  constructor(agentMemory: AgentMemory, config?: Partial<OrchestratorConfig>) {
    super();
    this.agentMemory = agentMemory;
    this.config = {
      maxTotalContextPercent: 50,
      executionTimeoutMs: 200,
      enabledAgents: ['symbol_contractor', 'session_orchestrator', 'context_guardian'],
      ...config
    };
  }
  
  /**
   * Register an agent with the orchestrator
   */
  registerAgent(agent: Agent): void {
    if (this.agents.has(agent.name)) {
      throw new Error(`Agent ${agent.name} is already registered`);
    }
    
    this.agents.set(agent.name, agent);
    console.log(`[Orchestrator] Registered agent: ${agent.name}`);
  }
  
  /**
   * Execute all registered agents sequentially
   */
  async executeAgents(context: AgentContext): Promise<AgentSuggestion[]> {
    if (this.isRunning) {
      console.warn('[Orchestrator] Already running, skipping execution');
      return [];
    }
    
    if (context.contextUsagePercent >= this.config.maxTotalContextPercent) {
      console.warn(`[Orchestrator] Context usage too high: ${context.contextUsagePercent}%`);
      return [];
    }
    
    this.isRunning = true;
    const allSuggestions: AgentSuggestion[] = [];
    const startTime = Date.now();
    
    try {
      // Initialize all agents if needed
      await this.initializeAgents();
      
      // Execute agents in priority order
      const priorityOrder = [
        'symbol_contractor',    // High priority - naming consistency
        'session_orchestrator', // Medium priority - checkpoint suggestions
        'context_guardian'      // Low priority - context warnings
      ];
      
      for (const agentType of priorityOrder) {
        const agent = Array.from(this.agents.values()).find(a => a.type === agentType);
        
        if (!agent || !this.config.enabledAgents.includes(agent.type)) {
          continue;
        }
        
        if (!agent.shouldRun(context)) {
          console.log(`[Orchestrator] Skipping ${agent.name} - shouldRun returned false`);
          continue;
        }
        
        try {
          this.emit('agent:started', {
            type: 'agent:started',
            agentName: agent.name,
            timestamp: Date.now()
          });
          
          // Execute with timeout
          const result = await this.executeWithTimeout(agent, context);
          
          if (result.success) {
            // Record decision to memory
            if (result.decision) {
              await this.agentMemory.recordDecision(
                context.sessionId,
                context.projectId,
                result.decision
              );
            }
            
            // Collect suggestions
            if (result.suggestions) {
              allSuggestions.push(...result.suggestions);
            }
            
            this.emit('agent:completed', {
              type: 'agent:completed',
              agentName: agent.name,
              result,
              timestamp: Date.now()
            });
          }
        } catch (error) {
          console.error(`[Orchestrator] Error executing ${agent.name}:`, error);
          this.emit('agent:error', {
            type: 'agent:error',
            agentName: agent.name,
            error: error as Error,
            timestamp: Date.now()
          });
        }
      }
      
      const totalTime = Date.now() - startTime;
      console.log(`[Orchestrator] Completed execution in ${totalTime}ms`);
      
      this.emit('orchestration:complete', {
        type: 'orchestration:complete',
        timestamp: Date.now()
      });
      
      return allSuggestions;
      
    } finally {
      this.isRunning = false;
    }
  }
  
  /**
   * Get health status of all agents
   */
  getHealthStatus(): Record<string, any> {
    const status: Record<string, any> = {};
    
    for (const [name, agent] of this.agents) {
      status[name] = agent.getHealthStatus();
    }
    
    return status;
  }
  
  /**
   * Get all registered agents
   */
  getAgents(): Agent[] {
    return Array.from(this.agents.values());
  }
  
  private async initializeAgents(): Promise<void> {
    const initPromises = Array.from(this.agents.values()).map(agent => 
      agent.initialize().catch(err => {
        console.error(`[Orchestrator] Failed to initialize ${agent.name}:`, err);
      })
    );
    
    await Promise.all(initPromises);
  }
  
  private async executeWithTimeout(
    agent: Agent,
    context: AgentContext
  ): Promise<AgentExecutionResult> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Agent ${agent.name} execution timeout`));
      }, this.config.executionTimeoutMs);
      
      agent.execute(context)
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }
}