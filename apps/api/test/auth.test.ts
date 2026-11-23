import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../src/auth/passwords.ts';
import { createAuthService, hashToken, roles, type AuthStore, type LoginStaff, type Session, type Staff } from '../src/auth/service.ts';
import { hasPermission, isAssigned } from '../src/auth/permissions.ts';

const password = 'Curtains-test-passphrase';
const passwordHash = await hashPassword(password);
function fixture() {
  const user: LoginStaff = { id: 'staff-1', name: 'Amina', email: 'amina@example.com', role: 'RINGS_PACKAGING', active: true, passwordHash };
  const sessions = new Map<string, Session>();
  let clock = new Date('2026-11-23T09:00:00Z');
  let accept = true;
  const store: AuthStore = {
    async findByEmail(email) { return email === user.email ? user : null; },
    async createSession(_user, session) { if (!accept) return false; sessions.set(session.tokenHash, session); return true; },
    async findSession(hash, now) {
      const session = sessions.get(hash);
      return session && session.expiresAt > now && user.active ? user : null;
    },
    async revokeSession(hash) { sessions.delete(hash); },
  };
  return { user, sessions, auth: createAuthService(store, () => clock), advance: () => { clock = new Date(clock.getTime() + 12 * 60 * 60 * 1000); }, rejectCommit: () => { accept = false; } };
}

test('passwords are salted, bounded and checked without accepting malformed hashes', async () => {
  assert.notEqual(await hashPassword(password), passwordHash);
  assert.equal(await verifyPassword(password, passwordHash), true);
  assert.equal(await verifyPassword('wrong', passwordHash), false);
  for (const hash of ['', 'scrypt$bad$bad', passwordHash + '$extra']) assert.equal(await verifyPassword(password, hash), false);
  await assert.rejects(() => hashPassword('short'));
  await assert.rejects(() => hashPassword('x'.repeat(129)));
});

test('login normalizes email and stores only token hashes; responses omit credentials', async () => {
  const { auth, sessions } = fixture();
  const result = await auth.login(' AMINA@EXAMPLE.COM ', password);
  assert.ok(result);
  assert.equal(sessions.has(result.token), false);
  assert.equal(sessions.has(hashToken(result.token)), true);
  assert.equal('passwordHash' in result.user, false);
  assert.equal('active' in result.user, false);
  assert.equal((await auth.authenticate(result.token))?.id, 'staff-1');
  assert.equal(await auth.authenticate('malformed'), null);
});

test('unknown, incorrect and disabled credentials share a failed result', async () => {
  const { auth, user } = fixture();
  assert.equal(await auth.login('unknown@example.com', password), null);
  assert.equal(await auth.login(user.email, 'incorrect'), null);
  user.active = false;
  assert.equal(await auth.login(user.email, password), null);
});

test('expiry, sign-out and account deactivation invalidate sessions', async () => {
  for (const reason of ['expiry', 'logout', 'deactivation']) {
    const f = fixture();
    const session = await f.auth.login(f.user.email, password);
    assert.ok(session);
    if (reason === 'expiry') f.advance();
    if (reason === 'logout') { await f.auth.logout(session.token); await f.auth.logout(session.token); }
    if (reason === 'deactivation') f.user.active = false;
    assert.equal(await f.auth.authenticate(session.token), null, reason);
  }
});

test('fresh role is used for existing sessions and failed transaction returns no token', async () => {
  const f = fixture();
  const session = await f.auth.login(f.user.email, password);
  assert.ok(session);
  f.user.role = 'POS';
  assert.equal((await f.auth.authenticate(session.token))?.role, 'POS');
  f.rejectCommit();
  assert.equal(await f.auth.login(f.user.email, password), null);
});

test('receipt issuing is POS-only; stock and staff administration are Super Admin-only', () => {
  for (const role of roles) {
    const user: Staff = { id: 'a', name: 'Staff', email: 'a@example.com', role };
    assert.equal(hasPermission(user, 'receipts:issue'), role === 'POS');
    assert.equal(hasPermission(user, 'staff:manage'), role === 'SUPER_ADMIN');
    assert.equal(hasPermission(user, 'catalogue:manage'), role === 'SUPER_ADMIN');
    assert.equal(isAssigned(user, 'a'), true);
    assert.equal(isAssigned(user, 'other'), false);
    assert.equal(isAssigned(user, ''), false);
  }
});

