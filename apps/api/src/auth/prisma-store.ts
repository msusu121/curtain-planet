import type { PrismaClient } from '@prisma/client';
import type { AuthStore, LoginStaff } from './service.ts';

export function createPrismaAuthStore(db: PrismaClient): AuthStore {
  return {
    findByEmail: email => db.user.findUnique({ where: { email } }),
    createSession: (user, session) => db.$transaction(async tx => {
      const current = await tx.$queryRaw<LoginStaff[]>`SELECT * FROM "User" WHERE "id" = ${user.id}::uuid FOR UPDATE`;
      if (!current[0]?.active || current[0].passwordHash !== user.passwordHash) return false;
      await tx.session.create({ data: session });
      await tx.auditEvent.create({ data: {
        actorId: user.id, entityType: 'User', entityId: user.id, action: 'SESSION_CREATED', data: {},
      } });
      return true;
    }),
    async findSession(tokenHash, now) {
      const session = await db.session.findUnique({ where: { tokenHash }, include: { user: true } });
      if (!session || session.expiresAt <= now || !session.user.active) return null;
      return session.user;
    },
    async revokeSession(tokenHash) {
      await db.$transaction(async tx => {
        const session = await tx.session.findUnique({ where: { tokenHash } });
        if (!session) return;
        const removed = await tx.session.deleteMany({ where: { tokenHash } });
        if (removed.count) await tx.auditEvent.create({ data: {
          actorId: session.userId, entityType: 'User', entityId: session.userId, action: 'SESSION_REVOKED', data: {},
        } });
      });
    },
  };
}
