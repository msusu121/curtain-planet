# Curtain Planet Plus engineering instructions

This workspace belongs to the Curatin Planet project. Product name: Curtain Planet Plus.

## Goal and scope

Read `PROJECT_GOAL.md` and `docs/ARCHITECTURE.md` before changing business behavior. The goal is a completed connected application, including all seven staff roles and the entire quotation-to-customer-handover lifecycle. Keep the completion checklist accurate. Never treat a static screen, mocked successful payment or unrun test as proof of completion.

## Required TDD workflow

The owner explicitly requires test-driven development for implementation and fixes.

1. Select a small behavior from the project acceptance criteria.
2. Write a meaningful failing test first. Run it and confirm it fails for the intended missing behavior, not an import, environment or syntax failure.
3. Implement the smallest complete change that makes the test pass.
4. Run the focused test and relevant regression tests.
5. Refactor only with passing tests, then rerun the affected checks.
6. Record what was verified and any blocked checks. Update the goal checklist only after its evidence exists.

Use unit tests for calculation and transition rules; authenticated HTTP tests for role and assignment boundaries; real PostgreSQL integration tests for transaction rollback, concurrent requests, idempotency, stock, financial events and custody. Use browser checks for role navigation, mobile layout and user-visible workflows. Mocks and unit tests alone cannot establish database correctness.

Prefer tests of observable behavior. Every bug fix starts with a regression test. Do not write passing implementation-shaped tests afterward and label the process TDD. Do not bypass failing assertions or silently skip required tests to obtain a green run.

See `docs/TDD_WORKFLOW.md` for the acceptance-driven sequence and verification commands.

## Business invariants

- Enforce role and assigned-record access on the server.
- Use Rings & Packaging consistently; no delivery department.
- Quantities are manual. Measurements do not calculate order quantities.
- Only Super Admin manages raw inventory and catalogue costs/prices. Only POS issues customer receipts.
- Actual transacted prices determine revenue. Quotations are not revenue.
- Deduct stock once. Clearance receipts never create another sale or stock deduction.
- Sender completion never substitutes for independently counted recipient acceptance.
- Full cleared-order handover requires zero balance, named recipient and matching counts.
- Financial changes, inventory and custody transitions must be atomic, audited and protected against duplicate/concurrent requests.
- One selected section and one expanded order at a time in the mobile interface.

## Git and delivery

Keep implementation, migrations, meaningful tests and documentation together in reviewable commits. Exclude `.env`, secrets, dependency folders and generated build output. Do not push without an actual configured destination. Report build or deployment limits honestly; never claim the system is production-ready without verification.
