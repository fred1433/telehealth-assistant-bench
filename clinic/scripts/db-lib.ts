import { readFileSync } from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';

const root = path.resolve(__dirname, '..');

/** Drops and recreates every table, then loads the fictional seed. */
export async function resetDatabase(url: string): Promise<void> {
  const conn = await mysql.createConnection({ uri: url, multipleStatements: true, timezone: 'Z' });
  try {
    await conn.query(readFileSync(path.join(root, 'db/schema.sql'), 'utf8'));
    await conn.query(readFileSync(path.join(root, 'db/seed.sql'), 'utf8'));
  } finally {
    await conn.end();
  }
}
