import { Router } from 'express';
import { query, queryOne } from '../db.js';
import { AppError, asyncHandler, requireFields } from '../util.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

/** GET /api/clients?q= — búsqueda por nombre/teléfono */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = req.query.q ? String(req.query.q).trim() : '';
    const rows = await query(
      `SELECT c.id, c.name, c.phone, c.is_vip, c.notes, c.created_at,
              (SELECT COUNT(*) FROM appointments a WHERE a.client_id = c.id AND a.status <> 'cancelado')::int AS visits
       FROM clients c
       WHERE c.shop_id = $1
         AND ($2 = '' OR LOWER(c.name) LIKE '%' || LOWER($2) || '%' OR c.phone LIKE '%' || $2 || '%')
       ORDER BY c.created_at DESC
       LIMIT 100`,
      [req.user!.shopId, q],
    );
    res.json(rows);
  }),
);

/** GET /api/clients/:id — ficha + historial (citas y compras) */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const client = await queryOne(
      `SELECT id, name, phone, is_vip, notes, created_at
       FROM clients WHERE id = $1 AND shop_id = $2`,
      [req.params.id, req.user!.shopId],
    );
    if (!client) throw new AppError(404, 'Cliente no encontrado');

    const history = await query(
      `SELECT a.id, a.start_at, a.status, a.price::float8 AS price,
              b.name AS barber_name, a.service_name, a.payment_status
       FROM appointments a
       LEFT JOIN barbers b ON b.id = a.barber_id
       WHERE a.client_id = $1 AND a.shop_id = $2 AND a.status <> 'cancelado'
       ORDER BY a.start_at DESC
       LIMIT 50`,
      [req.params.id, req.user!.shopId],
    );
    const purchases = await query(
      `SELECT s.id, s.created_at, s.total::float8 AS total, s.payment_method, s.client_name
       FROM sales s
       WHERE s.client_id = $1 AND s.shop_id = $2 AND s.status = 'completada'
       ORDER BY s.created_at DESC
       LIMIT 50`,
      [req.params.id, req.user!.shopId],
    );
    res.json({ ...client, history, purchases });
  }),
);

/** POST /api/clients */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const b = req.body ?? {};
    const missing = requireFields(b, ['name']);
    if (missing) throw new AppError(400, missing);

    const client = await queryOne(
      `INSERT INTO clients (shop_id, name, phone, is_vip, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, phone, is_vip, notes, created_at`,
      [
        req.user!.shopId,
        String(b.name).trim(),
        b.phone ? String(b.phone) : null,
        Boolean(b.is_vip),
        b.notes ? String(b.notes) : null,
      ],
    );
    res.status(201).json(client);
  }),
);

/** PUT /api/clients/:id */
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const b = req.body ?? {};
    const cols: string[] = [];
    const vals: unknown[] = [];
    const mapping: Record<string, (v: unknown) => unknown> = {
      name: (v: unknown) => String(v).trim(),
      phone: (v: unknown) => (v ? String(v) : null),
      is_vip: (v: unknown) => Boolean(v),
      notes: (v: unknown) => (v ? String(v) : null),
    };
    for (const [key, fn] of Object.entries(mapping)) {
      if (b[key] !== undefined) {
        cols.push(`${key} = $${vals.length + 1}`);
        vals.push(fn(b[key]));
      }
    }
    if (!cols.length) throw new AppError(400, 'Sin campos para actualizar');
    vals.push(req.params.id, req.user!.shopId);
    const client = await queryOne(
      `UPDATE clients SET ${cols.join(', ')}
       WHERE id = $${vals.length - 1} AND shop_id = $${vals.length}
       RETURNING id, name, phone, is_vip, notes, created_at`,
      vals,
    );
    if (!client) throw new AppError(404, 'Cliente no encontrado');
    res.json(client);
  }),
);

export default router;