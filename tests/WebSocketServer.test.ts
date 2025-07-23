import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { MyWorkFlowWebSocketServer } from '../src/websocket/server';
import { DatabaseConnection } from '../src/database';
import WebSocket from 'ws';
import { setupTestDatabase, cleanupTestDatabase } from './helpers/database';

// Test helper for WebSocket client
class TestWebSocketClient {
  private ws: WebSocket | null = null;
  private messages: any[] = [];
  private connected = false;

  async connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);
      
      this.ws.on('open', () => {
        this.connected = true;
        resolve();
      });
      
      this.ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.messages.push(message);
        } catch (err) {
          console.error('Failed to parse message:', err);
        }
      });
      
      this.ws.on('error', reject);
      
      this.ws.on('close', () => {
        this.connected = false;
      });
    });
  }

  async authenticate(token: string): Promise<boolean> {
    if (!this.ws || !this.connected) throw new Error('Not connected');
    
    // Clear any existing messages (like welcome message)
    this.clearMessages();
    
    this.send({ type: 'authenticate', auth: token });
    
    // Wait for auth response
    const response = await this.waitForMessage('auth');
    return response.data?.authenticated === true;
  }

  subscribe(topic: string, params?: Record<string, any>): void {
    if (!this.ws || !this.connected) throw new Error('Not connected');
    this.send({ type: 'subscribe', topic, params });
  }

  unsubscribe(topic: string): void {
    if (!this.ws || !this.connected) throw new Error('Not connected');
    this.send({ type: 'unsubscribe', topic });
  }

  ping(): void {
    if (!this.ws || !this.connected) throw new Error('Not connected');
    this.send({ type: 'ping' });
  }

  private send(data: any): void {
    if (!this.ws) return;
    this.ws.send(JSON.stringify(data));
  }

  async waitForMessage(type: string, timeout = 1000): Promise<any> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const message = this.messages.find(m => m.type === type);
      if (message) {
        this.messages = this.messages.filter(m => m !== message);
        return message;
      }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    throw new Error(`Timeout waiting for message type: ${type}`);
  }

  async waitForEvent(topic: string, timeout = 1000): Promise<any> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const event = this.messages.find(m => m.type === 'event' && m.topic === topic);
      if (event) {
        this.messages = this.messages.filter(m => m !== event);
        return event;
      }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    throw new Error(`Timeout waiting for event topic: ${topic}`);
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  getMessages(): any[] {
    return [...this.messages];
  }

  clearMessages(): void {
    this.messages = [];
  }
}

