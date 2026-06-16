import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { config } from '../config.js';
import { hashToken, safeUser } from '../services/authService.js';

export async function attachUser(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[config.cookieName];
    if (!token) return next();
    const session = await prisma.authSession.findFirst({ where: { sessionTokenHash: hashToken(token), invalidatedAt: null, expiresAt: { gt: new Date() } }, include: { user: true } });
    if (session) req.user = safeUser(session.user);
    next();
  } catch (err) { next(err); }
}
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(Object.assign(new Error('Nicht angemeldet'), { status: 401 }));
  next();
}
