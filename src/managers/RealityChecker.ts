/* eslint-disable @typescript-eslint/no-unused-vars */
import { BehaviorSubject, Observable } from 'rxjs';
import { DatabaseConnection } from '../database';
import {
  RealityCheckParams,
  RealityCheckResponse,
  MetricValidateParams,
  ValidatedMetric,
  Discrepancy,
} from '../interfaces';

export class RealityChecker {
  private db: DatabaseConnection;
  private discrepancies$ = new BehaviorSubject<Discrepancy[]>([]);

  constructor() {
    this.db = DatabaseConnection.getInstance();
  }

  getDiscrepancies(): Observable<Discrepancy[]> {
    return this.discrepancies$.asObservable();
  }

  async performCheck(_params: RealityCheckParams): Promise<RealityCheckResponse> {
    throw new Error('Method not implemented');
  }

  async applyFixes(_params: { snapshot_id: string; fix_ids: string[]; auto_commit?: boolean }): Promise<unknown> {
    throw new Error('Method not implemented');
  }

  async validateMetrics(_params: MetricValidateParams): Promise<ValidatedMetric[]> {
    throw new Error('Method not implemented');
  }

  private async checkFileSystem(): Promise<Discrepancy[]> {
    throw new Error('Method not implemented');
  }

  private async checkTests(): Promise<Discrepancy[]> {
    throw new Error('Method not implemented');
  }

  private async checkDocumentation(): Promise<Discrepancy[]> {
    throw new Error('Method not implemented');
  }
}