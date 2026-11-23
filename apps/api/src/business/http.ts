import express, { Router } from 'express';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { Client } from 'minio';
import { z } from 'zod';
import { requireStaff } from '../auth/http.ts';
import { roles, type AuthService, type Staff } from '../auth/service.ts';
import { hashPassword } from '../auth/passwords.ts';
import { BusinessError } from '../domain/business.ts';
import { type BusinessStore, staffTransaction } from './store.ts';
export type BusinessDependencies = { store: BusinessStore; pool?: Pool; media?: Client; bucket?: string };
export function businessRouter(auth: AuthService, origin: string, deps: BusinessDependencies) {
  const router = Router();
  router.use(requireStaff(auth));
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!['GET', 'HEAD'].includes(req.method) && req.headers.origin !== origin) { res.status(403).json({ error: 'INVALID_ORIGIN' }); return; }
    next();
  });
  router.get('/workspace', async (_req, res) => {
    const actor = res.locals.staff as Staff;
    const data = await deps.store.view(actor);
    const staff = deps.pool ? (await deps.pool.query('SELECT "id", "name", "role" FROM "User" WHERE "active" = true ORDER BY "name"')).rows : [];
    res.json({ data, staff });
  });
  router.post('/commands', async (req, res) => {
    const key = req.header('Idempotency-Key');
    if (!key || !/^[a-zA-Z0-9_-]{16,128}$/.test(key)) { res.status(400).json({ error: 'A unique Idempotency-Key is required' }); return; }
    const parsed = z.object({ type: z.string().min(1).max(80) }).passthrough().safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'INVALID_COMMAND' }); return; }
    res.json(await deps.store.command(res.locals.staff as Staff, key, parsed.data));
  });
  router.get('/staff', async (_req, res) => {
    if ((res.locals.staff as Staff).role !== 'SUPER_ADMIN') throw new BusinessError('Forbidden', 403);
    if (!deps.pool) throw new BusinessError('Staff service unavailable', 503);
    res.json({ staff: (await deps.pool.query('SELECT "id", "name", "email", "role", "active" FROM "User" ORDER BY "name"')).rows });
  });
  router.post('/staff', async (req, res) => {
    const actor = res.locals.staff as Staff;
    if (actor.role !== 'SUPER_ADMIN') throw new BusinessError('Forbidden', 403);
    if (!deps.pool) throw new BusinessError('Staff service unavailable', 503);
    const parsed = z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(1).max(120), email: z.string().trim().email().max(254).transform(v => v.toLowerCase()), role: z.enum(roles), active: z.boolean(), password: z.string().min(12).max(128).optional() }).strict().safeParse(req.body);
    if (!parsed.success) throw new BusinessError('Invalid staff details or password (minimum 12 characters)', 400);
    const input = parsed.data;
    if (!input.id && !input.password) throw new BusinessError('A password is required for a new employee');
    const passwordHash = input.password ? await hashPassword(input.password) : undefined;
    const id = input.id ?? randomUUID();
    await staffTransaction(deps.pool, async tx => {
      const users = (await tx.query('SELECT "id", "role", "active" FROM "User" ORDER BY "id" FOR UPDATE')).rows;
      const current = users.find(u => u.id === actor.id);
      if (!current?.active || current.role !== 'SUPER_ADMIN') throw new BusinessError('Forbidden', 403);
      if (input.id && !users.some(u => u.id === id)) throw new BusinessError('Employee not found', 404);
      if ((!input.active || input.role !== 'SUPER_ADMIN') && users.filter(u => u.active && u.role === 'SUPER_ADMIN' && u.id !== id).length === 0) throw new BusinessError('Keep at least one active Super Admin');
      if (input.id) await tx.query('UPDATE "User" SET "name"=$2, "email"=$3, "role"=$4::"Role", "active"=$5, "passwordHash"=COALESCE($6,"passwordHash") WHERE "id"=$1', [id, input.name, input.email, input.role, input.active, passwordHash]);
      else await tx.query('INSERT INTO "User" ("id","name","email","role","active","passwordHash") VALUES ($1,$2,$3,$4::"Role",$5,$6)', [id, input.name, input.email, input.role, input.active, passwordHash]);
      if (passwordHash || !input.active || input.role !== users.find(u => u.id === id)?.role) await tx.query('DELETE FROM "Session" WHERE "userId"=$1', [id]);
      await tx.query('INSERT INTO "AuditEvent" ("id","actorId","entityType","entityId","action","data") VALUES ($1,$2,\'User\',$3,\'STAFF_SAVED\',$4::jsonb)', [randomUUID(), actor.id, id, JSON.stringify({ name: input.name, email: input.email, role: input.role, active: input.active, passwordChanged: !!passwordHash })]);
    });
    res.json({ id });
  });
  router.post('/media', express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '5mb' }), async (req, res) => {
    if ((res.locals.staff as Staff).role !== 'SUPER_ADMIN') throw new BusinessError('Forbidden', 403);
    if (!deps.media || !deps.bucket) throw new BusinessError('Media service unavailable', 503);
    const bytes = req.body as Buffer;
    if (!Buffer.isBuffer(bytes)) throw new BusinessError('Upload JPEG, PNG or WebP', 400);
    const kind = bytes.subarray(0, 3).equals(Buffer.from([255,216,255])) ? 'jpg' : bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'png' : bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP' ? 'webp' : '';
    if (!kind) throw new BusinessError('Invalid image file', 400);
    const key = `${randomUUID()}.${kind}`;
    await deps.media.putObject(deps.bucket, key, bytes, bytes.length, { 'Content-Type': `image/${kind === 'jpg' ? 'jpeg' : kind}` });
    res.json({ image: `/media/${key}` });
  });
  return router;
}
