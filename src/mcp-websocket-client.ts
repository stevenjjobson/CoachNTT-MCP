#!/usr/bin/env node

import WebSocket from 'ws';
import { createInterface } from 'readline';
import { info, error } from './utils/logger';

/**
 * MCP WebSocket Client Adapter
 * 
 * This adapter allows Claude Code to connect to the CoachNTT-MCP server
 * via WebSocket instead of stdio. It translates between stdio (used by Claude Code)
 * and WebSocket (used by our unified server).
 * 
 * Usage in Claude Code settings:
 * {
 *   "mcpServers": {
 *     "coachntt": {
 *       "command": "node",
 *       "args": ["/path/to/dist/mcp-websocket-client.js"],
 *       "env": {
 *         "MCP_WEBSOCKET_URL": "ws://localhost:8080",
 *         "MCP_AUTH_TOKEN": "your-auth-token"
 *       }
 *     }
 *   }
 * }
 */

interface MCPMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: any;
  result?: any;
  error?: any;
}

class MCPWebSocketClient {
  private ws: WebSocket | null = null;
  private connected = false;
  private pendingRequests = new Map<string | number, (response: any) => void>();
  private rl: any;

  constructor(
    private wsUrl: string = process.env.MCP_WEBSOCKET_URL || 'ws://localhost:8080',
    private authToken: string = process.env.MCP_AUTH_TOKEN || 'myworkflow-secret'
  ) {
    // Set up stdin/stdout for communication with Claude Code
    this.rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });
  }

  async start(): Promise<void> {
    try {
      // Connect to WebSocket server
      await this.connectWebSocket();

      // Set up stdio handlers
      this.setupStdioHandlers();

      // Send server info to Claude Code
      this.sendServerInfo();

    } catch (err) {
      error('Failed to start MCP WebSocket client', { error: err });
      process.exit(1);
    }
  }

  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.on('open', () => {
        info('Connected to WebSocket server', { url: this.wsUrl });
        this.connected = true;

        // Authenticate
        this.ws!.send(JSON.stringify({
          type: 'authenticate',
          auth: this.authToken
        }));

        resolve();
      });

      this.ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleWebSocketMessage(message);
        } catch (err) {
          error('Failed to parse WebSocket message', { error: err });
        }
      });

      this.ws.on('close', () => {
        info('WebSocket connection closed');
        this.connected = false;
        process.exit(0);
      });

      this.ws.on('error', (err) => {
        error('WebSocket error', { error: err });
        reject(err);
      });

      // Set timeout for connection
      setTimeout(() => {
        if (!this.connected) {
          reject(new Error('WebSocket connection timeout'));
        }
      }, 5000);
    });
  }

  private setupStdioHandlers(): void {
    // Handle input from Claude Code
    this.rl.on('line', (line: string) => {
      try {
        const message: MCPMessage = JSON.parse(line);
        this.handleMCPRequest(message);
      } catch (err) {
        error('Failed to parse MCP message from stdin', { error: err, line });
      }
    });

    // Handle process termination
    process.on('SIGINT', () => this.close());
    process.on('SIGTERM', () => this.close());
  }

  private handleMCPRequest(message: MCPMessage): void {
    if (!this.connected || !this.ws) {
      this.sendMCPError(message.id, 'WebSocket not connected');
      return;
    }

    // Map MCP methods to WebSocket tool executions
    switch (message.method) {
      case 'tools/list':
        // Request list of available tools
        this.ws.send(JSON.stringify({
          type: 'execute',
          tool: '_list_tools',
          params: {},
          requestId: message.id
        }));
        break;

      case 'tools/call':
        // Execute a tool
        const { name, arguments: args } = message.params || {};
        this.ws.send(JSON.stringify({
          type: 'execute',
          tool: name,
          params: args || {},
          requestId: message.id
        }));
        break;

      default:
        // For other methods, pass through as-is
        this.ws.send(JSON.stringify({
          type: 'execute',
          tool: '_mcp_method',
          params: {
            method: message.method,
            params: message.params
          },
          requestId: message.id
        }));
    }

    // Store pending request
    if (message.id) {
      this.pendingRequests.set(message.id, (response) => {
        this.sendMCPResponse(message.id!, response);
      });
    }
  }

  private handleWebSocketMessage(message: any): void {
    switch (message.type) {
      case 'auth':
        info('Authentication successful');
        break;

      case 'result':
        // Handle tool execution result
        if (message.requestId && this.pendingRequests.has(message.requestId)) {
          const callback = this.pendingRequests.get(message.requestId)!;
          this.pendingRequests.delete(message.requestId);
          
          if (message.error) {
            callback({ error: message.error });
          } else {
            callback({ result: message.result });
          }
        }
        break;

      case 'error':
        // Handle errors
        if (message.requestId && this.pendingRequests.has(message.requestId)) {
          const callback = this.pendingRequests.get(message.requestId)!;
          this.pendingRequests.delete(message.requestId);
          callback({ error: message.error || 'Unknown error' });
        }
        break;

      case 'event':
        // Forward events as notifications to Claude Code
        this.sendMCPNotification('tool/event', {
          topic: message.topic,
          data: message.data
        });
        break;
    }
  }

  private sendServerInfo(): void {
    // Send initial server information to Claude Code
    const serverInfo: MCPMessage = {
      jsonrpc: '2.0',
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
          logging: {}
        },
        serverInfo: {
          name: 'coachntt-mcp',
          version: '1.0.0'
        }
      }
    };

    this.sendToStdout(serverInfo);
  }

  private sendMCPResponse(id: string | number, response: any): void {
    const message: MCPMessage = {
      jsonrpc: '2.0',
      id,
      ...response
    };

    this.sendToStdout(message);
  }

  private sendMCPError(id: string | number | undefined, error: string): void {
    if (!id) return;

    const message: MCPMessage = {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32603,
        message: error
      }
    };

    this.sendToStdout(message);
  }

  private sendMCPNotification(method: string, params: any): void {
    const message: MCPMessage = {
      jsonrpc: '2.0',
      method,
      params
    };

    this.sendToStdout(message);
  }

  private sendToStdout(message: MCPMessage): void {
    console.log(JSON.stringify(message));
  }

  private close(): void {
    info('Closing MCP WebSocket client...');
    
    if (this.ws) {
      this.ws.close();
    }
    
    this.rl.close();
    process.exit(0);
  }
}

// Main entry point
if (require.main === module) {
  const client = new MCPWebSocketClient();
  client.start().catch((err) => {
    console.error('Failed to start MCP WebSocket client:', err);
    process.exit(1);
  });
}