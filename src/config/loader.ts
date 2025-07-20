import { MCPConfig, ConfigValidationError, ConfigLoader } from './index';
import { DEFAULT_CONFIG } from './defaults';
import { existsSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export class MCPConfigLoader implements ConfigLoader {
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || join(process.cwd(), 'config.json');
  }

  async load(): Promise<MCPConfig> {
    let config = { ...DEFAULT_CONFIG };

    // Load from environment variables
    config = this.loadFromEnv(config);

    // Load from config file if exists
    if (existsSync(this.configPath)) {
      try {
        const fileConfig = JSON.parse(readFileSync(this.configPath, 'utf-8'));
        config = this.merge(config, fileConfig);
      } catch (error) {
        console.error(`Failed to load config from ${this.configPath}:`, error);
      }
    }

    // Validate configuration
    const errors = this.validate(config);
    if (errors.length > 0) {
      throw new Error(`Configuration validation failed: ${JSON.stringify(errors)}`);
    }

    // Ensure directories exist
    this.ensureDirectories(config);

    return config;
  }

  validate(config: Partial<MCPConfig>): ConfigValidationError[] {
    const errors: ConfigValidationError[] = [];

    // Database validation
    if (!config.database?.path) {
      errors.push({ field: 'database.path', message: 'Database path is required' });
    }

    // WebSocket validation
    if (config.websocket) {
      if (config.websocket.port < 1 || config.websocket.port > 65535) {
        errors.push({ field: 'websocket.port', message: 'Port must be between 1 and 65535' });
      }
      if (config.websocket.maxConnections && config.websocket.maxConnections < 1) {
        errors.push({ field: 'websocket.maxConnections', message: 'Max connections must be positive' });
      }
    }

    // Context validation
    if (config.context) {
      if (config.context.defaultBudget < 1000) {
        errors.push({ field: 'context.defaultBudget', message: 'Default budget must be at least 1000' });
      }
      if (config.context.warningThreshold >= config.context.criticalThreshold) {
        errors.push({
          field: 'context.thresholds',
          message: 'Warning threshold must be less than critical threshold',
        });
      }
      if (config.context.warningThreshold < 0 || config.context.warningThreshold > 1) {
        errors.push({
          field: 'context.warningThreshold',
          message: 'Warning threshold must be between 0 and 1',
        });
      }
    }

    // Paths validation
    if (config.paths) {
      const requiredPaths = ['projects', 'documentation', 'logs'];
      for (const path of requiredPaths) {
        if (!config.paths[path as keyof typeof config.paths]) {
          errors.push({ field: `paths.${path}`, message: `${path} path is required` });
        }
      }
    }

    // Logging validation
    if (config.logging) {
      const validLevels = ['debug', 'info', 'warn', 'error'];
      if (!validLevels.includes(config.logging.level)) {
        errors.push({
          field: 'logging.level',
          message: `Level must be one of: ${validLevels.join(', ')}`,
        });
      }
    }

    return errors;
  }

  merge(base: MCPConfig, override: Partial<MCPConfig>): MCPConfig {
    const merged = { ...base };

    // Deep merge each section
    for (const key of Object.keys(override) as Array<keyof MCPConfig>) {
      if (typeof override[key] === 'object' && !Array.isArray(override[key])) {
        merged[key] = { ...base[key], ...override[key] } as any;
      } else {
        merged[key] = override[key] as any;
      }
    }

    return merged;
  }

  private loadFromEnv(config: MCPConfig): MCPConfig {
    const env = process.env;

    // Database
    if (env.MCP_DATABASE_PATH) {
      config.database.path = env.MCP_DATABASE_PATH;
    }
    if (env.MCP_DATABASE_POOL_SIZE) {
      config.database.poolSize = parseInt(env.MCP_DATABASE_POOL_SIZE, 10);
    }

    // WebSocket
    if (env.MCP_WEBSOCKET_PORT) {
      config.websocket.port = parseInt(env.MCP_WEBSOCKET_PORT, 10);
    }
    if (env.MCP_WEBSOCKET_HOST) {
      config.websocket.host = env.MCP_WEBSOCKET_HOST;
    }
    if (env.MCP_WEBSOCKET_AUTH) {
      config.websocket.authToken = env.MCP_WEBSOCKET_AUTH;
    }

    // Context
    if (env.MCP_CONTEXT_BUDGET) {
      config.context.defaultBudget = parseInt(env.MCP_CONTEXT_BUDGET, 10);
    }
    if (env.MCP_CONTEXT_WARNING) {
      config.context.warningThreshold = parseFloat(env.MCP_CONTEXT_WARNING);
    }
    if (env.MCP_CONTEXT_CRITICAL) {
      config.context.criticalThreshold = parseFloat(env.MCP_CONTEXT_CRITICAL);
    }

    // Paths
    if (env.MCP_PROJECTS_PATH) {
      config.paths.projects = env.MCP_PROJECTS_PATH;
    }
    if (env.MCP_DOCS_PATH) {
      config.paths.documentation = env.MCP_DOCS_PATH;
    }
    if (env.MCP_LOGS_PATH) {
      config.paths.logs = env.MCP_LOGS_PATH;
    }

    // Logging
    if (env.MCP_LOG_LEVEL) {
      config.logging.level = env.MCP_LOG_LEVEL as any;
    }
    if (env.MCP_LOG_FILE) {
      config.logging.file = env.MCP_LOG_FILE;
    }

    return config;
  }

  private ensureDirectories(config: MCPConfig): void {
    const dirs = [
      config.paths.projects,
      config.paths.documentation,
      config.paths.logs,
      config.paths.templates,
    ].filter((path): path is string => Boolean(path));

    for (const dir of dirs) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }

    // Ensure database directory exists
    const dbDir = join(config.database.path, '..');
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }
  }
}

// Singleton instance
let configInstance: MCPConfig | null = null;

export async function getConfig(): Promise<MCPConfig> {
  if (!configInstance) {
    const loader = new MCPConfigLoader();
    configInstance = await loader.load();
  }
  return configInstance;
}

export function resetConfig(): void {
  configInstance = null;
}

export { MCPConfig, ConfigValidationError, ConfigLoader };