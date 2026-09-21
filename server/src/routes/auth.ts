import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query, queryOne } from '../db.js';
import { AppError, asyncHandler, requireFields } from '../util.js';
import {
  requireAuth,
  signToken,
  loadUserById,
  setSessionCookie,
  clearSessionCookie,
} from '../middleware/auth.js';

const router = Router();

/** POST /api/auth/register — crea dueño + barbería */
router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    const missing = requireFields(body, ['email', 'password', 'fullName', 'shopName']);
    if (missing) throw new AppError(400, missing);

    if (body.role === 'barber') {
      throw new AppError(
        400,
        'Los barberos se crean desde el panel del dueño con sus credenciales opcionales',
      );
    }

    const email = String(body.email).trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new AppError(400, 'Correo inválido');
    }
    if (String(body.password).length < 6) {
      throw new AppError(400, 'La contraseña debe tener al menos 6 caracteres');
    }

    const existing = await queryOne('SELECT id FROM users WHERE email = $1', [email]);
    if (existing) throw new AppError(409, 'Ya existe un usuario con ese correo');

    const passwordHash = await bcrypt.hash(String(body.password), 10);
    const client = await (await import('../db.js')).pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: shopRows } = await client.query(
        `INSERT INTO shops (name, address, phone)
         VALUES ($1, $2, $3) RETURNING id`,
        [
          String(body.shopName).trim(),
          body.shopAddress ? String(body.shopAddress) : null,
          body.shopPhone ? String(body.shopPhone) : null,
        ],
      );
      const shopId = shopRows[0].id as string;

      const { rows: userRows } = await client.query(
        `INSERT INTO users (email, password_hash, full_name, role, shop_id)
         VALUES ($1, $2, $3, 'owner', $4) RETURNING id`,
        [email, passwordHash, String(body.fullName).trim(), shopId],
      );
      await client.query('UPDATE shops SET owner_id = $1 WHERE id = $2', [userRows[0].id, shopId]);
      await client.query('COMMIT');

      const token = signToken(userRows[0].id as string, 0);
      setSessionCookie(res, token);
      res.status(201).json({ token, user: await loadUserById(userRows[0].id as string), shopId });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }),
);

/** POST /api/auth/login */
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) throw new AppError(400, 'Correo y contraseña requeridos');

    const u = await queryOne(
      `SELECT id FROM users WHERE email = $1`,
      [String(email).trim().toLowerCase()],
    );
    const user = u
      ? await queryOne(
          `SELECT id, email, password_hash, full_name, role, shop_id, barber_id, token_version
           FROM users WHERE id = $1`,
          [u.id],
        )
      : null;
    if (!user) throw new AppError(401, 'Correo o contraseña incorrectos');

    const ok = await bcrypt.compare(String(password), user.password_hash as string);
    if (!ok) throw new AppError(401, 'Correo o contraseña incorrectos');

    const token = signToken(user.id as string, Number(user.token_version ?? 0));
    setSessionCookie(res, token);
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        shopId: user.shop_id,
        barberId: user.barber_id,
      },
    });
  }),
);

/** GET /api/auth/me */
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const shop = req.user!.shopId
      ? await queryOne(
          `SELECT id, name, address, phone, settings FROM shops WHERE id = $1`,
          [req.user!.shopId],
        )
      : null;
    res.json({ user: req.user, shop });
  }),
);

/** POST /api/auth/logout — invalida la sesión (revoca el token) y borra la cookie. */
router.post(
  '/logout',
  requireAuth,
  asyncHandler(async (req, res) => {
    await query(`UPDATE users SET token_version = token_version + 1 WHERE id = $1`, [
      req.user!.id,
    ]);
    clearSessionCookie(res);
    res.json({ ok: true });
  }),
);

export default router;