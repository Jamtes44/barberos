// BarberOS · Motor de membresías
// Ciclo: prueba gratis 7 días -> recordatorios diarios desde el día 3 ->
// día 7: si pagó (webhook Wompi) activa 30 días más; si no, se bloquea la cuenta.

import crypto from 'node:crypto';
import { config } from './config.js';
import { query, queryOne } from './db.js';
import type { Request, Response, NextFunction } from 'express';
import { AppError } from './util.js';

export const MEMBERSHIP_PRICE = 35900;
export const MEMBERSHIP_PLAN_ID = 'ilimitado_barberia';
export const MEMBERSHIP_PLAN_NAME = 'Plan Ilimitado Barbería';
export const TRIAL_DAYS = 7;
export const REMINDER_FROM_DAY = 3;

export interface MembershipRow {
  [key: string]: unknown;
  id: string;
  status: 'trial' | 'active' | 'blocked';
  trial_started_at: string | null;
  trial_ends_at: string | null;
  membership_activated_at: string | null;
  membership_expires_at: string | null;
  plan_id: string | null;
  plan_name: string | null;
  plan_price: string | null;
  last_payment_at: string | null;
}

/** Estado calculado y listo para el frontend. */
export interface Membership {
  status: 'trial' | 'active' | 'blocked';
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  trialDays: number;
  reminderFromDay: number;
  daysLeft: number; // días que quedan de prueba (0 si terminó)
  daysSinceStart: number;
  remindersActive: boolean; // día >= 3 y prueba sin vencer
  activeUntil: string | null;
  price: number;
  planId: string;
  planName: string;
  lastPaymentAt: string | null;
  blocked: boolean;
  wompiConfigured: boolean;
  testPayAvailable: boolean;
}

type ShopRow = MembershipRow & {
  name: string;
  phone: string | null;
  owner_email: string | null;
};

/** Lee las columnas de membresía de una barbería. */
export async function getMembershipRow(shopId: string): Promise<MembershipRow | null> {
  return queryOne<MembershipRow>(
    `SELECT id,
            membership_status AS status,
            trial_started_at,
            trial_ends_at,
            membership_activated_at,
            membership_expires_at,
            plan_id,
            plan_name,
            plan_price,
            last_payment_at
     FROM shops WHERE id = $1`,
    [shopId],
  );
}

export async function getMembership(shopId: string): Promise<Membership> {
  const row = await getMembershipRow(shopId);
  const now = Date.now();

  const started = row?.trial_started_at ? new Date(row.trial_started_at).getTime() : null;
  const ends = row?.trial_ends_at ? new Date(row.trial_ends_at).getTime() : null;
  const daysLeft = ends ? Math.max(0, Math.ceil((ends - now) / 86400000)) : 0;
  const daysSinceStart = started ? Math.max(0, Math.floor((now - started) / 86400000)) : 0;

  return {
    status: row?.status ?? 'trial',
    trialStartedAt: row?.trial_started_at ?? null,
    trialEndsAt: row?.trial_ends_at ?? null,
    trialDays: TRIAL_DAYS,
    reminderFromDay: REMINDER_FROM_DAY,
    daysLeft,
    daysSinceStart,
    remindersActive: Boolean(
      row?.status === 'trial' &&
        ends &&
        now >= (started ?? 0) + (REMINDER_FROM_DAY - 1) * 86400000 &&
        now < ends,
    ),
    activeUntil: row?.membership_expires_at ?? null,
    price: row?.plan_price ? Number(row.plan_price) : MEMBERSHIP_PRICE,
    planId: row?.plan_id ?? MEMBERSHIP_PLAN_ID,
    planName: row?.plan_name ?? MEMBERSHIP_PLAN_NAME,
    lastPaymentAt: row?.last_payment_at ?? null,
    blocked: row?.status === 'blocked',
    wompiConfigured: Boolean(config.wompi.publicKey && config.wompi.eventsSecret),
    testPayAvailable: !config.isProduction || Boolean(config.testPaymentSecret),
  };
}

/**
 * Inicia la prueba gratuita de 7 días. Idempotente: si ya fue iniciada o la
 * membresía está activa, no se reinicia.
 */
export async function startTrial(shopId: string): Promise<void> {
  await query(
    `UPDATE shops SET
       membership_status = CASE
         WHEN membership_status = 'active' THEN 'active'
         ELSE 'trial'
       END,
       trial_started_at = COALESCE(trial_started_at, now()),
       trial_ends_at    = COALESCE(trial_ends_at, now() + make_interval(days => $2))
     WHERE id = $1`,
    [shopId, TRIAL_DAYS],
  );
}

