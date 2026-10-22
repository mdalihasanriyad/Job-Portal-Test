import { createHash, randomBytes } from 'node:crypto';
import type { ServerResponse } from 'node:http';
import { ObjectId, type Db } from 'mongodb';
import { col } from './db.js';
import { HttpError, getIp, isHttps, parseCookies, type Req } from './http.js';

export const SESSION_COOKIE = 'gj_session';
const SESSION_DAYS = 7;

export interface AdminUser {
  id: string;
  email: string;
  name?: string;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function cookieAttributes(req: Req, maxAgeSeconds: number): string {
  const parts = ['Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${maxAgeSeconds}`];
  if (isHttps(req)) parts.push('Secure');
  return parts.join('; ');
}

export async function createSession(db: Db, req: Req, res: ServerResponse, adminId: ObjectId): Promise<void> {
  const token = randomBytes(32).toString('base64url');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 86_400_000);
  await col.sessions(db).insertOne({
    tokenHash: hashToken(token),
    adminId,
    createdAt: now,
    expiresAt,
    ip: getIp(req),
    userAgent: String(req.headers['user-agent'] ?? '').slice(0, 200),
  });
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; ${cookieAttributes(req, SESSION_DAYS * 86_400)}`);
}

export async function destroySession(db: Db, req: Req, res: ServerResponse): Promise<void> {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (token) await col.sessions(db).deleteOne({ tokenHash: hashToken(token) });
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; ${cookieAttributes(req, 0)}`);
}

export async function getSessionAdmin(db: Db, req: Req): Promise<AdminUser | null> {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (!token || token.length > 200) return null;
  const session = await col.sessions(db).findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } });
  if (!session) return null;
  const admin = await col.admins(db).findOne({ _id: session.adminId as ObjectId });
  if (!admin) return null;
  return { id: String(admin._id), email: String(admin.email), name: admin.name ? String(admin.name) : undefined };
}

/** Every /api/admin/* handler must call this first. */
export async function requireAdmin(db: Db, req: Req): Promise<AdminUser> {
  const admin = await getSessionAdmin(db, req);
  if (!admin) throw new HttpError(401, 'unauthorized', 'এই কাজের জন্য লগইন করতে হবে।');
  return admin;
}
