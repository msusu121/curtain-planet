# Project goal: complete Curtain Planet Plus

Owner instruction, 23 November 2026: act as an advanced full-stack engineer and carry this project through to completion. Include the project in Git. The supplied architecture and visual references define the intended application; a sign-in page or static mockup does not count as completion.

Required workflow: **TDD — red, green, refactor** for implementation and fixes. Run a meaningful failing behavior test before writing the implementation, then make it pass and refactor. Follow `AGENTS.md` and `docs/TDD_WORKFLOW.md` throughout the project.

## Definition of done

- [ ] Connected, responsive role workspaces for Super Admin, Salesperson, POS, Cutting, Tailor, Rings & Packaging, and Storekeeper.
- [ ] Premium navy/blue interface informed by supplied references, compact phone layouts, visible role navigation, only the selected section open, and one expanded order at a time.
- [ ] Customers, reusable rooms/window measurements, design photographs, explicit colour variants, manual quantities, quotation drafts/submission/printing and attributable POS conversion.
- [ ] Admin-controlled catalogue and raw inventory, purchase cost history, transactional stock ledger and audited adjustments.
- [ ] POS direct/quoted sales, actual per-line price overrides, partial payments, original receipts, fresh zero-balance clearance receipts, promised dates and named collectors.
- [ ] One combined cutting task per order, exact tailor allocations, no partial dispatch and independently counted acceptance.
- [ ] Private tailor queues, agreed pay, sewing completion and handover to a named Rings & Packaging employee.
- [ ] Rings & Packaging tasks visible from initial assignment, count/accept, optional rings, finish/pack, then independently accepted storage or POS-cleared direct handover.
- [ ] Finished-goods storage, independently counted receipt, verified zero balance, named collector release, collector acceptance and explicit customer handover.
- [ ] POS shifts, expenses, separate tailor payouts/liabilities, drawer reconciliation and admin reports using actual selling prices.
- [ ] Server-enforced roles and assignment permissions, secure sessions, validated transitions, idempotent financial/stock/custody operations and append-only audit events.
- [ ] Persistent state across reloads, reproducible setup, migrations, appropriate automated tests, production builds and documented operational limits.
- [ ] All architecture section 16 acceptance scenarios demonstrated; unfinished or blocked items explicitly documented.
- [ ] Source, lockfile, migrations, documentation and CI committed to Git; secrets, dependencies and build output excluded. Push when a remote is configured and available.

## Authoritative requirements

`Curtain_Planet_Plus_Complete_System_Architecture - Copy.pdf`, version 1.0, nine pages, dated 23 November 2026. Latest workflow instructions override older visual labels: use **Rings & Packaging**, never the legacy department name. Storekeeper handles finished goods only. Only POS issues official customer receipts. No invented delivery department.

## Decisions requiring an explicit configuration or owner input

Inventory valuation (FIFO or weighted average); returns/refunds/cancellations/damage policy; fiscal/tax receipt requirements; physical printer; verified payment provider; offline POS expectations; discrepancy/reversal permissions; allowed collector roles and partial collections. Do not claim integrations are live without credentials and verification.

## Starting state

The repository initially contains infrastructure, staff authentication, custody guards and a sign-in screen. The business domains are not complete. No Git commits or remote were present at inspection. A checked item above must be supported by implementation and verification, not intention.
