import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { authRouter } from './auth/http.ts';
import type { AuthService } from './auth/service.ts';
import { requireStaff } from './auth/http.ts';
import { businessRouter, type BusinessDependencies } from './business/http.ts';
import { BusinessError } from './domain/business.ts';
export type Checks = Record<string, () => Promise<unknown>>;
export function createApp(checks: Checks, auth?: AuthService, business?: BusinessDependencies) {
  const app = express();
  app.disable('x-powered-by');
  const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:23000';
  app.use(helmet(), cors({origin: webOrigin, credentials: true}), rateLimit({windowMs: 60000, limit: 120}), express.json({limit: '1mb'}));
  if (auth) app.use('/auth', authRouter(auth, webOrigin, process.env.NODE_ENV === 'production'));
  if (auth && business) {
    app.use('/api', businessRouter(auth, webOrigin, business));
    app.get('/media/:key', requireStaff(auth), async (req, res, next) => {
      if (!business.media || !business.bucket || !/^[a-f0-9-]+\.(jpg|png|webp)$/.test(String(req.params.key))) { res.status(404).end(); return; }
      try {
        const key = String(req.params.key);
        const stream = await business.media.getObject(business.bucket, key);
        res.type(key.endsWith('.jpg') ? 'image/jpeg' : key.endsWith('.png') ? 'image/png' : 'image/webp');
        res.set('Cache-Control', 'private, max-age=3600');
        stream.on('error', next); stream.pipe(res);
      } catch { res.status(404).end(); }
    });
  }
  app.get('/health/live', (_req, res) => res.json({status: 'ok'}));
  app.get('/health/ready', async (_req, res) => {
    const results = await Promise.all(Object.entries(checks).map(async ([name, check]) => {
      try { await check(); return [name, 'up']; } catch { return [name, 'down']; }
    }));
    const ready = results.length > 0 && results.every(([,state]) => state === 'up');
    res.status(ready ? 200 : 503).json({status: ready ? 'ready' : 'unavailable', dependencies: Object.fromEntries(results)});
  });
  app.use((_req, res) => res.status(404).json({error: 'NOT_FOUND'}));
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof BusinessError) { res.status(err.status).json({ error: err.message }); return; }
    if ((err as {code?: string}).code === '23505') { res.status(409).json({ error: 'A record with these details already exists' }); return; }
    const status = (err as {status?: number}).status;
    res.status(status === 400 ? 400 : 500).json({error: status === 400 ? 'INVALID_JSON' : 'INTERNAL_ERROR'});
  });
  return app;
}

