import React, { useState } from 'react';
import { useDashboard } from '../store/dashboard-context';
import { TrendingUp, TrendingDown, Minus, Zap, Download, AlertTriangle } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import clsx from 'clsx';

export default function ContextMonitor() {
  const { state, tools } = useDashboard();
  const [view, setView] = useState<'circular' | 'bar'>('circular');
  const [optimizing, setOptimizing] = useState(false);

  const context = state.contextStatus;

  const handleOptimize = async () => {
    if (!state.currentSession) return;
    
    setOptimizing(true);
    try {
      await tools.optimizeContext(state.currentSession.id, 0.3);
    } catch (error) {
      console.error('Failed to optimize context:', error);
    } finally {
      setOptimizing(false);
    }
  };

  if (!context) {
    return (
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4">Context Monitor</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Context usage will appear here when a session is active.
        </p>
      </div>
    );
  }

  const trendIcon = {
    stable: <Minus className="h-4 w-4" />,
    increasing: <TrendingUp className="h-4 w-4" />,
    rapid: <TrendingUp className="h-4 w-4 text-coach-red" />,
  };

  const trendColor = {
    stable: 'text-gray-600',
    increasing: 'text-coach-amber',
    rapid: 'text-coach-red',
  };

  const usageColor = context.usage_percent > 80 ? '#ef4444' : context.usage_percent > 60 ? '#f59e0b' : '#10b981';

  const pieData = [
    { name: 'Used', value: context.used_tokens },
    { name: 'Remaining', value: context.total_tokens - context.used_tokens },
  ];

  const barData = Object.entries(context.phase_breakdown).map(([phase, tokens]) => ({
    phase: phase.charAt(0).toUpperCase() + phase.slice(1),
    tokens,
    percentage: Math.round((tokens / context.used_tokens) * 100),
  }));

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Context Monitor</h2>
        <div className="flex items-center space-x-2">
          <span className={clsx('flex items-center space-x-1 text-sm', trendColor[context.trend])}>
            {trendIcon[context.trend]}
            <span className="capitalize">{context.trend}</span>
          </span>
        </div>
      </div>

      {/* Usage Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Used</p>
          <p className="text-xl font-semibold">{context.used_tokens.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
          <p className="text-xl font-semibold">{context.total_tokens.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Usage</p>
          <p className="text-xl font-semibold" style={{ color: usageColor }}>
            {context.usage_percent}%
          </p>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex space-x-2 mb-4">
        <button
          onClick={() => setView('circular')}
          className={clsx(
            'px-3 py-1 rounded text-sm font-medium transition-colors',
            view === 'circular'
              ? 'bg-coach-blue text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          )}
        >
          Circular
        </button>
        <button
          onClick={() => setView('bar')}
          className={clsx(
            'px-3 py-1 rounded text-sm font-medium transition-colors',
            view === 'bar'
              ? 'bg-coach-blue text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          )}
        >
          Breakdown
        </button>
      </div>

      {/* Visualization */}
      <div className="h-48 mb-4">
        {view === 'circular' ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                startAngle={90}
                endAngle={-270}
                dataKey="value"
              >
                <Cell fill={usageColor} />
                <Cell fill="#e5e7eb" />
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData}>
              <XAxis dataKey="phase" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="tokens" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Warning */}
      {context.usage_percent > 80 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <p className="text-sm text-red-800 dark:text-red-200">
              Context usage critical! Consider optimizing or creating a checkpoint.
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex space-x-2">
        <button
          onClick={handleOptimize}
          disabled={optimizing}
          className={clsx('btn-primary flex-1', optimizing && 'opacity-50')}
        >
          <Zap className="h-4 w-4 mr-2" />
          {optimizing ? 'Optimizing...' : 'Optimize'}
        </button>
        <button className="btn-secondary">
          <Download className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}