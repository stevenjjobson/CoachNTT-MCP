import { writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
}

export class Logger {
  private static instance: Logger;
  private logFile?: string;
  private logLevel: LogLevel;
  private console: boolean;

  private readonly levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  private constructor(
    level: LogLevel = 'info',
    logFile?: string,
    console: boolean = true
  ) {
    this.logLevel = level;
    this.logFile = logFile;
    this.console = console;

    if (this.logFile) {
      const dir = dirname(this.logFile);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }
  }

  static getInstance(level?: LogLevel, logFile?: string, console?: boolean): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(level, logFile, console);
    }
    return Logger.instance;
  }

  static resetInstance(): void {
    Logger.instance = undefined as any;
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levelPriority[level] >= this.levelPriority[this.logLevel];
  }

  private formatMessage(entry: LogEntry): string {
    const { timestamp, level, message, context } = entry;
    let formatted = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    if (context && Object.keys(context).length > 0) {
      formatted += ` ${JSON.stringify(context)}`;
    }
    
    return formatted;
  }

  private writeLog(entry: LogEntry): void {
    const formatted = this.formatMessage(entry);

    // Console output
    if (this.console) {
      switch (entry.level) {
        case 'debug':
          console.debug(formatted);
          break;
        case 'info':
          console.log(formatted);
          break;
        case 'warn':
          console.warn(formatted);
          break;
        case 'error':
          console.error(formatted);
          break;
      }
    }

    // File output
    if (this.logFile) {
      try {
        appendFileSync(this.logFile, formatted + '\n', 'utf-8');
      } catch (error) {
        console.error('Failed to write to log file:', error);
      }
    }
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
    };

    this.writeLog(entry);
  }

  debug(message: string, context?: Record<string, any>): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, any>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, any>): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: Record<string, any>): void {
    this.log('error', message, context);
  }

  setLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  getLevel(): LogLevel {
    return this.logLevel;
  }
}

// Convenience functions
export const logger = Logger.getInstance();

export function debug(message: string, context?: Record<string, any>): void {
  logger.debug(message, context);
}

export function info(message: string, context?: Record<string, any>): void {
  logger.info(message, context);
}

export function warn(message: string, context?: Record<string, any>): void {
  logger.warn(message, context);
}

export function error(message: string, context?: Record<string, any>): void {
  logger.error(message, context);
}