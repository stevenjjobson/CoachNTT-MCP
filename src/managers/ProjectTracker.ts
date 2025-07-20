import { DatabaseConnection } from '../database';
import {
  Project,
  VelocityMetrics,
  Blocker,
  ProgressReportParams,
} from '../interfaces';
import { v4 as uuidv4 } from 'uuid';
import { BehaviorSubject, Observable } from 'rxjs';

interface ProjectMetrics {
  project_id: string;
  total_lines: number;
  total_tests: number;
  total_sessions: number;
  average_session_duration: number;
  completion_rate: number;
  blockers_resolved: number;
  blockers_open: number;
}

interface VelocityData {
  timestamp: number;
  lines_written: number;
  tests_written: number;
  session_id: string;
}

export class ProjectTracker {
  private db: DatabaseConnection;
  private projectStatus$ = new BehaviorSubject<Project | null>(null);
  private velocityMetrics$ = new BehaviorSubject<VelocityMetrics | null>(null);

  constructor() {
    this.db = DatabaseConnection.getInstance();
  }

  getProjectStatus(): Observable<Project | null> {
    return this.projectStatus$.asObservable();
  }

  getVelocityMetrics(): Observable<VelocityMetrics | null> {
    return this.velocityMetrics$.asObservable();
  }

  async track(params: { project_name: string; session_id: string }): Promise<Project> {
    const { project_name, session_id } = params;

    try {
      return this.db.transaction(() => {
        // Get or create project
        let project = this.db.get<any>(
          'SELECT * FROM projects WHERE name = ?',
          project_name
        );

        const now = Date.now();

        if (!project) {
          // Create new project
          const projectId = uuidv4();
          this.db.run(
            `INSERT INTO projects (id, name, created_at, updated_at, total_sessions, total_lines_written, average_velocity, completion_rate, tech_stack, common_blockers)
             VALUES (?, ?, ?, ?, 0, 0, 0, 0, '[]', '[]')`,
            [projectId, project_name, now, now]
          );

          project = {
            id: projectId,
            name: project_name,
            created_at: now,
            total_sessions: 0,
            total_lines_written: 0,
            average_velocity: 0,
            completion_rate: 0,
            tech_stack: '[]',
            common_blockers: '[]',
          };
        }

        // Update project metrics from session
        const session = this.db.get<any>(
          'SELECT * FROM sessions WHERE id = ?',
          session_id
        );

        if (session) {
          // Calculate new metrics
          const sessions = this.db.all<any>(
            'SELECT * FROM sessions WHERE project_name = ?',
            project_name
          );

          const totalLines = sessions.reduce((sum, s) => sum + (s.actual_lines || 0), 0);
          const totalSessions = sessions.length;
          const completedSessions = sessions.filter(s => s.status === 'complete').length;
          const completionRate = totalSessions > 0 ? completedSessions / totalSessions : 0;

          // Calculate average velocity
          const velocityData = this.calculateProjectVelocity(project_name, sessions);

          // Get common blockers
          const blockers = this.db.all<any>(
            `SELECT type, COUNT(*) as count FROM blockers 
             WHERE project_id = ? OR session_id IN (SELECT id FROM sessions WHERE project_name = ?)
             GROUP BY type ORDER BY count DESC LIMIT 3`,
            [project.id, project_name]
          );

          const commonBlockers = blockers.map(b => b.type);

          // Extract tech stack from sessions
          const techStack = this.extractTechStack(sessions);

          // Update project
          this.db.run(
            `UPDATE projects SET 
             total_sessions = ?,
             total_lines_written = ?,
             average_velocity = ?,
             completion_rate = ?,
             tech_stack = ?,
             common_blockers = ?,
             updated_at = ?
             WHERE id = ?`,
            [
              totalSessions,
              totalLines,
              velocityData.average_velocity,
              completionRate,
              JSON.stringify(techStack),
              JSON.stringify(commonBlockers),
              now,
              project.id
            ]
          );

          // Update project object
          project.total_sessions = totalSessions;
          project.total_lines_written = totalLines;
          project.average_velocity = velocityData.average_velocity;
          project.completion_rate = completionRate;
          project.tech_stack = techStack;
          project.common_blockers = commonBlockers;
        }

        // Convert to interface format
        const result: Project = {
          id: project.id,
          name: project.name,
          created_at: project.created_at,
          total_sessions: project.total_sessions,
          total_lines_written: project.total_lines_written,
          average_velocity: project.average_velocity,
          completion_rate: project.completion_rate,
          common_blockers: typeof project.common_blockers === 'string' 
            ? JSON.parse(project.common_blockers) 
            : project.common_blockers,
          tech_stack: typeof project.tech_stack === 'string'
            ? JSON.parse(project.tech_stack)
            : project.tech_stack,
        };

        // Emit update
        this.projectStatus$.next(result);

        return result;
      });
    } catch (error) {
      console.error('Failed to track project:', error);
      throw error;
    }
  }