describe('WebSocketServer', () => {
  let wsServer: MyWorkFlowWebSocketServer;
  let testPort = 9999;

  beforeEach(async () => {
    // Setup test database
    setupTestDatabase();
    
    // Create WebSocket server on test port
    wsServer = new MyWorkFlowWebSocketServer(testPort);
    
    // Give server time to start
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterEach(async () => {
    // Close server
    if (wsServer) {
      await wsServer.close();
    }
    
    // Clean up test database
    cleanupTestDatabase();
    
    // Increment port for next test to avoid conflicts
    testPort++;
  });

  describe('Connection Management', () => {
    it('should accept client connections', async () => {
      const client = new TestWebSocketClient();
      await client.connect(`ws://localhost:${testPort}`);
      
      expect(client.isConnected()).toBe(true);
      
      // Should receive welcome message
      const welcomeMsg = await client.waitForMessage('auth');
      expect(welcomeMsg.data.message).toContain('Welcome');
      
      client.disconnect();
    });

    it('should handle multiple client connections', async () => {
      const client1 = new TestWebSocketClient();
      const client2 = new TestWebSocketClient();
      
      await client1.connect(`ws://localhost:${testPort}`);
      await client2.connect(`ws://localhost:${testPort}`);
      
      expect(client1.isConnected()).toBe(true);
      expect(client2.isConnected()).toBe(true);
      
      client1.disconnect();
      client2.disconnect();
    });

    it('should clean up on client disconnect', async () => {
      const client = new TestWebSocketClient();
      await client.connect(`ws://localhost:${testPort}`);
      
      client.disconnect();
      
      // Give server time to clean up
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Server should still be able to accept new connections
      const newClient = new TestWebSocketClient();
      await newClient.connect(`ws://localhost:${testPort}`);
      expect(newClient.isConnected()).toBe(true);
      
      newClient.disconnect();
    });
  });

  describe('Authentication', () => {
    it('should authenticate with correct token', async () => {
      const client = new TestWebSocketClient();
      await client.connect(`ws://localhost:${testPort}`);
      
      const authenticated = await client.authenticate('myworkflow-secret');
      expect(authenticated).toBe(true);
      
      client.disconnect();
    });

    it('should reject invalid authentication', async () => {
      const client = new TestWebSocketClient();
      await client.connect(`ws://localhost:${testPort}`);
      
      const authenticated = await client.authenticate('invalid-token');
      expect(authenticated).toBe(false);
      
      client.disconnect();
    });

    it('should require authentication for subscriptions', async () => {
      const client = new TestWebSocketClient();
      await client.connect(`ws://localhost:${testPort}`);
      
      // Try to subscribe without auth
      client.subscribe('session.status');
      
      const errorMsg = await client.waitForMessage('error');
      expect(errorMsg.error).toContain('Authentication required');
      
      client.disconnect();
    });
  });

  describe('Subscriptions', () => {
    it('should handle session status subscription', async () => {
      const client = new TestWebSocketClient();
      await client.connect(`ws://localhost:${testPort}`);
      await client.authenticate('myworkflow-secret');
      
      client.subscribe('session.status');
      
      // Should receive initial status
      const event = await client.waitForEvent('session.status');
      expect(event.data).toBeDefined();
      
      client.disconnect();
    });

    it('should handle context status subscription', async () => {
      const client = new TestWebSocketClient();
      await client.connect(`ws://localhost:${testPort}`);
      await client.authenticate('myworkflow-secret');
      
      client.subscribe('context.status');
      
      const event = await client.waitForEvent('context.status');
      expect(event.data).toBeDefined();
      
      client.disconnect();
    });

    it('should handle unsubscribe', async () => {
      const client = new TestWebSocketClient();
      await client.connect(`ws://localhost:${testPort}`);
      await client.authenticate('myworkflow-secret');
      
      client.subscribe('session.status');
      await client.waitForEvent('session.status');
      
      // Clear messages and unsubscribe
      client.clearMessages();
      client.unsubscribe('session.status');
      
      // Should not receive more events
      await new Promise(resolve => setTimeout(resolve, 200));
      expect(client.getMessages().filter(m => m.topic === 'session.status')).toHaveLength(0);
      
      client.disconnect();
    });

    it('should reject unknown subscription topics', async () => {
      const client = new TestWebSocketClient();
      await client.connect(`ws://localhost:${testPort}`);
      await client.authenticate('myworkflow-secret');
      
      client.subscribe('invalid.topic');
      
      const errorMsg = await client.waitForMessage('error');
      expect(errorMsg.error).toContain('Unknown topic');
      
      client.disconnect();
    });
  });

  describe('Message Handling', () => {
    it('should respond to ping messages', async () => {
      const client = new TestWebSocketClient();
      await client.connect(`ws://localhost:${testPort}`);
      
      client.ping();
      
      const pongMsg = await client.waitForMessage('pong');
      expect(pongMsg.type).toBe('pong');
      
      client.disconnect();
    });

    it('should handle invalid message format', async () => {
      const client = new TestWebSocketClient();
      await client.connect(`ws://localhost:${testPort}`);
      
      // Send invalid JSON
      const ws = (client as any).ws;
      ws.send('invalid json');
      
      const errorMsg = await client.waitForMessage('error');
      expect(errorMsg.error).toContain('Invalid message format');
      
      client.disconnect();
    });

    it('should handle unknown message types', async () => {
      const client = new TestWebSocketClient();
      await client.connect(`ws://localhost:${testPort}`);
      
      (client as any).send({ type: 'unknown' });
      
      const errorMsg = await client.waitForMessage('error');
      expect(errorMsg.error).toContain('Unknown message type');
      
      client.disconnect();
    });
  });

  describe('Broadcast', () => {
    it('should broadcast to subscribed clients only', async () => {
      const client1 = new TestWebSocketClient();
      const client2 = new TestWebSocketClient();
      
      await client1.connect(`ws://localhost:${testPort}`);
      await client2.connect(`ws://localhost:${testPort}`);
      
      await client1.authenticate('myworkflow-secret');
      await client2.authenticate('myworkflow-secret');
      
      // Only client1 subscribes
      client1.subscribe('project.status');
      await client1.waitForEvent('project.status');
      
      // Clear messages
      client1.clearMessages();
      client2.clearMessages();
      
      // Broadcast
      wsServer.broadcast('project.status', { test: 'data' });
      
      // Only client1 should receive
      const event1 = await client1.waitForEvent('project.status');
      expect(event1.data.test).toBe('data');
      
      // Client2 should not receive
      await new Promise(resolve => setTimeout(resolve, 200));
      const client2Events = client2.getMessages().filter(m => m.topic === 'project.status');
      expect(client2Events).toHaveLength(0);
      
      client1.disconnect();
      client2.disconnect();
    });
  });
});