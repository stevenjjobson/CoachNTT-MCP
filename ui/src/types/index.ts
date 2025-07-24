// Session Types
export interface Session {
  id: string;
  project_id: string;
  project_name: string;
  type: 'feature' | 'bugfix' | 'refactor' | 'documentation';
  status: 'active' | 'checkpoint' | 'handoff' | 'complete';
  start_time: number;
  estimated_end_time?: number;
  actual_end_time?: number;
  estimated_lines: number;
  actual_lines: number;
  estimated_tests: number;
  actual_tests: number;
  context_budget: number;
  checkpoints: Checkpoint[];
}

export interface Checkpoint {
  id: string;
  session_id: string;
  number: number;
  timestamp: number;
  context_used: number;
  message: string;
  commit_hash?: string;
  metrics: CheckpointMetrics;
}

export interface CheckpointMetrics {
  lines_written: number;
  tests_passing: number;
  context_used_percent: number;
}

// Context Types
export interface ContextStatus {
  session_id: string;
  used_tokens: number;
  total_tokens: number;
  usage_percent: number;
  phase_breakdown: Record<string, number>;
  trend: 'stable' | 'increasing' | 'rapid';
  predicted_overflow?: number;
}

export interface ContextPrediction {
  task: string;
  estimated_tokens: number;
  confidence: number;
}

// Reality Check Types
export interface Discrepancy {
  type: 'file_mismatch' | 'test_failure' | 'documentation_gap' | 'state_drift';
  severity: 'critical' | 'warning' | 'info';
  description: string;
  location?: string;
  suggested_fix?: string;
  auto_fixable: boolean;
  ui_priority: number;
}

export interface RealityCheckResult {
  snapshot_id: string;
  timestamp: number;
  discrepancies: Discrepancy[];
  confidence_score: number;
  recommendations: string[];
}

// Project Types
export interface Project {
  id: string;
  name: string;
  created_at: number;
  total_sessions: number;
  total_lines_written: number;
  average_velocity: number;
  completion_rate: number;
  common_blockers: string[];
  tech_stack: string[];
}

export interface VelocityMetrics {
  current_velocity: number;
  average_velocity: number;
  trend: 'improving' | 'stable' | 'declining';
  factors: string[];
}

// Action Types
export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  action: string;
  params?: Record<string, any>;
  enabled: boolean;
  tooltip?: string;
}

// WebSocket Types
export interface WSMessage {
  type: 'event' | 'error' | 'auth' | 'pong' | 'result';
  topic?: string;
  data?: any;
  error?: string;
  requestId?: string;
}

// Tool Execution Types
export interface ToolExecutionLog {
  id: string;
  timestamp: number;
  tool: string;
  params: unknown;
  result?: unknown;
  error?: string;
  duration: number;
  status: 'pending' | 'success' | 'error';
}

// Dashboard State
export interface DashboardState {
  connected: boolean;
  authenticated: boolean;
  currentSession?: Session;
  contextStatus?: ContextStatus;
  recentCheckpoints: Checkpoint[];
  activeDiscrepancies: Discrepancy[];
  project?: Project;
  velocityMetrics?: VelocityMetrics;
  suggestedActions: QuickAction[];
  toolExecutionLogs: ToolExecutionLog[];
  uiState: {
    expanded: boolean;
    refreshInterval: number;
    layout: 'card' | 'inline' | 'minimal';
  };
}