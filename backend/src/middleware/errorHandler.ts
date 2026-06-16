import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export function notFound(_req: Request, _res: Response, next: NextFunction) { next(Object.assign(new Error('Nicht gefunden'), { status: 404 })); }
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const e = err as Error & { status?: number; issues?: unknown };
  const isValidation = err instanceof ZodError;
  const status = isValidation ? 400 : (e.status ?? 500);
  const message = isValidation ? 'Ungültige Eingaben' : (status >= 500 ? 'Interner Serverfehler' : e.message);
  res.status(status).json({ error: { message, issues: e.issues } });
}
