import rateLimit from 'express-rate-limit';
import { AppError } from '../util.js';

/**
 * Límite general por IP sobre /api (protege abusos básicos de endpoints).
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => next(new AppError(429, 'Demasiadas peticiones. Intenta de nuevo en un minuto')),
});

/**
 * Límite estricto sobre login/logout: solo cuentan los intentos fallidos, así un
 * atacante no puede hacer fuerza bruta de contraseñas (30 fallos / 15 min por IP).
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) =>
    next(new AppError(429, 'Demasiados intentos fallidos. Espera 15 minutos e inténtalo de nuevo')),
});

/**
 * Límite propio del registro de cuentas: evita spam de cuentas sin penalizar el
 * login/brute-force con el mismo contador (DoS cruzado).
 */
export const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) =>
    next(new AppError(429, 'Demasiados intentos de registro. Espera 15 minutos e inténtalo de nuevo')),
});