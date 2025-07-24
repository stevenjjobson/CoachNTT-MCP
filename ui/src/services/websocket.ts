import { WSMessage } from '../types';

export type MessageHandler = (message: WSMessage) => void;
export type ConnectionHandler = (connected: boolean) => void;

export class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private baseReconnectTimeout: number = 1000; // Start at 1 second
  private maxReconnectTimeout: number = 30000; // Max 30 seconds
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private messageHandlers: Set<MessageHandler> = new Set();
  private connectionHandlers: Set<ConnectionHandler> = new Set();
  private authenticated: boolean = false;
  private pendingRequests: Map<string, { resolve: (value: any) => void; reject: (error: any) => void }> = new Map();
  private reconnectTimer: number | null = null;

  constructor(url: string = 'ws://localhost:8080') {
    this.url = url;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      this.ws = new WebSocket(this.url);
      this.setupEventHandlers();
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.scheduleReconnect();
    }
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.clearReconnectTimer();
      this.notifyConnectionHandlers(true);
      this.authenticate();
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.authenticated = false;
      this.notifyConnectionHandlers(false);
      this.scheduleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };
  }

  private authenticate(): void {
    console.log('[WebSocket] Sending authentication...');
    this.send({
      type: 'authenticate',
      auth: 'myworkflow-secret', // Changed to match server expectation
    });
  }

  private handleMessage(message: WSMessage): void {
    // Only log non-session messages to reduce console spam
    if (message.type !== 'event' || message.topic !== 'session.status') {
      console.log('[WebSocket] Received message:', message);
    }
    if (message.type === 'auth' && message.data?.authenticated) {
      console.log('[WebSocket] Authentication successful!');
      this.authenticated = true;
      this.subscribeToTopics();
    }
    
    // Forward all messages to handlers (including auth messages)
    this.messageHandlers.forEach(handler => handler(message));

    // Handle tool execution results
    if (message.type === 'result' && message.requestId) {
      // Tool results are logged above already
      const pending = this.pendingRequests.get(message.requestId);
      if (pending) {
        this.pendingRequests.delete(message.requestId);
        if (message.data?.success) {
          pending.resolve(message.data.result);
        } else {
          pending.reject(new Error(message.data?.error || 'Tool execution failed'));
        }
        return;
      }
    }

    // Handle errors with request IDs
    if (message.type === 'error' && message.requestId) {
      const pending = this.pendingRequests.get(message.requestId);
      if (pending) {
        this.pendingRequests.delete(message.requestId);
        pending.reject(new Error(message.error || 'Unknown error'));
        return;
      }
    }
  }

  private subscribeToTopics(): void {
    const topics = [
      'session.status',
      'context.status',
      'reality.checks',
      'project.status',
      'suggestions.actions',
      'tool:execution',  // Added tool execution events
    ];

    console.log('[WebSocket] Subscribing to topics:', topics);
    topics.forEach(topic => {
      console.log(`[WebSocket] Sending subscribe request for topic: ${topic}`);
      this.send({
        type: 'subscribe',
        topic,
      });
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    
    // Calculate exponential backoff with jitter
    const backoffTime = Math.min(
      this.baseReconnectTimeout * Math.pow(2, this.reconnectAttempts - 1) + Math.random() * 1000,
      this.maxReconnectTimeout
    );
    
    console.log(`Reconnecting in ${Math.round(backoffTime)}ms... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    this.clearReconnectTimer();
    this.reconnectTimer = window.setTimeout(() => {
      this.connect();
    }, backoffTime);
  }
  
  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  send(data: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[WebSocket] Sending:', data);
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket not connected, cannot send message:', data);
    }
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onConnectionChange(handler: ConnectionHandler): () => void {
    this.connectionHandlers.add(handler);
    return () => this.connectionHandlers.delete(handler);
  }

  private notifyConnectionHandlers(connected: boolean): void {
    this.connectionHandlers.forEach(handler => handler(connected));
  }

  disconnect(): void {
    this.clearReconnectTimer();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  isAuthenticated(): boolean {
    return this.authenticated;
  }

  async executeTool(tool: string, params: Record<string, any>): Promise<any> {
    if (!this.isConnected() || !this.isAuthenticated()) {
      throw new Error('WebSocket not connected or authenticated');
    }

    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });
      
      const message = {
        type: 'execute',
        tool,
        params,
        requestId,
      };
      console.log('[WebSocket] Sending tool execution:', message); // Keep this one for debugging
      this.send(message);
      
      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('Tool execution timeout'));
        }
      }, 30000);
    });
  }
}