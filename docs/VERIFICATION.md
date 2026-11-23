# Verification — 23 November 2026

## Completion goal and required TDD workflow

- Added `PROJECT_GOAL.md` with the complete application goal and explicit, initially unchecked acceptance checklist.
- Added `AGENTS.md` to make the owner's red/green/refactor requirement persistent for subsequent engineering work.
- Added `docs/TDD_WORKFLOW.md` with acceptance-driven implementation slices and required unit, HTTP, database and browser verification.
- Linked these documents from the README. No business implementation was changed in this increment.
- Reran `npm test`: all eight existing tests passed, none skipped. This is baseline verification, not evidence that the business application is complete or that existing code was originally written with TDD.
- Retried dependency installation: registry requests fail with EACCES; stopped the unsuccessful retry. Docker engine inspection receives permission denied.
- Attempted `git add --all`: Git could not create `.git/index.lock` because permission was denied. No files were staged and no commit or push was created. The repository has no configured remote. Workspace changes remain available, but Git completion remains blocked by the current read-only repository metadata permissions.

## Staff authentication increment

- Reviewed the existing code, architecture, security guidance, deployment and verification notes before implementation.
- Preserved Next.js / React, Express / TypeScript, Prisma / PostgreSQL, Redis and private MinIO.
- Added password hashing, session service, Prisma persistence, auth HTTP routes, permission middleware, one-time admin bootstrap, a login/account screen and auth proxy configuration.
- Added a transactional migration for normalized staff emails, session storage and append-only audit triggers.
- npm test: **8 tests passed**, including six new password/session/permission tests and both original custody/release tests.
- API TypeScript syntax checks passed with Node type stripping; Compose configuration validation passed (with a Docker config access warning).
- Added HTTP contract tests and opt-in PostgreSQL integration tests. These are supplied for execution once dependencies and database access are available; they are not evidence of a verified deployment.
- npm install was retried and failed with operating-system EACCES connecting to registry.npmjs.org:443. No lockfile was produced.
- Docker version and Compose inspection were retried. The client is installed; this execution session receives permission denied accessing the engine named pipe and cannot read the Docker config. This does not establish that Docker Desktop is stopped.
- Typecheck was attempted and could not run because tsc is not installed. HTTP tests were attempted and could not load Express. The optional integration test correctly skipped without TEST_DATABASE_URL. Prisma generation, migration application, full builds, browser verification and live database integration remain unverified in this session.

## Earlier foundation

The original custody guards cover unpaid balance, incorrect collector, absent clearance, invalid/mismatched counts and independent recipient acceptance. Dedicated localhost ports remain PostgreSQL 25432, Redis 26379, MinIO 29000/29001, API 24000 and web 23000.

CI has not run on a remote repository. Dependency resolution and a committed lockfile are still required before reproducible builds can be claimed.

See AUTHENTICATION.md for administrator setup and test commands. Catalogue/media, customer rooms/windows, quotation, inventory, sales/receipts, production and collection remain future domains. Open accounting and collection decisions in ARCHITECTURE.md remain unresolved.


