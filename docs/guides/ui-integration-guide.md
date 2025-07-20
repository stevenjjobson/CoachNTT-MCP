# MyWorkFlow MCP Server - Implementation Context with UI Integration

## Project Overview

**Goal**: Build an MCP server that provides data and operations for the MyWorkFlow Development Dashboard UI components.

**Architecture**: The MCP server provides backend functionality that maps directly to the UI contract components.

## Core Interfaces (with UI Contract References)

```typescript
// src/interfaces/core.ts
import { 
  SessionOverviewProps, 
  ContextMonitorState,
  RealityCheckState,
  ProjectTrackerState 
} from './ui-contracts';

// Maps to SessionOverviewWidget requirements
export interface Session {
  id: string;
  project_name: string;
  session_type: 'feature' | 'bugfix' | 'refactor' | 'documentation';
  start_time: number; // For duration calculation in UI
  estimated_completion: number; // For countdown display
  current_phase: string; // For phase progression display
  status: 'active' | 'checkpoint' | 'handoff' | 'complete';
  estimated_scope: EstimatedScope;
  context_plan: ContextPlan;
  checkpoints: CheckpointPlan[];
  metrics: SessionMetrics;
  // UI-specific fields
  ui_state?: {
    expanded: boolean;
    refresh_interval: number;
    layout: 'card' | 'inline' | 'minimal';
  };
}

// Maps to ContextMonitorDisplay requirements
export interface ContextStatus {
  session_id: string;
  used_tokens: number;
  total_tokens: number;
  percentage_used: number;
  status: 'green' | 'yellow' | 'orange' | 'red';
  trend: 'stable' | 'increasing' | 'rapid';
  predicted_completion: number;
  recommendations: string[];
  // UI-specific fields from ContextMonitorProps
  max_tokens: number;
  warning_threshold: number;
  critical_threshold: number;
  display_mode: 'detailed' | 'compact' | 'minimal';
  // For visual elements
  chart_data?: {
    history: Array<{ time: number; tokens: number }>;
    prediction_line: Array<{ time: number; tokens: number }>;
  };
  optimization_available?: boolean;
  tokens_per_minute?: number;
}

// Maps to RealityCheckDashboard requirements
export interface RealityCheckResult {
  project_path: string;
  last_check_date: number;
  auto_check_enabled: boolean;
  accuracy_score: number; // For CircularProgress display
  discrepancies: DiscrepancyGroup[];
  trend: TrendData; // For SparklineChart
  active_check: boolean;
  history: CheckEvent[]; // For historical visualization
}

export interface DiscrepancyGroup {
  severity: 'low' | 'medium' | 'high';
  type: 'feature' | 'test' | 'performance' | 'documentation';
  items: Discrepancy[];
  group_by: 'severity' | 'type' | 'component'; // From UI contract
}

export interface Discrepancy {
  id: string;
  title: string;
  claimed: string;
  actual: string;
  component: string;
  severity: 'low' | 'medium' | 'high';
  fix_available: boolean;
  actions: ('view' | 'fix' | 'ignore' | 'schedule')[]; // From UI contract
}

// Maps to ProjectTrackerProps requirements
export interface Project {
  id: string;
  name: string;
  sessions: SessionSummary[];
  current_session?: string;
  total_progress: number;
  velocity: VelocityMetrics;
  blockers: Blocker[];
  upcoming_sessions: PlannedSession[];
  // UI display preferences
  display_mode: 'timeline' | 'kanban' | 'list';
  timeline_scale?: 'hours' | 'days' | 'weeks';
  kanban_columns?: string[];
}

// Maps to DocumentationStatusPanel requirements
export interface DocumentationStatus {
  documents: DocumentStatus[];
  reality_score: number;
  last_update: number;
  outdated_docs: Document[];
  missing_docs: DocumentType[];
  accuracy_by_type: Record<DocumentType, number>;
  // Visual status mapping
  status_icons: {
    current: '✅';
    outdated: '⚠️';
    missing: '❌';
    generating: '⏳';
  };
}

// Maps to QuickActionsPanel requirements
export interface QuickActionContext {
  session_id?: string;
  context_state: ContextState;
  project_state: ProjectState;
  suggested_actions: ActionSuggestion[];
  recent_actions: Action[];
  custom_actions: CustomAction[];
  // Emergency actions availability
  emergency_actions_enabled: boolean;
  position: 'floating' | 'docked' | 'inline';
}
```

