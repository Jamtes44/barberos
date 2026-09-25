import { Router } from 'express';
import { query, queryOne } from '../db.js';
import { AppError, asyncHandler, requireFields } from '../util.js';
import { requireAuth } from '../middleware/auth.js';
import { requireMemberActive, sendWhatsApp } from '../membership.js';

const router = Router();
router.use(requireAuth);
router.use(requireMemberActive);

const STATUSES = ['pendiente', 'confirmada', 'en_corte', 'finalizado', 'cancelado', 'no_show'];

/** Formatea fecha/hora en hora de Colombia (América/Bogotá). */
function formatAppointmentDate(startAt: string | Date): string {
  const dt = new Date(startAt);
  const fecha = new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(dt);
  const hora = new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(dt);
  return `${fecha} · ${hora}`;
}

/** Confirma por WhatsApp una cita agendada (NO walk-in). Se envía sin bloquear la respuesta. */
function notifyScheduledAppointment(
  payload: Record<string, unknown>,
  phone: string | null,
  shopId: string,
): void {
  if (!phone) return;
  void (async () => {
    try {
      const shop = await queryOne<{ name: string | null }>(
        `SELECT name FROM shops WHERE id = $1`,
        [shopId],
      );
      const shopName = shop?.name ?? 'la barbería';
      const lines = [
        `¡Hola ${payload.client_name}! 👋`,
        '',
        `Te confirmamos tu cita en *${shopName}*:`,
        '',
        `📅 ${formatAppointmentDate(String(payload.start_at))}`,
        payload.service_name ? `💈 ${payload.service_name}` : '',
        '',
        'Te esperamos 🪒 BarberOS',
      ];
      const ok = await sendWhatsApp(phone, lines.filter(Boolean).join('\n'));
      console.log(
        ok
          ? `[whatsapp] cita confirmada enviada a ${phone}`
          : `[whatsapp] envío pendiente/fuera de ventana 24h a ${phone}`,
      );
    } catch (err) {
      console.error('[whatsapp] error enviando confirmación de cita:', err);
    }
  })();
}

function parseDate(d: unknown): string | null {
  if (!d) return null;
  const s = String(d);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/** GET /api/appointments?from=&to=&barberId=&status= */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const from = parseDate(req.query.from);
    const to = parseDate(req.query.to);
    const barberId = req.query.barberId ? String(req.query.barberId) : null;
    const status = req.query.status ? String(req.query.status) : null;

    const conditions = ['a.shop_id = $1'];
    const params: unknown[] = [req.user!.shopId];
    if (from) { conditions.push(`(a.start_at AT TIME ZONE 'America/Bogota')::date >= $${params.length + 1}::date`); params.push(from); }
    if (to) { conditions.push(`(a.start_at AT TIME ZONE 'America/Bogota')::date <= $${params.length + 1}::date`); params.push(to); }
    if (barberId) { conditions.push(`a.barber_id = $${params.length + 1}`); params.push(barberId); }
    if (status) { conditions.push(`a.status = $${params.length + 1}`); params.push(status); }

    const rows = await query(
      `SELECT a.id, a.client_id, a.client_name, a.phone, a.start_at, a.end_at,
              a.status, a.payment_status, a.is_walkin, a.notes,
              a.price::float8 AS price, a.service_name,
              b.id AS barber_id, b.name AS barber_name
       FROM appointments a
       LEFT JOIN barbers b ON b.id = a.barber_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY a.start_at ASC`,
      params,
    );
    res.json(rows);
  }),
);

