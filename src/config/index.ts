export interface MCPConfig {
  database: {
    path: string;
    poolSize?: number;
    walMode?: boolean;
  };
  
  websocket: {
    port: number;
    host?: string;
    authToken?: string;
    heartbeatInterval?: number;
    maxConnections?: number;
  };
  
  context: {
    defaultBudget: number;
    warningThreshold: number;
    criticalThreshold: number;
    checkInterval?: number;
  };
  
  paths: {
    projects: string;
    documentation: string;
    logs: string;
    templates?: string;
  };
  
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    file?: string;
    console?: boolean;
    maxFileSize?: number;
    maxFiles?: number;
  };
  
  session: {
    autoCheckpoint?: boolean;
    checkpointInterval?: number;
    maxSessionDuration?: number;
  };
  
  reality: {
    checkInterval?: number;
    autoFix?: boolean;
    discrepancyThreshold?: number;
  };
  
  project: {
    velocityTimeWindow?: number;
    blockerAutoResolveTimeout?: number;
    metricsRetentionDays?: number;
  };
}

export interface ConfigValidationError {
  field: string;
  message: string;
}

export interface ConfigLoader {
  load(): Promise<MCPConfig>;
  validate(config: Partial<MCPConfig>): ConfigValidationError[];
  merge(base: MCPConfig, override: Partial<MCPConfig>): MCPConfig;
}

export { getConfig, resetConfig } from './loader';