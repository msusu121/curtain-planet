import { randomUUID } from 'node:crypto';
import type { Staff, StaffRole } from '../auth/service.ts';

// Money is integer KES cents; quantity is integer thousandths of a metre/unit.
// All multiplication/division uses BigInt, with explicit half-up rounding.
export type Command = { type: string; [key: string]: unknown };
type Row = Record<string, unknown>;
export type Batch = { id: string; quantity: number; remaining: number; unitCost: number; reference: string; at: string };
export type Product = { id: string; name: string; colour: string; unit: 'm' | 'pc'; image: string; price: number; stock: number; reorder: number; inventoryValue: number; batches: Batch[] };
export type Customer = { id: string; ownerId: string; name: string; phone: string; location: string; rooms: { name: string; windows: { width: string; height: string }[] }[] };
export type Line = { productId: string; name: string; colour: string; image: string; unit: string; quantity: number; pieces: number; room: string; width: string; height: string; rings: boolean; price: number; standardPrice: number; total: number };
export type Quote = { id: string; number: string; ownerId: string; customerId: string; lines: Line[]; discount: number; total: number; notes: string; status: string; at: string };
export type Payment = { id: string; amount: number; method: string; reference: string; shiftId: string; actorId: string; at: string };
export type Receipt = { id: string; number: string; kind: string; at: string; actorId: string };
export type Order = { id: string; number: string; customerId: string; posId: string; salespersonId?: string; quoteId?: string; lines: Line[]; discount: number; total: number; cost: number; cutterId: string; cuttingDone: boolean; actualCut?: Row[]; payments: Payment[]; receipts: Receipt[]; promisedDate: string; notes: string; at: string; collection?: { collectorId: string; receiptId: string; status: string; storekeeperId?: string } };
export type Job = { id: string; orderId: string; line: number; tailorId: string; packerId: string; quantity: number; pieces: number; rings: boolean; agreedPay: number; status: string; shelf?: string; storekeeperId?: string; timestamps: Record<string, string> };
export type Shift = { id: string; operatorId: string; opening: number; at: string; closedAt?: string; actual?: number; variance?: number };
export type Outflow = { id: string; shiftId: string; actorId: string; amount: number; method: string; category: string; description: string; reference: string; jobId?: string; at: string };
export type Discrepancy = { id: string; entityId: string; orderId: string; actorId: string; expected: number; counted: number; status: string; reason?: string; at: string };
export type Event = { id: string; actorId: string; type: string; entityId: string; at: string; details: Row };
export type BusinessState = { version: 1; settings: { valuation: '' | 'FIFO' | 'WEIGHTED_AVERAGE'; collectorRoles: StaffRole[] }; products: Product[]; customers: Customer[]; quotes: Quote[]; orders: Order[]; jobs: Job[]; shifts: Shift[]; expenses: Outflow[]; payouts: Outflow[]; discrepancies: Discrepancy[]; ledger: { id: string; productId: string; quantity: number; unitCost?: number; orderId?: string; reason: string; at: string }[]; events: Event[] };
export class BusinessError extends Error { status: number; constructor(message: string, status = 422) { super(message); this.status = status; } }
function ensure(condition: unknown, message: string, status = 422): asserts condition { if (!condition) throw new BusinessError(message, status); }
const uid = () => randomUUID();
const text = (v: unknown, optional = false): string => { ensure(typeof v === 'string' && (optional || v.trim().length > 0) && v.length <= 4000, 'Invalid text'); return v.trim(); };
const integer = (v: unknown, minimum = 0): number => { ensure(typeof v === 'number' && Number.isSafeInteger(v) && v >= minimum && v <= 1000000000000, 'Invalid integer amount or quantity'); return v; };
const array = (v: unknown): Row[] => { ensure(Array.isArray(v) && v.length <= 200 && v.every(x => x && typeof x === 'object' && !Array.isArray(x)), 'Invalid list'); return v as Row[]; };
const sum = (values: number[]) => integer(values.reduce((a, b) => a + b, 0));
const ratio = (a: number, b: number, divisor: number) => integer(Number((BigInt(a) * BigInt(b) + BigInt(Math.floor(divisor / 2))) / BigInt(divisor)));
const found = <T extends { id: string }>(rows: T[], id: unknown): T => { const item = rows.find(r => r.id === id); ensure(item, 'Record not found', 404); return item; };
const allowed = (actor: Staff, ...roles: StaffRole[]) => ensure(roles.includes(actor.role), 'Forbidden', 403);
const assigned = (actor: Staff, id: string) => ensure(actor.id === id, 'Forbidden: assigned employee required', 403);
export const balance = (order: Order) => order.total - sum(order.payments.map(p => p.amount));
export function emptyState(): BusinessState { return { version: 1, settings: { valuation: '', collectorRoles: [] }, products: [], customers: [], quotes: [], orders: [], jobs: [], shifts: [], expenses: [], payouts: [], discrepancies: [], ledger: [], events: [] }; }
function snapshot(s: BusinessState, value: unknown, override: boolean): Line[] {
  const lines = array(value); ensure(lines.length > 0, 'Add at least one line');
  return lines.map(l => {
    const p = found(s.products, l.productId), quantity = integer(l.quantity, 1), pieces = integer(l.pieces ?? 0);
    ensure(p.unit !== 'pc' || quantity % 1000 === 0, 'Pieces must use whole units');
    ensure(p.unit !== 'm' || pieces > 0, 'Fabric requires manually entered pieces');
    const price = override ? integer(l.price ?? p.price) : p.price;
    return { productId: p.id, name: p.name, colour: p.colour, image: p.image, unit: p.unit, quantity, pieces, price, standardPrice: p.price, total: ratio(price, quantity, 1000), room: text(l.room ?? '', true), width: text(l.width ?? '', true), height: text(l.height ?? '', true), rings: l.rings === true };
  });
}
function total(lines: Line[], discount: unknown) { const subtotal = sum(lines.map(l => l.total)); const d = integer(discount ?? 0); ensure(d <= subtotal, 'Discount exceeds subtotal'); return subtotal - d; }
function shiftFor(s: BusinessState, actor: Staff) { const sh = s.shifts.find(sh => sh.operatorId === actor.id && !sh.closedAt); ensure(sh, 'Open your shift first'); return sh; }
function method(value: unknown, reference: unknown, requireReference = true) { ensure(['CASH', 'MPESA', 'BANK', 'CARD', 'OTHER'].includes(String(value)), 'Invalid payment method'); const ref = text(reference ?? '', true); ensure(!requireReference || value === 'CASH' || ref.length > 0, 'External payment reference required'); return { method: String(value), reference: ref }; }
function paidFor(s: BusinessState, jobId: string) { return sum(s.payouts.filter(p => p.jobId === jobId).map(p => p.amount)); }
function payable(job: Job) { return ['PACKING', 'PACKED', 'AWAITING_STORE', 'STORED', 'RELEASE_PENDING', 'WITH_COLLECTOR', 'HANDED_TO_CLIENT'].includes(job.status); }
export function expectedCash(s: BusinessState, sh: Shift) { return sh.opening + sum(s.orders.flatMap(o => o.payments.filter(p => p.shiftId === sh.id && p.method === 'CASH').map(p => p.amount))) - sum([...s.expenses, ...s.payouts].filter(e => e.shiftId === sh.id && e.method === 'CASH').map(e => e.amount)); }

