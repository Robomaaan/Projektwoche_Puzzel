import type { NextFunction, Request, Response } from 'express';

export function notFound(_req: Request, _res: Response, next: NextFunction) { next(Object.assign(new Error('Nicht gefunden'), { status: 404 })); }
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const e = err as Error & { status?: number; issues?: unknown };
  const status = e.status ?? 500;
  res.status(status).json({ error: { message: status >= 500 ? 'Interner Serverfehler' : e.message, issues: e.issues } });
}
