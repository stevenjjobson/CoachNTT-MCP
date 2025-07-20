/* eslint-disable @typescript-eslint/no-unused-vars */
import { BehaviorSubject, Observable } from 'rxjs';
import { DatabaseConnection } from '../database';
import {
  Session,
  SessionStartParams,
  CheckpointParams,
  CheckpointResponse,
  HandoffParams,
  HandoffResponse,
} from '../interfaces';

export class SessionManager {
  private db: DatabaseConnection;
  private currentSession$ = new BehaviorSubject<Session | null>(null);

  constructor() {
    this.db = DatabaseConnection.getInstance();
  }

  getCurrentSession(): Observable<Session | null> {
    return this.currentSession$.asObservable();
  }

  async startSession(_params: SessionStartParams): Promise<Session> {
    throw new Error('Method not implemented');
  }

  async createCheckpoint(_params: CheckpointParams): Promise<CheckpointResponse> {
    throw new Error('Method not implemented');
  }

  async createHandoff(_params: HandoffParams): Promise<HandoffResponse> {
    throw new Error('Method not implemented');
  }

  async getSessionStatus(_params: { session_id: string }): Promise<Session> {
    throw new Error('Method not implemented');
  }

  async executeQuickAction(_params: { action_id: string; params?: unknown }): Promise<unknown> {
    throw new Error('Method not implemented');
  }

  async suggestActions(_params: { session_id: string; limit?: number }): Promise<unknown> {
    throw new Error('Method not implemented');
  }

  async defineCustomAction(_params: unknown): Promise<unknown> {
    throw new Error('Method not implemented');
  }

  async updateUIState(_params: unknown): Promise<unknown> {
    throw new Error('Method not implemented');
  }

  async getWebSocketDetails(_params: { session_id: string }): Promise<unknown> {
    throw new Error('Method not implemented');
  }

  async getDebugState(_params: { session_id: string; include_sensitive?: boolean }): Promise<unknown> {
    throw new Error('Method not implemented');
  }
}