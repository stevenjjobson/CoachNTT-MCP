import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import { ToolRegistry } from '../interfaces/tools';
import { SessionManager } from '../managers/SessionManager';
import { ContextMonitor } from '../managers/ContextMonitor';
import { RealityChecker } from '../managers/RealityChecker';
import { DocumentationEngine } from '../managers/DocumentationEngine';
import { ProjectTracker } from '../managers/ProjectTracker';
import { createToolRegistry } from './tools';
import { WebSocketBroadcaster } from '../utils/websocket-broadcaster';

export class MyWorkFlowServer {
  private server: Server;
  private tools: ToolRegistry;
  private sessionManager: SessionManager;
  private contextMonitor: ContextMonitor;
  private realityChecker: RealityChecker;
  private documentationEngine: DocumentationEngine;
  private projectTracker: ProjectTracker;
  private wsBroadcaster: WebSocketBroadcaster;

  constructor() {
    this.server = new Server(
      {
        name: 'myworkflow-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.sessionManager = new SessionManager();
    this.contextMonitor = new ContextMonitor();
    this.realityChecker = new RealityChecker();
    this.documentationEngine = new DocumentationEngine();
    this.projectTracker = new ProjectTracker();
    this.wsBroadcaster = WebSocketBroadcaster.getInstance();

    this.tools = createToolRegistry({
      sessionManager: this.sessionManager,
      contextMonitor: this.contextMonitor,
      realityChecker: this.realityChecker,
      documentationEngine: this.documentationEngine,
      projectTracker: this.projectTracker,
    });

    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: Object.values(this.tools).map(({ handler, ...tool }) => tool as Tool),
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      const tool = this.tools[name];
      if (!tool) {
        throw new Error(`Tool "${name}" not found`);
      }

      try {
        const result = await tool.handler(args);
        
        // Broadcast the tool execution to WebSocket
        this.wsBroadcaster.broadcastToolExecution(name, args, result);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        // Broadcast the error too
        this.wsBroadcaster.broadcastToolExecution(name, args, null, error);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: error instanceof Error ? error.message : 'Unknown error',
              }),
            },
          ],
          isError: true,
        };
      }
    });
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('MyWorkFlow MCP Server started');
  }
}