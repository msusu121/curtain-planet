# Curtain Planet Plus

Next.js responsive staff workspace + Express/TypeScript API + Prisma/PostgreSQL + Redis + private MinIO. Folder name follows the requested `Curatin Planet`; product label is Curtain Planet Plus.

The active completion goal and acceptance checklist are in [PROJECT_GOAL.md](PROJECT_GOAL.md). All implementation and fixes follow the owner's required [TDD workflow](docs/TDD_WORKFLOW.md) and [engineering instructions](AGENTS.md).

## Windows development

Requires Node 22.12+, npm, Git, Docker Desktop running with Linux containers.

```powershell
Copy-Item .env.example .env
npm install
npm test
npm run db:generate
npm run test:http
npm run typecheck
npm run build
docker compose up -d --build --wait
```

Web: http://localhost:23000. API liveness: http://localhost:24000/health/live. Readiness: http://localhost:24000/health/ready verifies PostgreSQL, Redis and media bucket. MinIO console: http://localhost:29001. Development credentials are in `.env`; replace them before any shared deployment. Ports bind to localhost. Data persists in named volumes; `docker compose down` retains it.

For hot reload, start only infrastructure (`docker compose up -d postgres redis minio minio-init`), copy `.env` to `apps/api/.env`, run migrations, then run `npm run dev:api` and `npm run dev:web` in separate terminals. Never commit environment files.

## GitHub

CI runs tests, generation, TypeScript checks, builds and Docker readiness smoke check. Dependabot, PR template, bug form and security guidance included. Set the real owner in CODEOWNERS, enable branch protection and require Quality checks in repository settings. A remote repository is not automatically created or published.

Use test-first development: reproduce a failing behavior, implement minimally, then refactor. Run database integration tests for financial and custody transactions; pure tests alone cannot establish concurrency safety. See docs/ARCHITECTURE.md for boundaries and deferred decisions.

## Dedicated host ports

| Service | Localhost port | Container port |
| --- | --- | --- |
| PostgreSQL | 25432 | 5432 |
| Redis | 26379 | 6379 |
| MinIO API | 29000 | 9000 |
| MinIO console | 29001 | 9001 |
| Express API | 24000 | 4000 |
| Next.js | 23000 | 3000 |

Change the *_HOST_PORT values in .env if needed, and update DATABASE_URL, REDIS_URL, MINIO_PORT, WEB_ORIGIN and PORT to match for host development. Containers use their own isolated network and internal ports. Do not change another project's containers or ports.


## Staff sign-in

The login screen now connects to server-side staff sessions. Apply both migrations, then create the initial administrator with npm run admin:bootstrap using the environment variables in [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md). No default account is installed. Sign-in, current identity and sign-out are available; department business screens are the next implementation stage.

The auth web proxy defaults to the host API on port 24000. Compose builds it with the internal API address. Set WEB_ORIGIN to the exact public web origin. Production requires HTTPS and NODE_ENV=production on the API for Secure cookies.

See [docs/VERIFICATION.md](docs/VERIFICATION.md) for current verification limits, and [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md) for the HTTP contract, security boundaries and disposable-database tests.
"# curtain-planet" 
