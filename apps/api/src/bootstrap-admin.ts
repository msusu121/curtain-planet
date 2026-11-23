import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { z } from 'zod';
import { hashPassword } from './auth/passwords.ts';

const input = z.object({
  DATABASE_URL: z.string().min(1),
  BOOTSTRAP_ADMIN_NAME: z.string().trim().min(1).max(100),
  BOOTSTRAP_ADMIN_EMAIL: z.string().trim().toLowerCase().email().max(254),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(12).max(128),
}).safeParse(process.env);
if (!input.success) {
  console.error('Set DATABASE_URL, BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL and a 12–128 character BOOTSTRAP_ADMIN_PASSWORD.');
  process.exit(1);
}
const env = input.data;
const passwordHash = await hashPassword(env.BOOTSTRAP_ADMIN_PASSWORD);
delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });
try {
  await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(230002)`;
    if (await tx.user.findFirst({ where: { role: 'SUPER_ADMIN' } })) throw new Error('An administrator already exists');
    const user = await tx.user.create({ data: { name: env.BOOTSTRAP_ADMIN_NAME, email: env.BOOTSTRAP_ADMIN_EMAIL, passwordHash, role: 'SUPER_ADMIN' } });
    await tx.auditEvent.create({ data: { actorId: user.id, entityType: 'User', entityId: user.id, action: 'ADMIN_BOOTSTRAPPED', data: {} } });
  });
  console.log('Administrator created. Sign in to Curtain Planet Plus.');
} catch {
  console.error('Administrator not created. Check database access, migrations and whether an administrator already exists.');
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}


