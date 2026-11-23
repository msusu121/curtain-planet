import 'dotenv/config';
import { defineConfig } from 'prisma/config';
export default defineConfig({ schema: 'prisma/schema.prisma', migrations: { path: 'prisma/migrations' }, datasource: { url: process.env.DATABASE_URL ?? 'postgresql://curatin:local-development-only@localhost:25432/curatin' } });

