import { MyWorkFlowServer } from './core/server';
import { MyWorkFlowWebSocketServer } from './websocket/server';
import { createToolRegistry } from './core/tools';
import { SessionManager } from './managers/SessionManager';
import { ContextMonitor } from './managers/ContextMonitor';
import { RealityChecker } from './managers/RealityChecker';
import { DocumentationEngine } from './managers/DocumentationEngine';
import { ProjectTracker } from './managers/ProjectTracker';
import { AgentManager } from './managers/AgentManager';
import { info, error } from './utils/logger';

/**
 * Bridge between MCP tools and WebSocket server.
 * This allows MCP tools to be called via WebSocket while maintaining
 * the same tool interfaces and behaviors.
 */
export class MCPWebSocketBridge {
  private toolRegistry: any;
  private managers: {
    sessionManager: SessionManager;
    contextMonitor: ContextMonitor;
    realityChecker: RealityChecker;
    documentationEngine: DocumentationEngine;
    projectTracker: ProjectTracker;
    agentManager: AgentManager;
  };
  private ready = false;

  constructor(
    private mcpServer: MyWorkFlowServer,
    private wsServer: MyWorkFlowWebSocketServer
  ) {
    // Initialize shared managers
    this.managers = {
      sessionManager: new SessionManager(),
      contextMonitor: new ContextMonitor(),
      realityChecker: new RealityChecker(),
      documentationEngine: new DocumentationEngine(),
      projectTracker: new ProjectTracker(),
      agentManager: new AgentManager(),
    };
  }

  async initialize(): Promise<void> {
    try {
      info('Initializing MCP-WebSocket bridge...');

      // Create the MCP tool registry
      this.toolRegistry = createToolRegistry(this.managers);

      // Register MCP tools with the WebSocket handler
      this.registerMCPTools();

      // Set up event forwarding from MCP to WebSocket
      this.setupEventForwarding();

      this.ready = true;
      info('MCP-WebSocket bridge initialized successfully', {
        toolCount: Object.keys(this.toolRegistry).length,
        tools: Object.keys(this.toolRegistry)
      });
    } catch (err) {
      error('Failed to initialize MCP-WebSocket bridge', { error: err });
      throw err;
    }
  }

  /**
   * Register all MCP tools with the WebSocket server's tool handler
   */
  private registerMCPTools(): void {
    // Get the WebSocket server's tool handler through a method we'll add
    const wsToolHandler = (this.wsServer as any).getToolHandler();
    
    if (!wsToolHandler) {
      throw new Error('WebSocket server tool handler not available');
    }

    // Register each MCP tool with the WebSocket handler
    for (const [toolName, tool] of Object.entries(this.toolRegistry)) {
      info(`Registering MCP tool: ${toolName}`);
      
      // Add the MCP tool to the WebSocket handler's available tools
      const toolDef = tool as any; // Type assertion since we know the structure
      wsToolHandler.registerTool(toolName, async (params: any) => {
        try {
          // Call the MCP tool handler
          const result = await toolDef.handler(params);
          return result;
        } catch (err) {
          error(`MCP tool ${toolName} execution failed`, { error: err });
          throw err;
        }
      });
    }
  }

  /**
   * Set up event forwarding from MCP managers to WebSocket broadcast
   */
  private setupEventForwarding(): void {
    // Forward session events
    this.managers.sessionManager.getCurrentSession().subscribe((session) => {
      if (session) {
        this.wsServer.broadcast('session:update', session);
      }
    });

    // Forward context monitoring events
    this.managers.contextMonitor.getContextStatus().subscribe((status) => {
      this.wsServer.broadcast('context:status', status);
    });

    // Forward reality check events
    this.managers.realityChecker.getDiscrepancies().subscribe((discrepancies) => {
      this.wsServer.broadcast('reality:discrepancies', discrepancies);
    });

    // Forward project events
    this.managers.projectTracker.getProjectStatus().subscribe((project) => {
      this.wsServer.broadcast('project:status', project);
    });

    // Forward agent suggestions
    // Note: AgentManager broadcasts suggestions directly via WebSocketBroadcaster
    // So we don't need to set up forwarding here - it's already handled internally

    info('Event forwarding established between MCP and WebSocket');
  }

  /**
   * Get the list of available MCP tools for documentation/discovery
   */
  getAvailableTools(): string[] {
    return Object.keys(this.toolRegistry);
  }

  /**
   * Get tool metadata for a specific tool
   */
  getToolMetadata(toolName: string): any {
    const tool = this.toolRegistry[toolName];
    if (!tool) {
      return null;
    }

    return {
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    };
  }

  /**
   * Check if the bridge is ready
   */
  isReady(): boolean {
    return this.ready;
  }

  /**
   * Close the bridge and clean up resources
   */
  async close(): Promise<void> {
    try {
      info('Closing MCP-WebSocket bridge...');
      
      // Clean up any subscriptions or resources
      // The managers will be cleaned up by the unified server
      
      this.ready = false;
      info('MCP-WebSocket bridge closed successfully');
    } catch (err) {
      error('Error closing MCP-WebSocket bridge', { error: err });
      throw err;
    }
  }
}