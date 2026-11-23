import { Router, type RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import type { AuthService, Staff } from './service.ts';
import { hasPermission, type Permission } from './permissions.ts';

const cookieName = 'curtain_session';
const loginInput = z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(128) }).strict();
export function sessionToken(cookie: string | undefined): string {
  return cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1) ?? '';
}
export function requireStaff(auth: AuthService): RequestHandler {
  return async (req, res, next) => {
    const user = await auth.authenticate(sessionToken(req.headers.cookie));
    if (!user) { res.status(401).json({ error: 'AUTHENTICATION_REQUIRED' }); return; }
    res.locals.staff = user;
    next();
  };
}
export function requirePermission(permission: Permission): RequestHandler {
  return (_req, res, next) => {
    const user = res.locals.staff as Staff | undefined;
    if (!user) { res.status(401).json({ error: 'AUTHENTICATION_REQUIRED' }); return; }
    if (!hasPermission(user, permission)) { res.status(403).json({ error: 'FORBIDDEN' }); return; }
    next();
  };
}
export function authRouter(auth: AuthService, webOrigin: string, secure: boolean) {
  const router = Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.use((req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin !== webOrigin) {
      res.status(403).json({ error: 'INVALID_ORIGIN' }); return;
    }
    next();
  });
  const cookieOptions = { httpOnly: true, secure, sameSite: 'strict' as const, path: '/' };
  router.post('/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'TOO_MANY_ATTEMPTS' } }), async (req, res) => {
    const parsed = loginInput.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'INVALID_CREDENTIALS_INPUT' }); return; }
    const session = await auth.login(parsed.data.email, parsed.data.password);
    if (!session) { res.status(401).json({ error: 'INVALID_CREDENTIALS' }); return; }
    res.cookie(cookieName, session.token, { ...cookieOptions, expires: session.expiresAt });
    res.json({ user: session.user });
  });
  router.get('/me', requireStaff(auth), (_req, res) => res.json({ user: res.locals.staff }));
  router.post('/logout', async (req, res) => {
    await auth.logout(sessionToken(req.headers.cookie));
    res.clearCookie(cookieName, cookieOptions);
    res.status(204).end();
  });
  return router;
}

