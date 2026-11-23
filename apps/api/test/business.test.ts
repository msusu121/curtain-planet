import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, execute, workspace, type Command } from '../src/domain/business.ts';
import type { Staff } from '../src/auth/service.ts';

const person = (id: string, role: Staff['role']): Staff => ({ id, role, name: id, email: `${id}@example.com` });
const admin = person('admin', 'SUPER_ADMIN'), sales = person('sales', 'SALESPERSON'), pos = person('pos', 'POS');
const cutter = person('cutter', 'CUTTING'), tailor = person('tailor', 'TAILOR'), packer = person('packer', 'RINGS_PACKAGING'), store = person('store', 'STOREKEEPER');
const staff = [admin, sales, pos, cutter, tailor, packer, store];
function fixture() {
  let state = emptyState();
  const run = (actor: Staff, command: Command) => { const reply = execute(state, actor, command, staff); state = reply.state; return reply.result.id; };
  const productId = run(admin, { type: 'product.save', name: 'Royal Flower', colour: 'Blue', unit: 'm', price: 100000, image: '/media/royal.jpg' });
  run(admin, { type: 'settings.save', valuation: 'FIFO', collectorRoles: ['RINGS_PACKAGING'] });
  run(admin, { type: 'stock.receive', productId, quantity: 100000, unitCost: 40000, reference: 'Batch A' });
  const customerId = run(sales, { type: 'customer.save', name: 'Fatuma', phone: '0723456789', location: 'Nyali', rooms: [{ name: 'Sitting room', windows: [{ width: '2.50', height: '2.80' }] }] });
  const lines = [{ productId, quantity: 12000, pieces: 4, room: 'Sitting room', width: '2.50', height: '2.80', rings: false, price: 75000 }];
  const assignments = [{ line: 0, tailorId: tailor.id, packerId: packer.id, quantity: 12000, pieces: 4, agreedPay: 200000 }];
  const openShift = () => run(pos, { type: 'shift.open', opening: 100000 });
  const sale = (paid = 900000) => { openShift(); return run(pos, { type: 'order.create', customerId, lines, assignments, cutterId: cutter.id, discount: 0, paid, method: 'CASH', promisedDate: '2026-12-01' }); };
  return { run, get state() { return state; }, productId, customerId, lines, assignments, sale, openShift };
}

test('catalogue and purchase history are admin-only; manual customer measurements persist', () => {
  const f = fixture();
  assert.equal(f.state.products[0].stock, 100000);
  assert.equal(f.state.customers[0].rooms[0].windows[0].width, '2.50');
  assert.throws(() => f.run(store, { type: 'stock.receive', productId: f.productId, quantity: 1000, unitCost: 1 }), /Forbidden/);
  f.run(admin, { type: 'stock.receive', productId: f.productId, quantity: 10000, unitCost: 50000, reference: 'Batch B' });
  assert.deepEqual(f.state.products[0].batches.map(b => b.unitCost), [40000, 50000]);
});

test('sale uses actual price, deducts stock once and preserves catalogue price; invalid allocations roll back', () => {
  const f = fixture(); const id = f.sale();
  assert.equal(f.state.products[0].stock, 88000);
  assert.equal(f.state.products[0].price, 100000);
  assert.equal(f.state.orders[0].total, 900000);
  assert.equal(f.state.orders[0].cost, 480000);
  assert.equal(f.state.orders[0].id, id);
  const before = JSON.stringify(f.state);
  assert.throws(() => f.run(pos, { type: 'order.create', customerId: f.customerId, lines: f.lines, assignments: [], cutterId: cutter.id, discount: 0, paid: 0, method: 'CASH' }), /allocation/i);
  assert.equal(JSON.stringify(f.state), before);
});

test('multi-room quote is not revenue; submitted quote converts once with salesperson attribution', () => {
  const f = fixture();
  const quoteId = f.run(sales, { type: 'quote.save', customerId: f.customerId, lines: [...f.lines, { ...f.lines[0], room: 'Bedroom', quantity: 5000, pieces: 2 }], discount: 0, notes: 'Manual quantities' });
  assert.equal(f.state.orders.length, 0);
  assert.equal(f.state.quotes[0].lines[1].quantity, 5000);
  f.run(sales, { type: 'quote.submit', id: quoteId }); f.openShift();
  f.run(pos, { type: 'order.create', quoteId, customerId: f.customerId, lines: f.state.quotes[0].lines, assignments: [...f.assignments, { ...f.assignments[0], line: 1, quantity: 5000, pieces: 2 }], cutterId: cutter.id, discount: 0, paid: 0, method: 'CASH' });
  assert.equal(f.state.orders[0].salespersonId, sales.id);
  assert.equal(f.state.quotes[0].status, 'CONVERTED');
  assert.throws(() => f.run(pos, { type: 'order.create', quoteId }), /submitted/i);
  assert.equal('reports' in workspace(f.state, sales), false);
});