/** POST /api/appointments — crear cita (agenda / walk-in) */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const b = req.body ?? {};
    const missing = requireFields(b, ['clientName', 'startAt']);
    if (missing) throw new AppError(400, missing);

    const startAt = new Date(String(b.startAt));
    if (Number.isNaN(startAt.getTime())) throw new AppError(400, 'startAt inválido');

    const service = b.serviceId
      ? await queryOne(
          `SELECT id, name, price::float8 AS price, duration_minutes
           FROM services WHERE id = $1 AND shop_id = $2`,
          [b.serviceId, req.user!.shopId],
        )
      : null;

    let clientId: string | null = b.clientId ? String(b.clientId) : null;
    if (!clientId && b.clientName) {
      const existing = await queryOne(
        `SELECT id FROM clients
         WHERE shop_id = $1 AND LOWER(name) = LOWER($2) AND ($3 = '' OR phone = $3)
         ORDER BY created_at DESC LIMIT 1`,
        [req.user!.shopId, String(b.clientName).trim(), b.phone ? String(b.phone) : ''],
      );
      clientId = existing ? (existing.id as string) : null;
    }

    const dur = (service ? Number(service.duration_minutes) : 45) || 45;
    const endAt = new Date(startAt.getTime() + dur * 60000);

    const apt = await queryOne(
      `INSERT INTO appointments
        (shop_id, client_id, client_name, phone, barber_id, service_id, service_name,
         start_at, end_at, price, status, payment_status, is_walkin, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id, client_id, client_name, phone, start_at, end_at, status,
                 payment_status, is_walkin, notes, price::float8 AS price, service_name`,
      [
        req.user!.shopId,
        clientId,
        String(b.clientName).trim(),
        b.phone ? String(b.phone) : null,
        b.barberId ? String(b.barberId) : null,
        service ? service.id : null,
        b.serviceName ? String(b.serviceName) : service ? (service.name as string) : null,
        startAt.toISOString(),
        endAt.toISOString(),
        b.price !== undefined ? Number(b.price) : service ? Number(service.price) : 0,
        b.status ?? 'pendiente',
        b.paymentStatus ? String(b.paymentStatus) : null,
        Boolean(b.isWalkin),
        b.notes ? String(b.notes) : null,
      ],
    );
    // Cita agendada (no walk-in/express): avisa al cliente por WhatsApp.
    if (apt && !Boolean(apt.is_walkin) && apt.phone) {
      notifyScheduledAppointment(apt, String(apt.phone), req.user!.shopId!);
    }
    res.status(201).json(apt);
  }),
);

/** PATCH /api/appointments/:id — cambiar estado / asignar barbero / precio */
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const b = req.body ?? {};
    const cols: string[] = [];
    const vals: unknown[] = [];
    if (b.status !== undefined) {
      if (!STATUSES.includes(String(b.status))) throw new AppError(400, 'Estado inválido');
      cols.push(`status = $${vals.length + 1}`);
      vals.push(String(b.status));
    }
    if (b.paymentStatus !== undefined) {
      cols.push(`payment_status = $${vals.length + 1}`);
      vals.push(b.paymentStatus ? String(b.paymentStatus) : null);
    }
    if (b.barberId !== undefined) {
      cols.push(`barber_id = $${vals.length + 1}`);
      vals.push(b.barberId ? String(b.barberId) : null);
    }
    if (b.price !== undefined) {
      cols.push(`price = $${vals.length + 1}`);
      vals.push(Number(b.price) || 0);
    }
    if (b.startAt !== undefined) {
      const s = new Date(String(b.startAt));
      if (Number.isNaN(s.getTime())) throw new AppError(400, 'startAt inválido');
      cols.push(`start_at = $${vals.length + 1}`);
      vals.push(s.toISOString());
    }
    if (!cols.length) throw new AppError(400, 'Sin campos para actualizar');

    vals.push(req.params.id, req.user!.shopId);
    const apt = await queryOne(
      `UPDATE appointments SET ${cols.join(', ')}
       WHERE id = $${vals.length - 1} AND shop_id = $${vals.length}
       RETURNING id, status, payment_status, barber_id, price::float8 AS price, start_at`,
      vals,
    );
    if (!apt) throw new AppError(404, 'Cita no encontrada');
    res.json(apt);
  }),
);

/** DELETE /api/appointments/:id */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const r = await queryOne(
      `DELETE FROM appointments WHERE id = $1 AND shop_id = $2 RETURNING id`,
      [req.params.id, req.user!.shopId],
    );
    if (!r) throw new AppError(404, 'Cita no encontrada');
    res.json({ ok: true });
  }),
);

export default router;