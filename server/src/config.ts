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
 * - SSL de BD activado en producción o si la URL trae sslmode. Verificación de certificado:
 *   estricta por defecto, salvo para pooler.supabase.com (propio CA); override con PG_REJECT_UNAUTHORIZED=1/0.
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
// Pasarela Wompi (miembros de la barbería). Sin estas llaves el cobro queda
// "no configurado": el frontend lo informa y se puede probar con TEST_PAYMENT_SECRET.
wompi: {
env: (process.env.WOMPI_ENV || 'sandbox') as 'sandbox' | 'production',
publicKey: process.env.WOMPI_PUBLIC_KEY || null,
privateKey: process.env.WOMPI_PRIVATE_KEY || null,
eventsSecret: process.env.WOMPI_EVENTS_KEY || null,
},
// Recordatorios de membresía por WhatsApp (Meta Cloud API o gateway)
whatsapp: {
provider: (process.env.WHATSAPP_PROVIDER || '') as 'meta' | 'gateway' | '',
token: process.env.WHATSAPP_TOKEN || null,
phoneId: process.env.WHATSAPP_PHONE_ID || null,
apiUrl: process.env.WHATSAPP_API_URL || null,
authToken: process.env.WHATSAPP_AUTH_TOKEN || null,
},
appBaseUrl: process.env.APP_BASE_URL || '',
testPaymentSecret: process.env.TEST_PAYMENT_SECRET || null,
  trustProxy: process.env.TRUST_PROXY !== undefined ? process.env.TRUST_PROXY === 'true' : isProduction,
  dbSsl:
    process.env.PGSSL === '0'
      ? undefined
      : /sslmode=/.test(process.env.DATABASE_URL || '') || isProduction
        ? {
            // El pooler de Supabase presenta un certificado emitido por su propio CA
            // (no es una CA pública). Con él la verificación estricta falla con
            // "self-signed certificate in certificate chain". Por defecto se omite la
            // verificación de cadena solo para pooler.supabase.com; se puede forzar
            // con PG_REJECT_UNAUTHORIZED=1/0.
            rejectUnauthorized: (() => {
              const override = process.env.PG_REJECT_UNAUTHORIZED;
              if (override !== undefined) return override !== '0';
              return !/pooler\.supabase\.com/.test(process.env.DATABASE_URL || '');
            })(),
          }
        : undefined,
};

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name}`);
  return v;
}