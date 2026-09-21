import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { queryOne } from '../db.js';
import { AppError } from '../util.js';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: 'owner' | 'barber';
  shopId: string | null;
  barberId: string | null;
  tokenVersion: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function loadUserById(id: string): Promise<AuthUser | null> {
  const u = await queryOne(
    `SELECT u.id, u.email, u.full_name, u.role, u.shop_id, u.barber_id, u.token_version
     FROM users u WHERE u.id = $1`,
    [id],
  );
  if (!u) return null;
  return {
    id: u.id as string,
    email: u.email as string,
    fullName: u.full_name as string,
    role: u.role as AuthUser['role'],
    shopId: (u.shop_id as string) || null,
    barberId: (u.barber_id as string) || null,
    tokenVersion: Number(u.token_version ?? 0),
  };
}

export function signToken(userId: string, tokenVersion: number): string {
  return jwt.sign({ sub: userId, v: tokenVersion }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

export function sessionCookieOptions(): Record<string, unknown> {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.isProduction,
    path: '/',
    maxAge: config.jwtExpiresSeconds * 1000,
  };
}

/** Establece la cookie de sesión (httpOnly, SameSite=Strict, Secure en prod). */
export function setSessionCookie(res: Response, token: string): void {
  res.cookie(config.sessionCookieName, token, sessionCookieOptions());
}

/** Elimina la cookie de sesión (logout). */
export function clearSessionCookie(res: Response): void {
  res.clearCookie(config.sessionCookieName, { path: '/' });
}

/** Requiere un token JWT válido (header Bearer o cookie httpOnly) y carga el usuario. */
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const header = req.headers.authorization || '';
    const cookieToken = readCookie(req, config.sessionCookieName);
    const token = header.startsWith('Bearer ') ? header.slice(7) : cookieToken;
    if (!token) throw new AppError(401, 'No autorizado: falta token');

    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;
    } catch {
      throw new AppError(401, 'No autorizado: token inválido o expirado');
    }

    const user = await loadUserById(payload.sub as string);
    if (!user) throw new AppError(401, 'No autorizado: usuario inexistente');
    // Revocación de sesiones: un token firmado con una versión anterior (p.ej. tras
    // CERRAR SESIÓN desde otro dispositivo) ya no es válido.
    if ((payload.v as number) !== user.tokenVersion) {
      throw new AppError(401, 'No autorizado: sesión cerrada en otro dispositivo');
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/** Requiere rol owner (o barber en su shop). */
export function requireOwner(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) throw new AppError(401, 'No autorizado');
  if (req.user.role !== 'owner') throw new AppError(403, 'Requiere rol de dueño');
  next();
}

/** Requiere que el usuario pertenezca a un shop. */
export function requireShop(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) throw new AppError(401, 'No autorizado');
  if (!req.user.shopId) throw new AppError(403, 'No estás vinculado a una barbería');
  next();
}