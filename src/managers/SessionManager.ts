import { BehaviorSubject, Observable } from 'rxjs';
import { randomUUID } from 'crypto';
import { DatabaseConnection } from '../database';
import { ContextMonitor } from './ContextMonitor';
import { SessionNotFoundError, InvalidParametersError, DatabaseError } from '../utils/errors';
import {
  Session,
  SessionStartParams,
  CheckpointParams,
  CheckpointResponse,
  HandoffParams,
  HandoffResponse,
  ContextPlan,
  EstimatedScope,
  SessionMetrics,
  CheckpointPlan,
  ContextSnapshot,
  ContinuationPlan,
  ContextRequirement,
  PrerequisiteCheck,
  SessionEstimate,
} from '../interfaces';

export class SessionManager {
  private db: DatabaseConnection;
  private contextMonitor: ContextMonitor;
  private currentSession$ = new BehaviorSubject<Session | null>(null);
  private sessionMetrics$ = new BehaviorSubject<SessionMetrics | null>(null);
  private contextStatus$ = new BehaviorSubject<{ used: number; total: number; percent: number } | null>(null);

  constructor() {
    this.db = DatabaseConnection.getInstance();
    this.contextMonitor = new ContextMonitor();
    
    // Subscribe to context monitor updates
    this.contextMonitor.getContextStatus().subscribe(status => {
      if (status) {
        this.contextStatus$.next({
          used: status.used_tokens,
          total: status.total_tokens,
          percent: status.usage_percent,
        });
      }
    });
  }

  getCurrentSession(): Observable<Session | null> {
    return this.currentSession$.asObservable();
  }
  
  getSessionMetrics(): Observable<SessionMetrics | null> {
    return this.sessionMetrics$.asObservable();
  }
  
  getContextStatus(): Observable<{ used: number; total: number; percent: number } | null> {
    return this.contextStatus$.asObservable();
  }

  async startSession(params: SessionStartParams): Promise<Session> {
    return this.db.transaction(() => {
      const sessionId = randomUUID();
      const now = Date.now();
      
      // Create or update project record
      this.ensureProjectExists(params.project_name);
      
      // Calculate context budget and plan
      const contextPlan = this.calculateContextBudget(params.estimated_scope, params.context_budget);
      
      // Calculate estimated completion time (4 hours default)
      const estimatedCompletion = now + (4 * 60 * 60 * 1000);
      
      // Create checkpoint plans based on context triggers
      const checkpointPlans = this.generateCheckpointPlans(contextPlan);
      
      // Initialize metrics
      const initialMetrics: SessionMetrics = {
        lines_written: 0,
        tests_written: 0,
        tests_passing: 0,
        documentation_updated: false,
        docs_updated: 0,
        context_used: 0,
        velocity_score: 0,
      };
      
      // Insert session into database
      const insertSession = this.db.prepare(`
        INSERT INTO sessions (
          id, project_name, session_type, start_time, estimated_completion,
          current_phase, status, estimated_lines, estimated_tests, estimated_docs,
          actual_lines, actual_tests, docs_updated, context_budget, context_used,
          velocity_score, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `);
      
      const values = [
        sessionId,
        params.project_name,
        params.session_type,
        now,
        estimatedCompletion,
        'planning',
        'active',
        params.estimated_scope.lines_of_code,
        params.estimated_scope.test_coverage,
        params.estimated_scope.documentation,
        0, // actual_lines
        0, // actual_tests
        0, // docs_updated (boolean as 0/1)
        contextPlan.total_budget,
        0, // context_used
        0, // velocity_score
        now,
        now
      ];
      
      // Check for undefined values
      values.forEach((val, idx) => {
        if (val === undefined) {
          throw new Error(`Undefined value at index ${idx}: ${['id', 'project_name', 'session_type', 'start_time', 'estimated_completion', 'current_phase', 'status', 'estimated_lines', 'estimated_tests', 'estimated_docs', 'actual_lines', 'actual_tests', 'docs_updated', 'context_budget', 'context_used', 'velocity_score', 'created_at', 'updated_at'][idx]}`);
        }
      });
      
      insertSession.run(...values);
      
      // Create initial checkpoint
      this.createInitialCheckpoint(sessionId, now);
      
      // Build and return session object
      const session: Session = {
        id: sessionId,
        project_name: params.project_name,
        session_type: params.session_type,
        start_time: now,
        estimated_completion: estimatedCompletion,
        current_phase: 'planning',
        status: 'active',
        estimated_scope: params.estimated_scope,
        context_plan: contextPlan,
        checkpoints: checkpointPlans,
        metrics: initialMetrics,
        ui_state: {
          expanded: true,
          refresh_interval: 30000,
          layout: 'card',
        },
      };
      
      // Update observables
      console.log('[SessionManager] Session created, updating observables:', {
        sessionId: session.id,
        projectName: session.project_name,
        type: session.session_type,
        status: session.status
      });
      this.currentSession$.next(session);
      console.log('[SessionManager] currentSession$ updated with session:', session);
      this.sessionMetrics$.next(initialMetrics);
      this.contextStatus$.next({ used: 0, total: contextPlan.total_budget, percent: 0 });
      
      // Initialize context monitor with session
      if (this.contextMonitor) {
        this.contextMonitor.trackUsage(sessionId, 'initialization', 0, 'session_start');
      }
      
      console.log('Session manager: New session started:', session.id);
      return session;
    });
  }

