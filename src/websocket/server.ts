import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { SessionManager } from '../managers/SessionManager';
import { ContextMonitor } from '../managers/ContextMonitor';
import { RealityChecker } from '../managers/RealityChecker';
import { ProjectTracker } from '../managers/ProjectTracker';
import { DocumentationEngine } from '../managers/DocumentationEngine';
import { Subscription } from 'rxjs';
import { ToolExecutionHandler, ToolExecutionRequest } from './handlers';

interface ClientConnection {
  id: string;
  ws: WebSocket;
  subscriptions: Map<string, Subscription>;
  authenticated: boolean;
}

interface WebSocketMessage {
  type: 'subscribe' | 'unsubscribe' | 'authenticate' | 'ping' | 'execute';
  topic?: string;
  auth?: string;
  params?: Record<string, any>;
  tool?: string;
  requestId?: string;
}

interface WebSocketResponse {
  type: 'event' | 'error' | 'auth' | 'pong' | 'result';
  topic?: string;
  data?: any;
  error?: string;
  requestId?: string;
}

export class MyWorkFlowWebSocketServer {
  private wss: WebSocketServer;
  private httpServer: ReturnType<typeof createServer>;
  private clients: Map<string, ClientConnection> = new Map();
  private managers: {
    session: SessionManager;
    context: ContextMonitor;
    reality: RealityChecker;
    project: ProjectTracker;
    documentation: DocumentationEngine;
  };
  private toolHandler: ToolExecutionHandler;

  constructor(port: number = 8080) {
    this.httpServer = createServer();
    this.wss = new WebSocketServer({ server: this.httpServer });
    
    // Initialize managers
    this.managers = {
      session: new SessionManager(),
      context: new ContextMonitor(),
      reality: new RealityChecker(),
      project: new ProjectTracker(),
      documentation: new DocumentationEngine(),
    };
    
    // Initialize tool handler
    this.toolHandler = new ToolExecutionHandler(this.managers);

    this.setupWebSocketHandlers();
    this.httpServer.listen(port, () => {
      console.log(`WebSocket server listening on port ${port}`);
    });
  }

