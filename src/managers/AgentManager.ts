import { AgentMemory, SymbolEntry } from '../agents/AgentMemory';
import { SimpleAgentOrchestrator } from '../agents/SimpleAgentOrchestrator';
import { SymbolContractor } from '../agents/SymbolContractor';
import { SessionOrchestrator } from '../agents/SessionOrchestrator';
import { ContextGuardian } from '../agents/ContextGuardian';
import { AgentContext, AgentSuggestion } from '../agents/base/Agent';
import { BehaviorSubject } from 'rxjs';
import { WebSocketBroadcaster } from '../utils/websocket-broadcaster';

export interface AgentStatus {
  enabled: boolean;
  lastRun?: number;
  suggestions: AgentSuggestion[];
  health: Record<string, any>;
}

/**
 * Manager for agent operations and MCP tool integration
 */
export class AgentManager {
  private agentMemory: AgentMemory;
  private orchestrator: SimpleAgentOrchestrator;
  private symbolContractor: SymbolContractor;
  private sessionOrchestrator: SessionOrchestrator;
  private contextGuardian: ContextGuardian;
  private wsBroadcaster: WebSocketBroadcaster;
  private agentStatus$ = new BehaviorSubject<AgentStatus>({
    enabled: true,
    suggestions: [],
    health: {}
  });
  
  constructor() {
    // Initialize agent memory
    this.agentMemory = new AgentMemory();
    
    // Initialize orchestrator
    this.orchestrator = new SimpleAgentOrchestrator(this.agentMemory);
    
    // Initialize and register all agents
    this.symbolContractor = new SymbolContractor(this.agentMemory);
    this.sessionOrchestrator = new SessionOrchestrator(this.agentMemory);
    this.contextGuardian = new ContextGuardian(this.agentMemory);
    
    // Initialize WebSocket broadcaster
    this.wsBroadcaster = WebSocketBroadcaster.getInstance();
    
    // Register agents in priority order
    this.orchestrator.registerAgent(this.symbolContractor);
    this.orchestrator.registerAgent(this.sessionOrchestrator);
    this.orchestrator.registerAgent(this.contextGuardian);
    
    // Set up orchestrator event listeners
    this.setupOrchestratorEvents();
  }
  
  /**
   * Run all agents for the current context
   */
  async runAgents(params: {
    session_id: string;
    project_id: string;
    current_phase: string;
    context_usage_percent: number;
  }): Promise<{ suggestions: AgentSuggestion[] }> {
    const context: AgentContext = {
      sessionId: params.session_id,
      projectId: params.project_id,
      currentPhase: params.current_phase,
      contextUsagePercent: params.context_usage_percent,
      timestamp: Date.now()
    };
    
    // Check if agents are enabled
    if (!this.agentStatus$.value.enabled) {
      console.log('[AgentManager] Agents are disabled');
      return { suggestions: [] };
    }
    
    console.log('[AgentManager] Running agents with context:', context);
    const suggestions = await this.orchestrator.executeAgents(context);
    console.log('[AgentManager] Agents returned suggestions:', suggestions);
    
    // Broadcast suggestions via WebSocket
    if (suggestions.length > 0) {
      this.wsBroadcaster.broadcastAgentSuggestions(
        suggestions,
        params.session_id,
        params.project_id
      );
    }
    
    // Update status
    const currentStatus = this.agentStatus$.value;
    this.agentStatus$.next({
      ...currentStatus,
      lastRun: Date.now(),
      suggestions,
      health: this.orchestrator.getHealthStatus()
    });
    
    return { suggestions };
  }
  
