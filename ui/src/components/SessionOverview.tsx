import React, { useState } from 'react';
import { useDashboard } from '../store/dashboard-context';
import { Play, Pause, Save, Share2, ChevronDown, ChevronUp, Clock, Code } from 'lucide-react';
import clsx from 'clsx';

export default function SessionOverview() {
  const { state, tools } = useDashboard();
  const [expanded, setExpanded] = useState(true);
  const [loading, setLoading] = useState<string | null>(null);

  const session = state.currentSession;

  const handleCheckpoint = async () => {
    if (!session) return;
    
    setLoading('checkpoint');
    try {
      await tools.createCheckpoint(
        session.id,
        ['Current progress'],
        {
          lines_written: session.actual_lines,
          tests_passing: session.actual_tests,
          context_used_percent: state.contextStatus?.usage_percent || 0,
        }
      );
    } catch (error) {
      console.error('Failed to create checkpoint:', error);
    } finally {
      setLoading(null);
    }
  };

  const handleHandoff = async () => {
    if (!session) return;
    
    setLoading('handoff');
    try {
      await tools.createHandoff(session.id);
    } catch (error) {
      console.error('Failed to create handoff:', error);
    } finally {
      setLoading(null);
    }
  };

  if (!session) {
    return (
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4">No Active Session</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Start a new session through Claude Code to begin tracking your development progress.
        </p>
        <button
          className="btn-primary"
          onClick={() => {
            // This would typically open Claude Code or show instructions
            alert('Start a new session in Claude Code with:\n\n"Let\'s start a new development session for my project"');
          }}
        >
          <Play className="h-4 w-4 mr-2" />
          Start New Session
        </button>
      </div>
    );
  }

  const duration = Date.now() - session.start_time;
  const hours = Math.floor(duration / (1000 * 60 * 60));
  const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));

  const statusColors = {
    active: 'bg-coach-green',
    checkpoint: 'bg-coach-blue',
    handoff: 'bg-coach-amber',
    complete: 'bg-gray-500',
  };

  const sessionTypeIcons = {
    feature: '✨',
    bugfix: '🐛',
    refactor: '🔧',
    documentation: '📝',
  };

  return (
    <div className="card">
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">{sessionTypeIcons[session.type]}</span>
              <div>
                <h2 className="text-lg font-semibold">{session.project_name}</h2>
                <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                  <span className="capitalize">{session.type} Session</span>
                  <span className={clsx('status-indicator', statusColors[session.status], 'text-white')}>
                    {session.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="flex items-center space-x-2 text-sm">
            <Clock className="h-4 w-4 text-gray-400" />
            <span>{hours}h {minutes}m</span>
          </div>
          <div className="flex items-center space-x-2 text-sm">
            <Code className="h-4 w-4 text-gray-400" />
            <span>{session.actual_lines} / {session.estimated_lines} lines</span>
          </div>
        </div>

        {expanded && (
          <div className="mt-6 space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Progress</span>
                <span>{Math.round((session.actual_lines / session.estimated_lines) * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-coach-blue h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, (session.actual_lines / session.estimated_lines) * 100)}%` }}
                />
              </div>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={handleCheckpoint}
                disabled={loading !== null}
                className={clsx('btn-primary flex-1', loading === 'checkpoint' && 'opacity-50')}
              >
                <Save className="h-4 w-4 mr-2" />
                {loading === 'checkpoint' ? 'Creating...' : 'Checkpoint'}
              </button>
              <button
                onClick={handleHandoff}
                disabled={loading !== null}
                className={clsx('btn-secondary flex-1', loading === 'handoff' && 'opacity-50')}
              >
                <Share2 className="h-4 w-4 mr-2" />
                {loading === 'handoff' ? 'Creating...' : 'Handoff'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}