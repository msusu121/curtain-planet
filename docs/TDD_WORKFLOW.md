# Acceptance-driven TDD workflow

Owner requirement recorded 23 November 2026. This is the required implementation workflow for `PROJECT_GOAL.md`.

## Red, green, refactor

For each small behavior, capture a failing assertion before implementation, implement it, verify the assertion and related regression checks, then refactor. Record the command, intended failure and final result in the change's verification notes. An unavailable dependency or database is a blocked test run, not the red phase.

## Implementation sequence

| Slice | First observable failing scenarios | Required verification |
| --- | --- | --- |
| Catalogue and purchases | Non-admin cannot edit stock/prices; image and explicit colour required; purchase batches retain different actual costs | Authenticated HTTP and PostgreSQL ledger tests |
| Customers and quotations | Multi-room measurements persist; manually entered quantity stays unchanged; own-only quote visibility; draft/submitted status; no revenue | Domain, HTTP and mobile browser tests |
| Sales and inventory | Confirming a 12 m sale changes 100 m to 88 m once; concurrent/repeated confirmation cannot double deduct; failed checkout rolls back | PostgreSQL transaction/concurrency tests |
| Actual price accounting | KES 1,000 catalogue item sold at KES 750 reports KES 750 revenue; catalogue unchanged; override audited | Calculation, HTTP and database tests |
| Payments and clearance | Partial payment reduces the same sale balance; duplicate payment posts once; unpaid clearance blocked; fresh clearance changes no stock/revenue | HTTP and database idempotency/rollback tests |
| Cutting and allocation | One combined order task; allocations match exact pieces by variant; partial dispatch blocked; completion does not accept for tailor | Domain, HTTP and database tests |
| Tailoring | Unassigned tailor denied; independent count required; mismatch logged; named packaging recipient required; agreed pay remains internal | Authorization, transition and database tests |
| Rings & Packaging | Assigned job visible while awaiting tailor; matching-count acceptance; no-rings work can finish/pack; uncleared direct handover blocked | HTTP, database and browser tests |
| Storage and collection | Storekeeper cannot receive raw stock; independent finished-piece acceptance; release to wrong collector blocked; collector accepts before explicit customer handover | HTTP, database and browser tests |
| Shifts and liabilities | Cash expense and cash tailor payout reduce drawer once in separate categories; digital expense does not reduce cash; partial payout leaves liability | Exact-money calculation and database tests |
| Admin and staff | Staff activation and role changes enforced; own-only operational visibility; actual prices/costs feed reports; audit mutation rejected | HTTP, PostgreSQL and browser tests |
| End-to-end acceptance | Each architecture section 16 scenario exercised, including persistence after reload and duplicate/concurrent actions | Real database integration and browser journey |

## Commands

From the repository root, after dependencies are installed:

```powershell
npm test
npm run db:generate
npm run test:http
npm run typecheck
npm run build
```

For the real database suite, provide a separate disposable `TEST_DATABASE_URL`, apply migrations to that test database, then run `npm run test:integration`. Never point destructive test setup at operational customer data. A skipped integration suite is not acceptance evidence.

The initial tests use Node's built-in test runner. New domain tests belong in `apps/api/test`; HTTP tests in `apps/api/test/http`; PostgreSQL tests in `apps/api/test/integration`. Introduce a browser test runner when dependencies can be installed; do not claim browser coverage before running it.

## Completion evidence

For each completed slice record: accepted behavior, failing test before change, passing focused/regression results, migration status, browser verification where applicable, and remaining limitations. Every applicable definition-of-done item stays unchecked until this evidence exists.

## Current environment limits

At inspection on 23 November 2026, npm dependency retrieval receives EACCES and Docker engine access is denied. These prevent full dependency installation, PostgreSQL verification and production builds in this execution session. They do not prove services are stopped. Preserve the TDD requirement and report blocked checks rather than claiming completion.
