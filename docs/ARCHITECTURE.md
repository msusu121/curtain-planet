# Curtain Planet Plus foundation

Source reviewed: Curtain_Planet_Plus_Complete_System_Architecture(1).pdf, all nine pages, version 1.0, 23 November 2026.

One connected application: quotation → POS confirmation and payments → combined cutting → separately assigned tailoring → Rings & Packaging → direct cleared handover or finished storage → named collection and customer handover.

Server-side role AND assignment checks are required. Roles: Super Admin, Salesperson, POS, Cutting, Tailor, Rings & Packaging, Storekeeper. Storekeeper handles finished orders only. Super Admin controls raw stock and catalogue. Only POS issues customer receipts. No delivery department.

Quantities are entered manually; measurements never infer sale quantities. Use PostgreSQL Decimal for metres and money; JSON numbers must not perform accounting. Sale prices are snapshots; POS overrides do not edit catalogue. Stock deductions, payments, receipts and releases need unique idempotency records inside transactions. Financial corrections use reversal entries. Immutable audits must be enforced at database level before business APIs ship.

One cutting task per order; no partial dispatch. Tailors independently accept allocations. Packaging recipient is named at assignment and sees awaiting-tailor work. Every custody recipient counts and explicitly accepts; sender completion never transfers custody. Rings are optional, packing is required. Full order release requires zero balance, fresh clearance, named collector and matching quantities. Clearance creates neither revenue nor stock deduction.

Foundation scope: health endpoints, dependency clients, base identity/customer/audit schema, tested pure custody guards, responsive placeholder and Docker/GitHub configuration. Staff authentication is now implemented; domain business mutations remain unimplemented. See AUTHENTICATION.md for the identity increment. Pure guards are not a substitute for transaction-level authorization.

Next domains: catalogue/media; customers/rooms/windows; quotation; inventory ledger/purchase batches; sales/payments/receipts/shifts; production assignments and acceptance; finished storage/collection; reporting and audit. Translate all section 16 acceptance scenarios into integration tests before each domain ships.

Open owner/accountant decisions: FIFO vs weighted average; refund/cancellation/damage handling; fiscal receipt and printer; payment provider verification; offline POS; discrepancy/reversal permissions; partial collections; collector permission subset. Do not silently choose these. UI awaits supplied designs, one selected page and one expanded order at a time.

## Identity increment

Staff login, current identity, logout, role/assignment helpers and one-time administrator bootstrap have been added. Sessions and corresponding audit events commit in database transactions. The second migration enforces normalized staff emails and append-only audit triggers. The web now presents one login/account screen, with no fabricated operational data.

No additional financial or collection policy decisions were made. Staff lifecycle management, password recovery, distributed rate limiting and restricted production database credentials remain prerequisites for a shared production rollout.
