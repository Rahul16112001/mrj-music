import 'dotenv/config';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dbClient } from './client.js';

const MIGRATIONS_DIRECTORY = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'migrations',
);

function discoverMigrations() {
  if (!fs.existsSync(MIGRATIONS_DIRECTORY)) {
    throw new Error(`Migration directory not found at ${MIGRATIONS_DIRECTORY}`);
  }

  const sqlFiles = fs.readdirSync(MIGRATIONS_DIRECTORY)
    .filter((fileName) => fileName.toLowerCase().endsWith('.sql'));

  const migrations = sqlFiles.map((fileName) => {
    const match = /^(\d+)[_-].+\.sql$/i.exec(fileName);
    if (!match) {
      throw new Error(
        `Malformed migration filename "${fileName}". Expected <number>_<name>.sql`,
      );
    }

    const number = Number.parseInt(match[1], 10);
    if (!Number.isSafeInteger(number) || number < 1) {
      throw new Error(`Invalid migration number in filename "${fileName}"`);
    }

    const filePath = path.join(MIGRATIONS_DIRECTORY, fileName);
    const sql = fs.readFileSync(filePath, 'utf8').trim();
    if (!sql) {
      throw new Error(`Migration file "${fileName}" is empty`);
    }

    return {
      fileName,
      number,
      sql,
      checksum: crypto.createHash('sha256').update(sql).digest('hex'),
    };
  });

  migrations.sort((left, right) => left.number - right.number || left.fileName.localeCompare(right.fileName));

  for (let index = 1; index < migrations.length; index += 1) {
    const previous = migrations[index - 1];
    const current = migrations[index];
    if (previous.number === current.number) {
      throw new Error(
        `Migration order is broken: duplicate migration number ${current.number} `
        + `(${previous.fileName}, ${current.fileName})`,
      );
    }
    if (current.number !== previous.number + 1) {
      throw new Error(
        `Migration order is broken: expected ${String(previous.number + 1).padStart(3, '0')} `
        + `after ${previous.fileName}, found ${current.fileName}`,
      );
    }
  }

  return migrations;
}

async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      migration_number INT PRIMARY KEY,
      migration_name VARCHAR(255) NOT NULL UNIQUE,
      checksum VARCHAR(64) NOT NULL,
      applied_at BIGINT NOT NULL
    )
  `);
}

async function verifyDatabaseConnection(client) {
  // dbClient has an embedded fallback for application requests. A migration
  // must never report success against that fallback when PostgreSQL is
  // configured, because no schema changes would actually be persisted.
  if (!process.env.DATABASE_URL) return;

  const result = await client.query('SELECT current_database() AS database_name');
  if (!result.rows[0]?.database_name) {
    throw new Error('DATABASE_URL is configured, but PostgreSQL could not be reached');
  }
}

async function applyMigration(client, migration) {
  await client.query('BEGIN');
  try {
    const appliedResult = await client.query(
      'SELECT migration_name, checksum FROM schema_migrations WHERE migration_number = $1',
      [migration.number],
    );

    if (appliedResult.rows.length > 0) {
      const applied = appliedResult.rows[0];
      if (applied.migration_name !== migration.fileName || applied.checksum !== migration.checksum) {
        throw new Error(
          `Applied migration ${migration.number} does not match ${migration.fileName}`,
        );
      }
      await client.query('COMMIT');
      console.log(`⏭️  Skipped ${migration.fileName} (already applied).`);
      return false;
    }

    await client.query(migration.sql);
    await client.query(
      `INSERT INTO schema_migrations
        (migration_number, migration_name, checksum, applied_at)
       VALUES ($1, $2, $3, $4)`,
      [migration.number, migration.fileName, migration.checksum, Date.now()],
    );
    await client.query('COMMIT');
    console.log(`✅ Applied ${migration.fileName}.`);
    return true;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      error.message += `; rollback failed: ${rollbackError.message}`;
    }
    throw new Error(`Migration ${migration.fileName} failed: ${error.message}`, { cause: error });
  }
}

export async function runMigrations() {
  console.log('🔄 Running PostgreSQL Database Migrations...');
  const migrations = discoverMigrations();
  const client = await dbClient.getClient();

  try {
    await verifyDatabaseConnection(client);
    await ensureMigrationTable(client);
    for (const migration of migrations) {
      await applyMigration(client, migration);
    }
    console.log(`✅ Migration run complete (${migrations.length} discovered).`);
  } finally {
    client.release();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Migration failed:', error.message);
      process.exit(1);
    });
}
