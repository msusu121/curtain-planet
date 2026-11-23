import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../../src/app.ts';
import { createAuthService, type AuthStore } from '../../src/auth/service.ts';
import { hashPassword } from '../../src/auth/passwords.ts';

test('HTTP auth enforces origins, private cookies, sessions and sign-out', async () => {
  const user = { id: 'staff', name: 'Amina', email: 'amina@example.com', role: 'POS' as const, active: true, passwordHash: await hashPassword('test-password-123') };
  const sessions = new Set<string>();
  const store: AuthStore = {
    async findByEmail(email) { return email === user.email ? user : null; },
    async createSession(_user, session) { sessions.add(session.tokenHash); return true; },
    async findSession(hash) { return sessions.has(hash) ? user : null; },
    async revokeSession(hash) { sessions.delete(hash); },
  };
  const app = createApp({}, createAuthService(store));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  const origin = process.env.WEB_ORIGIN ?? 'http://localhost:23000';
  const login = (requestOrigin?: string) => fetch(base + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(requestOrigin ? { Origin: requestOrigin } : {}) },
    body: JSON.stringify({ email: user.email, password: 'test-password-123' }),
  });
  try {
    assert.equal((await fetch(base + '/auth/me')).status, 401);
    assert.equal((await login()).status, 403);
    assert.equal((await login('https://other.example')).status, 403);
    const response = await login(origin);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const setCookie = response.headers.get('set-cookie') ?? '';
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /SameSite=Strict/);
    const cookie = setCookie.split(';')[0];
    const me = await fetch(base + '/auth/me', { headers: { Cookie: cookie } });
    assert.equal(me.status, 200);
    assert.equal('passwordHash' in (await me.json()).user, false);
    assert.equal((await fetch(base + '/auth/logout', { method: 'POST', headers: { Origin: origin, Cookie: cookie } })).status, 204);
    assert.equal((await fetch(base + '/auth/me', { headers: { Cookie: cookie } })).status, 401);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

