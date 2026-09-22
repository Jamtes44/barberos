import { Router } from 'express';
import { query, queryOne, salesSummary, localToday } from '../db.js';
import { AppError, asyncHandler, requireFields } from '../util.js';
import { requireAuth } from '../middleware/auth.js';
import { requireMemberActive } from '../membership.js';

const router = Router();
router.use(requireAuth);
router.use(requireMemberActive);

const METHODS = ['efectivo', 'nequi', 'tarjeta', 'caja_central'];

/** GET /api/sales?from=&to=&barberId= */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const from = req.query.from ? String(req.query.from) : null;
    const to = req.query.to ? String(req.query.to) : null;
    const barberId = req.query.barberId ? String(req.query.barberId) : null;

    const conditions = ['s.shop_id = $1'];
    const params: unknown[] = [req.user!.shopId];
    if (from) { conditions.push(`(s.created_at AT TIME ZONE 'America/Bogota')::date >= $${params.length + 1}::date`); params.push(from); }
    if (to) { conditions.push(`(s.created_at AT TIME ZONE 'America/Bogota')::date <= $${params.length + 1}::date`); params.push(to); }
    if (barberId) { conditions.push(`s.barber_id = $${params.length + 1}`); params.push(barberId); }

    const rows = await query(
      `SELECT s.id, s.client_name, s.total::float8 AS total,
              s.barber_earnings::float8 AS barber_earnings, s.tip::float8 AS tip,
              s.payment_method, s.status, s.created_at,
              b.id AS barber_id, b.name AS barber_name,
              COALESCE(json_agg(json_build_object(
                'name', si.service_name, 'qty', si.quantity,
                'unit_price', si.unit_price::float8, 'commission', si.commission::float8
              )) FILTER (WHERE si.id IS NOT NULL), '[]') AS items
       FROM sales s
       LEFT JOIN barbers b ON b.id = s.barber_id
       LEFT JOIN sale_items si ON si.sale_id = s.id
       WHERE ${conditions.join(' AND ')} AND s.status = 'completada'
       GROUP BY s.id, b.id
       ORDER BY s.created_at DESC`,
      params,
    );
    res.json(rows);
  }),
);

/** GET /api/sales/summary?date= — caja del día por método de pago */
router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const date = String(req.query.date || localToday());
    const rows = await salesSummary(req.user!.shopId!, date);
    const total = rows.reduce((acc, r) => acc + Number(r.total || 0), 0);
    res.json({ date, byMethod: rows, total });
  }),
);

