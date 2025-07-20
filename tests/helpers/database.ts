import Database from 'better-sqlite3';
import { join } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { DATABASE_SCHEMA } from '../../src/database/schema';
import { DatabaseConnection } from '../../src/database/connection';

export function setupTestDatabase(): void {
  // Reset the singleton instance
  (DatabaseConnection as any).resetInstance();
  
  // Create test data directory
  const testDbDir = join(process.cwd(), 'test-data');
  if (!existsSync(testDbDir)) {
    mkdirSync(testDbDir, { recursive: true });
  }
  
  // Remove old test database if exists
  const testDbPath = join(testDbDir, 'test.db');
  if (existsSync(testDbPath)) {
    rmSync(testDbPath);
  }
  if (existsSync(testDbPath + '-shm')) {
    rmSync(testDbPath + '-shm');
  }
  if (existsSync(testDbPath + '-wal')) {
    rmSync(testDbPath + '-wal');
  }
  
  // Override the getInstance method to use test database
  const originalGetInstance = DatabaseConnection.getInstance;
  (DatabaseConnection as any).getInstance = function() {
    if (!(DatabaseConnection as any).instance) {
      const db = new Database(testDbPath);
      db.pragma('foreign_keys = ON');
      db.pragma('journal_mode = WAL');
      db.exec(DATABASE_SCHEMA);
      
      const instance = Object.create(DatabaseConnection.prototype);
      instance.db = db;
      
      // Add all the methods
      instance.getDatabase = () => db;
      instance.close = () => db.close();
      instance.transaction = (fn: any) => db.transaction(fn)();
      instance.prepare = (sql: string) => db.prepare(sql);
      instance.run = (sql: string, ...params: any[]) => {
        const stmt = db.prepare(sql);
        return params.length > 0 ? stmt.run(...params) : stmt.run();
      };
      instance.get = (sql: string, ...params: any[]) => {
        const stmt = db.prepare(sql);
        return params.length > 0 ? stmt.get(...params) : stmt.get();
      };
      instance.all = (sql: string, ...params: any[]) => {
        const stmt = db.prepare(sql);
        return params.length > 0 ? stmt.all(...params) : stmt.all();
      };
      
      (DatabaseConnection as any).instance = instance;
    }
    return (DatabaseConnection as any).instance;
  };
}

export function cleanupTestDatabase(): void {
  // Reset the singleton
  (DatabaseConnection as any).resetInstance();
  
  // Clean up test database files
  const testDbDir = join(process.cwd(), 'test-data');
  if (existsSync(testDbDir)) {
    rmSync(testDbDir, { recursive: true, force: true });
  }
}