test('one combined cutting task requires all pieces and independent named tailor acceptance', () => {
  const f = fixture(); const id = f.sale(); const job = f.state.jobs[0];
  assert.equal(job.status, 'AWAITING_CUTTING');
  assert.throws(() => f.run(cutter, { type: 'cutting.complete', id, actual: [{ line: 0, quantity: 12000, pieces: 3 }] }), /pieces/i);
  f.run(cutter, { type: 'cutting.complete', id, actual: [{ line: 0, quantity: 12000, pieces: 4 }] });
  assert.equal(f.state.jobs[0].status, 'AWAITING_TAILOR');
  assert.throws(() => f.run(person('other', 'TAILOR'), { type: 'job.accept', id: job.id, counted: 4 }), /Forbidden/);
  f.run(tailor, { type: 'job.accept', id: job.id, counted: 3 });
  assert.equal(f.state.jobs[0].status, 'AWAITING_TAILOR');
  assert.equal(f.state.discrepancies.length, 1);
  assert.throws(() => f.run(tailor, { type: 'job.accept', id: job.id, counted: 4 }), /discrepancy/i);
  f.run(admin, { type: 'discrepancy.resolve', id: f.state.discrepancies[0].id, reason: 'Missing piece delivered and recounted' });
  f.run(tailor, { type: 'job.accept', id: job.id, counted: 4 });
  assert.equal(f.state.jobs[0].status, 'SEWING');
});

function packed(f: ReturnType<typeof fixture>, id: string) {
  const jobId = f.state.jobs[0].id;
  f.run(cutter, { type: 'cutting.complete', id, actual: [{ line: 0, quantity: 12000, pieces: 4 }] });
  f.run(tailor, { type: 'job.accept', id: jobId, counted: 4 });
  f.run(tailor, { type: 'job.sew', id: jobId, counted: 4 });
  f.run(tailor, { type: 'job.handover', id: jobId });
  assert.equal(f.state.jobs[0].status, 'AWAITING_PACKAGING');
  f.run(packer, { type: 'packaging.accept', id: jobId, counted: 4 });
  f.run(packer, { type: 'packaging.finish', id: jobId, counted: 4 });
  return jobId;
}

test('packaging sees awaiting-tailor assignment, accepts independently and packs no-rings work', () => {
  const f = fixture(); const id = f.sale();
  assert.equal(workspace(f.state, packer).jobs.length, 1);
  const jobId = packed(f, id);
  assert.equal(f.state.jobs[0].rings, false);
  assert.equal(f.state.jobs[0].status, 'PACKED');
  f.run(packer, { type: 'packaging.direct', id, counted: 4 });
  assert.equal(f.state.jobs[0].status, 'HANDED_TO_CLIENT');
  assert.throws(() => f.run(packer, { type: 'packaging.store', id: jobId }), /state/i);
});

test('unpaid handover is blocked and fresh clearance creates neither revenue nor stock movement', () => {
  const f = fixture(); const id = f.sale(100000); packed(f, id);
  assert.throws(() => f.run(packer, { type: 'packaging.direct', id, counted: 4 }), /clearance/i);
  assert.throws(() => f.run(pos, { type: 'collection.clear', id, collectorId: packer.id }), /balance/i);
  f.run(pos, { type: 'payment.record', id, amount: 800000, method: 'CASH' });
  f.run(pos, { type: 'collection.clear', id, collectorId: packer.id });
  assert.equal(f.state.orders.length, 1); assert.equal(f.state.products[0].stock, 88000);
  assert.equal(f.state.orders[0].receipts.filter(r => r.kind === 'CLEARANCE').length, 1);
});

