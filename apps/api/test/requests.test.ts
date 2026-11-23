import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runRequest } from '../src/domain/requests.ts';
import { emptyState } from '../src/domain/business.ts';
const actor = { id: 'a', name: 'Admin', email: 'a@example.com', role: 'SUPER_ADMIN' as const };
const command = { type: 'settings.save', valuation: 'FIFO', collectorRoles: ['RINGS_PACKAGING'] };
test('retry returns original result and adds no second business event', () => {
  const first = runRequest(emptyState(), actor, command, [actor]);
  const retry = runRequest(first.state, actor, command, [actor], first.saved);
  assert.equal(retry.replayed, true); assert.deepEqual(retry.saved.result, first.saved.result);
  assert.equal(retry.state.events.length, 1);
});
test('reusing a key for different input is a conflict; object key order is immaterial', () => {
  const first = runRequest(emptyState(), actor, command, [actor]);
  assert.throws(() => runRequest(first.state, actor, { ...command, valuation: 'WEIGHTED_AVERAGE' }, [actor], first.saved), /different request/i);
  assert.equal(runRequest(first.state, actor, { collectorRoles: ['RINGS_PACKAGING'], valuation: 'FIFO', type: 'settings.save' }, [actor], first.saved).replayed, true);
});