  async createCheckpoint(params: CheckpointParams): Promise<CheckpointResponse> {
    // Handle async context tracking outside of transaction
    const session = this.getSessionFromDb(params.session_id);
    if (!session) {
      throw new SessionNotFoundError(params.session_id);
    }
    
    if (session.status !== 'active') {
      throw new Error(`Session ${params.session_id} is not active (status: ${session.status})`);
    }
    
    // Track context usage before the transaction
    const contextUsed = Math.floor(session.context_budget * (params.metrics.context_used_percent / 100));
    const previousCheckpoint = this.getLatestCheckpoint(params.session_id);
    const tokensSinceLastCheckpoint = previousCheckpoint 
      ? contextUsed - (previousCheckpoint.context_used || 0)
      : contextUsed;
    
    if (tokensSinceLastCheckpoint > 0) {
      await this.contextMonitor.trackUsage(
        params.session_id,
        session.current_phase,
        tokensSinceLastCheckpoint,
        `Checkpoint: ${params.completed_components.slice(0, 3).join(', ')}${params.completed_components.length > 3 ? '...' : ''}`
      );
    }
    
    return this.db.transaction(() => {
      const now = Date.now();
      const checkpointNumber = this.getNextCheckpointNumber(params.session_id);
      const checkpointId = `${params.session_id}-checkpoint-${checkpointNumber}`;
      
      // contextUsed was already calculated above
      
      const contextSnapshot: ContextSnapshot = {
        session_id: params.session_id,
        checkpoint_id: checkpointId,
        timestamp: now,
        context_used: contextUsed,
        important_files: this.identifyImportantFiles(params.completed_components),
        key_decisions: this.extractKeyDecisions(params.completed_components),
        next_steps: this.generateNextSteps(session, params.completed_components),
      };
      
      // Generate continuation plan
      const continuationPlan: ContinuationPlan = {
        remaining_tasks: this.calculateRemainingTasks(session, params.completed_components),
        context_requirements: this.estimateRemainingContext(session, params.metrics.context_used_percent),
        prerequisite_checks: this.generatePrerequisiteChecks(session).map(p => p.command),
        suggested_approach: this.suggestApproach(session, params.completed_components),
      };
      
      // Insert checkpoint record
      const insertCheckpoint = this.db.prepare(`
        INSERT INTO checkpoints (
          id, session_id, checkpoint_number, timestamp,
          context_used, commit_hash, completed_components,
          metrics, continuation_plan, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      let commitHash: string | null = null;
      
      // Handle git commit if requested
      if (params.commit_message) {
        try {
          const { execSync } = require('child_process');
          execSync('git add -A', { encoding: 'utf-8' });
          const output = execSync(`git commit -m "${params.commit_message}"`, { encoding: 'utf-8' });
          const hashMatch = output.match(/\[\w+ ([a-f0-9]+)\]/i);
          commitHash = hashMatch ? hashMatch[1] : null;
        } catch (error) {
          if (!params.force) {
            throw new Error(`Git commit failed: ${error}`);
          }
        }
      }
      
      insertCheckpoint.run(
        checkpointId,
        params.session_id,
        checkpointNumber,
        now,
        contextSnapshot.context_used,
        commitHash,
        JSON.stringify(params.completed_components),
        JSON.stringify(params.metrics),
        JSON.stringify(continuationPlan),
        now
      );
      
      // Update session metrics
      this.updateSessionMetrics(params.session_id, params.metrics);
      
      // Update session phase if needed
      const newPhase = this.determinePhase(params.metrics.context_used_percent);
      if (newPhase !== session.current_phase) {
        this.updateSessionPhase(params.session_id, newPhase);
      }
      
      // Update observables
      const updatedSession = this.getSessionFromDb(params.session_id);
      if (updatedSession) {
        this.currentSession$.next(this.buildSessionObject(updatedSession));
        this.sessionMetrics$.next(this.buildMetricsObject(updatedSession));
        this.contextStatus$.next({
          used: contextSnapshot.context_used,
          total: updatedSession.context_budget,
          percent: params.metrics.context_used_percent,
        });
      }
      
      return {
        checkpoint_id: checkpointId,
        commit_hash: commitHash || undefined,
        context_snapshot: contextSnapshot,
        continuation_plan: continuationPlan,
      };
    });
  }

  async createHandoff(params: HandoffParams): Promise<HandoffResponse> {
    return this.db.transaction(() => {
      const session = this.getSessionFromDb(params.session_id);
      if (!session) {
        throw new SessionNotFoundError(params.session_id);
      }
      
      // Generate handoff document
      const handoffDocument = this.generateHandoffDocument(session, params);
      
      // Identify context requirements
      const contextRequirements: ContextRequirement[] = this.identifyContextRequirements(session);
      
      // Generate prerequisite checks
      const prerequisiteChecks: PrerequisiteCheck[] = this.generateHandoffPrerequisites(session);
      
      // Estimate next session
      const nextSessionEstimate: SessionEstimate = this.estimateNextSession(session, params.next_session_goals);
      
      // Create final checkpoint
      const checkpointParams: CheckpointParams = {
        session_id: params.session_id,
        completed_components: this.getCompletedComponents(params.session_id),
        metrics: {
          lines_written: session.actual_lines,
          tests_passing: session.actual_tests,
          context_used_percent: Math.floor((session.context_used / session.context_budget) * 100),
        },
        commit_message: 'Session handoff checkpoint',
      };
      
      const checkpoint = this.createCheckpoint(checkpointParams);
      
      // Update session status
      const updateStatus = this.db.prepare(`
        UPDATE sessions SET status = 'handoff', updated_at = ?
        WHERE id = ?
      `);
      updateStatus.run(Date.now(), params.session_id);
      
      // Clear active session
      this.currentSession$.next(null);
      
      return {
        handoff_document: handoffDocument,
        context_requirements: contextRequirements,
        prerequisite_checks: prerequisiteChecks,
        estimated_next_session: nextSessionEstimate,
      };
    });
  }

  async getSessionStatus(params: { session_id: string }): Promise<Session> {
    const session = this.getSessionFromDb(params.session_id);
    if (!session) {
      throw new SessionNotFoundError(params.session_id);
    }
    return this.buildSessionObject(session);
  }
  
  async completeSession(sessionId: string): Promise<Session> {
    return this.db.transaction(() => {
      const session = this.getSessionFromDb(sessionId);
      if (!session) {
        throw new SessionNotFoundError(sessionId);
      }
      
      const now = Date.now();
      
      // Update project statistics
      this.updateProjectStats(session);
      
      // Update session to complete
      const updateSession = this.db.prepare(`
        UPDATE sessions SET 
          status = 'complete',
          end_time = ?,
          updated_at = ?
        WHERE id = ?
      `);
      
      updateSession.run(now, now, sessionId);
      
      // Clear observables
      this.currentSession$.next(null);
      this.sessionMetrics$.next(null);
      this.contextStatus$.next(null);
      
      // Return final session state
      const finalSession = this.getSessionFromDb(sessionId);
      return this.buildSessionObject(finalSession);
    });
  }
  
  async getActiveSession(): Promise<Session | null> {
    const session = this.db.get(
      'SELECT * FROM sessions WHERE status = \'active\' ORDER BY start_time DESC LIMIT 1'
    );
    
    if (!session) return null;
    
    const sessionObj = this.buildSessionObject(session);
    
    // Update observables if we found an active session
    this.currentSession$.next(sessionObj);
    this.sessionMetrics$.next(sessionObj.metrics);
    this.contextStatus$.next({
      used: (session as any).context_used || 0,
      total: (session as any).context_budget,
      percent: Math.floor((((session as any).context_used || 0) / (session as any).context_budget) * 100),
    });
    
    return sessionObj;
  }
  
  async getSessionHistory(params?: { project_name?: string; limit?: number }): Promise<Session[]> {
    let query = 'SELECT * FROM sessions WHERE 1=1';
    const queryParams: any[] = [];
    
    if (params?.project_name) {
      query += ' AND project_name = ?';
      queryParams.push(params.project_name);
    }
    
    query += ' ORDER BY start_time DESC';
    
    if (params?.limit) {
      query += ' LIMIT ?';
      queryParams.push(params.limit);
    }
    
    const sessions = queryParams.length > 0 ? this.db.all(query, queryParams) : this.db.all(query);
    return sessions.map(s => this.buildSessionObject(s));
  }

  async executeQuickAction(params: { action_id: string; params?: unknown; session_id?: string }): Promise<unknown> {
    const action = this.db.get(
      'SELECT * FROM quick_actions WHERE id = ?',
      params.action_id
    ) as any;
    
    if (!action) {
      throw new InvalidParametersError(`Quick action '${params.action_id}' not found. Use suggestActions to see available actions.`);
    }
    
    // Get current session if provided
    const session = params.session_id ? this.getSessionFromDb(params.session_id) : null;
    
    // Update usage count
    const updateAction = this.db.prepare(
      'UPDATE quick_actions SET usage_count = usage_count + 1, last_used = ? WHERE id = ?'
    );
    updateAction.run(Date.now(), params.action_id);
    
    // Parse and execute the tool sequence
    const toolSequence = JSON.parse(action.tool_sequence);
    const parameterTemplate = JSON.parse(action.parameter_template);
    const results = [];
    
    try {
      for (const tool of toolSequence) {
        // Merge template parameters with any provided parameters
        const toolParams = {
          ...parameterTemplate[tool.name] || {},
          ...params.params || {},
          session_id: params.session_id || (session ? session.id : undefined),
        };
        
        // Execute the tool based on its name
        let result;
        switch (tool.name) {
          case 'checkpoint':
            result = await this.createCheckpoint({
              session_id: toolParams.session_id,
              completed_components: toolParams.completed_components || ['Quick action checkpoint'],
              metrics: toolParams.metrics || (session ? {
                lines_written: session.actual_lines,
                tests_passing: session.actual_tests,
                context_used_percent: (session.context_used / session.context_budget) * 100,
              } : {
                lines_written: 0,
                tests_passing: 0,
                context_used_percent: 0,
              }),
              commit_message: toolParams.commit_message || `Quick action: ${action.name}`,
            });
            break;
            
          case 'reality_check':
            result = await this.contextMonitor.getStatus({ session_id: toolParams.session_id });
            break;
            
          case 'context_status':
            result = await this.contextMonitor.getStatus({ session_id: toolParams.session_id });
            break;
            
          default:
            throw new Error(`Unknown tool in sequence: ${tool.name}`);
        }
        
        results.push({
          tool: tool.name,
          success: true,
          result,
        });
      }
      
      return {
        action_id: params.action_id,
        executed: true,
        results,
        message: `Successfully executed ${action.name}`,
      };
    } catch (error) {
      return {
        action_id: params.action_id,
        executed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        results,
      };
    }
  }

  async suggestActions(params: { session_id: string; limit?: number }): Promise<unknown> {
    const session = this.getSessionFromDb(params.session_id);
    if (!session) {
      throw new SessionNotFoundError(params.session_id);
    }
    
    const limit = params.limit || 5;
    const suggestions = [];
    
    // Suggest based on current phase
    if (session.current_phase === 'implementation') {
      suggestions.push({
        action_id: 'run-tests',
        name: 'Run Tests',
        confidence: 0.9,
        reason: 'Implementation phase - verify your changes',
      });
    }
    
    if (session.context_used / session.context_budget > 0.5) {
      suggestions.push({
        action_id: 'create-checkpoint',
        name: 'Create Checkpoint',
        confidence: 0.95,
        reason: 'Over 50% context used',
      });
    }
    
    return suggestions.slice(0, limit);
  }

  async defineCustomAction(params: any): Promise<unknown> {
    // Validate required parameters
    if (!params.name || !params.description || !params.tool_sequence) {
      const missing = [];
      if (!params.name) missing.push('name');
      if (!params.description) missing.push('description');
      if (!params.tool_sequence) missing.push('tool_sequence');
      throw new InvalidParametersError('Missing required parameters for custom action', missing);
    }
    
    // Generate unique action ID
    const actionId = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Validate tool sequence
    const toolSequence = Array.isArray(params.tool_sequence) ? params.tool_sequence : [];
    if (toolSequence.length === 0) {
      throw new Error('Tool sequence cannot be empty');
    }
    
    // Prepare parameter template from the tool sequence
    const parameterTemplate: Record<string, any> = {};
    toolSequence.forEach((step: any) => {
      if (step.tool && step.params) {
        parameterTemplate[step.tool] = step.params;
      }
    });
    
    // Insert custom action into database
    const stmt = this.db.prepare(`
      INSERT INTO quick_actions (
        id, name, description, tool_sequence, parameter_template,
        keyboard_shortcut, ui_group, usage_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    try {
      stmt.run(
        actionId,
        params.name,
        params.description,
        JSON.stringify(toolSequence),
        JSON.stringify(parameterTemplate),
        params.keyboard_shortcut || null,
        params.ui_group || 'custom',
        0,
        Date.now(),
        Date.now()
      );
      
      return {
        success: true,
        action_id: actionId,
        name: params.name,
        description: params.description,
        tool_count: toolSequence.length,
        message: `Custom action "${params.name}" created successfully`,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new DatabaseError('create custom action', error);
      }
      throw error;
    }
  }

  async updateUIState(params: { session_id: string; ui_state: Session['ui_state'] }): Promise<unknown> {
    const session = this.getSessionFromDb(params.session_id);
    if (!session) {
      throw new SessionNotFoundError(params.session_id);
    }
    
    // Store UI state (would need to add column to sessions table)
    // For now, just update the observable
    const currentSession = this.currentSession$.value;
    if (currentSession && currentSession.id === params.session_id) {
      currentSession.ui_state = params.ui_state;
      this.currentSession$.next(currentSession);
    }
    
    return {
      success: true,
      ui_state: params.ui_state,
    };
  }

  async getWebSocketDetails(params: { session_id: string }): Promise<unknown> {
    return {
      url: 'ws://localhost:3000/realtime',
      session_id: params.session_id,
      channels: [
        `session:${params.session_id}`,
        `metrics:${params.session_id}`,
        `context:${params.session_id}`,
      ],
      status: 'ready',
    };
  }

  async getDebugState(params: { session_id: string; include_sensitive?: boolean }): Promise<unknown> {
    const session = this.getSessionFromDb(params.session_id);
    if (!session) {
      throw new SessionNotFoundError(params.session_id);
    }
    
    const checkpoints = this.getSessionCheckpoints(params.session_id);
    const contextUsage = this.db.all(
      'SELECT * FROM context_usage WHERE session_id = ? ORDER BY timestamp DESC LIMIT 10',
      params.session_id
    );
    
    const debugInfo = {
      session,
      checkpoints: checkpoints.length,
      last_checkpoint: checkpoints[checkpoints.length - 1],
      context_usage_samples: contextUsage,
      observables: {
        current_session: this.currentSession$.value?.id === params.session_id,
        metrics_active: this.sessionMetrics$.value !== null,
        context_active: this.contextStatus$.value !== null,
      },
    };
    
    if (!params.include_sensitive) {
      // Remove sensitive data
      delete debugInfo.session.commit_hash;
    }
    
    return debugInfo;
  }

  // Private helper methods
  private calculateContextBudget(scope: EstimatedScope, customBudget?: number): ContextPlan {
    const baseTokensPerLine = 10;
    const testOverhead = 1.5;
    const docOverhead = 1.2;
    
    // Calculate base token estimate
    const codeTokens = scope.lines_of_code * baseTokensPerLine;
    const testTokens = scope.test_coverage * baseTokensPerLine * testOverhead;
    const docTokens = scope.documentation * baseTokensPerLine * docOverhead;
    const totalEstimate = codeTokens + testTokens + docTokens;
    
    // Apply 20% buffer
    const totalBudget = customBudget || Math.ceil(totalEstimate * 1.2);
    
    // Define phase allocations
    const phaseAllocation: Record<string, number> = {
      planning: Math.ceil(totalBudget * 0.10),
      implementation: Math.ceil(totalBudget * 0.50),
      testing: Math.ceil(totalBudget * 0.25),
      documentation: Math.ceil(totalBudget * 0.15),
    };
    
    // Generate checkpoint triggers
    const checkpointTriggers = [
      `${Math.ceil(totalBudget * 0.35)} tokens (35%)`,
      `${Math.ceil(totalBudget * 0.60)} tokens (60%)`,
      `${Math.ceil(totalBudget * 0.70)} tokens (70%)`,
      `${Math.ceil(totalBudget * 0.85)} tokens (85% - emergency)`,
    ];
    
    return {
      total_budget: totalBudget,
      phase_allocation: phaseAllocation,
      checkpoint_triggers: checkpointTriggers,
    };
  }
  
  private generateCheckpointPlans(contextPlan: ContextPlan): CheckpointPlan[] {
    return [
      {
        phase: 'planning',
        context_threshold: Math.ceil(contextPlan.total_budget * 0.35),
        deliverables: ['Core implementation complete', 'Basic functionality working'],
      },
      {
        phase: 'implementation',
        context_threshold: Math.ceil(contextPlan.total_budget * 0.60),
        deliverables: ['Main features implemented', 'Integration points complete'],
      },
      {
        phase: 'testing',
        context_threshold: Math.ceil(contextPlan.total_budget * 0.70),
        deliverables: ['Tests written and passing', 'Edge cases handled'],
      },
      {
        phase: 'documentation',
        context_threshold: Math.ceil(contextPlan.total_budget * 0.85),
        deliverables: ['Documentation updated', 'Handoff prepared'],
      },
    ];
  }
  
  private ensureProjectExists(projectName: string): void {
    const now = Date.now();
    const upsertProject = this.db.prepare(`
      INSERT INTO projects (id, name, created_at, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET updated_at = ?
    `);
    
    upsertProject.run(
      randomUUID(),
      projectName,
      now,
      now,
      now
    );
  }
  
  private createInitialCheckpoint(sessionId: string, timestamp: number): void {
    const checkpointId = `${sessionId}-checkpoint-0`;
    const insertCheckpoint = this.db.prepare(`
      INSERT INTO checkpoints (
        id, session_id, checkpoint_number, timestamp,
        context_used, commit_hash, completed_components,
        metrics, continuation_plan, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const initialMetrics = {
      lines_written: 0,
      tests_passing: 0,
      context_used_percent: 0,
    };
    
    const continuationPlan = {
      remaining_tasks: ['Begin implementation'],
      context_requirements: 0,
      prerequisite_checks: [],
      suggested_approach: 'Start with core functionality',
    };
    
    insertCheckpoint.run(
      checkpointId,
      sessionId,
      0,
      timestamp,
      0,
      null,
      JSON.stringify([]),
      JSON.stringify(initialMetrics),
      JSON.stringify(continuationPlan),
      timestamp
    );
  }
  
  // Database query helpers
  private getSessionFromDb(sessionId: string): any {
    return this.db.get(
      'SELECT * FROM sessions WHERE id = ?',
      sessionId
    );
  }
  
  private getNextCheckpointNumber(sessionId: string): number {
    const result = this.db.get<{ max_number: number }>(
      'SELECT MAX(checkpoint_number) as max_number FROM checkpoints WHERE session_id = ?',
      sessionId
    );
    return (result?.max_number || 0) + 1;
  }
  
  private getLatestCheckpoint(sessionId: string): any {
    return this.db.get(
      `SELECT * FROM checkpoints WHERE session_id = ? ORDER BY checkpoint_number DESC LIMIT 1`,
      sessionId
    );
  }
  
  private updateSessionMetrics(sessionId: string, metrics: CheckpointParams['metrics']): void {
    const update = this.db.prepare(`
      UPDATE sessions SET
        actual_lines = ?,
        actual_tests = ?,
        context_used = context_budget * ? / 100,
        velocity_score = ?,
        updated_at = ?
      WHERE id = ?
    `);
    
    const velocityScore = this.calculateVelocityScore(sessionId, metrics);
    
    update.run(
      metrics.lines_written,
      metrics.tests_passing,
      metrics.context_used_percent,
      velocityScore,
      Date.now(),
      sessionId
    );
  }
  
  private updateSessionPhase(sessionId: string, phase: string): void {
    const update = this.db.prepare(
      'UPDATE sessions SET current_phase = ?, updated_at = ? WHERE id = ?'
    );
    update.run(phase, Date.now(), sessionId);
  }
  
  // Checkpoint helper methods
  private identifyImportantFiles(components: string[]): string[] {
    const files: string[] = [];
    components.forEach(component => {
      if (component.includes('SessionManager')) files.push('src/managers/SessionManager.ts');
      if (component.includes('interfaces')) files.push('src/interfaces/session.ts');
      if (component.includes('database')) files.push('src/database/schema.ts');
      if (component.includes('context')) files.push('src/interfaces/context.ts');
    });
    return [...new Set(files)];
  }
  
  private extractKeyDecisions(components: string[]): string[] {
    return components.map(component => `Implemented ${component}`);
  }
  
  private generateNextSteps(session: any, completedComponents: string[]): string[] {
    const steps: string[] = [];
    const percentComplete = (session.actual_lines / session.estimated_lines) * 100;
    
    if (percentComplete < 30) {
      steps.push('Continue core implementation');
    } else if (percentComplete < 60) {
      steps.push('Complete main features');
      steps.push('Begin testing');
    } else if (percentComplete < 90) {
      steps.push('Finalize implementation');
      steps.push('Complete test coverage');
      steps.push('Update documentation');
    } else {
      steps.push('Final testing and cleanup');
      steps.push('Documentation review');
    }
    
    return steps;
  }
  
  private calculateRemainingTasks(session: any, completedComponents: string[]): string[] {
    const allTasks = [
      'Core session methods',
      'Context planning',
      'Metrics calculation',
      'UI state management',
      'Quick actions',
      'Testing',
      'Documentation',
    ];
    
    return allTasks.filter(task => 
      !completedComponents.some(comp => comp.toLowerCase().includes(task.toLowerCase()))
    );
  }
  
  private estimateRemainingContext(session: any, usedPercent: number): number {
    const remainingPercent = 100 - usedPercent;
    return Math.floor(session.context_budget * (remainingPercent / 100));
  }
  
  private generatePrerequisiteChecks(session: any): PrerequisiteCheck[] {
    return [
      {
        check_type: 'build',
        command: 'npm run build',
        expected_result: 'Compilation successful',
      },
      {
        check_type: 'test',
        command: 'npm test',
        expected_result: 'All tests passing',
      },
    ];
  }
  
  private suggestApproach(session: any, completedComponents: string[]): string {
    const percentComplete = (session.actual_lines / session.estimated_lines) * 100;
    
    if (percentComplete < 30) {
      return 'Focus on core functionality and basic structure';
    } else if (percentComplete < 60) {
      return 'Implement remaining features and begin integration';
    } else if (percentComplete < 90) {
      return 'Complete testing and ensure all edge cases are handled';
    } else {
      return 'Final polish, documentation, and prepare for deployment';
    }
  }
  
  private determinePhase(contextUsedPercent: number): string {
    if (contextUsedPercent < 10) return 'planning';
    if (contextUsedPercent < 60) return 'implementation';
    if (contextUsedPercent < 85) return 'testing';
    return 'documentation';
  }
  
  private calculateVelocityScore(sessionId: string, metrics: CheckpointParams['metrics']): number {
    const session = this.getSessionFromDb(sessionId);
    if (!session) return 0;
    
    const elapsedHours = (Date.now() - session.start_time) / (1000 * 60 * 60);
    const linesPerHour = metrics.lines_written / Math.max(elapsedHours, 0.1);
    const testCoverage = metrics.tests_passing / Math.max(session.estimated_tests, 1);
    const efficiency = metrics.lines_written / Math.max(session.estimated_lines, 1);
    
    return Math.round((linesPerHour * 0.4 + testCoverage * 100 * 0.3 + efficiency * 100 * 0.3));
  }
  
  // Handoff helper methods
  private generateHandoffDocument(session: any, params: HandoffParams): string {
    const checkpoints = this.getSessionCheckpoints(session.id);
    const metrics = this.buildMetricsObject(session);
    
    let document = `# Session Handoff Document\n\n`;
    document += `## Session Summary\n`;
    document += `- **Session ID**: ${session.id}\n`;
    document += `- **Project**: ${session.project_name}\n`;
    document += `- **Type**: ${session.session_type}\n`;
    document += `- **Duration**: ${this.formatDuration(Date.now() - session.start_time)}\n\n`;
    
    document += `## Progress Metrics\n`;
    document += `- **Lines Written**: ${metrics.lines_written}/${session.estimated_lines} (${Math.round((metrics.lines_written / session.estimated_lines) * 100)}%)\n`;
    document += `- **Tests Written**: ${metrics.tests_written}/${session.estimated_tests}\n`;
    document += `- **Tests Passing**: ${metrics.tests_passing}\n`;
    document += `- **Context Used**: ${Math.round((session.context_used / session.context_budget) * 100)}%\n`;
    document += `- **Velocity Score**: ${metrics.velocity_score}\n\n`;
    
    document += `## Checkpoints\n`;
    checkpoints.forEach((cp: any) => {
      const cpMetrics = JSON.parse(cp.metrics);
      document += `\n### Checkpoint ${cp.checkpoint_number} (${new Date(cp.timestamp).toISOString()})\n`;
      document += `- Context Used: ${cpMetrics.context_used_percent}%\n`;
      document += `- Components: ${JSON.parse(cp.completed_components).join(', ')}\n`;
      if (cp.commit_hash) {
        document += `- Commit: ${cp.commit_hash}\n`;
      }
    });
    
    if (params.next_session_goals && params.next_session_goals.length > 0) {
      document += `\n## Next Session Goals\n`;
      params.next_session_goals.forEach(goal => {
        document += `- ${goal}\n`;
      });
    }
    
    document += `\n## Continuation Instructions\n`;
    document += `1. Pull latest changes\n`;
    document += `2. Run prerequisite checks\n`;
    document += `3. Review important files\n`;
    document += `4. Continue from current phase: ${session.current_phase}\n`;
    
    if (params.include_context_dump) {
      document += `\n## Context Dump\n`;
      document += `\`\`\`json\n${JSON.stringify({
        session,
        checkpoints,
        metrics,
      }, null, 2)}\n\`\`\`\n`;
    }
    
    return document;
  }
  
  private identifyContextRequirements(session: any): ContextRequirement[] {
    const requirements: ContextRequirement[] = [];
    
    // Always include main implementation files
    requirements.push({
      file_path: 'src/managers/SessionManager.ts',
      reason: 'Core session management implementation',
      priority: 'critical',
    });
    
    // Add based on session type
    if (session.session_type === 'feature') {
      requirements.push({
        file_path: 'src/interfaces/session.ts',
        reason: 'Session interface definitions',
        priority: 'critical',
      });
    }
    
    // Add based on progress
    if (session.actual_tests < session.estimated_tests) {
      requirements.push({
        file_path: 'tests/',
        reason: 'Test implementation needed',
        priority: 'important',
      });
    }
    
    return requirements;
  }
  
  private generateHandoffPrerequisites(session: any): PrerequisiteCheck[] {
    const checks: PrerequisiteCheck[] = [
      {
        check_type: 'dependency',
        command: 'npm install',
        expected_result: 'Dependencies installed',
      },
      {
        check_type: 'build',
        command: 'npm run build',
        expected_result: 'Build successful',
      },
    ];
    
    if (session.actual_tests > 0) {
      checks.push({
        check_type: 'test',
        command: 'npm test',
        expected_result: `${session.actual_tests} tests passing`,
      });
    }
    
    return checks;
  }
  
  private estimateNextSession(session: any, nextGoals?: string[]): SessionEstimate {
    const remainingLines = Math.max(0, session.estimated_lines - session.actual_lines);
    const remainingTests = Math.max(0, session.estimated_tests - session.actual_tests);
    const contextUsedPercent = (session.context_used / session.context_budget) * 100;
    
    // Base estimates on remaining work
    let estimatedLines = remainingLines;
    let complexityScore = 50;
    
    // Adjust based on goals
    if (nextGoals && nextGoals.length > 0) {
      estimatedLines += nextGoals.length * 100;
      complexityScore += nextGoals.length * 10;
    }
    
    // Calculate duration based on velocity
    const velocityScore = session.velocity_score || 50;
    const estimatedHours = estimatedLines / Math.max(velocityScore, 20);
    
    return {
      estimated_lines: estimatedLines,
      estimated_duration: Math.ceil(estimatedHours * 60 * 60 * 1000),
      estimated_context: Math.ceil(estimatedLines * 12),
      complexity_score: Math.min(100, complexityScore),
    };
  }
  
  private getCompletedComponents(sessionId: string): string[] {
    const checkpoints = this.getSessionCheckpoints(sessionId);
    const allComponents: string[] = [];
    
    checkpoints.forEach((cp: any) => {
      const components = JSON.parse(cp.completed_components);
      allComponents.push(...components);
    });
    
    return [...new Set(allComponents)];
  }
  
  private getSessionCheckpoints(sessionId: string): any[] {
    return this.db.all(
      'SELECT * FROM checkpoints WHERE session_id = ? ORDER BY checkpoint_number',
      sessionId
    );
  }
  
  private buildSessionObject(dbRow: any): Session {
    const checkpoints = this.db.all(
      'SELECT * FROM checkpoints WHERE session_id = ? ORDER BY checkpoint_number',
      dbRow.id
    );
    
    const contextPlan: ContextPlan = {
      total_budget: dbRow.context_budget,
      phase_allocation: {
        planning: Math.ceil(dbRow.context_budget * 0.10),
        implementation: Math.ceil(dbRow.context_budget * 0.50),
        testing: Math.ceil(dbRow.context_budget * 0.25),
        documentation: Math.ceil(dbRow.context_budget * 0.15),
      },
      checkpoint_triggers: [
        `${Math.ceil(dbRow.context_budget * 0.35)} tokens (35%)`,
        `${Math.ceil(dbRow.context_budget * 0.60)} tokens (60%)`,
        `${Math.ceil(dbRow.context_budget * 0.70)} tokens (70%)`,
        `${Math.ceil(dbRow.context_budget * 0.85)} tokens (85% - emergency)`,
      ],
    };
    
    const session: Session = {
      id: dbRow.id,
      project_name: dbRow.project_name,
      session_type: dbRow.session_type,
      start_time: dbRow.start_time,
      estimated_completion: dbRow.estimated_completion,
      current_phase: dbRow.current_phase,
      status: dbRow.status,
      estimated_scope: {
        lines_of_code: dbRow.estimated_lines,
        test_coverage: dbRow.estimated_tests,
        documentation: dbRow.estimated_docs,
      },
      context_plan: contextPlan,
      checkpoints: this.generateCheckpointPlans(contextPlan),
      metrics: this.buildMetricsObject(dbRow),
      ui_state: {
        expanded: true,
        refresh_interval: 30000,
        layout: 'card',
      },
    };
    
    // Add any additional properties that the UI might expect
    // These will be included in the returned object but not in the typed Session
    return {
      ...session,
      // UI-specific fields that aren't in the Session interface
      project_id: dbRow.project_name,
      type: dbRow.session_type,
      estimated_end_time: dbRow.estimated_completion,
      estimated_lines: dbRow.estimated_lines,
      actual_lines: dbRow.actual_lines || 0,
      estimated_tests: dbRow.estimated_tests,
      actual_tests: dbRow.actual_tests || 0,
      context_budget: dbRow.context_budget,
    } as any;
  }
  
  private buildMetricsObject(dbRow: any): SessionMetrics {
    return {
      lines_written: dbRow.actual_lines || 0,
      tests_written: dbRow.actual_tests || 0,
      tests_passing: dbRow.actual_tests || 0,
      documentation_updated: dbRow.docs_updated || false,
      docs_updated: dbRow.docs_updated || 0,
      context_used: dbRow.context_used || 0,
      velocity_score: dbRow.velocity_score || 0,
    };
  }
  
  private formatDuration(ms: number): string {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  }
  
  private updateProjectStats(session: any): void {
    const projectStats = this.db.get<any>(
      'SELECT * FROM projects WHERE name = ?',
      session.project_name
    );
    
    if (!projectStats) return;
    
    const completedSessions = this.db.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM sessions WHERE project_name = ? AND status = \'complete\'',
      session.project_name
    );
    
    const totalLines = this.db.get<{ total: number }>(
      'SELECT SUM(actual_lines) as total FROM sessions WHERE project_name = ?',
      session.project_name
    );
    
    const avgVelocity = this.db.get<{ avg: number }>(
      'SELECT AVG(velocity_score) as avg FROM sessions WHERE project_name = ? AND velocity_score > 0',
      session.project_name
    );
    
    const update = this.db.prepare(`
      UPDATE projects SET
        total_sessions = ?,
        total_lines_written = ?,
        average_velocity = ?,
        completion_rate = ?,
        updated_at = ?
      WHERE name = ?
    `);
    
    const totalSessions = (completedSessions?.count || 0) + 1;
    const completionRate = session.actual_lines / session.estimated_lines;
    
    update.run(
      totalSessions,
      totalLines?.total || 0,
      avgVelocity?.avg || 0,
      completionRate,
      Date.now(),
      session.project_name
    );
  }
}