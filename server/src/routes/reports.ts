import { Router } from 'express';
import { query, localToday } from '../db.js';
import { asyncHandler } from '../util.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

/** GET /api/reports/kpis?date= — KPIs del día (dashboard dueño) */
router.get(
  '/kpis',
  asyncHandler(async (req, res) => {
    const date = String(req.query.date || localToday());
    const shopId = req.user!.shopId;

    const day = await query(
      `SELECT COALESCE(SUM(total), 0)::float8 AS revenue,
              COALESCE(SUM(barber_earnings), 0)::float8 AS barber_earnings,
              COUNT(*)::int AS sales_count,
              COALESCE(AVG(total), 0)::float8 AS avg_ticket
       FROM sales
       WHERE shop_id = $1 AND status = 'completada' AND (created_at AT TIME ZONE 'America/Bogota')::date = $2::date`,
      [shopId, date],
    );

    const appointments = await query(
      `SELECT status, COUNT(*)::int AS count
       FROM appointments
       WHERE shop_id = $1 AND (start_at AT TIME ZONE 'America/Bogota')::date = $2::date
       GROUP BY status`,
      [shopId, date],
    );
    const aptMap: Record<string, number> = {};
    for (const a of appointments) aptMap[a.status as string] = Number(a.count);

    const vip = await query(
      `SELECT COUNT(*)::int AS count FROM clients WHERE shop_id = $1 AND is_vip = true`,
      [shopId],
    );

    res.json({
      date,
      revenue: Number(day[0]?.revenue || 0),
      barberEarnings: Number(day[0]?.barber_earnings || 0),
      houseEarnings: Number(day[0]?.revenue || 0) - Number(day[0]?.barber_earnings || 0),
      salesCount: Number(day[0]?.sales_count || 0),
      avgTicket: Number(day[0]?.avg_ticket || 0),
      appointments: aptMap,
      totalAppointments: Object.values(aptMap).reduce((a, b) => a + b, 0),
      vipClients: Number(vip[0]?.count || 0),
    });
  }),
);

/** GET /api/reports/commissions?from=&to= — comisiones por barbero y por día */
router.get(
  '/commissions',
  asyncHandler(async (req, res) => {
    const from = req.query.from ? String(req.query.from) : `${localToday().slice(0, 8)}01`;
    const to = req.query.to ? String(req.query.to) : localToday();
    const shopId = req.user!.shopId;

    const byBarber = await query(
      `SELECT b.id, b.name,
              COUNT(s.id)::int AS sales_count,
              COALESCE(SUM(s.total), 0)::float8 AS revenue,
              COALESCE(SUM(s.barber_earnings), 0)::float8 AS earnings,
              COALESCE(SUM(s.tip), 0)::float8 AS tips
       FROM barbers b
       LEFT JOIN sales s ON s.barber_id = b.id AND s.shop_id = $1
                        AND s.status = 'completada'
                        AND (s.created_at AT TIME ZONE 'America/Bogota')::date >= $2::date
                        AND (s.created_at AT TIME ZONE 'America/Bogota')::date <= $3::date
       WHERE b.shop_id = $1
       GROUP BY b.id, b.name
       ORDER BY earnings DESC`,
      [shopId, from, to],
    );

    const byDay = await query(
      `SELECT (created_at AT TIME ZONE 'America/Bogota')::date AS day,
              COALESCE(SUM(barber_earnings), 0)::float8 AS earnings,
              COALESCE(SUM(total), 0)::float8 AS revenue
       FROM sales
       WHERE shop_id = $1 AND status = 'completada'
         AND (created_at AT TIME ZONE 'America/Bogota')::date >= $2::date
         AND (created_at AT TIME ZONE 'America/Bogota')::date <= $3::date
       GROUP BY (created_at AT TIME ZONE 'America/Bogota')::date
       ORDER BY day ASC`,
      [shopId, from, to],
    );

    res.json({
      from,
      to,
      totalEarnings: byBarber.reduce((a, r) => a + Number(r.earnings || 0), 0),
      totalRevenue: byDay.reduce((a, r) => a + Number(r.revenue || 0), 0),
      byBarber,
      byDay,
    });
  }),
);

/** GET /api/reports/period?from=&to= — ventas por día, método, servicios y barberos */
router.get(
  '/period',
  asyncHandler(async (req, res) => {
    const from = req.query.from ? String(req.query.from) : `${localToday().slice(0, 8)}01`;
    const to = req.query.to ? String(req.query.to) : localToday();
    const shopId = req.user!.shopId;

    const byDay = await query(
      `SELECT (created_at AT TIME ZONE 'America/Bogota')::date AS day,
              COUNT(*)::int AS sales_count,
              COALESCE(SUM(total), 0)::float8 AS total
       FROM sales
       WHERE shop_id = $1 AND status = 'completada'
         AND (created_at AT TIME ZONE 'America/Bogota')::date >= $2::date
         AND (created_at AT TIME ZONE 'America/Bogota')::date <= $3::date
       GROUP BY (created_at AT TIME ZONE 'America/Bogota')::date ORDER BY day`,
      [shopId, from, to],
    );

    const byMethod = await query(
      `SELECT payment_method, COUNT(*)::int AS count, COALESCE(SUM(total), 0)::float8 AS total
       FROM sales
       WHERE shop_id = $1 AND status = 'completada'
         AND (created_at AT TIME ZONE 'America/Bogota')::date >= $2::date
         AND (created_at AT TIME ZONE 'America/Bogota')::date <= $3::date
       GROUP BY payment_method`,
      [shopId, from, to],
    );

    const topServices = await query(
      `SELECT si.service_name, COUNT(*)::int AS count, COALESCE(SUM(si.quantity * si.unit_price), 0)::float8 AS total
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       WHERE s.shop_id = $1 AND s.status = 'completada'
         AND (s.created_at AT TIME ZONE 'America/Bogota')::date >= $2::date
         AND (s.created_at AT TIME ZONE 'America/Bogota')::date <= $3::date
       GROUP BY si.service_name ORDER BY total DESC LIMIT 10`,
      [shopId, from, to],
    );

    const topBarbers = await query(
      `SELECT b.name, COUNT(s.id)::int AS sales_count, COALESCE(SUM(s.total), 0)::float8 AS total
       FROM sales s JOIN barbers b ON b.id = s.barber_id
       WHERE s.shop_id = $1 AND s.status = 'completada'
         AND (s.created_at AT TIME ZONE 'America/Bogota')::date >= $2::date
         AND (s.created_at AT TIME ZONE 'America/Bogota')::date <= $3::date
       GROUP BY b.name ORDER BY total DESC`,
      [shopId, from, to],
    );

    res.json({
      from,
      to,
      byDay,
      byMethod,
      topServices,
      topBarbers,
    });
  }),
);

export default router;