## Tool Interfaces (UI-Aware)

```typescript
// src/interfaces/tools.ts
import { 
  SessionOverviewMethods,
  ContextMonitorMethods,
  RealityCheckMethods,
  ProjectTrackerMethods,
  DocumentationStatusMethods,
  QuickActionsMethods
} from './ui-contracts';

// Session Management Tools (implements SessionOverviewMethods)
export interface SessionManagerTools {
  // Core session operations
  session_start(params: SessionStartParams): Promise<SessionStartResponse>;
  session_checkpoint(params: CheckpointParams): Promise<CheckpointResponse>;
  session_handoff(params: HandoffParams): Promise<HandoffResponse>;
  
  // UI-specific operations from SessionOverviewMethods
  refresh_session(session_id: string): Promise<Session>;
  expand_session_view(session_id: string): Promise<void>;
  collapse_session_view(session_id: string): Promise<void>;
  trigger_checkpoint_ui(session_id: string): Promise<void>;
  trigger_handoff_ui(session_id: string): Promise<void>;
}

// Context Monitoring Tools (implements ContextMonitorMethods)
export interface ContextMonitorTools {
  // Core monitoring
  context_status(params: ContextStatusParams): Promise<ContextStatusResponse>;
  context_optimize(params: OptimizeParams): Promise<OptimizeResponse>;
  
  // UI-specific operations from ContextMonitorMethods
  update_usage(session_id: string, tokens: number): Promise<void>;
  predict_completion(session_id: string): Promise<number>;
  suggest_optimization(session_id: string): Promise<Optimization[]>;
  export_metrics(session_id: string): Promise<ContextMetrics>;
  
  // Chart data for visualization
  get_usage_history(session_id: string): Promise<UsageHistory>;
  get_trend_data(session_id: string): Promise<TrendData>;
}

// Reality Check Tools (implements RealityCheckMethods)
export interface RealityCheckerTools {
  // Core checking
  reality_check(params: RealityCheckParams): Promise<RealityCheckResponse>;
  metric_validate(params: MetricValidateParams): Promise<MetricValidateResponse>;
  
  // UI-specific operations from RealityCheckMethods
  run_check(options?: CheckOptions): Promise<CheckResult>;
  schedule_check(cron: string): Promise<void>;
  export_report(format: 'markdown' | 'json' | 'html'): Promise<string>;
  fix_discrepancy(id: string): Promise<void>;
  
  // UI data providers
  get_accuracy_trend(days: number): Promise<TrendData>;
  get_discrepancy_groups(): Promise<DiscrepancyGroup[]>;
}

// Documentation Tools (implements DocumentationStatusMethods)
export interface DocumentationTools {
  // Core operations
  doc_generate(params: DocGenerateParams): Promise<DocGenerateResponse>;
  doc_update(params: DocUpdateParams): Promise<DocUpdateResponse>;
  
  // UI-specific operations from DocumentationStatusMethods
  scan_documents(): Promise<DocumentStatus[]>;
  generate_missing(): Promise<void>;
  update_outdated(): Promise<void>;
  validate_accuracy(): Promise<AccuracyReport>;
  
  // UI state management
  get_documentation_health(): Promise<DocumentationHealth>;
  get_missing_documents(): Promise<DocumentType[]>;
}

// Quick Actions Tools (implements QuickActionsMethods)
export interface QuickActionTools {
  // Action execution
  execute_action(action_id: string): Promise<ActionResult>;
  add_custom_action(action: CustomAction): Promise<void>;
  update_suggestions(): Promise<void>;
  record_action(action: Action): Promise<void>;
  
  // Context-aware suggestions
  get_suggested_actions(context: QuickActionContext): Promise<ActionSuggestion[]>;
  get_emergency_actions(): Promise<EmergencyAction[]>;
  
  // Action categories from UI contract
  get_immediate_actions(): Promise<ImmediateAction[]>;
  get_planning_actions(): Promise<PlanningAction[]>;
  get_documentation_actions(): Promise<DocumentationAction[]>;
}
```

