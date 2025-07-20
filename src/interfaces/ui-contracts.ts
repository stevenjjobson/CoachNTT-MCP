import type { Session, SessionMetrics, CheckpointResponse } from './session';
import type { ContextStatus } from './context';
import type { Discrepancy } from './reality';
import type { ActionSuggestion } from './tools';

export interface DashboardEvents {
  'session:start': { session: Session };
  'session:checkpoint': { checkpoint: CheckpointResponse };
  'session:complete': { summary: SessionSummary };
  'context:warning': { status: ContextStatus };
  'context:critical': { immediate_action: string };
  'reality:discrepancy': { discrepancies: Discrepancy[] };
  'ui:action': { action: string; params: unknown };
}

export interface UIState {
  expanded: boolean;
  refresh_interval: number;
  layout: 'card' | 'inline' | 'minimal';
}

export interface SessionSummary {
  session_id: string;
  duration: number;
  accomplishments: string[];
  metrics: SessionMetrics;
  next_steps: string[];
}


export interface DashboardDataFlow {
  server_to_ui: {
    'session.update': Session;
    'context.status': ContextStatus;
    'reality.check': Discrepancy[];
    'metrics.update': Record<string, number>;
    'suggestions.new': ActionSuggestion[];
  };
  ui_to_server: {
    'action.execute': { action_id: string; params?: unknown };
    'session.control': { command: 'pause' | 'resume' | 'checkpoint' };
    'view.change': { view: string; filters?: unknown };
  };
}


export interface DashboardState {
  current_session?: Session;
  context_status?: ContextStatus;
  recent_checkpoints: CheckpointResponse[];
  active_discrepancies: Discrepancy[];
  suggested_actions: ActionSuggestion[];
  ui_preferences: {
    theme: 'light' | 'dark' | 'auto';
    density: 'comfortable' | 'compact';
    notifications: boolean;
  };
}

export interface WebSocketMessage<T = unknown> {
  type: string;
  payload: T;
  timestamp: number;
  correlation_id?: string;
}

export interface WSMessage {
  type: keyof DashboardEvents;
  payload: DashboardEvents[keyof DashboardEvents];
  timestamp: number;
}

export interface ErrorContract {
  code: string;
  message: string;
  details?: unknown;
  recoverable: boolean;
  suggested_action?: string;
}