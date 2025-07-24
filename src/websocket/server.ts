import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { SessionManager } from '../managers/SessionManager';
import { ContextMonitor } from '../managers/ContextMonitor';
import { RealityChecker } from '../managers/RealityChecker';
import { ProjectTracker } from '../managers/ProjectTracker';
import { DocumentationEngine } from '../managers/DocumentationEngine';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
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
    
    // Forward tool execution events to all authenticated clients
    this.toolHandler.on('tool:execution', (event) => {
      this.broadcast('tool:execution', event);
    });

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
          console.log(`Client ${client.id} subscribing to topic: ${message.topic}`);
          this.handleSubscribe(client, message.topic, message.params).catch(err => {
            console.error(`Subscription error for client ${client.id}:`, err);
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
    console.log(`[Auth] Client ${client.id} attempting authentication with token:`, auth);
    const expectedAuth = process.env.MCP_WEBSOCKET_AUTH || 'myworkflow-secret';
    console.log(`[Auth] Expected auth token:`, expectedAuth);
    
    // Simple authentication - in production, implement proper auth
    // Accept both keys for backwards compatibility
    if (auth === 'myworkflow-secret' || auth === 'dev-secret-key-123' || auth === expectedAuth) {
      client.authenticated = true;
      console.log(`[Auth] Client ${client.id} authenticated successfully`);
      this.sendMessage(client, {
        type: 'auth',
        data: { authenticated: true, message: 'Authentication successful' },
      });
    } else {
      console.log(`Client ${client.id} authentication failed with key: ${auth}`);
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
        // Subscribe to session updates
        console.log(`[WebSocket] Client ${client.id} subscribing to session.status observable`);
        subscription = this.managers.session.getCurrentSession().subscribe(session => {
          console.log(`[WebSocket] Observable emitted session update for client ${client.id}:`, {
            hasSession: !!session,
            sessionId: session?.id,
            sessionStatus: session?.status
          });
          this.sendEvent(client, topic, { session });
        });
        
        // Also send current active session immediately
        try {
          const session = await this.managers.session.getActiveSession();
          if (session) {
            this.sendEvent(client, topic, { session });
          }
        } catch (err) {
          console.error(`Failed to get initial session status: ${err}`);
        }
        break;

      case 'context.status':
        subscription = this.managers.context.getContextStatus().subscribe(status => {
          this.sendEvent(client, topic, { status });
        });
        
        // Send current context status immediately
        try {
          const activeSession = await this.managers.session.getActiveSession();
          if (activeSession) {
            const contextStatus = await this.managers.context.getStatus({ 
              session_id: activeSession.id 
            });
            if (contextStatus) {
              this.sendEvent(client, topic, { status: contextStatus });
            }
          }
        } catch (err) {
          console.error(`Failed to get initial context status: ${err}`);
        }
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
        
        // Send current project status immediately
        try {
          const activeSession = await this.managers.session.getActiveSession();
          if (activeSession && activeSession.project_name) {
            // Get the current project directly from database
            const currentProject = await this.managers.project.getCurrentProject(activeSession.project_name);
            
            if (currentProject) {
              this.sendEvent(client, topic, { project: currentProject });
            }
          }
        } catch (err) {
          console.error(`Failed to get initial project status: ${err}`);
        }
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

      case 'tool:execution':
        // Tool execution is event-based, not observable-based
        // Just mark the client as subscribed, events will be broadcast automatically
        console.log(`Client ${client.id} subscribed to tool:execution events`);
        // Store a dummy subscription to track it
        client.subscriptions.set(topic, { unsubscribe: () => {} } as any);
        return;

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
    console.log(`[WebSocket] Sending event to client ${client.id}:`, {
      type: 'event',
      topic,
      data: JSON.stringify(data, null, 2)
    });
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
      console.log(`Tool ${request.tool} executed successfully, broadcasting updates`);
      this.broadcastStateUpdates();
    } catch (error) {
      this.sendMessage(client, {
        type: 'error',
        requestId: request.requestId,
        error: error instanceof Error ? error.message : 'Tool execution failed',
      });
    }
  }
  
  private async broadcastStateUpdates(): Promise<void> {
    // Broadcast updated states to all subscribed clients
    // For session.status, we need to trigger a new emission from the observable
    // since it's a BehaviorSubject that will emit the latest value
    
    this.clients.forEach(client => {
      if (!client.authenticated) return;
      
      // Session status updates - the observable will automatically emit the new value
      // to all subscribers when the session is updated
      if (client.subscriptions.has('session.status')) {
        // The subscription will automatically send the update
        // We just need to ensure the session manager has updated its observable
      }
      
      // For other topics that might not automatically update, we can trigger a refresh
      const topicsToRefresh = [
        'context.status',
        'reality.checks',
        'project.status',
        'project.velocity',
        'documentation.status',
      ];
      
      topicsToRefresh.forEach(topic => {
        if (client.subscriptions.has(topic)) {
          // The observables should automatically emit new values
          // If needed, we could trigger a manual update here
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