## MCP Server Implementation (UI-Integrated)

```typescript
// src/core/server.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { 
  SessionManager,
  ContextMonitor,
  RealityChecker,
  DocumentationEngine,
  QuickActionManager,
  ProjectTracker
} from "../tools/index.js";
import { DashboardDataFlow } from "../interfaces/ui-integration.js";

export class MyWorkFlowServer implements DashboardDataFlow {
  private server: Server;
  
  // Core managers
  private sessionManager: SessionManager;
  private contextMonitor: ContextMonitor;
  private realityChecker: RealityChecker;
  private documentationEngine: DocumentationEngine;
  private quickActionManager: QuickActionManager;
  private projectTracker: ProjectTracker;
  
  // UI state management
  private dashboardState: DashboardState;
  private eventEmitter: EventEmitter;
  
  // Real-time subscriptions for UI
  public subscriptions: {
    sessionUpdates: Observable<SessionUpdate>;
    contextUpdates: Observable<ContextUpdate>;
    realityChecks: Observable<RealityCheckResult>;
  };

  constructor() {
    this.initializeServer();
    this.initializeManagers();
    this.setupUIIntegration();
    this.registerTools();
  }

  private initializeServer(): void {
    this.server = new Server(
      {
        name: "myworkflow-mcp",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
          // Enable server-sent events for real-time UI updates
          experimental_features: {
            server_sent_events: true
          }
        },
      }
    );
  }

  private setupUIIntegration(): void {
    // Setup real-time data streams for UI components
    this.subscriptions = {
      sessionUpdates: this.sessionManager.getUpdateStream(),
      contextUpdates: this.contextMonitor.getUpdateStream(),
      realityChecks: this.realityChecker.getUpdateStream()
    };
    
    // Setup event handlers for UI events
    this.eventEmitter.on('threshold.crossed', (event) => {
      this.handleThresholdCrossed(event);
    });
    
    this.eventEmitter.on('checkpoint.suggested', (event) => {
      this.handleCheckpointSuggestion(event);
    });
  }

  private registerTools(): void {
    this.server.setRequestHandler("tools/list", async () => ({
      tools: [
        // Session Overview Widget tools
        {
          name: "session_start",
          description: "Start a new development session",
          inputSchema: this.getSessionStartSchema()
        },
        {
          name: "session_refresh",
          description: "Refresh session display",
          inputSchema: { 
            type: "object",
            properties: { session_id: { type: "string" } },
            required: ["session_id"]
          }
        },
        
        // Context Monitor Display tools
        {
          name: "context_status",
          description: "Get current context usage with visualization data",
          inputSchema: this.getContextStatusSchema()
        },
        {
          name: "context_optimize",
          description: "Get optimization suggestions",
          inputSchema: this.getOptimizeSchema()
        },
        
        // Reality Check Dashboard tools
        {
          name: "reality_check",
          description: "Run documentation reality check",
          inputSchema: this.getRealityCheckSchema()
        },
        {
          name: "fix_discrepancy",
          description: "Fix a documentation discrepancy",
          inputSchema: {
            type: "object",
            properties: { discrepancy_id: { type: "string" } },
            required: ["discrepancy_id"]
          }
        },
        
        // Project Tracker tools
        {
          name: "project_status",
          description: "Get multi-session project status",
          inputSchema: this.getProjectStatusSchema()
        },
        {
          name: "switch_view",
          description: "Switch project tracker view mode",
          inputSchema: {
            type: "object",
            properties: { 
              mode: { 
                type: "string",
                enum: ["timeline", "kanban", "list"]
              }
            },
            required: ["mode"]
          }
        },
        
        // Quick Actions tools
        {
          name: "execute_action",
          description: "Execute a quick action",
          inputSchema: {
            type: "object",
            properties: { action_id: { type: "string" } },
            required: ["action_id"]
          }
        },
        {
          name: "get_suggested_actions",
          description: "Get context-aware action suggestions",
          inputSchema: {
            type: "object",
            properties: { 
              session_id: { type: "string" },
              context_state: { type: "object" }
            }
          }
        },
        
        // Documentation Status tools
        {
          name: "scan_documents",
          description: "Scan project documentation health",
          inputSchema: {
            type: "object",
            properties: { project_path: { type: "string" } }
          }
        },
        {
          name: "generate_missing_docs",
          description: "Generate missing documentation",
          inputSchema: {
            type: "object",
            properties: { 
              doc_types: { 
                type: "array",
                items: { type: "string" }
              }
            }
          }
        }
      ]
    }));
  }

  // UI-specific response formatting
  private async handleContextStatus(args: any): Promise<any> {
    const status = await this.contextMonitor.getStatus(args.session_id);
    
    // Add UI-specific data
    return {
      ...status,
      // Chart data for visualization
      chart_data: {
        history: await this.contextMonitor.getUsageHistory(args.session_id),
        prediction_line: await this.contextMonitor.getPredictionLine(args.session_id)
      },
      // Visual indicators
      visual_state: {
        color: this.getStatusColor(status.status),
        animation: status.trend === 'rapid' ? 'pulse' : 'none',
        alert_position: status.percentage_used > 85 ? 'modal' : 'inline'
      },
      // Formatted recommendations for UI display
      ui_recommendations: status.recommendations.map(r => ({
        text: r,
        priority: this.getRecommendationPriority(r),
        action_available: this.hasActionForRecommendation(r)
      }))
    };
  }

  // Real-time UI updates
  private async broadcastUpdate(type: string, data: any): Promise<void> {
    // Send update to all connected UI clients
    this.server.sendNotification(`ui.update.${type}`, data);
  }

  // Handle UI events
  public async executeUICommand(command: string, params: any): Promise<any> {
    switch (command) {
      case 'action.triggered':
        return this.quickActionManager.executeAction(params.actionId);
      
      case 'view.changed':
        return this.updateViewPreference(params.component, params.newView);
      
      case 'document.selected':
        return this.documentationEngine.getDocument(params.documentId);
      
      default:
        throw new Error(`Unknown UI command: ${command}`);
    }
  }
}
```

