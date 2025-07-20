export interface SessionStartParams {
  project_name: string;
  session_type: 'feature' | 'bugfix' | 'refactor' | 'documentation';
  estimated_scope: {
    lines_of_code: number;
    test_coverage: number;
    documentation: number;
  };
  context_budget?: number;
}

export interface Session {
  id: string;
  project_name: string;
  session_type: 'feature' | 'bugfix' | 'refactor' | 'documentation';
  start_time: number;
  estimated_completion: number;
  current_phase: string;
  status: 'active' | 'checkpoint' | 'handoff' | 'complete';
  estimated_scope: EstimatedScope;
  context_plan: ContextPlan;
  checkpoints: CheckpointPlan[];
  metrics: SessionMetrics;
  ui_state?: {
    expanded: boolean;
    refresh_interval: number;
    layout: 'card' | 'inline' | 'minimal';
  };
}

export interface EstimatedScope {
  lines_of_code: number;
  test_coverage: number;
  documentation: number;
}

export interface ContextPlan {
  total_budget: number;
  phase_allocation: Record<string, number>;
  checkpoint_triggers: string[];
}

export interface CheckpointPlan {
  phase: string;
  context_threshold: number;
  deliverables: string[];
}

export interface SessionMetrics {
  lines_written: number;
  tests_written: number;
  tests_passing: number;
  documentation_updated: boolean;
  docs_updated: number;
  context_used: number;
  velocity_score: number;
}

export interface CheckpointParams {
  session_id: string;
  completed_components: string[];
  metrics: {
    lines_written: number;
    tests_passing: number;
    context_used_percent: number;
  };
  commit_message?: string;
  force?: boolean;
}

export interface CheckpointResponse {
  checkpoint_id: string;
  commit_hash?: string;
  context_snapshot: ContextSnapshot;
  continuation_plan: ContinuationPlan;
}

export interface ContextSnapshot {
  session_id: string;
  checkpoint_id: string;
  timestamp: number;
  context_used: number;
  important_files: string[];
  key_decisions: string[];
  next_steps: string[];
}

export interface ContinuationPlan {
  remaining_tasks: string[];
  context_requirements: number;
  prerequisite_checks: string[];
  suggested_approach: string;
}

export interface HandoffParams {
  session_id: string;
  next_session_goals?: string[];
  include_context_dump?: boolean;
}

export interface HandoffResponse {
  handoff_document: string;
  context_requirements: ContextRequirement[];
  prerequisite_checks: PrerequisiteCheck[];
  estimated_next_session: SessionEstimate;
}

export interface ContextRequirement {
  file_path: string;
  reason: string;
  priority: 'critical' | 'important' | 'helpful';
}

export interface PrerequisiteCheck {
  check_type: 'test' | 'build' | 'dependency' | 'documentation';
  command: string;
  expected_result: string;
}

export interface SessionEstimate {
  estimated_lines: number;
  estimated_duration: number;
  estimated_context: number;
  complexity_score: number;
}