test('storage release verifies named collector; receiving and client handover remain separate', () => {
  const f = fixture(); const id = f.sale(); const jobId = packed(f, id);
  f.run(packer, { type: 'packaging.store', id: jobId });
  assert.equal(f.state.jobs[0].status, 'AWAITING_STORE');
  f.run(store, { type: 'storage.accept', id: jobId, counted: 4, shelf: 'A2' });
  f.run(pos, { type: 'collection.clear', id, collectorId: packer.id });
  assert.throws(() => f.run(store, { type: 'storage.release', id, collectorId: tailor.id, counted: 4 }), /collector/i);
  f.run(store, { type: 'storage.release', id, collectorId: packer.id, counted: 4 });
  assert.equal(f.state.jobs[0].status, 'RELEASE_PENDING');
  assert.throws(() => f.run(packer, { type: 'collection.handover', id, counted: 4 }), /state/i);
  f.run(packer, { type: 'collection.accept', id, counted: 4 });
  assert.equal(f.state.jobs[0].status, 'WITH_COLLECTOR');
  f.run(packer, { type: 'collection.handover', id, counted: 4 });
  assert.equal(f.state.jobs[0].status, 'HANDED_TO_CLIENT');
});

test('cash expenses and partial tailor payouts reduce drawer once and leave payable balance', () => {
  const f = fixture(); const id = f.sale(); packed(f, id);
  f.run(pos, { type: 'expense.record', amount: 20000, method: 'CASH', category: 'Utilities', description: 'Electricity' });
  f.run(pos, { type: 'expense.record', amount: 50000, method: 'MPESA', category: 'Utilities', description: 'Water' });
  f.run(pos, { type: 'payout.record', jobId: f.state.jobs[0].id, amount: 100000, method: 'CASH' });
  const view = workspace(f.state, pos);
  assert.equal(view.shifts[0].expected, 880000);
  assert.equal(workspace(f.state, tailor).jobs[0].outstandingPay, 100000);
  f.run(pos, { type: 'shift.close', actual: 880000 });
  assert.equal(f.state.shifts[0].variance, 0);
});

test('production views never expose price, purchase cost, other jobs or internal pay of another role', () => {
  const f = fixture(); f.sale();
  for (const actor of [cutter, packer, store]) {
    const json = JSON.stringify(workspace(f.state, actor));
    assert.equal(json.includes('unitCost'), false);
    assert.equal(json.includes('agreedPay'), false);
    assert.equal(json.includes('75000'), false);
  }
  assert.equal(workspace(f.state, person('unassigned', 'TAILOR')).jobs.length, 0);
});

test('weighted-average valuation carries remaining value through successive sales', () => {
  const f = fixture();
  f.run(admin, { type: 'settings.save', valuation: 'WEIGHTED_AVERAGE', collectorRoles: ['RINGS_PACKAGING'] });
  f.run(admin, { type: 'stock.receive', productId: f.productId, quantity: 100000, unitCost: 60000, reference: 'Higher-cost batch' });
  f.sale();
  f.run(pos, { type: 'order.create', customerId: f.customerId, lines: f.lines, assignments: f.assignments, cutterId: cutter.id, discount: 0, paid: 0, method: 'CASH' });
  assert.deepEqual(f.state.orders.map(o => o.cost), [600000, 600000]);
});

test('rings-required work cannot be packed until attachment is explicitly confirmed', () => {
  const f = fixture(); f.openShift();
  const id = f.run(pos, { type: 'order.create', customerId: f.customerId, lines: [{ ...f.lines[0], rings: true }], assignments: f.assignments, cutterId: cutter.id, discount: 0, paid: 0 });
  const job = f.state.jobs[0].id;
  f.run(cutter, { type: 'cutting.complete', id, actual: [{ line: 0, quantity: 12000, pieces: 4 }] });
  f.run(tailor, { type: 'job.accept', id: job, counted: 4 });
  f.run(tailor, { type: 'job.sew', id: job, counted: 4 });
  f.run(tailor, { type: 'job.handover', id: job });
  f.run(packer, { type: 'packaging.accept', id: job, counted: 4 });
  assert.throws(() => f.run(packer, { type: 'packaging.finish', id: job, counted: 4 }), /rings/i);
  f.run(packer, { type: 'packaging.finish', id: job, counted: 4, ringsAttached: true });
  assert.equal(f.state.jobs[0].status, 'PACKED');
});

test('cash and digital expenses retain reference and a description for audit', () => {
  const f = fixture(); f.openShift();
  const id = f.run(pos, { type: 'expense.record', amount: 100, method: 'MPESA', reference: 'PAY123', category: 'Water', description: 'Shop water' });
  assert.equal(f.state.expenses.find(e => e.id === id)?.reference, 'PAY123');
});
