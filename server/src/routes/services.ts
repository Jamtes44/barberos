import { Router } from 'express';
import { query, queryOne } from '../db.js';
import { AppError, asyncHandler, requireFields } from '../util.js';
import { requireAuth, requireOwner } from '../middleware/auth.js';
import { requireMemberActive } from '../membership.js';

const router = Router();
router.use(requireAuth);
router.use(requireMemberActive);

/** GET /api/services — lista de servicios de la barbería */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const rows = await query(
      `SELECT id, name, price::float8 AS price, commission_rate, duration_minutes, category, active
       FROM services WHERE shop_id = $1 ORDER BY active DESC, created_at ASC`,
      [req.user!.shopId],
    );
    res.json(rows);
  }),
);

/** POST /api/services */
router.post(
  '/',
  requireOwner,
  asyncHandler(async (req, res) => {
    const b = req.body ?? {};
    const missing = requireFields(b, ['name', 'price']);
    if (missing) throw new AppError(400, missing);

    const service = await queryOne(
      `INSERT INTO services (shop_id, name, price, commission_rate, duration_minutes, category)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, price::float8 AS price, commission_rate, duration_minutes, category, active`,
      [
        req.user!.shopId,
        String(b.name).trim(),
        Number(b.price) || 0,
        b.commission_rate !== undefined ? Number(b.commission_rate) : 45,
        b.duration_minutes !== undefined ? Number(b.duration_minutes) : 45,
        b.category ? String(b.category) : null,
      ],
    );
    res.status(201).json(service);
  }),
);

/** PUT /api/services/:id */
router.put(
  '/:id',
  requireOwner,
  asyncHandler(async (req, res) => {
    const b = req.body ?? {};
    const cols: string[] = [];
    const vals: unknown[] = [];
    const mapping: Record<string, (v: unknown) => unknown> = {
      name: (v: unknown) => String(v).trim(),
      price: (v: unknown) => Number(v),
      commission_rate: (v: unknown) => Number(v),
      duration_minutes: (v: unknown) => Number(v),
      category: (v: unknown) => (v ? String(v) : null),
      active: (v: unknown) => Boolean(v),
    };
    for (const [key, fn] of Object.entries(mapping)) {
      if (b[key] !== undefined) {
        cols.push(`${key} = $${vals.length + 1}`);
        vals.push(fn(b[key]));
      }
    }
    if (!cols.length) throw new AppError(400, 'Sin campos para actualizar');
    vals.push(req.params.id, req.user!.shopId);
    const service = await queryOne(
      `UPDATE services SET ${cols.join(', ')}
       WHERE id = $${vals.length - 1} AND shop_id = $${vals.length}
       RETURNING id, name, price::float8 AS price, commission_rate, duration_minutes, category, active`,
      vals,
    );
    if (!service) throw new AppError(404, 'Servicio no encontrado');
    res.json(service);
  }),
);

/** DELETE /api/services/:id */
router.delete(
  '/:id',
  requireOwner,
  asyncHandler(async (req, res) => {
    const r = await queryOne(
      `DELETE FROM services WHERE id = $1 AND shop_id = $2 RETURNING id`,
      [req.params.id, req.user!.shopId],
    );
    if (!r) throw new AppError(404, 'Servicio no encontrado');
    res.json({ ok: true });
  }),
);

export default router;