## Session Manager with UI Integration

```typescript
// src/tools/session-manager.ts
import { EventEmitter } from 'events';
import { Observable, Subject } from 'rxjs';
import { 
  Session, 
  SessionOverviewProps, 
  SessionOverviewState,
  SessionAction 
} from '../interfaces/index.js';

export class SessionManager extends EventEmitter {
  private sessions: Map<string, Session>;
  private sessionStates: Map<string, SessionOverviewState>;
  private updateSubject: Subject<SessionUpdate>;
  
  constructor(private db: Database) {
    super();
    this.sessions = new Map();
    this.sessionStates = new Map();
    this.updateSubject = new Subject();
  }

  // UI-aware session start
  async startSession(params: SessionStartParams): Promise<SessionStartResponse> {
    const session = await this.createSession(params);
    
    // Initialize UI state
    const uiState: SessionOverviewState = {
      expanded: false,
      refreshInterval: 1000 // 1 second default
    };
    
    this.sessionStates.set(session.id, uiState);
    
    // Prepare response with UI-specific data
    const response: SessionStartResponse = {
      session_id: session.id,
      context_plan: session.context_plan,
      checkpoints: session.checkpoints,
      warnings: this.generateWarnings(params),
      // UI-specific fields
      ui_config: {
        layout: this.determineLayout(params.estimated_scope.lines_of_code),
        color_scheme: {
          active: '#10b981',
          warning: '#f59e0b',
          critical: '#ef4444',
          checkpoint: '#3b82f6'
        },
        update_frequency: uiState.refreshInterval
      }
    };
    
    // Broadcast session start to UI
    this.broadcastSessionUpdate({
      type: 'session.started',
      session_id: session.id,
      data: response
    });
    
    return response;
  }

  // UI refresh method
  async refreshSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');
    
    // Update metrics
    const metrics = await this.calculateCurrentMetrics(sessionId);
    session.metrics = metrics;
    
    // Calculate UI-specific data
    const timeElapsed = Date.now() - session.start_time;
    const estimatedRemaining = this.estimateTimeRemaining(session);
    
    // Broadcast update to UI
    this.broadcastSessionUpdate({
      type: 'session.refreshed',
      session_id: sessionId,
      data: {
        ...session,
        ui_data: {
          duration_formatted: this.formatDuration(timeElapsed),
          estimated_completion_formatted: this.formatDuration(estimatedRemaining),
          phase_progress: this.calculatePhaseProgress(session),
          action_availability: this.determineAvailableActions(session)
        }
      }
    });
  }

  // Handle UI actions
  async handleSessionAction(sessionId: string, action: SessionAction): Promise<void> {
    switch (action.type) {
      case 'expand':
        await this.expandSessionView(sessionId);
        break;
      
      case 'checkpoint':
        await this.createCheckpointFromUI(sessionId);
        break;
      
      case 'handoff':
        await this.createHandoffFromUI(sessionId);
        break;
    }
  }

  // Get update stream for UI subscription
  getUpdateStream(): Observable<SessionUpdate> {
    return this.updateSubject.asObservable();
  }

  private broadcastSessionUpdate(update: SessionUpdate): void {
    this.updateSubject.next(update);
    this.emit('session.update', update);
  }

  private determineLayout(estimatedLines: number): 'card' | 'inline' | 'minimal' {
    if (estimatedLines < 500) return 'minimal';
    if (estimatedLines < 2000) return 'inline';
    return 'card';
  }

  private determineAvailableActions(session: Session): SessionAction[] {
    const actions: SessionAction[] = [];
    
    // Always available
    actions.push({ type: 'expand', label: 'Expand', enabled: true });
    
    // Context-dependent
    if (session.metrics.context_used_percent > 50) {
      actions.push({ 
        type: 'checkpoint', 
        label: 'Checkpoint',
        enabled: true,
        priority: 'high'
      });
    }
    
    if (session.metrics.context_used_percent > 80) {
      actions.push({ 
        type: 'handoff', 
        label: 'Handoff',
        enabled: true,
        priority: 'critical'
      });
    }
    
    return actions;
  }
}
```

