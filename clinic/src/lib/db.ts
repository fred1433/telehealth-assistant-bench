import mysql from 'mysql2/promise';
import { env } from './env';

let pool: mysql.Pool | undefined;

export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      uri: env.databaseUrl,
      connectionLimit: 5,
      timezone: 'Z',
      multipleStatements: false,
    });
  }
  return pool;
}

/** SELECT helper. Always pass values as params, never interpolate them into the SQL string. */
export async function query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const [rows] = await getPool().query(sql, params);
  return rows as T[];
}

export async function queryOne<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

/** INSERT / UPDATE / DELETE helper. */
export async function execute(sql: string, params: unknown[] = []): Promise<{ affectedRows: number }> {
  const [res] = await getPool().query(sql, params);
  return { affectedRows: (res as mysql.ResultSetHeader).affectedRows };
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
