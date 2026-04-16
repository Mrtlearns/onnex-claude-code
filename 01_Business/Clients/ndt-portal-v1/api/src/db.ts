import { Pool } from 'pg';

export const pool = new Pool({
  host: process.env.PGHOST ?? 'postgres',
  port: parseInt(process.env.PGPORT ?? '5432'),
  database: process.env.PGDATABASE ?? 'ndtportal',
  user: process.env.PGUSER ?? 'ndtapp',
  password: process.env.PGPASSWORD ?? 'Ndt%40P0rtal2026!',
  max: 10,
  idleTimeoutMillis: 30000,
});

export async function query<T extends object = Record<string, unknown>>(
  sql: string, params?: unknown[]
): Promise<T[]> {
  const res = await pool.query(sql, params);
  return res.rows as T[];
}

export async function queryOne<T extends object = Record<string, unknown>>(
  sql: string, params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}
