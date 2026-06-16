import crypto from 'node:crypto';
import argon2 from 'argon2';
import type { Response } from 'express';
import { prisma } from '../db/prisma.js';
import { config } from '../config.js';

const days = 1000 * 60 * 60 * 24;
export function hashToken(token: string) { return crypto.createHash('sha256').update(token + config.sessionSecret).digest('hex'); }
export function safeUser(user: { id:string; email:string; displayName:string; language?:string; timezone?:string }) {
  return { id:user.id, email:user.email, displayName:user.displayName, language:user.language ?? 'de', timezone:user.timezone ?? 'Europe/Berlin' };
}
export async function createSession(userId: string, res: Response) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 14 * days);
  await prisma.authSession.create({ data: { userId, sessionTokenHash: hashToken(token), expiresAt } });
  res.cookie(config.cookieName, token, { httpOnly: true, sameSite: config.crossSiteCookies ? 'none' : 'lax', secure: config.crossSiteCookies, path: '/', expires: expiresAt });
}
export async function register(email: string, password: string, displayName: string) {
  const exists = await prisma.userAccount.findUnique({ where: { email: email.toLowerCase() } });
  if (exists) throw Object.assign(new Error('E-Mail ist bereits registriert'), { status: 409 });
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  return prisma.userAccount.create({ data: { email: email.toLowerCase(), passwordHash, displayName } });
}
export async function login(email: string, password: string) {
  const user = await prisma.userAccount.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) throw Object.assign(new Error('Ungültige Zugangsdaten'), { status: 401 });
  const ok = await argon2.verify(user.passwordHash, password);
  if (!ok) throw Object.assign(new Error('Ungültige Zugangsdaten'), { status: 401 });
  await prisma.userAccount.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return user;
}
export async function invalidateSession(token: string | undefined) {
  if (!token) return;
  await prisma.authSession.updateMany({ where: { sessionTokenHash: hashToken(token), invalidatedAt: null }, data: { invalidatedAt: new Date() } });
}
