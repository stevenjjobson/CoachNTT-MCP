import React from 'react';
import { useDashboard } from '../store/dashboard-context';
import SessionOverview from './SessionOverview';
import ContextMonitor from './ContextMonitor';
import RealityCheck from './RealityCheck';
import ProjectTracker from './ProjectTracker';
import QuickActions from './QuickActions';
import ConnectionStatus from './ConnectionStatus';
import { AlertCircle } from 'lucide-react';

export default function Dashboard() {
  const { state } = useDashboard();

  if (!state.connected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-coach-amber animate-pulse" />
          <h2 className="mt-4 text-xl font-semibold">Connecting to CoachNTT-MCP...</h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Make sure the MCP server is running on port 3001
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-coach-blue">CoachNTT-MCP</h1>
              <ConnectionStatus />
            </div>
            <div className="flex items-center space-x-4">
              <QuickActions position="inline" />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            <SessionOverview />
            <ProjectTracker />
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <ContextMonitor />
            <RealityCheck />
          </div>
        </div>

        {/* Full Width Section */}
        {state.recentCheckpoints.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold mb-4">Recent Checkpoints</h2>
            <div className="card p-4">
              <div className="space-y-3">
                {state.recentCheckpoints.map((checkpoint) => (
                  <div
                    key={checkpoint.id}
                    className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
                  >
                    <div>
                      <p className="font-medium">{checkpoint.message}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {new Date(checkpoint.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{checkpoint.metrics.lines_written} lines</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {checkpoint.metrics.context_used_percent}% context used
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}