import { DatabaseConnection } from './connection';

interface Migration {
  version: number;
  name: string;
  up: string;
  down?: string;
}

export class MigrationManager {
  private db: DatabaseConnection;
  private migrations: Migration[] = [];

  constructor() {
    this.db = DatabaseConnection.getInstance();
    this.initializeMigrationTable();
  }

  private initializeMigrationTable(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at INTEGER NOT NULL
      )
    `);
  }

  addMigration(migration: Migration): void {
    this.migrations.push(migration);
  }

  async runMigrations(): Promise<void> {
    const appliedMigrations = this.db.all<{ version: number }>(
      'SELECT version FROM migrations ORDER BY version'
    );
    const appliedVersions = new Set(appliedMigrations.map(m => m.version));

    for (const migration of this.migrations.sort((a, b) => a.version - b.version)) {
      if (!appliedVersions.has(migration.version)) {
        console.log(`Running migration ${migration.version}: ${migration.name}`);
        
        this.db.transaction(() => {
          this.db.run(migration.up);
          this.db.run(
            'INSERT INTO migrations (version, name, applied_at) VALUES (?, ?, ?)',
            [migration.version, migration.name, Date.now()]
          );
        });
      }
    }
  }

  async rollback(version: number): Promise<void> {
    const migration = this.migrations.find(m => m.version === version);
    if (!migration || !migration.down) {
      throw new Error(`Cannot rollback migration ${version}`);
    }

    this.db.transaction(() => {
      this.db.run(migration.down!);
      this.db.run('DELETE FROM migrations WHERE version = ?', [version]);
    });
  }
}