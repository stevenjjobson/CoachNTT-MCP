import { MCPConfig } from './index';
import { join } from 'path';

export const DEFAULT_CONFIG: MCPConfig = {
  database: {
    path: join(process.cwd(), 'data', 'myworkflow.db'),
    poolSize: 5,
    walMode: true,
  },
  
  websocket: {
    port: parseInt(process.env.MCP_WEBSOCKET_PORT || '8180'),
    host: process.env.MCP_WEBSOCKET_HOST || 'localhost',
    authToken: process.env.MCP_WEBSOCKET_AUTH || 'myworkflow-secret',
    heartbeatInterval: 30000, // 30 seconds
    maxConnections: 100,
  },
  
  context: {
    defaultBudget: 100000,
    warningThreshold: 0.7,
    criticalThreshold: 0.85,
    checkInterval: 60000, // 1 minute
  },
  
  paths: {
    projects: join(process.cwd(), 'projects'),
    documentation: join(process.cwd(), 'docs', 'generated'),
    logs: join(process.cwd(), 'logs'),
    templates: join(process.cwd(), 'templates'),
  },
  
  logging: {
    level: 'info',
    console: true,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
  },
  
  session: {
    autoCheckpoint: true,
    checkpointInterval: 300000, // 5 minutes
    maxSessionDuration: 14400000, // 4 hours
  },
  
  reality: {
    checkInterval: 180000, // 3 minutes
    autoFix: false,
    discrepancyThreshold: 0.8,
  },
  
  project: {
    velocityTimeWindow: 7, // days
    blockerAutoResolveTimeout: 86400000, // 24 hours
    metricsRetentionDays: 30,
  },
};