/** POST /api/sales — cobro (caja) */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const b = req.body ?? {};
    const missing = requireFields(b, ['items', 'paymentMethod']);
    if (missing) throw new AppError(400, missing);
    if (!Array.isArray(b.items) || !b.items.length) throw new AppError(400, 'La venta requiere items');
    if (!METHODS.includes(String(b.paymentMethod))) throw new AppError(400, 'Método de pago inválido');

    const items = b.items.map((it: Record<string, unknown>) => ({
      serviceId: it.serviceId ? String(it.serviceId) : null,
      name: String(it.name || 'Servicio'),
      qty: Math.max(1, Number(it.qty) || 1),
      price: Number(it.price) || 0,
    }));

    let total = 0;
    let commissions = 0;
    const pricedItems: Array<{
      serviceId: string | null;
      name: string;
      qty: number;
      unitPrice: number;
      commission: number;
    }> = [];
    for (const it of items) {
      const service = it.serviceId
        ? await queryOne(
            `SELECT name, price::float8 AS price, commission_rate
             FROM services WHERE id = $1 AND shop_id = $2`,
            [it.serviceId, req.user!.shopId],
          )
        : null;
      const unit = service ? Number(service.price) : it.price;
      const rate = service ? Number(service.commission_rate) : 0;
      const lineTotal = unit * it.qty;
      total += lineTotal;
      commissions += (lineTotal * rate) / 100;
      pricedItems.push({
        serviceId: it.serviceId,
        name: service ? (service.name as string) : it.name,
        qty: it.qty,
        unitPrice: unit,
        commission: (lineTotal * rate) / 100,
      });
    }

    const tip = Number(b.tip) || 0;
    const cashReceived = Number(b.cashReceived) || 0;

    let barberId = b.barberId ? String(b.barberId) : null;
    if (!barberId && b.appointmentId) {
      const aptRef = await queryOne(
        `SELECT barber_id FROM appointments WHERE id = $1 AND shop_id = $2`,
        [String(b.appointmentId), req.user!.shopId],
      );
      if (aptRef?.barber_id) barberId = String(aptRef.barber_id);
    }
    let barberScheme: string | null = null;
    let barberValue: number | null = null;
    if (barberId) {
      const barber = await queryOne(
        `SELECT commission_scheme, commission_value::float8 AS commission_value
         FROM barbers WHERE id = $1 AND shop_id = $2`,
        [barberId, req.user!.shopId],
      );
      if (barber) {
        barberScheme = String(barber.commission_scheme ?? 'percentage');
        barberValue = barber.commission_value === null || barber.commission_value === undefined
          ? null
          : Number(barber.commission_value);
      }
    }

    let schemeCommissions: number;
    if (!barberScheme) {
      schemeCommissions = commissions; // barrer sin barbero → tarifas de servicio (legado)
    } else if (barberScheme === 'percentage') {
      schemeCommissions = barberValue !== null ? Math.round((total * barberValue) / 100) : commissions;
    } else if (barberScheme === 'fixed') {
      schemeCommissions = Math.round(barberValue ?? 0);
    } else {
      schemeCommissions = 0; // none
    }

    const barberEarnings = schemeCommissions + tip;
    const changeAmount = cashReceived > 0 ? Math.max(0, cashReceived - total) : 0;

    if (barberScheme && barberScheme === 'percentage' && barberValue !== null) {
      for (const p of pricedItems) {
        p.commission = Math.round((p.unitPrice * p.qty * barberValue) / 100);
      }
    } else if (barberScheme && barberScheme === 'fixed') {
      const fix = Math.round(barberValue ?? 0);
      const totalLines = pricedItems.reduce((a, p) => a + p.unitPrice * p.qty, 0) || 1;
      let acc = 0;
      pricedItems.forEach((p, idx) => {
        if (idx === pricedItems.length - 1) {
          p.commission = fix - acc;
        } else {
          const c = Math.round((fix * p.unitPrice * p.qty) / totalLines);
          acc += c;
          p.commission = c;
        }
      });
    } else if (barberScheme && barberScheme === 'none') {
      for (const p of pricedItems) p.commission = 0;
    }

    const client = await (await import('../db.js')).pool.connect();
    try {
      await client.query('BEGIN');

      if (b.appointmentId) {
        const aptRows = await client.query(
          `SELECT id, status, payment_status FROM appointments WHERE id = $1 AND shop_id = $2 FOR UPDATE`,
          [String(b.appointmentId), req.user!.shopId],
        );
        const aptRow = aptRows.rows[0] as
          | { status: string; payment_status: string | null }
          | undefined;
        if (!aptRow) throw new AppError(404, 'Cita no encontrada');
        if (aptRow.status === 'finalizado' || aptRow.payment_status) {
          throw new AppError(409, 'Este turno ya fue cobrado');
        }
        const linked = await client.query(
          `SELECT id FROM sales WHERE appointment_id = $1 AND shop_id = $2 LIMIT 1`,
          [String(b.appointmentId), req.user!.shopId],
        );
        if (linked.rows.length > 0) {
          throw new AppError(409, 'Este turno ya tiene un cobro registrado');
        }
      }

      let clientId: string | null = b.clientId ? String(b.clientId) : null;
      if (!clientId && b.clientName) {
        const existing = await client.query(
          `SELECT id FROM clients WHERE shop_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1`,
          [req.user!.shopId, String(b.clientName).trim()],
        );
        clientId = existing.rows[0]?.id ?? null;
      }
      

      const { rows } = await client.query(
        `INSERT INTO sales (shop_id, client_id, client_name, barber_id, appointment_id,
                           total, barber_earnings, tip, payment_method,
                           cash_received, change_amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id, created_at`,
        [
          req.user!.shopId,
          clientId,
          b.clientName ? String(b.clientName) : null,
          barberId,
          b.appointmentId ? String(b.appointmentId) : null,
          total,
          barberEarnings,
          tip,
          String(b.paymentMethod),
          cashReceived > 0 ? cashReceived : null,
          changeAmount,
        ],
      );
      const saleId = rows[0].id as string;

      for (const p of pricedItems) {
        await client.query(
          `INSERT INTO sale_items (sale_id, service_id, service_name, quantity, unit_price, commission)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [saleId, p.serviceId, p.name, p.qty, p.unitPrice, p.commission],
        );
      }

      if (b.appointmentId) {
        await client.query(
          `UPDATE appointments SET status = 'finalizado', payment_status = $3
           WHERE id = $1 AND shop_id = $2`,
          [String(b.appointmentId), req.user!.shopId, String(b.paymentMethod)],
        );
      }

      await client.query('COMMIT');
      res.status(201).json({
        id: saleId,
        total,
        barberEarnings,
        tip,
        changeAmount,
        createdAt: rows[0].created_at,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }),
);

/** GET /api/sales/:id — detalle de una venta */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const sale = await queryOne(
      `SELECT s.id, s.client_name, s.total::float8 AS total,
              s.barber_earnings::float8 AS barber_earnings, s.tip::float8 AS tip,
              s.payment_method, s.status, s.created_at, s.change_amount::float8 AS change_amount,
              b.name AS barber_name
       FROM sales s LEFT JOIN barbers b ON b.id = s.barber_id
       WHERE s.id = $1 AND s.shop_id = $2`,
      [req.params.id, req.user!.shopId],
    );
    if (!sale) throw new AppError(404, 'Venta no encontrada');
    const items = await query(
      `SELECT service_name, quantity, unit_price::float8 AS unit_price, commission::float8 AS commission
       FROM sale_items WHERE sale_id = $1`,
      [req.params.id],
    );
    res.json({ ...sale, items });
  }),
);

export default router;