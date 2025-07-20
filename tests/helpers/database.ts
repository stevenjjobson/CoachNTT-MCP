import Database from 'better-sqlite3';
import { join } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { DATABASE_SCHEMA } from '../../src/database/schema';
import { DatabaseConnection } from '../../src/database/connection';

export function setupTestDatabase(): void {
  // First cleanup any existing database
  cleanupTestDatabase();
  
  // Create test data directory
  const testDbDir = join(process.cwd(), 'test-data');
  if (!existsSync(testDbDir)) {
    mkdirSync(testDbDir, { recursive: true });
  }
  
  const testDbPath = join(testDbDir, 'test.db');
  
  // Override the getInstance method to use test database
  const originalGetInstance = DatabaseConnection.getInstance;
  (DatabaseConnection as any).getInstance = function() {
    if (!(DatabaseConnection as any).instance) {
      const db = new Database(testDbPath);
      db.pragma('foreign_keys = ON');
      db.pragma('journal_mode = DELETE'); // Use DELETE mode for tests to avoid locking
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
  try {
    // Close database connection first
    const instance = (DatabaseConnection as any).instance;
    if (instance && instance.db) {
      instance.db.close();
    }
  } catch (error) {
    // Ignore errors during close
  }
  
  // Reset the singleton
  (DatabaseConnection as any).resetInstance();
  
  // Clean up test database files
  const testDbDir = join(process.cwd(), 'test-data');
  if (existsSync(testDbDir)) {
    try {
      // Try to remove database files individually
      const testDbPath = join(testDbDir, 'test.db');
      ['', '-shm', '-wal', '-journal'].forEach(suffix => {
        const file = testDbPath + suffix;
        if (existsSync(file)) {
          try {
            rmSync(file, { force: true });
          } catch (e) {
            // Ignore individual file errors
          }
        }
      });
      
      // Try to remove directory
      try {
        rmSync(testDbDir, { recursive: true, force: true });
      } catch (e) {
        // Directory might not be empty yet, that's okay
      }
    } catch (error) {
      // If deletion fails, it's okay - we'll overwrite on next run
    }
  }
}