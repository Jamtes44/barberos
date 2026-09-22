import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query, queryOne } from '../db.js';
import { AppError, asyncHandler, requireFields } from '../util.js';
import { requireAuth, requireOwner } from '../middleware/auth.js';
import { requireMemberActive } from '../membership.js';

const COMMISSION_SCHEMES = ['percentage', 'fixed', 'none'];

const parseCommission = (b: Record<string, unknown>) => {
  const scheme = COMMISSION_SCHEMES.includes(String(b.commissionScheme))
    ? String(b.commissionScheme)
    : 'percentage';
  let value: number | null = null;
  if (b.commissionValue !== undefined && b.commissionValue !== null && b.commissionValue !== '') {
    value = Number(b.commissionValue);
    if (!Number.isFinite(value) || value < 0) {
      throw new AppError(400, 'El valor de comisión debe ser un número mayor o igual a 0');
    }
  }
  if (scheme === 'percentage' && value !== null && value > 100) {
    throw new AppError(400, 'El porcentaje de comisión no puede superar 100');
  }
  if (scheme === 'fixed' && (value === null || value <= 0)) {
    throw new AppError(400, 'Indica el valor fijo por cobro (COP) para la comisión');
  }
  if (scheme === 'none') value = null;
  return { scheme, value };
};

const router = Router();
router.use(requireAuth);

/** GET /api/barbers */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const rows = await query(
      `SELECT b.id, b.name, b.phone, b.chair, b.avatar_url, b.active,
              b.commission_scheme, b.commission_value::float8 AS commission_value,
              b.user_id, u.email AS user_email
       FROM barbers b
       LEFT JOIN users u ON u.id = b.user_id
       WHERE b.shop_id = $1
       ORDER BY b.active DESC, b.created_at ASC`,
      [req.user!.shopId],
    );
    res.json(rows);
  }),
);

/** POST /api/barbers — opcionalmente crea credenciales de login (rol barber) */
router.post(
  '/',
  requireOwner,
  asyncHandler(async (req, res) => {
    const b = req.body ?? {};
    const missing = requireFields(b, ['name']);
    if (missing) throw new AppError(400, missing);

    const linkToUser = Boolean(b.linkToUser);
    const email = b.email ? String(b.email).trim().toLowerCase() : null;
    if (linkToUser && email) {
      throw new AppError(400, 'El administrador se vincula con su cuenta, no con credenciales nuevas');
    }

    const client = await (await import('../db.js')).pool.connect();
    try {
      await client.query('BEGIN');

      if (linkToUser) {
        if (!req.user!.id) throw new AppError(400, 'No se pudo identificar tu cuenta');
        const dup = await client.query(
          'SELECT id FROM barbers WHERE shop_id = $1 AND user_id = $2 AND active = true',
          [req.user!.shopId, req.user!.id],
        );
        if (dup.rows.length) throw new AppError(409, 'Ya estás registrado como barbero de esta sede');
      }

      if (email) {
        const dup = await client.query('SELECT id FROM users WHERE email = $1', [email]);
        if (dup.rows.length) throw new AppError(409, 'Ese correo ya tiene una cuenta');
      }

      const { scheme, value } = parseCommission(b);
      const { rows } = await client.query(
        `INSERT INTO barbers (shop_id, name, phone, chair, avatar_url, commission_scheme, commission_value)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [
          req.user!.shopId,
          String(b.name).trim(),
          b.phone ? String(b.phone) : null,
          b.chair ? String(b.chair) : null,
          b.avatar_url ? String(b.avatar_url) : null,
          scheme,
          value,
        ],
      );
      const barberId = rows[0].id as string;

      let userId: string | null = null;
      if (linkToUser) {
        await client.query('UPDATE barbers SET user_id = $1 WHERE id = $2', [req.user!.id, barberId]);
        await client.query('UPDATE users SET barber_id = $1 WHERE id = $2', [barberId, req.user!.id]);
        userId = req.user!.id;
      } else if (email) {
        if (!b.password || String(b.password).length < 6) {
          throw new AppError(400, 'La contraseña debe tener al menos 6 caracteres');
        }
        const hash = await bcrypt.hash(String(b.password), 10);
        const { rows: urows } = await client.query(
          `INSERT INTO users (email, password_hash, full_name, role, shop_id, barber_id)
           VALUES ($1, $2, $3, 'barber', $4, $5) RETURNING id`,
          [email, hash, String(b.name).trim(), req.user!.shopId, barberId],
        );
        userId = urows[0].id as string;
        await client.query('UPDATE barbers SET user_id = $1 WHERE id = $2', [userId, barberId]);
      }

      await client.query('COMMIT');
      res.status(201).json({
        id: barberId,
        name: String(b.name).trim(),
        shopId: req.user!.shopId,
        userId,
        hasLogin: Boolean(userId),
        isAdmin: linkToUser,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }),
);

/** PUT /api/barbers/:id */
router.put(
  '/:id',
  requireOwner,
  asyncHandler(async (req, res) => {
    const b = req.body ?? {};
    const cols: string[] = [];
    const vals: unknown[] = [];
    const mapping: Record<string, (v: unknown) => unknown> = {
      name: (v: unknown) => String(v).trim(),
      phone: (v: unknown) => (v ? String(v) : null),
      chair: (v: unknown) => (v ? String(v) : null),
      avatar_url: (v: unknown) => (v ? String(v) : null),
      active: (v: unknown) => Boolean(v),
      commission_scheme: (v: unknown) => {
        if (!COMMISSION_SCHEMES.includes(String(v))) {
          throw new AppError(400, 'Esquema de comisión inválido');
        }
        return String(v);
      },
      commission_value: (v: unknown) => {
        if (v === undefined || v === null || v === '') return null;
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0) {
          throw new AppError(400, 'El valor de comisión debe ser un número mayor o igual a 0');
        }
        return n;
      },
    };
    for (const [key, fn] of Object.entries(mapping)) {
      if (b[key] !== undefined) {
        cols.push(`${key} = $${vals.length + 1}`);
        vals.push(fn(b[key]));
      }
    }
    if (!cols.length) throw new AppError(400, 'Sin campos para actualizar');
    vals.push(req.params.id, req.user!.shopId);
    const barber = await queryOne(
      `UPDATE barbers SET ${cols.join(', ')}
       WHERE id = $${vals.length - 1} AND shop_id = $${vals.length}
       RETURNING id, name, phone, chair, avatar_url, active, commission_scheme, commission_value::float8 AS commission_value`,
      vals,
    );
    if (!barber) throw new AppError(404, 'Barbero no encontrado');
    res.json(barber);
  }),
);

/** DELETE /api/barbers/:id — desactiva (no borra historial) */
router.delete(
  '/:id',
  requireOwner,
  asyncHandler(async (req, res) => {
    const r = await queryOne(
      `UPDATE barbers SET active = false WHERE id = $1 AND shop_id = $2 RETURNING id`,
      [req.params.id, req.user!.shopId],
    );
    if (!r) throw new AppError(404, 'Barbero no encontrado');
    res.json({ ok: true });
  }),
);

export default router;