import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: config.dbSsl,
});

export type Row = Record<string, unknown>;

/**
 * Fecha local de la barbería (hora de Colombia, UTC-5 sin DST) como 'YYYY-MM-DD'.
 * El frontend envía siempre fechas locales; las columnas timestamptz se guardan
 * en UTC, por eso las consultas comparan con AT TIME ZONE 'America/Bogota'.
 */
export function localToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
}

export async function query<T extends Row = Row>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await pool.query(text, params);
  return res.rows as T[];
}

export async function queryOne<T extends Row = Row>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Ejecuta server/src/schema.sql (CREATE TABLE IF NOT EXISTS ...).
 * Es idempotente: se puede ejecutar en cada arranque.
 */
export async function initSchema(): Promise<void> {
  const candidates = [
    path.join(__dirname, 'schema.sql'),
    path.resolve(process.cwd(), 'server', 'src', 'schema.sql'),
  ];
  const schemaPath = candidates.find((p) => fs.existsSync(p));
  if (!schemaPath) throw new Error('No se encontró schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(sql);
}

export async function checkDb(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

/** Cuenta la caja por método de pago en una fecha (YYYY-MM-DD, hora local). */
export async function salesSummary(shopId: string, date: string) {
  return query(
    `SELECT payment_method,
            COUNT(*)::int AS count,
            COALESCE(SUM(total), 0)::float8 AS total,
            COALESCE(SUM(tip), 0)::float8 AS tips
     FROM sales
     WHERE shop_id = $1
       AND status = 'completada'
       AND (created_at AT TIME ZONE 'America/Bogota')::date = $2::date
     GROUP BY payment_method`,
    [shopId, date],
  );
}