export function execute(original: BusinessState, actor: Staff, c: Command, staff: Staff[]): { state: BusinessState; result: { id: string } } {
  const s = structuredClone(original), at = new Date().toISOString(); let id = typeof c.id === 'string' ? c.id : uid();
  const employee = (value: unknown, role?: StaffRole) => { const user = staff.find(u => u.id === value); ensure(user && (!role || user.role === role), 'Choose an active assigned employee'); return user; };
  const event = (type: string, entityId: string, details: Row = {}) => s.events.push({ id: uid(), type, entityId, actorId: actor.id, at, details });
  const orderJobs = (o: Order) => s.jobs.filter(j => j.orderId === o.id);
  const clear = (o: Order) => ensure(balance(o) === 0, 'POS clearance required: outstanding balance');
  const count = (entityId: string, orderId: string, expected: number, value: unknown): boolean => {
    ensure(!s.discrepancies.some(d => d.entityId === entityId && d.status === 'OPEN'), 'Resolve open quantity discrepancy first');
    const counted = integer(value);
    if (counted === expected) return true;
    const discrepancy: Discrepancy = { id: uid(), entityId, orderId, actorId: actor.id, expected, counted, status: 'OPEN', at };
    s.discrepancies.push(discrepancy); event('QUANTITY_DISCREPANCY', entityId, { expected, counted }); return false;
  };
  const stateIs = (j: Job, status: string) => ensure(j.status === status, `Invalid state: expected ${status}`);
  const transition = (j: Job, status: string) => { j.status = status; j.timestamps[status] = at; };
  const receipt = (o: Order, kind: string): Receipt => { const r = { id: uid(), number: `${kind === 'SALE' ? 'RC' : 'CL'}-${String(s.orders.length).padStart(6, '0')}-${o.receipts.length + 1}`, kind, at, actorId: actor.id }; o.receipts.push(r); return r; };
  switch (c.type) {
    case 'settings.save': {
      allowed(actor, 'SUPER_ADMIN'); ensure(['FIFO', 'WEIGHTED_AVERAGE'].includes(String(c.valuation)), 'Select inventory valuation');
      ensure(s.orders.length === 0 || c.valuation === s.settings.valuation, 'Cannot change valuation after trading begins');
      ensure(Array.isArray(c.collectorRoles) && c.collectorRoles.every(r => ['SALESPERSON', 'POS', 'CUTTING', 'TAILOR', 'RINGS_PACKAGING', 'STOREKEEPER'].includes(r)), 'Invalid collector permissions');
      s.settings = { valuation: c.valuation as 'FIFO' | 'WEIGHTED_AVERAGE', collectorRoles: c.collectorRoles as StaffRole[] }; id = 'settings'; break;
    }
    case 'product.save': {
      allowed(actor, 'SUPER_ADMIN'); const image = text(c.image); ensure(/^\/media\/[a-f0-9-]+\.(jpg|png|webp)$|^\/media\/royal\.jpg$/.test(image), 'Upload a design photograph first');
      ensure(c.unit === 'm' || c.unit === 'pc', 'Invalid unit');
      const old = c.id ? found(s.products, c.id) : undefined;
      ensure(!old || old.unit === c.unit, 'A product unit cannot change');
      const product: Product = { id, name: text(c.name), colour: text(c.colour), image, unit: c.unit, price: integer(c.price), reorder: integer(c.reorder ?? 5000), stock: old?.stock ?? 0, inventoryValue: old?.inventoryValue ?? 0, batches: old?.batches ?? [] };
      if (old) Object.assign(old, product); else s.products.push(product); break;
    }
    case 'stock.receive': case 'stock.adjust': {
      allowed(actor, 'SUPER_ADMIN'); const p = found(s.products, c.productId); let q: number;
      if (c.type === 'stock.receive') q = integer(c.quantity, 1);
      else { ensure(typeof c.quantity === 'number' && Number.isSafeInteger(c.quantity) && c.quantity !== 0 && Math.abs(c.quantity) <= 1000000000, 'Invalid stock adjustment'); q = c.quantity; }
      ensure(p.unit !== 'pc' || q % 1000 === 0, 'Whole pieces required');
      const reason = text(c.type === 'stock.adjust' ? c.reason : c.reference ?? 'Purchase receipt');
      ensure(p.stock + q >= 0, 'Insufficient stock');
      if (q > 0) { const unitCost = integer(c.unitCost); p.batches.push({ id, quantity: q, remaining: q, unitCost, reference: reason, at }); p.inventoryValue += ratio(q, unitCost, 1000); }
      else { const before = p.stock; let remaining = -q, removedValue = 0; for (const b of p.batches) { const take = Math.min(b.remaining, remaining); b.remaining -= take; remaining -= take; removedValue += ratio(take, b.unitCost, 1000); } p.inventoryValue -= s.settings.valuation === 'WEIGHTED_AVERAGE' ? ratio(p.inventoryValue, -q, before) : removedValue; }
      p.stock += q; s.ledger.push({ id, productId: p.id, quantity: q, ...(q > 0 ? { unitCost: integer(c.unitCost) } : {}), reason, at }); break;
    }
    case 'customer.save': {
      allowed(actor, 'SALESPERSON', 'POS', 'SUPER_ADMIN'); const old = c.id ? found(s.customers, c.id) : undefined;
      if (old && actor.role === 'SALESPERSON') assigned(actor, old.ownerId);
      const phone = text(c.phone).replace(/[\s()-]/g, ''); ensure(/^\+?[0-9]{9,15}$/.test(phone), 'Invalid customer phone');
      ensure(!s.customers.some(x => x.phone === phone && x.id !== id), 'Customer phone already exists');
      const rooms = array(c.rooms ?? []).map(r => ({ name: text(r.name), windows: array(r.windows ?? []).map(w => { const width = text(w.width), height = text(w.height); ensure(/^\d{1,4}(\.\d{1,3})?$/.test(width) && /^\d{1,4}(\.\d{1,3})?$/.test(height), 'Invalid measurements'); return { width, height }; }) }));
      const value: Customer = { id, ownerId: old?.ownerId ?? actor.id, name: text(c.name), phone, location: text(c.location ?? '', true), rooms };
      if (old) Object.assign(old, value); else s.customers.push(value); break;
    }
    case 'quote.save': {
      allowed(actor, 'SALESPERSON'); const customer = found(s.customers, c.customerId); assigned(actor, customer.ownerId);
      const old = c.id ? found(s.quotes, c.id) : undefined; if (old) { assigned(actor, old.ownerId); ensure(old.status === 'DRAFT', 'Only drafts can be edited'); }
      const lines = snapshot(s, c.lines, false); const q: Quote = { id, number: old?.number ?? `QT-${String(s.quotes.length + 1).padStart(6, '0')}`, ownerId: actor.id, customerId: customer.id, lines, discount: integer(c.discount ?? 0), total: total(lines, c.discount), notes: text(c.notes ?? '', true), status: 'DRAFT', at };
      if (old) Object.assign(old, q); else s.quotes.push(q); break;
    }
    case 'quote.submit': case 'quote.reject': {
      const q = found(s.quotes, id);
      if (c.type === 'quote.submit') { allowed(actor, 'SALESPERSON'); assigned(actor, q.ownerId); ensure(q.status === 'DRAFT', 'Quote must be draft'); q.status = 'SUBMITTED'; }
      else { allowed(actor, 'POS'); ensure(q.status === 'SUBMITTED', 'Quote must be submitted'); text(c.reason); q.status = 'REJECTED'; } break;
    }
    case 'order.create': {
      allowed(actor, 'POS'); const sh = shiftFor(s, actor);
      const quote = c.quoteId ? found(s.quotes, c.quoteId) : undefined; ensure(!quote || quote.status === 'SUBMITTED', 'Quotation must be submitted and not converted');
      const customer = found(s.customers, quote?.customerId ?? c.customerId);
      const lines = snapshot(s, c.lines ?? quote?.lines, true); const amount = total(lines, c.discount); const paid = integer(c.paid ?? 0); ensure(paid <= amount, 'Payment exceeds sale total');
      const allocations = array(c.assignments ?? []); const fabricLines = lines.map((l, i) => l.unit === 'm' ? i : -1).filter(i => i >= 0);
      const cutterId = fabricLines.length ? employee(c.cutterId, 'CUTTING').id : '';
      const jobs = allocations.map(a => {
        const line = integer(a.line); const l = lines[line]; ensure(l?.unit === 'm', 'Invalid fabric allocation');
        return { id: uid(), orderId: id, line, tailorId: employee(a.tailorId, 'TAILOR').id, packerId: employee(a.packerId, 'RINGS_PACKAGING').id, quantity: integer(a.quantity, 1), pieces: integer(a.pieces, 1), agreedPay: integer(a.agreedPay), rings: l.rings, status: 'AWAITING_CUTTING', timestamps: { AWAITING_CUTTING: at } } satisfies Job;
      });
      for (const index of fabricLines) { const allocated = jobs.filter(j => j.line === index); ensure(sum(allocated.map(j => j.quantity)) === lines[index].quantity && sum(allocated.map(j => j.pieces)) === lines[index].pieces, 'Tailor allocations must equal all ordered metres and pieces'); }
      ensure(!!s.settings.valuation, 'Admin must configure inventory valuation first');
      let cost = 0;
      for (const l of lines) {
        const p = found(s.products, l.productId); ensure(p.stock >= l.quantity, `Insufficient stock: ${p.name} ${p.colour}`);
        const weightedCost = ratio(p.inventoryValue, l.quantity, p.stock);
        let remaining = l.quantity; let lineCost = 0;
        for (const b of p.batches) { const take = Math.min(remaining, b.remaining); b.remaining -= take; remaining -= take; lineCost += ratio(take, b.unitCost, 1000); }
        ensure(remaining === 0, 'Inventory ledger mismatch');
        const consumedValue = s.settings.valuation === 'FIFO' ? lineCost : weightedCost; cost += consumedValue; p.inventoryValue -= consumedValue;
        p.stock -= l.quantity; s.ledger.push({ id: uid(), productId: p.id, quantity: -l.quantity, orderId: id, reason: 'SALE', at });
        if (l.price !== l.standardPrice) event('PRICE_OVERRIDE', id, { productId: p.id, standardPrice: l.standardPrice, actualPrice: l.price, reason: text(c.overrideReason ?? '', true) });
      }
      const order: Order = { id, number: `CP-${String(s.orders.length + 1).padStart(6, '0')}`, customerId: customer.id, posId: actor.id, ...(quote ? { quoteId: quote.id, salespersonId: quote.ownerId } : {}), lines, total: amount, cost: integer(cost), discount: integer(c.discount ?? 0), cutterId, cuttingDone: !fabricLines.length, payments: [], receipts: [], promisedDate: text(c.promisedDate ?? '', true), notes: text(c.notes ?? quote?.notes ?? '', true), at };
      s.orders.push(order); s.jobs.push(...jobs); receipt(order, 'SALE');
      if (paid) order.payments.push({ id: uid(), amount: paid, ...method(c.method, c.reference), shiftId: sh.id, actorId: actor.id, at });
      if (quote) quote.status = 'CONVERTED'; break;
    }
    case 'payment.record': {
      allowed(actor, 'POS'); const o = found(s.orders, id), sh = shiftFor(s, actor), amount = integer(c.amount, 1); ensure(amount <= balance(o), 'Payment exceeds outstanding balance');
      o.payments.push({ id: uid(), amount, ...method(c.method, c.reference), shiftId: sh.id, actorId: actor.id, at }); receipt(o, 'PAYMENT'); break;
    }
    case 'order.promise': { allowed(actor, 'POS'); const o = found(s.orders, id); event('PROMISE_CHANGED', id, { before: o.promisedDate, after: text(c.promisedDate) }); o.promisedDate = text(c.promisedDate); break; }
    case 'cutting.complete': {
      allowed(actor, 'CUTTING'); const o = found(s.orders, id); assigned(actor, o.cutterId); ensure(!o.cuttingDone, 'Invalid state: cutting already completed');
      const actual = array(c.actual); const fabric = o.lines.map((l, i) => ({ l, i })).filter(x => x.l.unit === 'm'); ensure(actual.length === fabric.length, 'Deliver all fabric pieces together');
      for (const { l, i } of fabric) { const rows = actual.filter(a => a.line === i); ensure(rows.length === 1 && rows[0].pieces === l.pieces, 'All allocated pieces must be delivered'); integer(rows[0].quantity, 1); if (rows[0].quantity !== l.quantity) event('CUT_VARIANCE_REQUIRES_ADJUSTMENT', id, { productId: l.productId, planned: l.quantity, actual: rows[0].quantity }); }
      o.actualCut = actual; o.cuttingDone = true; for (const j of orderJobs(o)) transition(j, 'AWAITING_TAILOR'); break;
    }
    case 'job.accept': case 'job.sew': case 'job.handover': case 'packaging.accept': case 'packaging.finish': case 'packaging.store': case 'storage.accept': {
      const j = found(s.jobs, id);
      if (c.type.startsWith('job.')) { allowed(actor, 'TAILOR'); assigned(actor, j.tailorId); }
      if (c.type.startsWith('packaging.')) { allowed(actor, 'RINGS_PACKAGING'); assigned(actor, j.packerId); }
      if (c.type === 'storage.accept') allowed(actor, 'STOREKEEPER');
      const rules: Record<string, [string, string, boolean]> = { 'job.accept': ['AWAITING_TAILOR', 'SEWING', true], 'job.sew': ['SEWING', 'SEWN', true], 'job.handover': ['SEWN', 'AWAITING_PACKAGING', false], 'packaging.accept': ['AWAITING_PACKAGING', 'PACKING', true], 'packaging.finish': ['PACKING', 'PACKED', true], 'packaging.store': ['PACKED', 'AWAITING_STORE', false], 'storage.accept': ['AWAITING_STORE', 'STORED', true] };
      const [before, after, counted] = rules[c.type]; stateIs(j, before); if (c.type === 'packaging.finish' && j.rings) ensure(c.ringsAttached === true, 'Confirm rings are attached before packing');
      if (counted && !count(j.id, j.orderId, j.pieces, c.counted)) break;
      if (c.type === 'storage.accept') { j.shelf = text(c.shelf ?? '', true); j.storekeeperId = actor.id; }
      transition(j, after); break;
    }
    case 'packaging.direct': {
      allowed(actor, 'RINGS_PACKAGING'); const o = found(s.orders, id); clear(o); const jobs = orderJobs(o); ensure(jobs.length > 0 && jobs.every(j => j.packerId === actor.id && j.status === 'PACKED'), 'Invalid state: entire order must be packed by assigned employee; otherwise use storage');
      if (!count(o.id, o.id, sum(jobs.map(j => j.pieces)), c.counted)) break;
      jobs.forEach(j => transition(j, 'HANDED_TO_CLIENT')); break;
    }
    case 'collection.clear': {
      allowed(actor, 'POS'); const o = found(s.orders, id); clear(o); ensure(orderJobs(o).length > 0 && !orderJobs(o).some(j => ['RELEASE_PENDING', 'WITH_COLLECTOR', 'HANDED_TO_CLIENT'].includes(j.status)), 'Invalid state: collection already started');
      const collector = employee(c.collectorId); ensure(s.settings.collectorRoles.includes(collector.role), 'Employee role is not authorized for collection');
      const r = receipt(o, 'CLEARANCE'); o.collection = { collectorId: collector.id, receiptId: r.id, status: 'ASSIGNED' }; break;
    }
    case 'storage.release': case 'collection.accept': case 'collection.handover': {
      const o = found(s.orders, id); clear(o); const collection = o.collection; ensure(collection && o.receipts.some(r => r.id === collection.receiptId && r.kind === 'CLEARANCE'), 'Fresh POS clearance required'); const jobs = orderJobs(o);
      if (c.type === 'storage.release') { allowed(actor, 'STOREKEEPER'); ensure(c.collectorId === collection.collectorId, 'Assigned collector required'); ensure(collection.status === 'ASSIGNED' && jobs.every(j => j.status === 'STORED'), 'Invalid state: full order must be stored'); }
      else { assigned(actor, collection.collectorId); ensure(collection.status === (c.type === 'collection.accept' ? 'RELEASE_PENDING' : 'ACCEPTED'), 'Invalid state: independent collector acceptance required'); }
      if (!count(o.id, o.id, sum(jobs.map(j => j.pieces)), c.counted)) break;
      collection.status = c.type === 'storage.release' ? 'RELEASE_PENDING' : c.type === 'collection.accept' ? 'ACCEPTED' : 'HANDED_TO_CLIENT';
      if (c.type === 'storage.release') collection.storekeeperId = actor.id;
      jobs.forEach(j => transition(j, c.type === 'storage.release' ? 'RELEASE_PENDING' : c.type === 'collection.accept' ? 'WITH_COLLECTOR' : 'HANDED_TO_CLIENT')); break;
    }
    case 'shift.open': { allowed(actor, 'POS'); ensure(!s.shifts.some(x => x.operatorId === actor.id && !x.closedAt), 'Shift already open'); s.shifts.push({ id, operatorId: actor.id, opening: integer(c.opening), at }); break; }
    case 'shift.close': { allowed(actor, 'POS'); const sh = shiftFor(s, actor); id = sh.id; sh.actual = integer(c.actual); sh.variance = sh.actual - expectedCash(s, sh); sh.closedAt = at; break; }
    case 'expense.record': case 'payout.record': {
      allowed(actor, 'POS'); const sh = shiftFor(s, actor), amount = integer(c.amount, 1), m = method(c.method, c.reference, false);
      const entry: Outflow = { id, shiftId: sh.id, actorId: actor.id, amount, method: m.method, reference: m.reference, category: c.type === 'payout.record' ? 'TAILOR_PAY' : text(c.category), description: text(c.description ?? m.reference, true), at };
      if (c.type === 'payout.record') { const j = found(s.jobs, c.jobId); ensure(payable(j), 'Job is not yet payable: packaging acceptance required'); ensure(amount <= j.agreedPay - paidFor(s, j.id), 'Payout exceeds remaining liability'); entry.jobId = j.id; s.payouts.push(entry); }
      else s.expenses.push(entry); break;
    }
    case 'discrepancy.resolve': { allowed(actor, 'SUPER_ADMIN'); const d = found(s.discrepancies, id); ensure(d.status === 'OPEN', 'Discrepancy already resolved'); d.status = 'RESOLVED'; d.reason = text(c.reason); break; }
    default: throw new BusinessError('Unknown command', 400);
  }
  event(c.type, id, { command: c });
  return { state: s, result: { id } };
}

