import fs from 'fs';
import path from 'path';
import { dbClient } from './client.js';

export async function runMigrations() {
  console.log('🔄 Running PostgreSQL Database Migrations...');
  const migrationPath = path.resolve(process.cwd(), 'server', 'db', 'migrations', '001_initial_schema.sql');

  if (!fs.existsSync(migrationPath)) {
    throw new Error(`Migration file not found at ${migrationPath}`);
  }

  const sql = fs.readFileSync(migrationPath, 'utf-8');
  await dbClient.query(sql);
  console.log('✅ 001_initial_schema.sql executed successfully.');
}

if (process.argv[1] && process.argv[1].endsWith('migrate.js')) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Migration failed:', err.message);
      process.exit(1);
    });
}
