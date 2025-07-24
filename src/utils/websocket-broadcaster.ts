import WebSocket from 'ws';

export class WebSocketBroadcaster {
  private static instance: WebSocketBroadcaster | null = null;
  private ws: WebSocket | null = null;
  private url: string;
  private isConnected: boolean = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private requestId: number = 0;

  private constructor(url: string = 'ws://localhost:8080') {
    this.url = url;
    this.connect();
  }

  static getInstance(url?: string): WebSocketBroadcaster {
    if (!WebSocketBroadcaster.instance) {
      WebSocketBroadcaster.instance = new WebSocketBroadcaster(url);
    }
    return WebSocketBroadcaster.instance;
  }

  private connect(): void {
    try {
      this.ws = new WebSocket(this.url);

      this.ws.on('open', () => {
        console.log('[MCP->WS] Connected to WebSocket server');
        this.isConnected = true;
        
        // Authenticate
        this.send({
          type: 'authenticate',
          auth: process.env.MCP_WEBSOCKET_AUTH || 'myworkflow-secret'
        });
      });

      this.ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'auth' && message.data?.authenticated) {
            console.log('[MCP->WS] Authenticated successfully');
          }
        } catch (error) {
          console.error('[MCP->WS] Failed to parse message:', error);
        }
      });

      this.ws.on('close', () => {
        console.log('[MCP->WS] Disconnected from WebSocket server');
        this.isConnected = false;
        this.scheduleReconnect();
      });

      this.ws.on('error', (error) => {
        console.error('[MCP->WS] WebSocket error:', error);
        this.isConnected = false;
      });
    } catch (error) {
      console.error('[MCP->WS] Failed to connect:', error);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      console.log('[MCP->WS] Attempting to reconnect...');
      this.connect();
    }, 5000);
  }

  private send(data: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  // Broadcast a tool execution to the WebSocket server
  broadcastToolExecution(tool: string, params: any, result: any, error?: any): void {
    if (!this.isConnected) {
      console.log('[MCP->WS] Not connected, skipping tool broadcast');
      return;
    }

    const requestId = `mcp-${Date.now()}-${++this.requestId}`;
    
    this.send({
      type: 'execute',
      tool: tool,
      params: params,
      requestId: requestId
    });

    // Log the tool execution
    console.log(`[MCP->WS] Broadcasted tool execution: ${tool}`);
  }

  // Trigger a refresh of specific topics
  triggerRefresh(topics: string[]): void {
    if (!this.isConnected) {
      return;
    }

    // The WebSocket server will handle broadcasting updates to subscribers
    console.log(`[MCP->WS] Triggered refresh for topics:`, topics);
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}