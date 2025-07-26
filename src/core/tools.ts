import { ToolRegistry } from '../interfaces/tools';
import type { SessionManager } from '../managers/SessionManager';
import type { ContextMonitor } from '../managers/ContextMonitor';
import type { RealityChecker } from '../managers/RealityChecker';
import type { DocumentationEngine } from '../managers/DocumentationEngine';
import type { ProjectTracker } from '../managers/ProjectTracker';
import type { AgentManager } from '../managers/AgentManager';

interface Managers {
  sessionManager: SessionManager;
  contextMonitor: ContextMonitor;
  realityChecker: RealityChecker;
  documentationEngine: DocumentationEngine;
  projectTracker: ProjectTracker;
  agentManager: AgentManager;
}

export function createToolRegistry(managers: Managers): ToolRegistry {
  const {
    sessionManager,
    contextMonitor,
    realityChecker,
    documentationEngine,
    projectTracker,
    agentManager,
  } = managers;

  return {
    session_start: {
      name: 'session_start',
      description: 'Start a new development session with context planning',
      inputSchema: {
        type: 'object',
        properties: {
          project_name: { type: 'string' },
          session_type: {
            type: 'string',
            enum: ['feature', 'bugfix', 'refactor', 'documentation'],
          },
          estimated_scope: {
            type: 'object',
            properties: {
              lines_of_code: { type: 'number' },
              test_coverage: { type: 'number' },
              documentation: { type: 'number' },
            },
            required: ['lines_of_code', 'test_coverage', 'documentation'],
          },
          context_budget: { type: 'number' },
        },
        required: ['project_name', 'session_type', 'estimated_scope'],
      },
      handler: async (params) => sessionManager.startSession(params as any),
    },

    session_checkpoint: {
      name: 'session_checkpoint',
      description: 'Create a checkpoint with current progress',
      inputSchema: {
        type: 'object',
        properties: {
          session_id: { type: 'string' },
          completed_components: {
            type: 'array',
            items: { type: 'string' },
          },
          metrics: {
            type: 'object',
            properties: {
              lines_written: { type: 'number' },
              tests_passing: { type: 'number' },
              context_used_percent: { type: 'number' },
            },
          },
          commit_message: { type: 'string' },
          force: { type: 'boolean' },
        },
        required: ['session_id', 'completed_components', 'metrics'],
      },
      handler: async (params) => sessionManager.createCheckpoint(params as any),
    },

    session_handoff: {
      name: 'session_handoff',
      description: 'Create handoff documentation for next session',
      inputSchema: {
        type: 'object',
        properties: {
          session_id: { type: 'string' },
          next_session_goals: {
            type: 'array',
            items: { type: 'string' },
          },
          include_context_dump: { type: 'boolean' },
        },
        required: ['session_id'],
      },
      handler: async (params) => sessionManager.createHandoff(params as any),
    },

    session_status: {
      name: 'session_status',
      description: 'Get current session status and metrics',
      inputSchema: {
        type: 'object',
        properties: {
          session_id: { type: 'string' },
        },
        required: ['session_id'],
      },
      handler: async (params) => sessionManager.getSessionStatus(params as any),
    },

    context_status: {
      name: 'context_status',
      description: 'Get current context usage and projections',
      inputSchema: {
        type: 'object',
        properties: {
          session_id: { type: 'string' },
        },
        required: ['session_id'],
      },
      handler: async (params) => contextMonitor.getStatus(params as any),
    },

    context_optimize: {
      name: 'context_optimize',
      description: 'Optimize context usage by removing redundant information',
      inputSchema: {
        type: 'object',
        properties: {
          session_id: { type: 'string' },
          target_reduction: { type: 'number' },
          preserve_functionality: { type: 'boolean' },
        },
        required: ['session_id', 'target_reduction'],
      },
      handler: async (params) => contextMonitor.optimize(params as any),
    },

    context_predict: {
      name: 'context_predict',
      description: 'Predict context needs for remaining tasks',
      inputSchema: {
        type: 'object',
        properties: {
          session_id: { type: 'string' },
          planned_tasks: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['session_id'],
      },
      handler: async (params) => contextMonitor.predict(params as any),
    },

    reality_check: {
      name: 'reality_check',
      description: 'Perform reality check on current state',
      inputSchema: {
        type: 'object',
        properties: {
          session_id: { type: 'string' },
          check_type: {
            type: 'string',
            enum: ['comprehensive', 'quick', 'specific'],
          },
          focus_areas: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['session_id', 'check_type'],
      },
      handler: async (params) => realityChecker.performCheck(params as any),
    },

    reality_fix: {
      name: 'reality_fix',
      description: 'Apply fixes for detected discrepancies',
      inputSchema: {
        type: 'object',
        properties: {
          snapshot_id: { type: 'string' },
          fix_ids: {
            type: 'array',
            items: { type: 'string' },
          },
          auto_commit: { type: 'boolean' },
        },
        required: ['snapshot_id', 'fix_ids'],
      },
      handler: async (params) => realityChecker.applyFixes(params as any),
    },

    metric_validate: {
      name: 'metric_validate',
      description: 'Validate reported metrics against reality',
      inputSchema: {
        type: 'object',
        properties: {
          session_id: { type: 'string' },
          reported_metrics: {
            type: 'object',
            additionalProperties: { type: 'number' },
          },
        },
        required: ['session_id', 'reported_metrics'],
      },
      handler: async (params) => realityChecker.validateMetrics(params as any),
    },

    doc_generate: {
      name: 'doc_generate',
      description: 'Generate documentation from session',
      inputSchema: {
        type: 'object',
        properties: {
          session_id: { type: 'string' },
          doc_type: {
            type: 'string',
            enum: ['readme', 'api', 'architecture', 'handoff'],
          },
          include_sections: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['session_id', 'doc_type'],
      },
      handler: async (params) => documentationEngine.generate(params as any),
    },

    doc_update: {
      name: 'doc_update',
      description: 'Update existing documentation to match code',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: { type: 'string' },
          update_type: {
            type: 'string',
            enum: ['sync', 'append', 'restructure'],
          },
          context: { type: 'object' },
        },
        required: ['file_path', 'update_type'],
      },
      handler: async (params) => documentationEngine.update(params as any),
    },

    doc_status: {
      name: 'doc_status',
      description: 'Check documentation synchronization status',
      inputSchema: {
        type: 'object',
        properties: {
          file_paths: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['file_paths'],
      },
      handler: async (params) => documentationEngine.checkStatus(params as any),
    },

    project_track: {
      name: 'project_track',
      description: 'Track project-level metrics and patterns',
      inputSchema: {
        type: 'object',
        properties: {
          project_name: { type: 'string' },
          session_id: { type: 'string' },
        },
        required: ['project_name', 'session_id'],
      },
      handler: async (params) => projectTracker.track(params as any),
    },

    velocity_analyze: {
      name: 'velocity_analyze',
      description: 'Analyze development velocity and trends',
      inputSchema: {
        type: 'object',
        properties: {
          project_id: { type: 'string' },
          time_window: { type: 'number' },
        },
        required: ['project_id'],
      },
      handler: async (params) => projectTracker.analyzeVelocity(params as any),
    },

    blocker_report: {
      name: 'blocker_report',
      description: 'Report a development blocker',
      inputSchema: {
        type: 'object',
        properties: {
          session_id: { type: 'string' },
          type: {
            type: 'string',
            enum: ['technical', 'context', 'external', 'unclear_requirement'],
          },
          description: { type: 'string' },
          impact_score: { type: 'number' },
        },
        required: ['session_id', 'type', 'description', 'impact_score'],
      },
      handler: async (params) => projectTracker.reportBlocker(params as any),
    },

    blocker_resolve: {
      name: 'blocker_resolve',
      description: 'Mark a blocker as resolved',
      inputSchema: {
        type: 'object',
        properties: {
          blocker_id: { type: 'string' },
          resolution: { type: 'string' },
        },
        required: ['blocker_id', 'resolution'],
      },
      handler: async (params) => projectTracker.resolveBlocker(params as any),
    },

    progress_report: {
      name: 'progress_report',
      description: 'Generate progress report for project',
      inputSchema: {
        type: 'object',
        properties: {
          project_id: { type: 'string' },
          time_range: {
            type: 'object',
            properties: {
              start: { type: 'number' },
              end: { type: 'number' },
            },
          },
          include_predictions: { type: 'boolean' },
        },
        required: ['project_id'],
      },
      handler: async (params) => projectTracker.generateReport(params as any),
    },

    quick_action: {
      name: 'quick_action',
      description: 'Execute a predefined quick action',
      inputSchema: {
        type: 'object',
        properties: {
          action_id: { type: 'string' },
          params: { type: 'object' },
        },
        required: ['action_id'],
      },
      handler: async (params) => sessionManager.executeQuickAction(params as any),
    },

    suggest_actions: {
      name: 'suggest_actions',
      description: 'Get AI-suggested actions for current context',
      inputSchema: {
        type: 'object',
        properties: {
          session_id: { type: 'string' },
          limit: { type: 'number' },
        },
        required: ['session_id'],
      },
      handler: async (params) => sessionManager.suggestActions(params as any),
    },

    custom_action: {
      name: 'custom_action',
      description: 'Define a custom action sequence',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          tool_sequence: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                tool: { type: 'string' },
                params: { type: 'object' },
                condition: { type: 'string' },
              },
              required: ['tool', 'params'],
            },
          },
        },
        required: ['name', 'description', 'tool_sequence'],
      },
      handler: async (params) => sessionManager.defineCustomAction(params as any),
    },

    ui_state_update: {
      name: 'ui_state_update',
      description: 'Update UI state preferences',
      inputSchema: {
        type: 'object',
        properties: {
          session_id: { type: 'string' },
          ui_state: {
            type: 'object',
            properties: {
              expanded: { type: 'boolean' },
              refresh_interval: { type: 'number' },
              layout: {
                type: 'string',
                enum: ['card', 'inline', 'minimal'],
              },
            },
          },
        },
        required: ['session_id', 'ui_state'],
      },
      handler: async (params) => sessionManager.updateUIState(params as any),
    },

    ws_connect: {
      name: 'ws_connect',
      description: 'Get WebSocket connection details',
      inputSchema: {
        type: 'object',
        properties: {
          session_id: { type: 'string' },
        },
        required: ['session_id'],
      },
      handler: async (params) => sessionManager.getWebSocketDetails(params as any),
    },

    debug_state: {
      name: 'debug_state',
      description: 'Get complete debug state for troubleshooting',
      inputSchema: {
        type: 'object',
        properties: {
          session_id: { type: 'string' },
          include_sensitive: { type: 'boolean' },
        },
        required: ['session_id'],
      },
      handler: async (params) => sessionManager.getDebugState(params as any),
    },

    health_check: {
      name: 'health_check',
      description: 'Check server health and connectivity',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      handler: async () => ({
        status: 'healthy',
        version: '1.0.0',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      }),
    },

    // Agent-related tools
    agent_run: {
      name: 'agent_run',
      description: 'Run all agents to get suggestions for current context',
      inputSchema: {
        type: 'object',
        properties: {
          session_id: { type: 'string' },
          project_id: { type: 'string' },
          current_phase: { type: 'string' },
          context_usage_percent: { type: 'number' },
        },
        required: ['session_id', 'project_id', 'current_phase', 'context_usage_percent'],
      },
      handler: async (params) => agentManager.runAgents(params as any),
    },

    symbol_register: {
      name: 'symbol_register',
      description: 'Register a new symbol name for consistency',
      inputSchema: {
        type: 'object',
        properties: {
          project_id: { type: 'string' },
          session_id: { type: 'string' },
          concept: { type: 'string' },
          chosen_name: { type: 'string' },
          context_type: { type: 'string' },
        },
        required: ['project_id', 'session_id', 'concept', 'chosen_name', 'context_type'],
      },
      handler: async (params) => agentManager.registerSymbol(params as any),
    },

    symbol_lookup: {
      name: 'symbol_lookup',
      description: 'Get recommended name for a concept',
      inputSchema: {
        type: 'object',
        properties: {
          project_id: { type: 'string' },
          concept: { type: 'string' },
          context_type: { type: 'string' },
        },
        required: ['project_id', 'concept', 'context_type'],
      },
      handler: async (params) => agentManager.getSymbolName(params as any),
    },

    symbol_list: {
      name: 'symbol_list',
      description: 'Get all symbols for a project',
      inputSchema: {
        type: 'object',
        properties: {
          project_id: { type: 'string' },
        },
        required: ['project_id'],
      },
      handler: async (params) => agentManager.getProjectSymbols(params as any),
    },

    agent_status: {
      name: 'agent_status',
      description: 'Get agent system status and statistics',
      inputSchema: {
        type: 'object',
        properties: {
          agent_name: { type: 'string' },
          project_id: { type: 'string' },
        },
      },
      handler: async (params) => agentManager.getAgentStats(params as any),
    },

    agent_toggle: {
      name: 'agent_toggle',
      description: 'Enable or disable agent system',
      inputSchema: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean' },
        },
        required: ['enabled'],
      },
      handler: async (params) => agentManager.setAgentsEnabled(params as any),
    },
  };
}