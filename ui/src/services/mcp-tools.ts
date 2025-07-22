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
    return this.callTool('session_start', {
      project_name: projectName,
      session_type: sessionType,
      estimated_scope: estimatedScope,
    });
  }

  async createCheckpoint(sessionId: string, components: string[], metrics: any) {
    return this.callTool('session_checkpoint', {
      session_id: sessionId,
      completed_components: components,
      metrics,
    });
  }

  async createHandoff(sessionId: string, nextGoals?: string[]) {
    return this.callTool('session_handoff', {
      session_id: sessionId,
      next_session_goals: nextGoals,
    });
  }

  // Context Management Tools
  async getContextStatus(sessionId: string) {
    return this.callTool('context_status', {
      session_id: sessionId,
    });
  }

  async optimizeContext(sessionId: string, targetReduction: number) {
    return this.callTool('context_optimize', {
      session_id: sessionId,
      target_reduction: targetReduction,
      preserve_functionality: true,
    });
  }

  async predictContext(sessionId: string, plannedTasks: string[]) {
    return this.callTool('context_predict', {
      session_id: sessionId,
      planned_tasks: plannedTasks,
    });
  }

  // Reality Check Tools
  async performRealityCheck(sessionId: string, checkType: string = 'quick') {
    return this.callTool('reality_check', {
      session_id: sessionId,
      check_type: checkType,
    });
  }

  async applyFixes(snapshotId: string, fixIds: string[]) {
    return this.callTool('reality_fix', {
      snapshot_id: snapshotId,
      fix_ids: fixIds,
      auto_commit: false,
    });
  }

  // Project Management Tools
  async trackProject(projectName: string, sessionId: string) {
    return this.callTool('project_track', {
      project_name: projectName,
      session_id: sessionId,
    });
  }

  async analyzeVelocity(projectId: string) {
    return this.callTool('velocity_analyze', {
      project_id: projectId,
    });
  }

  async generateProgressReport(projectId: string) {
    return this.callTool('progress_report', {
      project_id: projectId,
      include_predictions: true,
    });
  }

  // Documentation Tools
  async generateDocumentation(sessionId: string, docType: string) {
    return this.callTool('doc_generate', {
      session_id: sessionId,
      doc_type: docType,
    });
  }

  async checkDocumentationStatus(filePaths: string[]) {
    return this.callTool('doc_status', {
      file_paths: filePaths,
    });
  }

  // Quick Actions
  async suggestActions(sessionId: string) {
    return this.callTool('suggest_actions', {
      session_id: sessionId,
      limit: 5,
    });
  }

  async executeQuickAction(actionId: string, params?: any) {
    return this.callTool('quick_action', {
      action_id: actionId,
      params,
    });
  }
}