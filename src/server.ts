import { createServer, IncomingMessage, ServerResponse } from 'http';
import { getConfig, MCPConfig } from './config';
import { DatabaseConnection } from './database';
import { MyWorkFlowWebSocketServer } from './websocket/server';
import { Logger, info, error, warn } from './utils/logger';
import { existsSync } from 'fs';

export class MCPServer {
  private config!: MCPConfig;
  private httpServer!: ReturnType<typeof createServer>;
  private wsServer!: MyWorkFlowWebSocketServer;
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
      
      info('Initializing MCP Server...', { 
        version: '1.0.0',
        node: process.version 
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

      // Create HTTP server for health checks
      this.httpServer = createServer((req, res) => this.handleHttpRequest(req, res));

      // Initialize WebSocket server
      info('Starting WebSocket server...', { 
        port: this.config.websocket.port,
        host: this.config.websocket.host 
      });
      
      // Note: WebSocketServer is initialized with the HTTP server in its constructor
      // We need to modify the WebSocket server to accept an existing HTTP server
      // For now, we'll start the HTTP server on a different port
      const healthPort = this.config.websocket.port + 1;
      
      this.httpServer.listen(healthPort, () => {
        info(`Health check endpoint available at http://localhost:${healthPort}/health`);
      });

      // Start WebSocket server
      this.wsServer = new MyWorkFlowWebSocketServer(this.config.websocket.port);

      // Setup graceful shutdown
      this.setupShutdownHandlers();

      info('MCP Server initialized successfully', {
        websocketPort: this.config.websocket.port,
        healthPort,
        contextBudget: this.config.context.defaultBudget,
      });
    } catch (err) {
      error('Failed to initialize server', { error: err });
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
      uptime: process.uptime(),
      checks: {
        database: 'unknown',
        websocket: 'unknown',
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
  const server = new MCPServer();
  
  server.start().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}