export function workspace(s: BusinessState, actor: Staff) {
  const admin = actor.role === 'SUPER_ADMIN', pos = actor.role === 'POS', sales = actor.role === 'SALESPERSON';
  const jobs = s.jobs.filter(j => admin || pos || (actor.role === 'TAILOR' && j.tailorId === actor.id) || (actor.role === 'RINGS_PACKAGING' && j.packerId === actor.id) || (actor.role === 'CUTTING' && s.orders.some(o => o.id === j.orderId && o.cutterId === actor.id)) || (actor.role === 'STOREKEEPER' && ['AWAITING_STORE', 'STORED', 'RELEASE_PENDING', 'WITH_COLLECTOR', 'HANDED_TO_CLIENT'].includes(j.status)) || s.orders.some(o => o.id === j.orderId && o.collection?.collectorId === actor.id));
  const orders = s.orders.filter(o => admin || pos || jobs.some(j => j.orderId === o.id) || o.collection?.collectorId === actor.id);
  const customerIds = new Set(orders.map(o => o.customerId));
  const safeJobs = jobs.map(j => { const { agreedPay, ...rest } = j; return { ...rest, ...(admin || pos || j.tailorId === actor.id ? { agreedPay, paid: paidFor(s, j.id), outstandingPay: agreedPay - paidFor(s, j.id), payable: payable(j) } : {}) }; });
  const safeOrders = orders.map(o => admin ? { ...o, balance: balance(o) } : pos ? (() => { const { cost, ...rest } = o; return { ...rest, balance: balance(o) }; })() : { id: o.id, number: o.number, customerId: o.customerId, cutterId: o.cutterId, cuttingDone: o.cuttingDone, cleared: balance(o) === 0, collection: o.collection, lines: o.lines.map(l => { const { price, standardPrice, total, ...rest } = l; return rest; }), ...(actor.role === 'CUTTING' ? {} : { promisedDate: o.promisedDate }) });
  const shifts = s.shifts.filter(sh => admin || (pos && sh.operatorId === actor.id)).map(sh => ({ ...sh, expected: expectedCash(s, sh), payments: s.orders.flatMap(o => o.payments).filter(p => p.shiftId === sh.id) }));
  const base = { settings: admin ? s.settings : undefined, products: (admin || pos || sales) ? s.products.map(p => { const { batches, inventoryValue, ...rest } = p; return admin ? p : rest; }) : [], customers: s.customers.filter(c => admin || pos || (sales && c.ownerId === actor.id) || customerIds.has(c.id)).map(c => admin || pos || sales ? c : { id: c.id, name: c.name, phone: c.phone, location: c.location }), quotes: s.quotes.filter(q => admin || (pos && q.status !== 'DRAFT') || (sales && q.ownerId === actor.id)), orders: safeOrders, jobs: safeJobs, shifts, expenses: s.expenses.filter(e => admin || (pos && e.actorId === actor.id)), payouts: s.payouts.filter(p => admin || (pos && p.actorId === actor.id) || jobs.some(j => j.id === p.jobId && j.tailorId === actor.id)), discrepancies: s.discrepancies.filter(d => admin || orders.some(o => o.id === d.orderId)), events: s.events.filter(e => admin || e.actorId === actor.id || orders.some(o => o.id === e.entityId) || jobs.some(j => j.id === e.entityId)).map(e => admin ? e : { id: e.id, actorId: e.actorId, type: e.type, entityId: e.entityId, at: e.at }) };
  return { ...base, ...(admin ? { reports: { actualRevenue: sum(s.orders.map(o => o.total)), costOfGoods: sum(s.orders.map(o => o.cost)), grossProfit: sum(s.orders.map(o => o.total)) - sum(s.orders.map(o => o.cost)), outstandingCustomers: sum(s.orders.map(balance)), expenses: sum(s.expenses.map(e => e.amount)), tailorLiabilities: sum(s.jobs.filter(payable).map(j => j.agreedPay - paidFor(s, j.id))), lowStock: s.products.filter(p => p.stock <= p.reorder).length, openDiscrepancies: s.discrepancies.filter(d => d.status === 'OPEN').length, paymentsByMethod: Object.fromEntries(['CASH', 'MPESA', 'BANK', 'CARD', 'OTHER'].map(m => [m, sum(s.orders.flatMap(o => o.payments).filter(p => p.method === m).map(p => p.amount))])) } } : {}) };
}


