import React, { useState } from 'react';
import { AgentSuggestion } from '../types';
import { useDashboard } from '../store/dashboard-context';
import { AlertCircle, CheckCircle, AlertTriangle, Info, Bot, X, Check } from 'lucide-react';

interface AgentSuggestionsProps {
  suggestions: AgentSuggestion[];
  onAccept: (suggestion: AgentSuggestion) => void;
  onReject: (suggestion: AgentSuggestion) => void;
}

const priorityConfig = {
  critical: {
    icon: AlertCircle,
    className: 'text-red-600 dark:text-red-400',
    bgClassName: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
  },
  high: {
    icon: AlertTriangle,
    className: 'text-orange-600 dark:text-orange-400',
    bgClassName: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
  },
  medium: {
    icon: Info,
    className: 'text-yellow-600 dark:text-yellow-400',
    bgClassName: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
  },
  low: {
    icon: Info,
    className: 'text-blue-600 dark:text-blue-400',
    bgClassName: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
  },
};

const typeLabels = {
  naming: 'Naming Convention',
  checkpoint: 'Checkpoint',
  context: 'Context Usage',
  quality: 'Code Quality',
};

export default function AgentSuggestions({ suggestions, onAccept, onReject }: AgentSuggestionsProps) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  // Filter out dismissed suggestions
  const activeSuggestions = suggestions.filter(s => !dismissedIds.has(s.id));

  if (activeSuggestions.length === 0) {
    return null;
  }

  const handleAccept = async (suggestion: AgentSuggestion) => {
    setProcessingIds(prev => new Set(prev).add(suggestion.id));
    try {
      await onAccept(suggestion);
      setDismissedIds(prev => new Set(prev).add(suggestion.id));
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(suggestion.id);
        return next;
      });
    }
  };

  const handleReject = async (suggestion: AgentSuggestion) => {
    setProcessingIds(prev => new Set(prev).add(suggestion.id));
    try {
      await onReject(suggestion);
      setDismissedIds(prev => new Set(prev).add(suggestion.id));
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(suggestion.id);
        return next;
      });
    }
  };

  // Sort suggestions by priority
  const sortedSuggestions = [...activeSuggestions].sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center">
          <Bot className="h-5 w-5 text-coach-blue mr-2" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Agent Suggestions
          </h3>
          <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
            ({activeSuggestions.length})
          </span>
        </div>
      </div>

      <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-96 overflow-y-auto">
        {sortedSuggestions.map(suggestion => {
          const config = priorityConfig[suggestion.priority];
          const Icon = config.icon;
          const isProcessing = processingIds.has(suggestion.id);

          return (
            <div
              key={suggestion.id}
              className={`p-4 transition-all ${config.bgClassName} ${
                isProcessing ? 'opacity-50' : ''
              }`}
            >
              <div className="flex items-start">
                <Icon className={`h-5 w-5 ${config.className} mt-0.5 flex-shrink-0`} />
                <div className="ml-3 flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {suggestion.title}
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {typeLabels[suggestion.type]} • {suggestion.agentName}
                      </span>
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                    {suggestion.description}
                  </p>

                  {suggestion.actionRequired && (
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        onClick={() => handleAccept(suggestion)}
                        disabled={isProcessing}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-coach-blue hover:bg-coach-blue-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-coach-blue disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Check className="h-3.5 w-3.5 mr-1" />
                        Accept
                      </button>
                      <button
                        onClick={() => handleReject(suggestion)}
                        disabled={isProcessing}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-xs font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-coach-blue disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <X className="h-3.5 w-3.5 mr-1" />
                        Dismiss
                      </button>
                      {suggestion.suggestedAction && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                          Tool: {suggestion.suggestedAction.tool}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}