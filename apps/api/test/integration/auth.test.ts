import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

// Run only against a separate, disposable database with all migrations applied.
const databaseUrl = process.env.TEST_DATABASE_URL;
test('database sessions commit with audits, recheck credentials, and reject audit mutation', { skip: !databaseUrl }, async () => {
  const { PrismaClient } = await import('@prisma/client');
  const { PrismaPg } = await import('@prisma/adapter-pg');
  const { createPrismaAuthStore } = await import('../../src/auth/prisma-store.ts');
  const { hashPassword } = await import('../../src/auth/passwords.ts');
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl! }) });
  const id = randomUUID();
  const hash = randomUUID().replaceAll('-', '').repeat(2);
  try {
    const user = await db.user.create({ data: { id, name: 'Session test', email: `${id}@example.com`, passwordHash: await hashPassword('integration-password'), role: 'POS' } });
    const store = createPrismaAuthStore(db);
    const session = { tokenHash: hash, userId: id, expiresAt: new Date(Date.now() + 60000) };
    assert.equal(await store.createSession(user, session), true);
    const audit = await db.auditEvent.findFirstOrThrow({ where: { actorId: id, action: 'SESSION_CREATED' } });
    assert.equal((await store.findSession(hash, new Date()))?.id, id);
    assert.equal(await store.findSession(hash, session.expiresAt), null);
    await assert.rejects(() => db.auditEvent.update({ where: { id: audit.id }, data: { action: 'CHANGED' } }));
    await assert.rejects(() => db.auditEvent.delete({ where: { id: audit.id } }));
    await assert.rejects(() => db.$executeRawUnsafe('TRUNCATE TABLE "AuditEvent"'));
    await assert.rejects(() => store.createSession(user, session));
    assert.equal(await db.auditEvent.count({ where: { actorId: id, action: 'SESSION_CREATED' } }), 1);
    await db.user.update({ where: { id }, data: { passwordHash: 'changed', active: false } });
    assert.equal(await store.findSession(hash, new Date()), null);
    assert.equal(await store.createSession(user, { ...session, tokenHash: 'a'.repeat(64) }), false);
    await Promise.all([store.revokeSession(hash), store.revokeSession(hash)]);
    assert.equal(await db.session.count({ where: { userId: id } }), 0);
    assert.equal(await db.auditEvent.count({ where: { actorId: id, action: 'SESSION_REVOKED' } }), 1);
  } finally {
    await db.user.deleteMany({ where: { id } });
    await db.$disconnect();
  }
});

