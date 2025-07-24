import React, { useState } from 'react';
import { useDashboard } from '../store/dashboard-context';
import { TrendingUp, TrendingDown, Minus, Calendar, Activity, AlertTriangle, BarChart3 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import clsx from 'clsx';

export default function ProjectTracker() {
  const { state, tools } = useDashboard();
  const [view, setView] = useState<'timeline' | 'velocity'>('timeline');
  const [analyzing, setAnalyzing] = useState(false);

  const project = state.project;
  const velocity = state.velocityMetrics;

  const handleAnalyzeVelocity = async () => {
    if (!project) return;
    
    setAnalyzing(true);
    try {
      await tools.analyzeVelocity(project.id);
    } catch (error) {
      console.error('Failed to analyze velocity:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  if (!project) {
    return (
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4">Project Tracker</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Project metrics will appear here when a session is active.
        </p>
      </div>
    );
  }

  const velocityTrendIcon = velocity?.trend === 'improving' 
    ? <TrendingUp className="h-4 w-4 text-green-600" />
    : velocity?.trend === 'declining'
    ? <TrendingDown className="h-4 w-4 text-red-600" />
    : <Minus className="h-4 w-4 text-gray-600" />;

  // Mock velocity data for visualization
  const velocityData = [
    { session: 'S1', lines: 1200 },
    { session: 'S2', lines: 1500 },
    { session: 'S3', lines: 1400 },
    { session: 'S4', lines: 1800 },
    { session: 'Current', lines: velocity?.current_velocity || 0 },
  ];

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Project: {project.name}</h2>
        <div className="flex space-x-2">
          <button
            onClick={() => setView('timeline')}
            className={clsx(
              'px-2 py-1 rounded text-sm',
              view === 'timeline' 
                ? 'bg-coach-blue text-white' 
                : 'bg-gray-200 dark:bg-gray-700'
            )}
          >
            <Calendar className="h-4 w-4" />
          </button>
          <button
            onClick={() => setView('velocity')}
            className={clsx(
              'px-2 py-1 rounded text-sm',
              view === 'velocity' 
                ? 'bg-coach-blue text-white' 
                : 'bg-gray-200 dark:bg-gray-700'
            )}
          >
            <Activity className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Project Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Sessions</p>
          <p className="text-xl font-semibold">{project.total_sessions}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Lines Written</p>
          <p className="text-xl font-semibold">{project.total_lines_written.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Avg Velocity</p>
          <p className="text-xl font-semibold flex items-center space-x-1">
            <span>{project.average_velocity.toLocaleString()}</span>
            <span className="text-sm text-gray-600">lines/session</span>
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Completion Rate</p>
          <p className="text-xl font-semibold">{Math.round(project.completion_rate * 100)}%</p>
        </div>
      </div>

      {view === 'timeline' ? (
        <>
          {/* Session Timeline */}
          <div className="mb-4">
            <h3 className="text-sm font-medium mb-2">Session Progress</h3>
            <div className="relative">
              <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gray-300 dark:bg-gray-600"></div>
              {[...Array(Math.min(4, project.total_sessions))].map((_, idx) => (
                <div key={idx} className="relative flex items-center mb-4 last:mb-0">
                  <div className={clsx(
                    'absolute left-0 w-5 h-5 rounded-full border-2 bg-white dark:bg-gray-800',
                    idx === project.total_sessions - 1 
                      ? 'border-coach-blue' 
                      : 'border-coach-green'
                  )}>
                    {idx === project.total_sessions - 1 && (
                      <div className="absolute inset-1 bg-coach-blue rounded-full animate-pulse"></div>
                    )}
                  </div>
                  <div className="ml-8">
                    <p className="text-sm font-medium">
                      Session {idx + 1} {idx === project.total_sessions - 1 && '(Current)'}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {idx === project.total_sessions - 1 ? 'In Progress' : 'Completed'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Common Blockers */}
          {project.common_blockers && project.common_blockers.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium mb-2 flex items-center space-x-1">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span>Common Blockers</span>
              </h3>
              <div className="space-y-1">
                {project.common_blockers.slice(0, 3).map((blocker, idx) => (
                  <div key={idx} className="text-sm bg-amber-50 dark:bg-amber-900/20 rounded px-2 py-1">
                    {blocker}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Velocity Chart */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">Velocity Trend</h3>
              {velocity && (
                <div className="flex items-center space-x-1 text-sm">
                  {velocityTrendIcon}
                  <span className="capitalize">{velocity.trend}</span>
                </div>
              )}
            </div>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={velocityData}>
                  <XAxis dataKey="session" />
                  <YAxis />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="lines" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Velocity Factors */}
          {velocity?.factors && velocity.factors.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium mb-2">Contributing Factors</h3>
              <div className="space-y-1">
                {velocity.factors.map((factor, idx) => (
                  <div key={idx} className="text-sm bg-gray-50 dark:bg-gray-800 rounded px-2 py-1">
                    {factor}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Actions */}
      <button
        onClick={handleAnalyzeVelocity}
        disabled={analyzing}
        className={clsx('btn-secondary w-full', analyzing && 'opacity-50')}
      >
        <BarChart3 className="h-4 w-4 mr-2" />
        {analyzing ? 'Analyzing...' : 'Generate Report'}
      </button>
    </div>
  );
}