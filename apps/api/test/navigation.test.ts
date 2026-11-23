import { test } from 'node:test';
import assert from 'node:assert/strict';
import { navigation, fixed } from '../../web/lib/workspace.ts';
test('role navigation contains real work links and excludes other departments', () => {
  assert.deepEqual(navigation('CUTTING'), ['My Orders', 'Completed', 'Collections']);
  assert.deepEqual(navigation('SALESPERSON').slice(0, 4), ['New Quotation', 'My Quotations', "Today’s Activity", 'My Customers']);
  assert.equal(navigation('STOREKEEPER').includes('Catalogue'), false);
  assert.equal(navigation('POS').includes('Sales (POS)'), true);
});
test('form decimal conversion is exact and rejects malformed or over-precise values', () => {
  assert.equal(fixed('12.345', 3), 12345);
  assert.equal(fixed('0.29', 2), 29);
  assert.equal(fixed('750', 2), 75000);
  for (const value of ['-1', 'NaN', '1e3', '1.234', '']) assert.throws(() => fixed(value, 2));
});
