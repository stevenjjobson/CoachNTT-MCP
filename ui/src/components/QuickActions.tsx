import React, { useEffect, useState } from 'react';
import { useDashboard } from '../store/dashboard-context';
import { 
  Zap, FileText, GitBranch, TestTube, BookOpen, 
  TrendingUp, AlertCircle, Plus, Play
} from 'lucide-react';
import clsx from 'clsx';

interface QuickActionsProps {
  position?: 'floating' | 'inline';
}

export default function QuickActions({ position = 'floating' }: QuickActionsProps) {
  const { state, tools } = useDashboard();
  const [loading, setLoading] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    // Fetch suggested actions when session is active
    if (state.currentSession && state.suggestedActions.length === 0) {
      tools.suggestActions(state.currentSession.id);
    }
  }, [state.currentSession, state.suggestedActions.length, tools]);

  const defaultActions = [
    {
      id: 'checkpoint',
      label: 'Quick Checkpoint',
      icon: <GitBranch className="h-4 w-4" />,
      action: 'checkpoint',
      enabled: !!state.currentSession,
      tooltip: 'Save current progress',
    },
    {
      id: 'reality_check',
      label: 'Reality Check',
      icon: <AlertCircle className="h-4 w-4" />,
      action: 'reality_check',
      enabled: !!state.currentSession,
      tooltip: 'Check code state',
    },
    {
      id: 'generate_docs',
      label: 'Generate Docs',
      icon: <FileText className="h-4 w-4" />,
      action: 'generate_docs',
      enabled: !!state.currentSession,
      tooltip: 'Create documentation',
    },
    {
      id: 'run_tests',
      label: 'Run Tests',
      icon: <TestTube className="h-4 w-4" />,
      action: 'run_tests',
      enabled: !!state.currentSession,
      tooltip: 'Execute test suite',
    },
  ];

  const actions = state.suggestedActions.length > 0 ? state.suggestedActions : defaultActions;

  const handleAction = async (actionId: string) => {
    if (!state.currentSession) return;
    
    setLoading(actionId);
    try {
      switch (actionId) {
        case 'checkpoint':
          await tools.createCheckpoint(
            state.currentSession.id,
            ['Quick checkpoint'],
            {
              lines_written: state.currentSession.actual_lines,
              tests_passing: state.currentSession.actual_tests,
              context_used_percent: state.contextStatus?.usage_percent || 0,
            }
          );
          break;
        
        case 'reality_check':
          await tools.performRealityCheck(state.currentSession.id, 'quick');
          break;
        
        case 'generate_docs':
          await tools.generateDocumentation(state.currentSession.id, 'readme');
          break;
        
        default:
          await tools.executeQuickAction(actionId);
      }
    } catch (error) {
      console.error(`Failed to execute action ${actionId}:`, error);
    } finally {
      setLoading(null);
    }
  };

  const actionIcons: Record<string, React.ReactNode> = {
    checkpoint: <GitBranch className="h-4 w-4" />,
    reality_check: <AlertCircle className="h-4 w-4" />,
    generate_docs: <FileText className="h-4 w-4" />,
    run_tests: <TestTube className="h-4 w-4" />,
    optimize_context: <Zap className="h-4 w-4" />,
    analyze_velocity: <TrendingUp className="h-4 w-4" />,
    generate_readme: <BookOpen className="h-4 w-4" />,
  };

  if (position === 'inline') {
    return (
      <div className="flex items-center space-x-2">
        {actions.slice(0, 3).map((action) => (
          <button
            key={action.id}
            onClick={() => handleAction(action.id)}
            disabled={!action.enabled || loading !== null}
            className={clsx(
              'p-2 rounded-lg transition-colors',
              action.enabled && loading === null
                ? 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                : 'opacity-50 cursor-not-allowed',
              loading === action.id && 'animate-pulse'
            )}
            title={action.tooltip}
          >
            {actionIcons[action.id] || <Zap className="h-4 w-4" />}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="fixed bottom-8 right-8 z-50">
      {expanded && (
        <div className="absolute bottom-16 right-0 w-64 card p-4 space-y-2 shadow-lg">
          <h3 className="font-medium mb-2">Quick Actions</h3>
          {actions.map((action) => (
            <button
              key={action.id}
              onClick={() => handleAction(action.id)}
              disabled={!action.enabled || loading !== null}
              className={clsx(
                'w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors',
                action.enabled && loading === null
                  ? 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  : 'opacity-50 cursor-not-allowed',
                loading === action.id && 'animate-pulse'
              )}
            >
              <span className="flex-shrink-0">
                {actionIcons[action.id] || <Zap className="h-4 w-4" />}
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium">{action.label}</p>
                {action.tooltip && (
                  <p className="text-xs text-gray-600 dark:text-gray-400">{action.tooltip}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
      
      <button
        onClick={() => setExpanded(!expanded)}
        className={clsx(
          'w-14 h-14 rounded-full shadow-lg transition-all',
          'bg-coach-blue hover:bg-blue-600 text-white',
          'flex items-center justify-center',
          expanded && 'rotate-45'
        )}
      >
        {state.currentSession ? (
          <Plus className="h-6 w-6" />
        ) : (
          <Play className="h-6 w-6" />
        )}
      </button>
    </div>
  );
}