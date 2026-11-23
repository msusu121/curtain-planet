import { createHash } from 'node:crypto';
import type { Staff } from '../auth/service.ts';
import { BusinessError, execute, type BusinessState, type Command } from './business.ts';
export type SavedRequest = { fingerprint: string; result: { id: string } };
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)]));
  return value;
}
export function runRequest(state: BusinessState, actor: Staff, command: Command, staff: Staff[], previous?: SavedRequest): { state: BusinessState; saved: SavedRequest; replayed: boolean } {
  const fingerprint = createHash('sha256').update(JSON.stringify(canonical(command))).digest('hex');
  if (previous) {
    if (previous.fingerprint !== fingerprint) throw new BusinessError('Idempotency key belongs to a different request', 409);
    return { state, saved: previous, replayed: true };
  }
  const changed = execute(state, actor, command, staff);
  return { state: changed.state, saved: { fingerprint, result: changed.result }, replayed: false };
}