  async analyzeVelocity(params: { project_id: string; time_window?: number }): Promise<VelocityMetrics> {
    const { project_id, time_window = 7 * 24 * 60 * 60 * 1000 } = params; // Default 7 days

    try {
      const project = this.db.get<any>(
        'SELECT * FROM projects WHERE id = ?',
        project_id
      );

      if (!project) {
        throw new Error(`Project ${project_id} not found`);
      }

      // Get sessions within time window
      const cutoffTime = Date.now() - time_window;
      const recentSessions = this.db.all<any>(
        `SELECT * FROM sessions 
         WHERE project_name = ? AND start_time >= ?
         ORDER BY start_time DESC`,
        [project.name, cutoffTime]
      );

      if (recentSessions.length === 0) {
        return {
          current_velocity: 0,
          average_velocity: project.average_velocity,
          trend: 'stable',
          factors: ['No recent sessions'],
        };
      }

      // Calculate current velocity (lines per day)
      const totalRecentLines = recentSessions.reduce((sum, s) => sum + (s.actual_lines || 0), 0);
      const timeSpan = Date.now() - recentSessions[recentSessions.length - 1].start_time;
      const daysSpan = timeSpan / (24 * 60 * 60 * 1000);
      const currentVelocity = daysSpan > 0 ? totalRecentLines / daysSpan : 0;

      // Calculate historical velocity for comparison
      const historicalSessions = this.db.all<any>(
        `SELECT * FROM sessions 
         WHERE project_name = ? AND start_time < ?
         ORDER BY start_time DESC
         LIMIT 10`,
        [project.name, cutoffTime]
      );

      let trend: 'improving' | 'stable' | 'declining' = 'stable';
      const factors: string[] = [];

      if (historicalSessions.length > 0) {
        const historicalLines = historicalSessions.reduce((sum, s) => sum + (s.actual_lines || 0), 0);
        const historicalSpan = historicalSessions[0].start_time - historicalSessions[historicalSessions.length - 1].start_time;
        const historicalDays = historicalSpan / (24 * 60 * 60 * 1000);
        const historicalVelocity = historicalDays > 0 ? historicalLines / historicalDays : 0;

        // Determine trend
        const velocityChange = currentVelocity - historicalVelocity;
        const percentChange = historicalVelocity > 0 ? velocityChange / historicalVelocity : 0;

        if (percentChange > 0.2) {
          trend = 'improving';
          factors.push(`Velocity increased by ${Math.round(percentChange * 100)}%`);
        } else if (percentChange < -0.2) {
          trend = 'declining';
          factors.push(`Velocity decreased by ${Math.round(Math.abs(percentChange) * 100)}%`);
        }
      }

      // Analyze factors affecting velocity
      const recentBlockers = this.db.all<any>(
        `SELECT * FROM blockers 
         WHERE session_id IN (${recentSessions.map(() => '?').join(',')}) 
         AND created_at >= ?`,
        [...recentSessions.map(s => s.id), cutoffTime]
      );

      if (recentBlockers.length > 3) {
        factors.push(`High blocker count (${recentBlockers.length})`);
        if (trend !== 'declining') trend = 'declining';
      }

      // Check context usage efficiency
      const avgContextEfficiency = recentSessions.reduce((sum, s) => {
        const efficiency = s.actual_lines / (s.context_used || 1);
        return sum + efficiency;
      }, 0) / recentSessions.length;

      if (avgContextEfficiency < 0.01) {
        factors.push('Low context efficiency');
      } else if (avgContextEfficiency > 0.05) {
        factors.push('High context efficiency');
      }

      // Check session completion rate
      const completedRecent = recentSessions.filter(s => s.status === 'complete').length;
      const completionRate = recentSessions.length > 0 ? completedRecent / recentSessions.length : 0;
      
      if (completionRate < 0.5) {
        factors.push(`Low completion rate (${Math.round(completionRate * 100)}%)`);
      } else if (completionRate > 0.8) {
        factors.push(`High completion rate (${Math.round(completionRate * 100)}%)`);
      }

      const metrics: VelocityMetrics = {
        current_velocity: Math.round(currentVelocity),
        average_velocity: Math.round(project.average_velocity),
        trend,
        factors,
      };

      // Emit update
      this.velocityMetrics$.next(metrics);

      return metrics;
    } catch (error) {
      console.error('Failed to analyze velocity:', error);
      throw error;
    }
  }