/** Activa o renueva la membresía tras un pago aprobado ($35.900 / 30 días). */
export async function activateMembership(shopId: string, paidAt: Date = new Date()): Promise<void> {
  await query(
    `UPDATE shops SET
       membership_status       = 'active',
       membership_activated_at = COALESCE(membership_activated_at, $2),
       membership_expires_at   = GREATEST(COALESCE(membership_expires_at, $2), $2) + interval '30 days',
       plan_id                 = $3,
       plan_name               = $4,
       plan_price              = $5,
       last_payment_at         = $2
     WHERE id = $1`,
    [shopId, paidAt.toISOString(), MEMBERSHIP_PLAN_ID, MEMBERSHIP_PLAN_NAME, MEMBERSHIP_PRICE],
  );
}

const wompiApiBase = () =>
  config.wompi.env === 'production' ? 'https://production.wompi.co' : 'https://sandbox.wompi.co';

/** Prepara el cobro: devuelve referencia y, si Wompi está configurado, los datos del widget.
 *  Nunca lanza: cualquier problema con Wompi se reporta en `error` y el widget decide. */
export async function createWompiCheckout(shopId: string, email: string) {
  const reference = `ref-${shopId}`; // 4 + 36 = 40 chars, máximo permitido por Wompi
  const fallback = (acceptanceToken: string | null, error: string | null = null) => ({
    reference,
    amount: MEMBERSHIP_PRICE,
    currency: 'COP',
    email,
    error,
    wompi: {
      env: config.wompi.env,
      publicKey: config.wompi.publicKey ?? '',
      currency: 'COP',
      amountInCents: MEMBERSHIP_PRICE * 100,
      reference,
      acceptanceToken,
      redirectUrl: `${config.appBaseUrl}/#/wompi_plan?pago=ok`,
    },
  });

  const publicKey = config.wompi.publicKey;
  if (!publicKey) {
    return { reference, amount: MEMBERSHIP_PRICE, currency: 'COP', error: 'no_wompi_keys', wompi: null };
  }

  const fetchImpl = globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    console.error('[membership] checkout: la runtime del servidor no expone fetch (Node >= 18 requerido)');
    return fallback(null, 'runtime_sin_fetch');
  }

  let acceptanceToken: string | null = null;
  try {
    const res = await fetchImpl(`${wompiApiBase()}/v1/merchants/${publicKey}`);
    if (res.ok) {
      const data = (await res.json()) as {
        data?: { presigned_acceptance?: { acceptance_token?: string } };
      };
      acceptanceToken = data.data?.presigned_acceptance?.acceptance_token ?? null;
    } else {
      console.warn(`[membership] checkout: Wompi respondió ${res.status}`);
    }
  } catch (err) {
    console.error('[membership] checkout: error consultando token de aceptación de Wompi:', err);
  }

  return fallback(acceptanceToken);
}

/**
 * Verifica la firma de un evento de Wompi (best-effort con body crudo). Con la
 * clave de eventos configurada se rechaza cualquier firma inválida; sin ella,
 * en desarrollo se acepta para poder probar, en producción se rechaza.
 */
export function verifyWompiSignature(rawBody: string, signature?: unknown): boolean {
  if (!signature) return false;
  const s = signature as { properties?: unknown; checksum?: string };
  const secret = config.wompi.eventsSecret;
  if (!secret) return !config.isProduction;

  const props = Array.isArray(s.properties) ? (s.properties as string[]).join('.') : '';
  const expected = crypto.createHash('sha256').update(`${props}.${rawBody}`).digest('hex');
  return expected === s.checksum;
}

type ReminderTarget = ShopRow & { owner_email: string | null };