  /**
   * Register a new symbol
   */
  async registerSymbol(params: {
    project_id: string;
    session_id: string;
    concept: string;
    chosen_name: string;
    context_type: string;
  }): Promise<{ symbol_id: string; existing?: boolean }> {
    // Check if symbol already exists
    const existing = await this.agentMemory.findSymbol(
      params.project_id,
      params.concept
    );
    
    if (existing) {
      await this.agentMemory.incrementSymbolUsage(existing.id);
      return {
        symbol_id: existing.id,
        existing: true
      };
    }
    
    // Register new symbol via Symbol Contractor
    const symbolId = await this.symbolContractor.registerSymbol(
      params.project_id,
      params.session_id,
      params.concept,
      params.chosen_name,
      params.context_type
    );
    
    return {
      symbol_id: symbolId,
      existing: false
    };
  }
  
  /**
   * Get recommended name for a concept
   */
  async getSymbolName(params: {
    project_id: string;
    concept: string;
    context_type: string;
  }): Promise<{ name: string | null; confidence: number }> {
    const recommended = await this.symbolContractor.getRecommendedName(
      params.project_id,
      params.concept,
      params.context_type
    );
    
    if (recommended) {
      const symbol = await this.agentMemory.findSymbol(
        params.project_id,
        params.concept
      );
      
      return {
        name: recommended,
        confidence: symbol?.confidenceScore || 1.0
      };
    }
    
    return {
      name: null,
      confidence: 0
    };
  }
  
  /**
   * Get all symbols for a project
   */
  async getProjectSymbols(params: {
    project_id: string;
  }): Promise<{ symbols: SymbolEntry[] }> {
    const symbols = await this.agentMemory.getProjectSymbols(params.project_id);
    return { symbols };
  }
  
  /**
   * Get agent status observable
   */
  getAgentStatus() {
    return this.agentStatus$.asObservable();
  }
  
  /**
   * Enable or disable agents
   */
  async setAgentsEnabled(params: {
    enabled: boolean;
  }): Promise<{ success: boolean }> {
    const currentStatus = this.agentStatus$.value;
    this.agentStatus$.next({
      ...currentStatus,
      enabled: params.enabled
    });
    
    return { success: true };
  }
  
  /**
   * Get agent memory statistics
   */
  async getAgentStats(params: {
    agent_name?: string;
    project_id?: string;
  }): Promise<{
    total_decisions: number;
    success_rate: number;
    recent_decisions: any[];
  }> {
    let agentName = params.agent_name;
    
    // If no agent name specified, aggregate stats from all agents
    if (!agentName) {
      // Get stats for all agents
      const allAgents = this.orchestrator.getAgents();
      let totalDecisions = 0;
      let totalSuccessRate = 0;
      const allDecisions: any[] = [];
      
      for (const agent of allAgents) {
        const decisions = await this.agentMemory.getRecentDecisions(
          agent.name,
          params.project_id,
          5
        );
        allDecisions.push(...decisions);
        totalDecisions += decisions.length;
        
        const successRate = await this.agentMemory.getAgentSuccessRate(
          agent.name,
          params.project_id
        );
        totalSuccessRate += successRate;
      }
      
      return {
        total_decisions: totalDecisions,
        success_rate: allAgents.length > 0 ? totalSuccessRate / allAgents.length : 1,
        recent_decisions: allDecisions.slice(0, 20)
      };
    }
    
    // Get stats for specific agent
    const decisions = await this.agentMemory.getRecentDecisions(
      agentName,
      params.project_id,
      20
    );
    
    const successRate = await this.agentMemory.getAgentSuccessRate(
      agentName,
      params.project_id
    );
    
    return {
      total_decisions: decisions.length,
      success_rate: successRate,
      recent_decisions: decisions
    };
  }
  
  private setupOrchestratorEvents(): void {
    this.orchestrator.on('agent:completed', (event) => {
      console.log(`[AgentManager] Agent completed: ${event.agentName}`);
    });
    
    this.orchestrator.on('agent:error', (event) => {
      console.error(`[AgentManager] Agent error: ${event.agentName}`, event.error);
    });
  }
  
  /**
   * Cleanup resources
   */
  destroy(): void {
    this.agentMemory.close();
  }
}