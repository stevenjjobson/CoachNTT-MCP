export interface RealityCheckParams {
  session_id: string;
  check_type: 'comprehensive' | 'quick' | 'specific';
  focus_areas?: string[];
}

export interface RealityCheckResponse {
  snapshot_id: string;
  timestamp: number;
  discrepancies: Discrepancy[];
  confidence_score: number;
  recommendations: string[];
}

export interface Discrepancy {
  type: 'file_mismatch' | 'test_failure' | 'documentation_gap' | 'state_drift';
  severity: 'critical' | 'warning' | 'info';
  description: string;
  location?: string;
  suggested_fix?: string;
  auto_fixable: boolean;
  ui_priority: number;
}

export interface DiscrepancyGroup {
  category: string;
  items: Discrepancy[];
  group_severity: 'critical' | 'warning' | 'info';
  quick_fix_available: boolean;
}

export interface MetricValidateParams {
  session_id: string;
  reported_metrics: Record<string, number>;
}

export interface ValidatedMetric {
  name: string;
  reported_value: number;
  actual_value: number;
  variance_percent: number;
  status: 'accurate' | 'minor_variance' | 'major_variance';
}