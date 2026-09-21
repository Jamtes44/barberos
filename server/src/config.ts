import 'dotenv/config';
import type { SignOptions } from 'jsonwebtoken';

const isProduction = process.env.NODE_ENV === 'production';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name}`);
  return v;
}

const port = parseInt(process.env.PORT || '4000', 10);

const jwtExpiresIn = (process.env.JWT_EXPIRES_IN || '30d') as SignOptions['expiresIn'];

function expiresSeconds(exp: string): number {
  const match = /^(\d+)([smhd])$/.exec(exp);
  if (!match) return 30 * 86400;
  const units: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return Number(match[1]) * (units[match[2]] || 86400);
}

/**
 * Configuración endurecida:
 * - En producción se exige JWT_SECRET y DATABASE_URL (sin fallbacks ni secretos de desarrollo).
 * - CORS estricto vía CORS_ORIGIN (coma-separado); sin valor ⇒ solo mismo origen + localhost de dev.
 * - SSL de BD activado en producción o si la URL trae sslmode (desactivable con PGSSL=0).
 */
export const config = {
  isProduction,
  port,
  databaseUrl: isProduction
    ? required('DATABASE_URL')
    : process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/barberos',
  jwtSecret: isProduction
    ? required('JWT_SECRET')
    : process.env.JWT_SECRET || 'barberos-dev-secret-change-me',
  jwtExpiresIn,
  jwtExpiresSeconds: expiresSeconds(String(jwtExpiresIn)),
  sessionCookieName: 'barberos_session',
  googleGeminiApiKey: process.env.GEMINI_API_KEY || null,
  allowedOrigins: (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  trustProxy: process.env.TRUST_PROXY !== undefined ? process.env.TRUST_PROXY === 'true' : isProduction,
  dbSsl:
    process.env.PGSSL === '0'
      ? undefined
      : /sslmode=/.test(process.env.DATABASE_URL || '') || isProduction
        ? { rejectUnauthorized: process.env.PG_REJECT_UNAUTHORIZED !== '0' }
        : undefined,
};

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name}`);
  return v;
}