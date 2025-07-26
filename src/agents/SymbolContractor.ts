import { BaseAgent, AgentContext, AgentExecutionResult, AgentSuggestion } from './base/Agent';
import { AgentMemory } from './AgentMemory';

interface NamingConflict {
  concept: string;
  existingName: string;
  suggestedName: string;
  contextType: string;
  severity: 'low' | 'medium' | 'high';
}

/**
 * Symbol Contractor Agent
 * Responsible for maintaining naming consistency across the codebase
 */
export class SymbolContractor extends BaseAgent {
  readonly name = 'Symbol Contractor';
  readonly type = 'symbol_contractor' as const;
  readonly maxContextAllocation = 15; // 15% of total context
  
  private agentMemory: AgentMemory;
  private recentSymbols: Map<string, string> = new Map(); // concept -> name cache
  
  constructor(agentMemory: AgentMemory) {
    super();
    this.agentMemory = agentMemory;
  }
  
  async initialize(): Promise<void> {
    await super.initialize();
    // Could pre-load common symbols here if needed
  }
  
  async execute(context: AgentContext): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Check for naming conflicts in the current project
      const conflicts = await this.detectNamingConflicts(context.projectId);
      const suggestions: AgentSuggestion[] = [];
      
      // Generate suggestions for conflicts
      for (const conflict of conflicts) {
        suggestions.push({
          id: `naming_${conflict.concept}_${Date.now()}`,
          agentName: this.name,
          type: 'naming',
          priority: conflict.severity === 'high' ? 'high' : 'medium',
          title: `Naming conflict: ${conflict.concept}`,
          description: `The concept "${conflict.concept}" is named "${conflict.existingName}" elsewhere but "${conflict.suggestedName}" here`,
          actionRequired: conflict.severity === 'high',
          suggestedAction: {
            tool: 'symbol_rename',
            params: {
              concept: conflict.concept,
              newName: conflict.existingName,
              contextType: conflict.contextType
            }
          }
        });
      }
      
      // Check recent decisions to learn from patterns
      const recentDecisions = await this.agentMemory.getRecentDecisions(
        this.name,
        context.projectId,
        5
      );
      
      // Record this execution
      const decision = {
        agentName: this.name,
        actionType: 'naming_check',
        inputContext: JSON.stringify({ projectId: context.projectId, phase: context.currentPhase }),
        decisionMade: `Found ${conflicts.length} naming conflicts`,
        confidence: conflicts.length > 0 ? 0.8 : 1.0,
        reasoning: `Analyzed naming consistency based on ${this.recentSymbols.size} cached symbols`
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
    // Run more frequently during implementation phase
    if (context.currentPhase === 'implementation') {
      return context.contextUsagePercent < 85;
    }
    
    // Otherwise use default logic
    return super.shouldRun(context);
  }
  
  /**
   * Register a new symbol name
   */
  async registerSymbol(
    projectId: string,
    sessionId: string,
    concept: string,
    chosenName: string,
    contextType: string
  ): Promise<string> {
    // Check if symbol already exists
    const existing = await this.agentMemory.findSymbol(projectId, concept);
    
    if (existing && existing.chosenName !== chosenName) {
      // Naming conflict detected
      console.warn(`[${this.name}] Naming conflict for "${concept}": "${existing.chosenName}" vs "${chosenName}"`);
    }
    
    // Register the symbol
    const symbolId = await this.agentMemory.registerSymbol(projectId, {
      concept,
      chosenName,
      contextType,
      projectId,
      confidenceScore: existing ? 0.7 : 1.0, // Lower confidence if conflict
      usageCount: 1,
      createdByAgent: this.name,
      sessionId
    });
    
    // Update cache
    this.recentSymbols.set(concept, chosenName);
    
    return symbolId;
  }
  
  /**
   * Get recommended name for a concept
   */
  async getRecommendedName(
    projectId: string,
    concept: string,
    contextType: string
  ): Promise<string | null> {
    // Check cache first
    if (this.recentSymbols.has(concept)) {
      return this.recentSymbols.get(concept)!;
    }
    
    // Check database
    const existing = await this.agentMemory.findSymbol(projectId, concept);
    if (existing) {
      this.recentSymbols.set(concept, existing.chosenName);
      await this.agentMemory.incrementSymbolUsage(existing.id);
      return existing.chosenName;
    }
    
    // No existing name found
    return null;
  }
  
  /**
   * Detect naming conflicts in the project
   */
  private async detectNamingConflicts(projectId: string): Promise<NamingConflict[]> {
    const conflicts: NamingConflict[] = [];
    const symbols = await this.agentMemory.getProjectSymbols(projectId);
    
    // Group symbols by concept
    const conceptMap = new Map<string, Set<string>>();
    for (const symbol of symbols) {
      if (!conceptMap.has(symbol.concept)) {
        conceptMap.set(symbol.concept, new Set());
      }
      conceptMap.get(symbol.concept)!.add(symbol.chosenName);
    }
    
    // Find concepts with multiple names
    for (const [concept, names] of conceptMap) {
      if (names.size > 1) {
        const nameArray = Array.from(names);
        const mostUsed = symbols
          .filter(s => s.concept === concept)
          .sort((a, b) => b.usageCount - a.usageCount)[0];
        
        for (const name of nameArray) {
          if (name !== mostUsed.chosenName) {
            conflicts.push({
              concept,
              existingName: mostUsed.chosenName,
              suggestedName: name,
              contextType: mostUsed.contextType,
              severity: this.calculateConflictSeverity(mostUsed.usageCount, symbols.length)
            });
          }
        }
      }
    }
    
    return conflicts;
  }
  
  private calculateConflictSeverity(usageCount: number, totalSymbols: number): 'low' | 'medium' | 'high' {
    const usageRatio = usageCount / totalSymbols;
    
    if (usageRatio > 0.1 || usageCount > 10) {
      return 'high';
    } else if (usageRatio > 0.05 || usageCount > 5) {
      return 'medium';
    }
    return 'low';
  }
}