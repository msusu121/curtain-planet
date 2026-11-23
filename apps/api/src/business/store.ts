import type { Pool, PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import type { Staff } from '../auth/service.ts';
import { BusinessError, emptyState, workspace, type BusinessState, type Command } from '../domain/business.ts';
import { runRequest, type SavedRequest } from '../domain/requests.ts';

export interface BusinessStore {
  view(actor: Staff): Promise<unknown>;
  command(actor: Staff, key: string, command: Command): Promise<{ id: string }>;
}
export class PostgresBusinessStore implements BusinessStore {
  private pool: Pool; constructor(pool: Pool) { this.pool = pool; }
  async view(actor: Staff) {
    const result = await this.pool.query<{ state: BusinessState }>('SELECT "state" FROM "BusinessSnapshot" WHERE "id" = 1');
    return workspace(result.rows[0]?.state ?? emptyState(), actor);
  }
  async command(actor: Staff, key: string, command: Command) {
    const tx = await this.pool.connect();
    try {
      await tx.query('BEGIN');
      await tx.query('SET LOCAL lock_timeout = \'10s\'');
      await tx.query('INSERT INTO "BusinessSnapshot" ("id", "state") VALUES (1, $1::jsonb) ON CONFLICT ("id") DO NOTHING', [JSON.stringify(emptyState())]);
      const snapshot = await tx.query<{ state: BusinessState }>('SELECT "state" FROM "BusinessSnapshot" WHERE "id" = 1 FOR UPDATE');
      // Lock current identities until commit so deactivation/role changes cannot race a mutation.
      const users = await tx.query<Staff>('SELECT "id", "name", "email", "role" FROM "User" WHERE "active" = true ORDER BY "id" FOR SHARE');
      const current = users.rows.find(u => u.id === actor.id);
      if (!current || current.role !== actor.role) throw new BusinessError('Account permissions changed; sign in again', 403);
      const old = await tx.query<SavedRequest>('SELECT "fingerprint", "result" FROM "BusinessRequest" WHERE "actorId" = $1 AND "key" = $2', [actor.id, key]);
      const change = runRequest(snapshot.rows[0].state, current, command, users.rows, old.rows[0]);
      if (!change.replayed) {
        await tx.query('UPDATE "BusinessSnapshot" SET "state" = $1::jsonb, "revision" = "revision" + 1, "updatedAt" = now() WHERE "id" = 1', [JSON.stringify(change.state)]);
        await tx.query('INSERT INTO "BusinessRequest" ("actorId", "key", "fingerprint", "result") VALUES ($1, $2, $3, $4::jsonb)', [actor.id, key, change.saved.fingerprint, JSON.stringify(change.saved.result)]);
        const events = change.state.events.slice(snapshot.rows[0].state.events.length);
        for (const e of events) await tx.query('INSERT INTO "AuditEvent" ("id", "actorId", "entityType", "entityId", "action", "data") VALUES ($1, $2, $3, $4, $5, $6::jsonb)', [randomUUID(), actor.id, 'Business', e.entityId, e.type, JSON.stringify(e)]);
      }
      await tx.query('COMMIT'); return change.saved.result;
    } catch (error) { await tx.query('ROLLBACK'); throw error; }
    finally { tx.release(); }
  }
}

export async function staffTransaction<T>(pool: Pool, operation: (tx: PoolClient) => Promise<T>) {
  const tx = await pool.connect();
  try { await tx.query('BEGIN'); const value = await operation(tx); await tx.query('COMMIT'); return value; }
  catch (error) { await tx.query('ROLLBACK'); throw error; }
  finally { tx.release(); }
}

