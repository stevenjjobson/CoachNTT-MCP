export interface ContextStatus {
  session_id: string;
  used_tokens: number;
  total_tokens: number;
  usage_percent: number;
  phase_breakdown: Record<string, number>;
  trend: 'stable' | 'increasing' | 'critical';
  projected_exhaustion?: number;
  ui_state?: {
    alert_shown: boolean;
    last_update: number;
  };
}

export interface ContextAnalytics {
  average_per_phase: Record<string, number>;
  peak_usage_points: Array<{
    timestamp: number;
    tokens: number;
    reason: string;
  }>;
  efficiency_score: number;
}

export interface ContextPrediction {
  remaining_capacity: number;
  tasks_feasible: string[];
  recommended_checkpoint: boolean;
  optimization_suggestions: string[];
}

export interface OptimizeParams {
  session_id: string;
  target_reduction: number;
  preserve_functionality?: boolean;
}

export interface OptimizeResponse {
  optimizations_applied: string[];
  tokens_saved: number;
  new_capacity: number;
  side_effects: string[];
}