## Context Monitor with Visual Data

```typescript
// src/monitors/context-monitor.ts
import { 
  ContextMonitorProps, 
  ContextMonitorState,
  ContextMonitorVisual 
} from '../interfaces/ui-contracts.js';

export class ContextMonitor {
  private tokenHistory: Map<string, TokenHistoryEntry[]>;
  private predictions: Map<string, ContextPrediction[]>;
  
  async getStatus(sessionId: string): Promise<ContextStatus> {
    const session = await this.getSession(sessionId);
    const history = this.tokenHistory.get(sessionId) || [];
    
    // Calculate core metrics
    const currentTokens = this.calculateCurrentTokens(session);
    const percentage = (currentTokens / session.context_plan.total_tokens) * 100;
    const status = this.determineStatus(percentage);
    const trend = this.calculateTrend(history);
    
    // Generate predictions
    const predictions = this.generatePredictions(history, currentTokens);
    
    // Prepare visualization data
    const chartData = {
      history: history.map(h => ({
        time: h.timestamp,
        tokens: h.tokens,
        percentage: (h.tokens / session.context_plan.total_tokens) * 100
      })),
      prediction_line: predictions.map(p => ({
        time: p.timestamp,
        tokens: p.predicted_tokens,
        confidence: p.confidence
      })),
      thresholds: {
        warning: session.context_plan.thresholds.warning,
        critical: session.context_plan.thresholds.critical,
        emergency: session.context_plan.thresholds.emergency
      }
    };
    
    // Generate UI-specific recommendations
    const recommendations = this.generateRecommendations(percentage, trend);
    
    return {
      session_id: sessionId,
      used_tokens: currentTokens,
      total_tokens: session.context_plan.total_tokens,
      percentage_used: percentage,
      status,
      trend,
      predicted_completion: predictions[0]?.predicted_tokens || 0,
      recommendations,
      // UI-specific fields
      max_tokens: session.context_plan.total_tokens,
      warning_threshold: session.context_plan.thresholds.warning,
      critical_threshold: session.context_plan.thresholds.critical,
      display_mode: this.determineDisplayMode(percentage),
      chart_data,
      optimization_available: this.hasOptimizations(session),
      tokens_per_minute: this.calculateTokenRate(history)
    };
  }

  // Visual-specific methods
  async getChartConfiguration(sessionId: string): Promise<ContextMonitorVisual> {
    const status = await this.getStatus(sessionId);
    
    return {
      chart: {
        type: status.percentage_used > 70 ? 'circular' : 'linear',
        showPrediction: status.trend !== 'stable',
        animateTransitions: true
      },
      alerts: {
        position: status.percentage_used > 85 ? 'modal' : 'inline',
        persistence: status.status === 'red' ? 'manual-dismiss' : 'auto-dismiss'
      },
      breakpoints: {
        green: [0, 50],
        yellow: [50, 70],
        orange: [70, 85],
        red: [85, 100]
      }
    };
  }

  private determineDisplayMode(percentage: number): 'detailed' | 'compact' | 'minimal' {
    if (percentage < 50) return 'detailed';
    if (percentage < 85) return 'compact';
    return 'minimal'; // Preserve space when context is critical
  }

  private generateRecommendations(percentage: number, trend: string): string[] {
    const recommendations: string[] = [];
    
    if (percentage > 60 && trend === 'rapid') {
      recommendations.push('Consider creating a checkpoint soon');
    }
    
    if (percentage > 70) {
      recommendations.push('Focus on essential features only');
    }
    
    if (percentage > 80) {
      recommendations.push('Prepare for session handoff');
      recommendations.push('Defer non-critical features to next session');
    }
    
    if (this.hasOptimizations()) {
      recommendations.push('Context optimization available: ~8k tokens can be saved');
    }
    
    return recommendations;
  }
}
```

