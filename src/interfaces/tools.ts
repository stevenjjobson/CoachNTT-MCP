import type { Tool } from '@modelcontextprotocol/sdk/types.js';

export interface ToolDefinition extends Tool {
  handler: (params: unknown) => Promise<unknown>;
}

export interface ToolRegistry {
  [toolName: string]: ToolDefinition;
}

export interface QuickAction {
  id: string;
  name: string;
  description: string;
  tool_sequence: string[];
  parameter_template: Record<string, unknown>;
  keyboard_shortcut?: string;
  ui_group: string;
}

export interface ActionSuggestion {
  action_id: string;
  confidence: number;
  reason: string;
  expected_outcome: string;
}

export interface CustomAction {
  name: string;
  description: string;
  tool_sequence: Array<{
    tool: string;
    params: Record<string, unknown>;
    condition?: string;
  }>;
}