  private setupWebSocketHandlers(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      const clientId = this.generateClientId();
      const client: ClientConnection = {
        id: clientId,
        ws,
        subscriptions: new Map(),
        authenticated: false,
      };

      this.clients.set(clientId, client);
      console.log(`Client ${clientId} connected`);

      // Set up heartbeat
      const heartbeat = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      }, 30000);

      ws.on('message', (data: Buffer) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          this.handleMessage(client, message);
        } catch (error) {
          this.sendError(client, 'Invalid message format');
        }
      });

      ws.on('close', () => {
        console.log(`Client ${clientId} disconnected`);
        this.cleanupClient(clientId);
        clearInterval(heartbeat);
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
        this.cleanupClient(clientId);
      });

      // Send welcome message
      this.sendMessage(client, {
        type: 'auth',
        data: { message: 'Welcome to MyWorkFlow WebSocket Server. Please authenticate.' },
      });
    });
  }

  private handleMessage(client: ClientConnection, message: WebSocketMessage): void {
    switch (message.type) {
      case 'authenticate':
        this.handleAuthentication(client, message.auth);
        break;
      
      case 'subscribe':
        if (!client.authenticated) {
          this.sendError(client, 'Authentication required');
          return;
        }
        if (message.topic) {
          this.handleSubscribe(client, message.topic, message.params).catch(err => {
            this.sendError(client, `Subscription error: ${err.message}`);
          });
        }
        break;
      
      case 'unsubscribe':
        if (message.topic) {
          this.handleUnsubscribe(client, message.topic);
        }
        break;
      
      case 'ping':
        this.sendMessage(client, { type: 'pong' });
        break;
      
      case 'execute':
        if (!client.authenticated) {
          this.sendError(client, 'Authentication required');
          return;
        }
        if (message.tool && message.requestId) {
          this.handleToolExecution(client, {
            tool: message.tool,
            params: message.params || {},
            requestId: message.requestId,
          });
        }
        break;
      
      default:
        this.sendError(client, 'Unknown message type');
    }
  }

  private handleAuthentication(client: ClientConnection, auth?: string): void {
    // Simple authentication - in production, implement proper auth
    if (auth === 'myworkflow-secret') {
      client.authenticated = true;
      this.sendMessage(client, {
        type: 'auth',
        data: { authenticated: true, message: 'Authentication successful' },
      });
    } else {
      this.sendMessage(client, {
        type: 'auth',
        data: { authenticated: false, message: 'Authentication failed' },
      });
    }
  }

  private async handleSubscribe(
    client: ClientConnection,
    topic: string,
    params?: Record<string, any>
  ): Promise<void> {
    // Unsubscribe from existing subscription on same topic
    this.handleUnsubscribe(client, topic);

    let subscription: Subscription | null = null;

    switch (topic) {
      case 'session.status':
        // SessionManager doesn't provide observables yet
        // Send current active session
        try {
          const session = await this.managers.session.getActiveSession();
          this.sendEvent(client, topic, { session });
        } catch (err) {
          this.sendError(client, `Failed to get session status: ${err}`);
        }
        break;

      case 'context.status':
        subscription = this.managers.context.getContextStatus().subscribe(status => {
          this.sendEvent(client, topic, { status });
        });
        break;

      case 'reality.checks':
        subscription = this.managers.reality.getDiscrepancies().subscribe(discrepancies => {
          this.sendEvent(client, topic, { discrepancies });
        });
        break;

      case 'project.status':
        subscription = this.managers.project.getProjectStatus().subscribe(project => {
          this.sendEvent(client, topic, { project });
        });
        break;

      case 'project.velocity':
        subscription = this.managers.project.getVelocityMetrics().subscribe(metrics => {
          this.sendEvent(client, topic, { metrics });
        });
        break;

      case 'documentation.status':
        subscription = this.managers.documentation.getDocumentStatus().subscribe(status => {
          this.sendEvent(client, topic, { status });
        });
        break;

      default:
        this.sendError(client, `Unknown topic: ${topic}`);
        return;
    }

    if (subscription) {
      client.subscriptions.set(topic, subscription);
      console.log(`Client ${client.id} subscribed to ${topic}`);
    }
  }

  private handleUnsubscribe(client: ClientConnection, topic: string): void {
    const subscription = client.subscriptions.get(topic);
    if (subscription) {
      subscription.unsubscribe();
      client.subscriptions.delete(topic);
      console.log(`Client ${client.id} unsubscribed from ${topic}`);
    }
  }

  private sendMessage(client: ClientConnection, response: WebSocketResponse): void {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(response));
    }
  }

  private sendEvent(client: ClientConnection, topic: string, data: any): void {
    this.sendMessage(client, {
      type: 'event',
      topic,
      data,
    });
  }

  private sendError(client: ClientConnection, error: string): void {
    this.sendMessage(client, {
      type: 'error',
      error,
    });
  }

  private cleanupClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      // Unsubscribe from all topics
      client.subscriptions.forEach(subscription => {
        subscription.unsubscribe();
      });
      client.subscriptions.clear();
      this.clients.delete(clientId);
    }
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async handleToolExecution(client: ClientConnection, request: ToolExecutionRequest): Promise<void> {
    try {
      const response = await this.toolHandler.execute(request);
      
      this.sendMessage(client, {
        type: 'result',
        requestId: request.requestId,
        data: response,
      });
      
      // Broadcast state updates after tool execution
      this.broadcastStateUpdates();
    } catch (error) {
      this.sendMessage(client, {
        type: 'error',
        requestId: request.requestId,
        error: error instanceof Error ? error.message : 'Tool execution failed',
      });
    }
  }
  
  private broadcastStateUpdates(): void {
    // Broadcast updated states to all subscribed clients
    const topics = [
      'session.status',
      'context.status',
      'reality.checks',
      'project.status',
      'project.velocity',
      'documentation.status',
    ];
    
    topics.forEach(topic => {
      this.clients.forEach(client => {
        if (client.authenticated && client.subscriptions.has(topic)) {
          // Re-fetch and send updated data
          this.handleSubscribe(client, topic).catch(err => {
            console.error(`Failed to broadcast update for ${topic}:`, err);
          });
        }
      });
    });
  }

  public async close(): Promise<void> {
    // Clean up all clients
    this.clients.forEach((client, id) => {
      this.cleanupClient(id);
      client.ws.close();
    });

    // Close servers
    return new Promise((resolve) => {
      this.wss.close(() => {
        this.httpServer.close(() => {
          resolve();
        });
      });
    });
  }

  // Broadcast method for sending to all authenticated clients
  public broadcast(topic: string, data: any): void {
    this.clients.forEach(client => {
      if (client.authenticated && client.subscriptions.has(topic)) {
        this.sendEvent(client, topic, data);
      }
    });
  }
}