## Complete Implementation Guide for Claude Code

### Session 1: Foundation and Interfaces

```bash
# Create all interface files with UI contract integration
claude-code --prompt "Create the complete interface definitions for MyWorkFlow MCP server, integrating all UI contract requirements from SessionOverviewProps, ContextMonitorProps, RealityCheckProps, ProjectTrackerProps, QuickActionsProps, and DocumentationStatusProps. Ensure all backend interfaces provide the data structures needed by the frontend components."
```

### Session 2: Core MCP Server with UI Integration

```bash
# Implement the main server with UI awareness
claude-code --prompt "Implement the MyWorkFlowServer class with full UI integration support. Include real-time subscriptions (Observable streams), event handling for UI events, and response formatting that includes all UI-specific fields like chart data, visual states, and formatted recommendations. Implement the DashboardDataFlow contract."
```

### Session 3: Session Manager with UI State

```bash
# Build session management with UI state tracking
claude-code --prompt "Implement the SessionManager class with full UI state management. Include SessionOverviewState tracking, real-time update broadcasting, UI action handling (expand/collapse/checkpoint/handoff), and formatted responses with duration calculations and phase progress for the Session Overview Widget."
```

### Session 4: Context Monitor with Visualization

```bash
# Create context monitoring with chart data
claude-code --prompt "Implement the ContextMonitor class with visualization support. Include token history tracking, prediction generation, chart data preparation for linear/circular/bar charts, trend analysis with visual indicators, and optimization suggestions. Ensure it provides all data needed for the Context Monitor Display component."
```

### Session 5: Reality Checker with Dashboard Support

```bash
# Build reality checking with UI reporting
claude-code --prompt "Implement the RealityChecker class with dashboard support. Include accuracy scoring for CircularProgress display, discrepancy grouping (by severity/type/component), trend data for SparklineChart, scheduled checks, and fix operations. Provide all data structures for the Reality Check Dashboard."
```

### Session 6: Testing with UI Scenarios

```bash
# Create comprehensive tests including UI flows
claude-code --prompt "Create comprehensive tests for the MyWorkFlow MCP server including unit tests for all managers, integration tests for MCP tool calls, UI event handling tests, real-time subscription tests, and end-to-end scenarios that verify the complete data flow from MCP commands to UI updates."
```

This implementation ensures that every MCP server component is built with the UI requirements in mind, providing all necessary data structures and real-time updates for the dashboard components.