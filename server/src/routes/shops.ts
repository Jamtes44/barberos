import { Router } from 'express';
import { query, queryOne } from '../db.js';
import { AppError, asyncHandler } from '../util.js';
import { requireAuth, requireOwner } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

/** GET /api/shop — datos de la barbería del usuario (incluye membresía) */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    if (!req.user!.shopId) throw new AppError(404, 'Sin barbería vinculada');
    const shop = await queryOne(
      `SELECT id, name, address, phone, settings, created_at,
              membership_status, trial_started_at, trial_ends_at,
              membership_activated_at, membership_expires_at, plan_id, plan_name,
              plan_price, last_payment_at, last_reminder_at
       FROM shops WHERE id = $1`,
      [req.user!.shopId],
    );
    if (!shop) throw new AppError(404, 'Barbería no encontrada');
    res.json(shop);
  }),
);

/** PUT /api/shop — actualizar datos de la barbería */
router.put(
  '/',
  requireOwner,
  asyncHandler(async (req, res) => {
    const { name, address, phone, settings } = req.body ?? {};
    if (!req.user!.shopId) throw new AppError(404, 'Sin barbería vinculada');

    const cols: string[] = [];
    const vals: unknown[] = [];
    if (name !== undefined) { cols.push(`name = $${vals.length + 1}`); vals.push(String(name)); }
    if (address !== undefined) { cols.push(`address = $${vals.length + 1}`); vals.push(address ? String(address) : null); }
    if (phone !== undefined) { cols.push(`phone = $${vals.length + 1}`); vals.push(phone ? String(phone) : null); }
    if (settings !== undefined) { cols.push(`settings = $${vals.length + 1}`); vals.push(JSON.stringify(settings)); }

    if (!cols.length) throw new AppError(400, 'Sin campos para actualizar');
    vals.push(req.user!.shopId);
    const shop = await queryOne(
      `UPDATE shops SET ${cols.join(', ')} WHERE id = $${vals.length} RETURNING id, name, address, phone, settings`,
      vals,
    );
    res.json(shop);
  }),
);

export default router;