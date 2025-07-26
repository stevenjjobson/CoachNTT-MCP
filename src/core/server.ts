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
import { AgentManager } from '../managers/AgentManager';
import { createToolRegistry } from './tools';
import { WebSocketBroadcaster } from '../utils/websocket-broadcaster';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export class MyWorkFlowServer {
  private server: Server;
  private tools: ToolRegistry;
  private sessionManager: SessionManager;
  private contextMonitor: ContextMonitor;
  private realityChecker: RealityChecker;
  private documentationEngine: DocumentationEngine;
  private projectTracker: ProjectTracker;
  private agentManager: AgentManager;
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
    this.agentManager = new AgentManager();
    this.wsBroadcaster = WebSocketBroadcaster.getInstance();

    this.tools = createToolRegistry({
      sessionManager: this.sessionManager,
      contextMonitor: this.contextMonitor,
      realityChecker: this.realityChecker,
      documentationEngine: this.documentationEngine,
      projectTracker: this.projectTracker,
      agentManager: this.agentManager,
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
    
    // Display welcome message
    console.error('MyWorkFlow MCP Server started');
    console.error('');
    
    // Try to read and display WELCOME.md
    try {
      const welcomePath = join(__dirname, '..', '..', 'WELCOME.md');
      if (existsSync(welcomePath)) {
        const welcomeContent = readFileSync(welcomePath, 'utf-8');
        // Display key sections from WELCOME.md
        const lines = welcomeContent.split('\n');
        let inQuickStart = false;
        
        console.error('═══════════════════════════════════════════════════════════════');
        console.error('🚀 Welcome to CoachNTT-MCP!');
        console.error('═══════════════════════════════════════════════════════════════');
        console.error('');
        console.error('📊 To view the UI Dashboard:');
        console.error('   1. Open a WSL terminal');
        console.error('   2. cd /mnt/c/Users/Steve/OneDrive/Documents/Development/CoachNTT-MCP');
        console.error('   3. Run: ./scripts/start-ui.sh');
        console.error('   4. Open: http://localhost:5173');
        console.error('');
        console.error('✨ New Features (Session 17):');
        console.error('   • Real-time agent suggestions');
        console.error('   • Accept/reject recommendations');
        console.error('   • Priority-based display');
        console.error('');
        console.error('🛠️  Available MCP Tools:');
        console.error('   • session_start - Begin coding session');
        console.error('   • agent_run - Get AI suggestions');
        console.error('   • checkpoint_create - Save progress');
        console.error('   • context_status - Check token usage');
        console.error('');
        console.error('💡 Tip: Run "agent_run" to see AI suggestions in the UI!');
        console.error('═══════════════════════════════════════════════════════════════');
        console.error('');
      }
    } catch (error) {
      // If welcome file can't be read, just show basic message
      console.error('To view the UI dashboard, run: ./scripts/start-ui.sh');
    }
  }
}