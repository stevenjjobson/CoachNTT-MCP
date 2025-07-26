import { createServer, IncomingMessage, ServerResponse } from 'http';
import { getConfig, MCPConfig } from './config';
import { DatabaseConnection } from './database';
import { MyWorkFlowWebSocketServer } from './websocket/server';
import { MyWorkFlowServer } from './core/server';
import { Logger, info, error, warn } from './utils/logger';
import { existsSync } from 'fs';
import { MCPWebSocketBridge } from './mcp-websocket-bridge';

/**
 * Unified server that runs both MCP and WebSocket services in a single process.
 * This is the primary entry point for Docker deployment.
 */
export class UnifiedServer {
  private config!: MCPConfig;
  private httpServer!: ReturnType<typeof createServer>;
  private wsServer!: MyWorkFlowWebSocketServer;
  private mcpServer!: MyWorkFlowServer;
  private mcpBridge!: MCPWebSocketBridge;
  private logger!: Logger;
  private isShuttingDown = false;

  async initialize(): Promise<void> {
    try {
      // Load configuration
      this.config = await getConfig();
      
      // Initialize logger
      this.logger = Logger.getInstance(
        this.config.logging.level,
        this.config.logging.file,
        this.config.logging.console
      );
      
      info('Initializing Unified CoachNTT-MCP Server...', { 
        version: '1.0.0',
        node: process.version,
        mode: 'unified'
      });

      // Initialize database
      info('Connecting to database...', { path: this.config.database.path });
      const db = DatabaseConnection.getInstance();
      
      // Verify database connection
      try {
        db.get('SELECT 1');
        info('Database connection established');
      } catch (err) {
        throw new Error(`Database connection failed: ${err}`);
      }

      // Initialize MCP Server (but don't start stdio transport)
      info('Initializing MCP server components...');
      this.mcpServer = new MyWorkFlowServer();
      
      // Create HTTP server for health checks
      this.httpServer = createServer((req, res) => this.handleHttpRequest(req, res));
      
      // Start health check server
      const healthPort = this.config.websocket.port + 1;
      this.httpServer.listen(healthPort, () => {
        info(`Health check endpoint available at http://localhost:${healthPort}/health`);
      });

      // Initialize WebSocket server
      info('Starting WebSocket server...', { 
        port: this.config.websocket.port,
        host: this.config.websocket.host 
      });
      
      this.wsServer = new MyWorkFlowWebSocketServer(this.config.websocket.port);

      // Initialize MCP-WebSocket bridge
      info('Initializing MCP-WebSocket bridge...');
      this.mcpBridge = new MCPWebSocketBridge(this.mcpServer, this.wsServer);
      await this.mcpBridge.initialize();

      // Setup graceful shutdown
      this.setupShutdownHandlers();

      info('Unified CoachNTT-MCP Server initialized successfully', {
        websocketPort: this.config.websocket.port,
        healthPort,
        contextBudget: this.config.context.defaultBudget,
        mode: 'Docker/Unified',
        features: ['MCP Tools', 'WebSocket API', 'UI Dashboard', 'Health Checks']
      });
    } catch (err) {
      error('Failed to initialize unified server', { error: err });
      throw err;
    }
  }

  private handleHttpRequest(req: IncomingMessage, res: ServerResponse): void {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Content-Type', 'application/json');

    if (req.url === '/health' && req.method === 'GET') {
      const health = this.getHealthStatus();
      const statusCode = health.status === 'healthy' ? 200 : 503;
      
      res.statusCode = statusCode;
      res.end(JSON.stringify(health, null, 2));
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  }

  private getHealthStatus(): any {
    const status = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      mode: 'unified',
      uptime: process.uptime(),
      checks: {
        database: 'unknown',
        websocket: 'unknown',
        mcpBridge: 'unknown',
        filesystem: 'unknown',
      },
    };

    // Check database
    try {
      const db = DatabaseConnection.getInstance();
      db.get('SELECT 1');
      status.checks.database = 'healthy';
    } catch (err) {
      status.checks.database = 'unhealthy';
      status.status = 'unhealthy';
    }

    // Check WebSocket server
    if (this.wsServer) {
      status.checks.websocket = 'healthy';
    } else {
      status.checks.websocket = 'unhealthy';
      status.status = 'unhealthy';
    }

    // Check MCP Bridge
    if (this.mcpBridge && this.mcpBridge.isReady()) {
      status.checks.mcpBridge = 'healthy';
    } else {
      status.checks.mcpBridge = 'unhealthy';
      status.status = 'degraded';
    }

    // Check filesystem
    try {
      const paths = [
        this.config.paths.projects,
        this.config.paths.documentation,
        this.config.paths.logs,
      ];
      
      for (const path of paths) {
        if (!existsSync(path)) {
          throw new Error(`Path not found: ${path}`);
        }
      }
      status.checks.filesystem = 'healthy';
    } catch (err) {
      status.checks.filesystem = 'unhealthy';
      status.status = 'degraded';
    }

    return status;
  }

  private setupShutdownHandlers(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;

      warn(`Received ${signal}, starting graceful shutdown...`);

      try {
        // Close MCP bridge first
        if (this.mcpBridge) {
          info('Closing MCP-WebSocket bridge...');
          await this.mcpBridge.close();
        }

        // Close WebSocket server
        if (this.wsServer) {
          info('Closing WebSocket connections...');
          await this.wsServer.close();
        }

        // Close HTTP server
        if (this.httpServer) {
          info('Closing HTTP server...');
          await new Promise<void>((resolve) => {
            this.httpServer.close(() => resolve());
          });
        }

        // Close database connection
        info('Closing database connection...');
        DatabaseConnection.resetInstance();

        info('Graceful shutdown completed');
        process.exit(0);
      } catch (err) {
        error('Error during shutdown', { error: err });
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('uncaughtException', (err) => {
      error('Uncaught exception', { error: err });
      shutdown('uncaughtException');
    });
    process.on('unhandledRejection', (reason, promise) => {
      error('Unhandled rejection', { reason, promise });
      shutdown('unhandledRejection');
    });
  }

  async start(): Promise<void> {
    await this.initialize();
  }
}

// Main entry point
if (require.main === module) {
  const server = new UnifiedServer();
  
  server.start().catch((err) => {
    console.error('Failed to start unified server:', err);
    process.exit(1);
  });
}