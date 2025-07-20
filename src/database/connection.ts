import Database from 'better-sqlite3';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { DATABASE_SCHEMA } from './schema';

export class DatabaseConnection {
  private db: Database.Database;
  private static instance: DatabaseConnection;

  private constructor() {
    const dbDir = join(process.cwd(), 'data');
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    const dbPath = join(dbDir, 'myworkflow.db');
    this.db = new Database(dbPath);
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('journal_mode = WAL');
    
    this.initialize();
  }

  static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  private initialize(): void {
    this.db.exec(DATABASE_SCHEMA);
  }

  getDatabase(): Database.Database {
    return this.db;
  }

  close(): void {
    this.db.close();
  }

  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  prepare(sql: string): Database.Statement {
    return this.db.prepare(sql);
  }

  run(sql: string, params?: unknown): Database.RunResult {
    const stmt = this.db.prepare(sql);
    return params ? stmt.run(params) : stmt.run();
  }

  get<T = unknown>(sql: string, params?: unknown): T | undefined {
    const stmt = this.db.prepare(sql);
    return (params ? stmt.get(params) : stmt.get()) as T | undefined;
  }

  all<T = unknown>(sql: string, params?: unknown): T[] {
    const stmt = this.db.prepare(sql);
    return (params ? stmt.all(params) : stmt.all()) as T[];
  }
}