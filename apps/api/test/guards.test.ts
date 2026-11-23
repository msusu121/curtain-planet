import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertCustodyAcceptance, assertRelease } from '../src/domain/guards.ts';

test('release blocks unpaid orders, wrong collector, missing clearance and quantity mismatch', () => {
  const valid = { balanceMinor: 0, assignedCollectorId: 'ali', collectorId: 'ali', hasClearance: true, expectedPieces: 6, countedPieces: 6 };
  assert.doesNotThrow(() => assertRelease(valid));
  for (const change of [{balanceMinor: 1}, {collectorId: 'hassan'}, {hasClearance: false}, {countedPieces: 5}, {countedPieces: -1}]) {
    assert.throws(() => assertRelease({...valid, ...change}));
  }
});
test('sender completion never substitutes for recipient acceptance', () => {
  assert.doesNotThrow(() => assertCustodyAcceptance('ali', 'ali', 6, 6));
  assert.throws(() => assertCustodyAcceptance('ali', 'hassan', 6, 6));
  assert.throws(() => assertCustodyAcceptance('ali', 'ali', 6, 5));
  assert.throws(() => assertCustodyAcceptance('ali', 'ali', 0, 0));
});
