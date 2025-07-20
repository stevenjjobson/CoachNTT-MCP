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

export interface Blocker {
  id: string;
  session_id: string;
  type: 'technical' | 'context' | 'external' | 'unclear_requirement';
  description: string;
  impact_score: number;
  resolution?: string;
  time_to_resolve?: number;
}

export interface ProgressReportParams {
  project_id: string;
  time_range?: {
    start: number;
    end: number;
  };
  include_predictions?: boolean;
}