  async reportBlocker(params: {
    session_id: string;
    type: 'technical' | 'context' | 'external' | 'unclear_requirement';
    description: string;
    impact_score: number;
  }): Promise<Blocker> {
    const { session_id, type, description, impact_score } = params;

    try {
      // Get session to find project
      const session = this.db.get<any>(
        'SELECT * FROM sessions WHERE id = ?',
        session_id
      );

      if (!session) {
        throw new Error(`Session ${session_id} not found`);
      }

      // Get project
      const project = this.db.get<any>(
        'SELECT * FROM projects WHERE name = ?',
        session.project_name
      );

      const blockerId = uuidv4();
      const now = Date.now();

      // Insert blocker
      this.db.run(
        `INSERT INTO blockers (id, session_id, project_id, type, description, impact_score, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [blockerId, session_id, project?.id || '', type, description, impact_score, now]
      );

      const blocker: Blocker = {
        id: blockerId,
        session_id,
        type,
        description,
        impact_score,
      };

      // Update project if high impact
      if (impact_score >= 7 && project) {
        await this.track({ project_name: session.project_name, session_id });
      }

      return blocker;
    } catch (error) {
      console.error('Failed to report blocker:', error);
      throw error;
    }
  }

  async resolveBlocker(params: { blocker_id: string; resolution: string }): Promise<Blocker> {
    const { blocker_id, resolution } = params;

    try {
      const blocker = this.db.get<any>(
        'SELECT * FROM blockers WHERE id = ?',
        blocker_id
      );

      if (!blocker) {
        throw new Error(`Blocker ${blocker_id} not found`);
      }

      const now = Date.now();
      const timeToResolve = now - blocker.created_at;

      // Update blocker
      this.db.run(
        'UPDATE blockers SET resolution = ?, resolved_at = ?, time_to_resolve = ? WHERE id = ?',
        [resolution, now, timeToResolve, blocker_id]
      );

      const resolved: Blocker = {
        id: blocker.id,
        session_id: blocker.session_id,
        type: blocker.type,
        description: blocker.description,
        impact_score: blocker.impact_score,
        resolution,
        time_to_resolve: timeToResolve,
      };

      // Update project metrics
      const session = this.db.get<any>(
        'SELECT project_name FROM sessions WHERE id = ?',
        blocker.session_id
      );

      if (session) {
        await this.track({ project_name: session.project_name, session_id: blocker.session_id });
      }

      return resolved;
    } catch (error) {
      console.error('Failed to resolve blocker:', error);
      throw error;
    }
  }

  async generateReport(params: {
    project_id: string;
    time_range?: { start: number; end: number };
    include_predictions?: boolean;
  }): Promise<{
    project: Project;
    sessions_summary: {
      total: number;
      completed: number;
      in_progress: number;
      by_type: Record<string, number>;
    };
    velocity_analysis: VelocityMetrics;
    blockers_summary: {
      total: number;
      resolved: number;
      by_type: Record<string, number>;
      average_resolution_time: number;
    };
    productivity_metrics: {
      lines_per_session: number;
      tests_per_session: number;
      context_efficiency: number;
    };
    predictions?: {
      estimated_completion: number;
      recommended_actions: string[];
      risk_factors: string[];
    };
  }> {
    const { project_id, time_range, include_predictions = false } = params;

    try {
      // Get project
      const project = await this.track({ 
        project_name: this.db.get<any>('SELECT name FROM projects WHERE id = ?', project_id)?.name || '',
        session_id: ''
      });

      // Apply time range filter
      const timeFilter = time_range 
        ? 'AND created_at >= ? AND created_at <= ?'
        : '';
      const timeParams = time_range 
        ? [time_range.start, time_range.end]
        : [];

      // Get sessions
      const sessions = this.db.all<any>(
        `SELECT * FROM sessions WHERE project_name = ? ${timeFilter}`,
        [project.name, ...timeParams]
      );

      // Sessions summary
      const sessionsSummary = {
        total: sessions.length,
        completed: sessions.filter(s => s.status === 'complete').length,
        in_progress: sessions.filter(s => s.status === 'active').length,
        by_type: sessions.reduce((acc, s) => {
          acc[s.session_type] = (acc[s.session_type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      };

      // Velocity analysis
      const velocityAnalysis = await this.analyzeVelocity({ project_id });

      // Blockers summary
      const blockers = this.db.all<any>(
        `SELECT * FROM blockers WHERE project_id = ? OR session_id IN (SELECT id FROM sessions WHERE project_name = ?) ${timeFilter}`,
        [project_id, project.name, ...timeParams]
      );

      const resolvedBlockers = blockers.filter(b => b.resolution);
      const avgResolutionTime = resolvedBlockers.length > 0
        ? resolvedBlockers.reduce((sum, b) => sum + (b.time_to_resolve || 0), 0) / resolvedBlockers.length
        : 0;

      const blockersSummary = {
        total: blockers.length,
        resolved: resolvedBlockers.length,
        by_type: blockers.reduce((acc, b) => {
          acc[b.type] = (acc[b.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        average_resolution_time: avgResolutionTime,
      };

      // Productivity metrics
      const totalLines = sessions.reduce((sum, s) => sum + (s.actual_lines || 0), 0);
      const totalTests = sessions.reduce((sum, s) => sum + (s.actual_tests || 0), 0);
      const totalContext = sessions.reduce((sum, s) => sum + (s.context_used || 0), 0);

      const productivityMetrics = {
        lines_per_session: sessions.length > 0 ? totalLines / sessions.length : 0,
        tests_per_session: sessions.length > 0 ? totalTests / sessions.length : 0,
        context_efficiency: totalContext > 0 ? totalLines / totalContext : 0,
      };

      // Build report
      const report: any = {
        project,
        sessions_summary: sessionsSummary,
        velocity_analysis: velocityAnalysis,
        blockers_summary: blockersSummary,
        productivity_metrics: productivityMetrics,
      };

      // Add predictions if requested
      if (include_predictions) {
        const predictions = this.generatePredictions(
          project,
          sessions,
          velocityAnalysis,
          blockers
        );
        report.predictions = predictions;
      }

      return report;
    } catch (error) {
      console.error('Failed to generate report:', error);
      throw error;
    }
  }

  private calculateProjectVelocity(projectName: string, sessions: any[]): { average_velocity: number } {
    if (sessions.length === 0) {
      return { average_velocity: 0 };
    }

    // Calculate total time span
    const sortedSessions = sessions.sort((a, b) => a.start_time - b.start_time);
    const firstSession = sortedSessions[0];
    const lastSession = sortedSessions[sortedSessions.length - 1];
    const totalSpan = (lastSession.end_time || Date.now()) - firstSession.start_time;
    const totalDays = totalSpan / (24 * 60 * 60 * 1000);

    // Calculate total lines
    const totalLines = sessions.reduce((sum, s) => sum + (s.actual_lines || 0), 0);

    // Average velocity in lines per day
    const averageVelocity = totalDays > 0 ? totalLines / totalDays : 0;

    return { average_velocity: Math.round(averageVelocity) };
  }

  private extractTechStack(sessions: any[]): string[] {
    const techStack = new Set<string>();

    // Simple heuristic - in production, would analyze actual code
    sessions.forEach(session => {
      if (session.session_type === 'feature') {
        techStack.add('TypeScript');
        techStack.add('Node.js');
      }
      if (session.estimated_tests > 0) {
        techStack.add('Jest');
      }
    });

    // Check for common patterns in project name
    const projectName = sessions[0]?.project_name || '';
    if (projectName.toLowerCase().includes('react')) {
      techStack.add('React');
    }
    if (projectName.toLowerCase().includes('api')) {
      techStack.add('REST API');
    }

    return Array.from(techStack);
  }

  private generatePredictions(
    project: Project,
    sessions: any[],
    velocity: VelocityMetrics,
    blockers: any[]
  ): {
    estimated_completion: number;
    recommended_actions: string[];
    risk_factors: string[];
  } {
    const recommendedActions: string[] = [];
    const riskFactors: string[] = [];

    // Estimate completion based on velocity
    const incompleteSessions = sessions.filter(s => s.status !== 'complete');
    const remainingWork = incompleteSessions.reduce((sum, s) => {
      const progress = s.actual_lines / s.estimated_lines;
      const remaining = s.estimated_lines * (1 - progress);
      return sum + remaining;
    }, 0);

    const daysToComplete = velocity.current_velocity > 0 
      ? remainingWork / velocity.current_velocity
      : 30; // Default estimate

    const estimatedCompletion = Date.now() + (daysToComplete * 24 * 60 * 60 * 1000);

    // Analyze trends for recommendations
    if (velocity.trend === 'declining') {
      recommendedActions.push('Address velocity decline by reviewing recent blockers');
      riskFactors.push('Declining productivity trend');
    }

    if (project.completion_rate < 0.7) {
      recommendedActions.push('Focus on completing in-progress sessions before starting new ones');
      riskFactors.push('Low session completion rate');
    }

    // Analyze blockers
    const unresolvedBlockers = blockers.filter(b => !b.resolution);
    if (unresolvedBlockers.length > 3) {
      recommendedActions.push(`Prioritize resolving ${unresolvedBlockers.length} open blockers`);
      riskFactors.push('High number of unresolved blockers');
    }

    const highImpactBlockers = unresolvedBlockers.filter(b => b.impact_score >= 7);
    if (highImpactBlockers.length > 0) {
      recommendedActions.push('Address high-impact blockers immediately');
      riskFactors.push(`${highImpactBlockers.length} high-impact blockers`);
    }

    // Context efficiency
    const avgContextEfficiency = sessions.reduce((sum, s) => {
      return sum + (s.actual_lines / (s.context_used || 1));
    }, 0) / sessions.length;

    if (avgContextEfficiency < 0.01) {
      recommendedActions.push('Improve context usage efficiency through better planning');
      riskFactors.push('Low context efficiency');
    }

    return {
      estimated_completion: estimatedCompletion,
      recommended_actions: recommendedActions,
      risk_factors: riskFactors,
    };
  }
}