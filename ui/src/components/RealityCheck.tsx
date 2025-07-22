import React, { useState } from 'react';
import { useDashboard } from '../store/dashboard-context';
import { RefreshCw, Wrench, FileX, TestTube, FileText, GitBranch, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

export default function RealityCheck() {
  const { state, tools } = useDashboard();
  const [checking, setChecking] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const discrepancies = state.activeDiscrepancies;

  const handleCheck = async () => {
    if (!state.currentSession) return;
    
    setChecking(true);
    try {
      await tools.performRealityCheck(state.currentSession.id, 'quick');
      setLastCheck(new Date());
    } catch (error) {
      console.error('Failed to perform reality check:', error);
    } finally {
      setChecking(false);
    }
  };

  const handleAutoFix = async () => {
    if (!state.currentSession) return;
    
    const fixableIds = discrepancies
      .filter(d => d.auto_fixable)
      .map((_, idx) => `fix_${idx}`);
    
    if (fixableIds.length === 0) return;
    
    setFixing(true);
    try {
      // Note: We need the snapshot_id from the last check
      // This is a simplified version
      await tools.applyFixes('current_snapshot', fixableIds);
    } catch (error) {
      console.error('Failed to apply fixes:', error);
    } finally {
      setFixing(false);
    }
  };

  const typeIcons = {
    file_mismatch: <FileX className="h-4 w-4" />,
    test_failure: <TestTube className="h-4 w-4" />,
    documentation_gap: <FileText className="h-4 w-4" />,
    state_drift: <GitBranch className="h-4 w-4" />,
  };

  const severityColors = {
    critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    info: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  };

  const criticalCount = discrepancies.filter(d => d.severity === 'critical').length;
  const fixableCount = discrepancies.filter(d => d.auto_fixable).length;

  // Calculate confidence score (100 - (criticals * 20) - (warnings * 5) - (infos * 1))
  const confidenceScore = Math.max(0, 
    100 - 
    (discrepancies.filter(d => d.severity === 'critical').length * 20) -
    (discrepancies.filter(d => d.severity === 'warning').length * 5) -
    (discrepancies.filter(d => d.severity === 'info').length * 1)
  );

  const confidenceColor = confidenceScore > 80 ? '#10b981' : confidenceScore > 60 ? '#f59e0b' : '#ef4444';

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Reality Check</h2>
        {lastCheck && (
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Last: {lastCheck.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Confidence Score */}
      <div className="text-center mb-6">
        <div className="relative inline-flex items-center justify-center">
          <svg className="w-32 h-32">
            <circle
              cx="64"
              cy="64"
              r="56"
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="8"
            />
            <circle
              cx="64"
              cy="64"
              r="56"
              fill="none"
              stroke={confidenceColor}
              strokeWidth="8"
              strokeDasharray={`${(confidenceScore / 100) * 352} 352`}
              strokeDashoffset="88"
              transform="rotate(-90 64 64)"
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute">
            <div className="text-2xl font-bold" style={{ color: confidenceColor }}>
              {confidenceScore}%
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Confidence</div>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      {discrepancies.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-4 text-center">
          <div className="bg-red-50 dark:bg-red-900/20 rounded p-2">
            <p className="text-sm font-semibold text-red-800 dark:text-red-200">
              {criticalCount}
            </p>
            <p className="text-xs text-red-600 dark:text-red-400">Critical</p>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded p-2">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
              {discrepancies.filter(d => d.severity === 'warning').length}
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400">Warnings</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded p-2">
            <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
              {fixableCount}
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400">Auto-fixable</p>
          </div>
        </div>
      )}

      {/* Discrepancies List */}
      {discrepancies.length > 0 && (
        <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
          {discrepancies.slice(0, 5).map((discrepancy, idx) => (
            <div key={idx} className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
              <div className="flex items-start space-x-2">
                <div className="mt-0.5">{typeIcons[discrepancy.type]}</div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{discrepancy.description}</p>
                  {discrepancy.location && (
                    <p className="text-xs text-gray-600 dark:text-gray-400">{discrepancy.location}</p>
                  )}
                </div>
                <span className={clsx('status-indicator text-xs', severityColors[discrepancy.severity])}>
                  {discrepancy.severity}
                </span>
              </div>
              {discrepancy.suggested_fix && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 ml-6">
                  Fix: {discrepancy.suggested_fix}
                </p>
              )}
            </div>
          ))}
          {discrepancies.length > 5 && (
            <p className="text-sm text-center text-gray-600 dark:text-gray-400">
              +{discrepancies.length - 5} more issues
            </p>
          )}
        </div>
      )}

      {/* Empty State */}
      {discrepancies.length === 0 && !state.currentSession && (
        <div className="text-center py-8 text-gray-600 dark:text-gray-400">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No active session to check</p>
        </div>
      )}

      {discrepancies.length === 0 && state.currentSession && (
        <div className="text-center py-8 text-green-600 dark:text-green-400">
          <p className="text-lg font-medium">All Clear! ✨</p>
          <p className="text-sm">No discrepancies found</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex space-x-2">
        <button
          onClick={handleCheck}
          disabled={checking || !state.currentSession}
          className={clsx('btn-primary flex-1', (checking || !state.currentSession) && 'opacity-50')}
        >
          <RefreshCw className={clsx('h-4 w-4 mr-2', checking && 'animate-spin')} />
          {checking ? 'Checking...' : 'Run Check'}
        </button>
        {fixableCount > 0 && (
          <button
            onClick={handleAutoFix}
            disabled={fixing}
            className={clsx('btn-secondary flex-1', fixing && 'opacity-50')}
          >
            <Wrench className="h-4 w-4 mr-2" />
            {fixing ? 'Fixing...' : `Auto Fix (${fixableCount})`}
          </button>
        )}
      </div>
    </div>
  );
}