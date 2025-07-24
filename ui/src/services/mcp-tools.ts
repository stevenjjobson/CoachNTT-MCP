import { WebSocketService } from './websocket';

export interface MCPToolCall {
  tool: string;
  params: Record<string, any>;
}

export interface MCPToolResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export class MCPToolsService {
  constructor(private ws: WebSocketService) {}

  async callTool(tool: string, params: Record<string, any>): Promise<MCPToolResponse> {
    try {
      const result = await this.ws.executeTool(tool, params);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Session Management Tools
  async startSession(projectName: string, sessionType: string, estimatedScope: any) {
    return this.callTool('startSession', {
      project_name: projectName,
      session_type: sessionType,
      estimated_scope: estimatedScope,
    });
  }

  async createCheckpoint(sessionId: string, components: string[], metrics: any) {
    console.log('[MCPTools] Creating checkpoint:', { sessionId, components, metrics });
    return this.callTool('createCheckpoint', {
      sessionId,  // Changed from session_id to match handler expectation
      achievements: components,  // Changed from completed_components to match handler
      linesWritten: metrics.lines_written || 0,
      testsPassing: metrics.tests_passing || 0,
      contextUsed: metrics.context_used_percent || 0,
    });
  }

  async createHandoff(sessionId: string, nextGoals?: string[]) {
    return this.callTool('createHandoff', {
      session_id: sessionId,
      next_session_goals: nextGoals,
    });
  }

  // Context Management Tools
  async getContextStatus(sessionId: string) {
    return this.callTool('getContextReport', {
      session_id: sessionId,
    });
  }

  async optimizeContext(sessionId: string, targetReduction: number) {
    console.log('[MCPTools] Optimizing context:', { sessionId, targetReduction });
    return this.callTool('optimizeContext', {
      sessionId,  // Changed from session_id
      threshold: targetReduction,  // Changed from target_reduction to match handler
    });
  }

  async predictContext(sessionId: string, plannedTasks: string[]) {
    return this.callTool('contextPredict', {
      session_id: sessionId,
      planned_tasks: plannedTasks,
    });
  }

  // Reality Check Tools
  async performRealityCheck(sessionId: string, checkType: string = 'quick') {
    console.log('[MCPTools] Performing reality check:', { sessionId, checkType });
    return this.callTool('performRealityCheck', {
      sessionId,  // Changed from session_id
      checkType,  // Changed from check_type
    });
  }

  async applyFixes(snapshotId: string, fixIds: string[]) {
    return this.callTool('applyFixes', {
      snapshot_id: snapshotId,
      fix_ids: fixIds,
      auto_commit: false,
    });
  }

  // Project Management Tools
  async trackProject(projectName: string, sessionId: string) {
    return this.callTool('initializeProject', {
      project_name: projectName,
      session_id: sessionId,
    });
  }

  async analyzeVelocity(projectId: string) {
    return this.callTool('analyzeVelocity', {
      project_id: projectId,
    });
  }

  async generateProgressReport(projectId: string) {
    return this.callTool('getProjectStatus', {
      project_id: projectId,
      include_predictions: true,
    });
  }

  // Documentation Tools
  async generateDocumentation(sessionId: string, docType: string) {
    return this.callTool('generateDocumentation', {
      session_id: sessionId,
      doc_type: docType,
    });
  }

  async checkDocumentationStatus(filePaths: string[]) {
    return this.callTool('validateDocumentation', {
      file_paths: filePaths,
    });
  }

  // Quick Actions
  async suggestActions(sessionId: string) {
    return this.callTool('suggestActions', {
      session_id: sessionId,
      limit: 5,
    });
  }

  async executeQuickAction(actionId: string, params?: any) {
    return this.callTool('executeQuickAction', {
      action_id: actionId,
      params,
    });
  }
}