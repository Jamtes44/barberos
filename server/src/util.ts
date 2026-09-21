import type { Request, Response, NextFunction, RequestHandler } from 'express';

export class AppError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type AsyncFn = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown> | unknown;

export const asyncHandler =
  (fn: AsyncFn): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export const requireFields = (
  body: Record<string, unknown>,
  fields: string[],
): string | null => {
  const missing = fields.filter((f) => body[f] === undefined || body[f] === null || body[f] === '');
  return missing.length ? `Faltan campos: ${missing.join(', ')}` : null;
};