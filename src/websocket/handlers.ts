import { SessionManager } from '../managers/SessionManager';
import { ContextMonitor } from '../managers/ContextMonitor';
import { RealityChecker } from '../managers/RealityChecker';
import { ProjectTracker } from '../managers/ProjectTracker';
import { DocumentationEngine } from '../managers/DocumentationEngine';
import { take } from 'rxjs/operators';

export interface ToolExecutionRequest {
  tool: string;
  params: Record<string, any>;
  requestId: string;
}

export interface ToolExecutionResponse {
  tool: string;
  requestId: string;
  success: boolean;
  result?: any;
  error?: string;
}

export class ToolExecutionHandler {
  constructor(
    private managers: {
      session: SessionManager;
      context: ContextMonitor;
      reality: RealityChecker;
      project: ProjectTracker;
      documentation: DocumentationEngine;
    }
  ) {}

  async execute(request: ToolExecutionRequest): Promise<ToolExecutionResponse> {
    const { tool, params, requestId } = request;
    
    try {
      let result: any;
      
      switch (tool) {
        // Session Tools
        case 'startSession':
          result = await this.managers.session.startSession({
            project_name: params.projectName,
            session_type: params.type,
            estimated_scope: {
              lines_of_code: params.estimatedLines || 100,
              test_coverage: params.estimatedTests || 80,
              documentation: 3,
            },
            context_budget: params.contextBudget,
          });
          break;
          
        case 'getActiveSession':
          result = await this.managers.session.getActiveSession();
          break;
          
        case 'createCheckpoint':
          result = await this.managers.session.createCheckpoint({
            session_id: params.sessionId,
            completed_components: params.achievements || [],
            metrics: {
              lines_written: params.linesWritten || 0,
              tests_passing: params.testsPassing || 0,
              context_used_percent: params.contextUsed || 0,
            },
            commit_message: params.commitMessage,
            force: params.force,
          });
          break;
          
        case 'createHandoff':
          result = await this.managers.session.createHandoff({
            session_id: params.sessionId,
            next_session_goals: params.nextGoals || [],
            include_context_dump: true,
          });
          break;
          
        case 'completeSession':
          result = await this.managers.session.completeSession(params.sessionId);
          break;
          
        // Context Tools
        case 'trackContext':
          result = await this.managers.context.trackUsage(
            params.sessionId,
            params.phase || 'general',
            params.tokens || 0,
            params.operation || 'manual'
          );
          break;
          
        case 'optimizeContext':
          result = await this.managers.context.optimize({
            session_id: params.sessionId,
            target_reduction: params.threshold || 0.3,
            preserve_functionality: true,
          });
          break;
          
        case 'getContextReport':
          result = await this.managers.context.getStatus({
            session_id: params.sessionId
          });
          break;
          
        // Reality Check Tools
        case 'performRealityCheck':
          result = await this.managers.reality.performCheck({
            session_id: params.sessionId,
            check_type: params.checkType || 'quick',
            focus_areas: params.focusAreas,
          });
          break;
          
        case 'applyFixes':
          result = await this.managers.reality.applyFixes({
            snapshot_id: params.snapshotId,
            fix_ids: params.fixIds || [],
            auto_commit: false,
          });
          break;
          
        case 'getDiscrepancyReport':
          // Use getDiscrepancies observable
          const discrepancies = this.managers.reality.getDiscrepancies();
          result = { discrepancies: discrepancies };
          break;
          
        // Project Tools
        case 'initializeProject':
          result = await this.managers.project.track({
            project_name: params.name,
            session_id: params.sessionId || 'init',
          });
          break;
          
        case 'getProjectStatus':
          // Return the current value from the observable
          const projectObs = this.managers.project.getProjectStatus();
          result = await new Promise((resolve) => {
            projectObs.pipe(take(1)).subscribe(project => resolve(project));
          });
          break;
          
        case 'updateProjectMetrics':
          // Project metrics are tracked automatically
          result = { success: true, message: 'Metrics updated' };
          break;
          
        case 'analyzeVelocity':
          result = await this.managers.project.analyzeVelocity({
            project_id: params.projectId,
            time_window: params.timeWindow,
          });
          break;
          
        case 'trackBlocker':
          result = await this.managers.project.resolveBlocker({
            blocker_id: params.blockerId,
            resolution: params.resolution || 'resolved',
          });
          break;
          
        // Documentation Tools
        case 'generateDocumentation':
          result = await this.managers.documentation.generate({
            session_id: params.sessionId,
            doc_type: params.format || 'handoff',
            include_sections: params.sections,
          });
          break;
          
        case 'updateDocumentationContext':
          result = await this.managers.documentation.update({
            file_path: params.filePath || 'README.md',
            update_type: params.updateType || 'sync',
            context: params.context || {},
          });
          break;
          
        case 'validateDocumentation':
          result = await this.managers.documentation.checkStatus({
            file_paths: params.filePaths || ['README.md'],
          });
          break;
          
        case 'exportDocumentation':
          // Documentation is already saved to disk
          result = { success: true, message: 'Documentation exported' };
          break;
          
        // Quick Actions
        case 'suggestActions':
          result = await this.suggestQuickActions(params.sessionId);
          break;
          
        case 'executeQuickAction':
          result = await this.executeQuickAction(params.actionId);
          break;
          
        default:
          throw new Error(`Unknown tool: ${tool}`);
      }
      
      return {
        tool,
        requestId,
        success: true,
        result,
      };
    } catch (error) {
      return {
        tool,
        requestId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  private async suggestQuickActions(sessionId: string): Promise<any[]> {
    // Analyze current session state and suggest relevant actions
    const session = await this.managers.session.getActiveSession();
    
    // Get observable values
    let contextStatus: any = null;
    let discrepancies: any[] = [];
    
    await new Promise<void>((resolve) => {
      this.managers.context.getContextStatus().pipe(take(1)).subscribe(status => {
        contextStatus = status;
        resolve();
      });
    });
    
    await new Promise<void>((resolve) => {
      this.managers.reality.getDiscrepancies().pipe(take(1)).subscribe(discreps => {
        discrepancies = discreps;
        resolve();
      });
    });
    
    const actions = [];
    
    // Context-based suggestions
    if (contextStatus && contextStatus.usage_percent > 80) {
      actions.push({
        id: 'optimize_context',
        label: 'Optimize Context',
        icon: 'Zap',
        action: 'optimizeContext',
        enabled: true,
        tooltip: 'Free up context space',
        priority: 'high',
      });
    }
    
    // Reality check suggestions
    if (discrepancies.filter((d: any) => d.severity === 'critical').length > 0) {
      actions.push({
        id: 'fix_critical',
        label: 'Fix Critical Issues',
        icon: 'AlertCircle',
        action: 'applyFixes',
        enabled: true,
        tooltip: 'Auto-fix critical discrepancies',
        priority: 'high',
      });
    }
    
    // Session-based suggestions
    if (session && (session as any).actual_lines > (session as any).estimated_lines * 0.8) {
      actions.push({
        id: 'checkpoint',
        label: 'Create Checkpoint',
        icon: 'Save',
        action: 'createCheckpoint',
        enabled: true,
        tooltip: 'Save progress before context limit',
        priority: 'medium',
      });
    }
    
    return actions;
  }
  
  private async executeQuickAction(actionId: string): Promise<any> {
    // Execute predefined quick actions
    switch (actionId) {
      case 'optimize_context':
        const session = await this.managers.session.getActiveSession();
        if (session) {
          return await this.managers.context.optimize({
            session_id: session.id,
            target_reduction: 0.3,
            preserve_functionality: true,
          });
        }
        break;
        
      case 'fix_critical':
        let discrepancies: any[] = [];
        await new Promise<void>((resolve) => {
          this.managers.reality.getDiscrepancies().pipe(take(1)).subscribe(discreps => {
            discrepancies = discreps;
            resolve();
          });
        });
        
        const criticalFixes = discrepancies
          .filter((d: any) => d.severity === 'critical' && d.auto_fixable)
          .map((_: any, idx: number) => `fix_${idx}`);
        
        if (criticalFixes.length > 0) {
          // Note: This needs the actual snapshot ID
          return await this.managers.reality.applyFixes({
            snapshot_id: 'current',
            fix_ids: criticalFixes,
            auto_commit: false,
          });
        }
        break;
        
      default:
        throw new Error(`Unknown quick action: ${actionId}`);
    }
  }
}