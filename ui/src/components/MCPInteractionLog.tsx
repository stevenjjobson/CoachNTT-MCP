import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useDashboard } from '../store/dashboard-context';
import type { ToolExecutionLog } from '../types';

interface MCPInteractionLogProps {
  maxItems?: number;
}

export function MCPInteractionLog({ maxItems = 100 }: MCPInteractionLogProps) {
  const { toolExecutionLogs } = useDashboard();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (shouldAutoScroll.current && scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [toolExecutionLogs]);

  const toggleExpanded = (id: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const getStatusIcon = (status: ToolExecutionLog['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500 animate-pulse" />;
    }
  };

  const getStatusBadge = (status: ToolExecutionLog['status']) => {
    const statusClasses = {
      success: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
      error: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusClasses[status]}`}>
        {status}
      </span>
    );
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const time = date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    const ms = date.getMilliseconds().toString().padStart(3, '0');
    return `${time}.${ms}`;
  };

  const formatParams = (params: unknown): string => {
    try {
      return JSON.stringify(params, null, 2);
    } catch {
      return String(params);
    }
  };

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    const isNearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 50;
    shouldAutoScroll.current = isNearBottom;
  };

  // Get the most recent logs (up to maxItems)
  const displayLogs = toolExecutionLogs.slice(-maxItems);

  return (
    <div className="card h-full flex flex-col">
      <div className="p-6 pb-3 border-b border-gray-100 dark:border-gray-700">
        <h3 className="text-lg font-semibold flex items-center justify-between">
          MCP Server Interactions
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
            {displayLogs.length} logs
          </span>
        </h3>
      </div>
      <div className="flex-1 p-0 overflow-hidden">
        <div 
          ref={scrollAreaRef}
          className="h-[400px] overflow-y-auto px-4" 
          onScroll={handleScroll}
        >
          <div className="space-y-2 py-2">
            {displayLogs.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No tool executions yet
              </div>
            ) : (
              displayLogs.map((log) => (
                <div
                  key={log.id}
                  className="border rounded-lg p-3 space-y-2 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleExpanded(log.id)}
                        className="hover:bg-accent rounded p-0.5"
                      >
                        {expandedItems.has(log.id) ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                      {getStatusIcon(log.status)}
                      <span className="font-mono text-sm font-medium">
                        {log.tool}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatTimestamp(log.timestamp)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {log.duration > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {formatDuration(log.duration)}
                        </span>
                      )}
                      {getStatusBadge(log.status)}
                    </div>
                  </div>

                  {expandedItems.has(log.id) && (
                    <div className="pl-7 space-y-2">
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-1">
                          Parameters:
                        </div>
                        <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                          {formatParams(log.params)}
                        </pre>
                      </div>

                      {log.result && (
                        <div>
                          <div className="text-xs font-medium text-muted-foreground mb-1">
                            Result:
                          </div>
                          <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-32 overflow-y-auto">
                            {String(formatParams(log.result))}
                          </pre>
                        </div>
                      )}

                      {log.error && (
                        <div>
                          <div className="text-xs font-medium text-red-600 mb-1">
                            Error:
                          </div>
                          <pre className="text-xs bg-red-50 text-red-800 p-2 rounded">
                            {log.error}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}