/** Envía un mensaje de WhatsApp por el proveedor configurado (Meta o gateway). */
export async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  const wa = config.whatsapp;
  const digits = phone.replace(/[^0-9]/g, '').replace(/^0/, '57');
  if (!digits || digits.length < 10) return false;

  try {
    if (wa.provider === 'meta' && wa.phoneId && wa.token) {
      const res = await fetch(`https://graph.facebook.com/v21.0/${wa.phoneId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${wa.token}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: digits,
          type: 'text',
          text: { body: message, preview_url: true },
        }),
      });
      return res.ok;
    }
    if (wa.provider === 'gateway' && wa.apiUrl) {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (wa.authToken) headers.Authorization = `Bearer ${wa.authToken}`;
      const res = await fetch(wa.apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ number: digits, message }),
      });
      return res.ok;
    }
  } catch {
    return false;
  }
  return false;
}

function reminderText(shop: ReminderTarget): string {
  const row = shop.trial_ends_at ? new Date(shop.trial_ends_at).getTime() : Date.now();
  const daysLeft = Math.max(0, Math.ceil((row - Date.now()) / 86400000));
  const payUrl = `${config.appBaseUrl}/#/wompi_plan?pago=ok`;
  return [
    `Hola 👋 ${shop.name}`,
    '',
    `Tu *prueba gratis de 7 días* está por terminar (quedan ${daysLeft === 0 ? 'hoy' : daysLeft + (daysLeft === 1 ? ' día' : ' días')}).`,
    '',
    `Activa tu *${MEMBERSHIP_PLAN_NAME}* por solo *$35.900/mes* y no pierdas acceso a tu sistema:`,
    payUrl,
    '',
    'BarberOS 🪒 El sistema operativo de tu barbería',
  ].join('\n');
}

/** Ejecuta la lógica de expiración + recordatorios. Se llama al arrancar y en el cron. */
export async function runMembershipEngine(): Promise<{
  reviewed: number;
  blocked: number;
  reminded: number;
}> {
  // 1) Pruebas vencidas sin pago -> cuenta bloqueada
  const expiredTrials = await queryOne<{ total: number }>(
    `SELECT COUNT(*)::int AS total FROM shops
     WHERE membership_status = 'trial'
       AND trial_ends_at IS NOT NULL
       AND trial_ends_at <= now()`,
  );
  await query(
    `UPDATE shops SET membership_status = 'blocked'
     WHERE membership_status = 'trial'
       AND trial_ends_at IS NOT NULL
       AND trial_ends_at <= now()`,
  );
  // 2) Membresías activas vencidas -> cuenta bloqueada
  const expiredActive = await queryOne<{ total: number }>(
    `SELECT COUNT(*)::int AS total FROM shops
     WHERE membership_status = 'active'
       AND membership_expires_at IS NOT NULL
       AND membership_expires_at <= now()`,
  );
  await query(
    `UPDATE shops SET membership_status = 'blocked'
     WHERE membership_status = 'active'
       AND membership_expires_at IS NOT NULL
       AND membership_expires_at <= now()`,
  );

  const blocked = (expiredTrials?.total ?? 0) + (expiredActive?.total ?? 0);
  if (blocked) console.log(`[membership] ${blocked} cuenta(s) bloqueada(s) por vencer`);

  // 3) Recordatorios DIARIOS a partir del día 3 y hasta el día de vencimiento
  const targets = await query<ReminderTarget>(
    `SELECT s.id, s.name, s.phone, s.membership_status AS status,
            s.trial_started_at, s.trial_ends_at,
            s.membership_activated_at, s.membership_expires_at,
            s.plan_id, s.plan_name, s.plan_price, s.last_payment_at,
            o.email AS owner_email
     FROM shops s
     LEFT JOIN users o ON o.id = s.owner_id
     WHERE s.membership_status = 'trial'
       AND s.trial_started_at IS NOT NULL
       AND s.trial_ends_at   IS NOT NULL
       AND now() >= s.trial_started_at + make_interval(days => $1)
       AND now() <  s.trial_ends_at
       AND (s.last_reminder_at IS NULL OR
            (s.last_reminder_at AT TIME ZONE 'America/Bogota')::date <
            (now() AT TIME ZONE 'America/Bogota')::date)`,
    [REMINDER_FROM_DAY - 1],
  );

  let reminded = 0;
  for (const shop of targets) {
    const phone = shop.phone || shop.owner_email || null;
    const message = reminderText(shop);
    const sent = phone ? await sendWhatsApp(phone, message) : false;
    if (sent) {
      reminded += 1;
      await query(
        `UPDATE shops SET last_reminder_at = now() WHERE id = $1`,
        [shop.id],
      );
      await query(
        `INSERT INTO membership_reminders (shop_id, shop_name, owner_phone, owner_email, type)
         VALUES ($1, $2, $3, $4, 'trial_reminder')`,
        [shop.id, shop.name, phone, shop.owner_email],
      );
    }
  }

  if (targets.length && !reminded) {
    console.warn(
      `[membership] ${targets.length} recordatorio(s) pendiente(s): configura WHATSAPP_PROVIDER para enviarlos (se omitieron sin reenviar).`,
    );
  } else if (reminded) {
    console.log(`[membership] enviados ${reminded} recordatorio(s) de membresía`);
  }

  return { reviewed: targets.length, blocked, reminded };
}

let engineTimer: NodeJS.Timeout | null = null;

/** Arranca el scheduler (cada 30 min + una pasada inicial). Idempotente. */
export function startMembershipScheduler(): void {
  if (engineTimer) return;
  const tick = () => runMembershipEngine().catch((err) => console.error('[membership]', err));
  tick();
  engineTimer = setInterval(tick, 30 * 60 * 1000);
  engineTimer.unref?.();
}

/** Middleware: bloquea solicitudes de datos de barberías con membresía vencida. */
export async function requireMemberActive(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user?.shopId) return next();
    const row = await queryOne<{ membership_status: string }>(
      `SELECT membership_status FROM shops WHERE id = $1`,
      [req.user.shopId],
    );
    if (row?.membership_status === 'blocked') {
      return next(
        new AppError(402, 'Membresía vencida: paga $35.900 para reactivar tu cuenta'),
      );
    }
    next();
  } catch (err) {
    next(err);
  }
}