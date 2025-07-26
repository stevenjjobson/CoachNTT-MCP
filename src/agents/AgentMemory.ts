import { DatabaseConnection } from '../database/connection';
import { AgentDecision } from './base/Agent';

export interface SymbolEntry {
  id: string;
  concept: string;
  chosenName: string;
  contextType: string;
  projectId: string;
  confidenceScore: number;
  usageCount: number;
  createdByAgent?: string;
  sessionId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AgentMemoryEntry {
  id: number;
  agentName: string;
  actionType: string;
  inputContext: string;
  decisionMade: string;
  worked: boolean;
  projectId?: string;
  sessionId?: string;
  createdAt: number;
}

/**
 * Simple SQL-based memory storage for agents
 * Provides read/write access to agent_memory and symbol_registry tables
 */
export class AgentMemory {
  private dbConnection: DatabaseConnection;
  
  constructor() {
    this.dbConnection = DatabaseConnection.getInstance();
  }
  
  /**
   * Record an agent decision to memory
   */
  async recordDecision(
    sessionId: string,
    projectId: string,
    decision: AgentDecision
  ): Promise<void> {
    this.dbConnection.run(
      `INSERT INTO agent_memory (
        agent_name, action_type, input_context, decision_made,
        worked, project_id, session_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        decision.agentName,
        decision.actionType,
        decision.inputContext,
        decision.decisionMade,
        true, // Default to true, can be updated later if it didn't work
        projectId,
        sessionId
      ]
    );
  }
  
  /**
   * Get recent decisions for an agent
   */
  async getRecentDecisions(
    agentName: string,
    projectId?: string,
    limit: number = 10
  ): Promise<AgentMemoryEntry[]> {
    let query = `
      SELECT * FROM agent_memory 
      WHERE agent_name = ?
    `;
    const params: any[] = [agentName];
    
    if (projectId) {
      query += ' AND project_id = ?';
      params.push(projectId);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);
    
    return this.dbConnection.all<AgentMemoryEntry>(query, params);
  }
  
  /**
   * Find similar past decisions
   */
  async findSimilarDecisions(
    agentName: string,
    inputContext: string,
    limit: number = 5
  ): Promise<AgentMemoryEntry[]> {
    // Simple text similarity using LIKE
    // In a more complex system, this could use embeddings
    const contextKeywords = inputContext.toLowerCase().split(/\s+/).slice(0, 5);
    const likeClause = contextKeywords.map(() => 'input_context LIKE ?').join(' OR ');
    const params = [
      agentName,
      ...contextKeywords.map(k => `%${k}%`),
      limit
    ];
    
    return this.dbConnection.all<AgentMemoryEntry>(
      `SELECT * FROM agent_memory 
       WHERE agent_name = ? AND (${likeClause})
       ORDER BY created_at DESC LIMIT ?`,
      params
    );
  }
  
  /**
   * Register a new symbol name
   */
  async registerSymbol(
    projectId: string,
    symbol: Omit<SymbolEntry, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    const id = `sym_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();
    
    this.dbConnection.run(
      `INSERT INTO symbol_registry (
        id, concept, chosen_name, context_type, project_id,
        confidence_score, usage_count, created_by_agent, session_id,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        symbol.concept,
        symbol.chosenName,
        symbol.contextType,
        projectId,
        symbol.confidenceScore || 1.0,
        symbol.usageCount || 1,
        symbol.createdByAgent,
        symbol.sessionId,
        now,
        now
      ]
    );
    
    return id;
  }
  
  /**
   * Find existing symbol by concept
   */
  async findSymbol(
    projectId: string,
    concept: string
  ): Promise<SymbolEntry | null> {
    const result = this.dbConnection.get<SymbolEntry>(
      `SELECT * FROM symbol_registry 
       WHERE project_id = ? AND concept = ?
       ORDER BY usage_count DESC, confidence_score DESC
       LIMIT 1`,
      [projectId, concept]
    );
    
    return result || null;
  }
  
  /**
   * Find symbols by chosen name (for conflict detection)
   */
  async findSymbolsByName(
    projectId: string,
    chosenName: string
  ): Promise<SymbolEntry[]> {
    return this.dbConnection.all<SymbolEntry>(
      `SELECT * FROM symbol_registry 
       WHERE project_id = ? AND chosen_name = ?
       ORDER BY usage_count DESC`,
      [projectId, chosenName]
    );
  }
  
  /**
   * Update symbol usage count
   */
  async incrementSymbolUsage(symbolId: string): Promise<void> {
    this.dbConnection.run(
      `UPDATE symbol_registry 
       SET usage_count = usage_count + 1, updated_at = ?
       WHERE id = ?`,
      [Date.now(), symbolId]
    );
  }
  
  /**
   * Get all symbols for a project
   */
  async getProjectSymbols(projectId: string): Promise<SymbolEntry[]> {
    return this.dbConnection.all<SymbolEntry>(
      `SELECT * FROM symbol_registry 
       WHERE project_id = ?
       ORDER BY context_type, chosen_name`,
      [projectId]
    );
  }
  
  /**
   * Mark a decision as not working
   */
  async markDecisionFailed(decisionId: number): Promise<void> {
    this.dbConnection.run(
      'UPDATE agent_memory SET worked = FALSE WHERE id = ?',
      [decisionId]
    );
  }
  
  /**
   * Get success rate for an agent
   */
  async getAgentSuccessRate(
    agentName: string,
    projectId?: string
  ): Promise<number> {
    let query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN worked THEN 1 ELSE 0 END) as successful
      FROM agent_memory 
      WHERE agent_name = ?
    `;
    const params: any[] = [agentName];
    
    if (projectId) {
      query += ' AND project_id = ?';
      params.push(projectId);
    }
    
    const result = this.dbConnection.get<{ total: number; successful: number }>(query, params);
    
    if (!result || result.total === 0) {
      return 1.0; // No data, assume success
    }
    
    return result.successful / result.total;
  }
  
  /**
   * Clean up old memory entries
   */
  async cleanupOldEntries(daysToKeep: number = 30): Promise<void> {
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    
    this.dbConnection.run(
      'DELETE FROM agent_memory WHERE created_at < ?',
      [cutoffTime]
    );
  }
  
  /**
   * Close database connection
   */
  close(): void {
    // Connection is managed by singleton
  }
}