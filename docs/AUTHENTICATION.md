# Staff authentication

The existing Next.js / Express / Prisma stack now includes staff sign-in. Business domains remain unimplemented; the signed-in page shows the staff identity and department without sample orders.

## Initial administrator

After dependency installation, Prisma generation and migrations, copy the root environment file to `apps/api/.env` for host development. Set these variables in the current PowerShell session:

```powershell
$env:BOOTSTRAP_ADMIN_NAME = 'Administrator'
$env:BOOTSTRAP_ADMIN_EMAIL = 'admin@your-company.example'
# Prompt instead of putting the password into shell history.
$secret = Read-Host 'Administrator password (12–128 characters)' -AsSecureString
$env:BOOTSTRAP_ADMIN_PASSWORD = [System.Net.NetworkCredential]::new('', $secret).Password
try { npm run admin:bootstrap }
finally { Remove-Item Env:BOOTSTRAP_ADMIN_PASSWORD -ErrorAction SilentlyContinue }
```

There are no default staff passwords or public registration routes. Bootstrap takes a PostgreSQL advisory transaction lock, refuses to run if any Super Admin already exists, and writes the account and audit together. It never resets an existing administrator. Staff management and password recovery are future work.

For a running Compose stack, the same variables may be passed explicitly into `docker compose run --rm -e BOOTSTRAP_ADMIN_NAME -e BOOTSTRAP_ADMIN_EMAIL -e BOOTSTRAP_ADMIN_PASSWORD migrate npm run admin:bootstrap`. Clear the password environment variable afterward.

## HTTP contract

| Endpoint | Behavior |
| --- | --- |
| POST /auth/login | JSON email/password; returns public staff identity and sets an HttpOnly cookie |
| GET /auth/me | Returns current staff identity, or 401 |
| POST /auth/logout | Revokes the session, clears the cookie; repeat calls return 204 |

Mutations require an exact `Origin` matching `WEB_ORIGIN`, including non-browser clients. Auth responses disable caching. Login attempts are limited to 10 per IP per 15 minutes per API process; the global limiter also applies. The current topology is a single API process. A shared limiter is needed before multiple replicas.

Passwords use salted scrypt. Sessions use random 256-bit opaque tokens; PostgreSQL stores only SHA-256 hashes, with a fixed 12-hour expiry. Every authenticated request checks current account activity and role. Login rechecks credentials under a user row lock before committing its session and audit. Password changes and staff administration are not exposed yet; their future transactions must revoke existing sessions.

The cookie uses HttpOnly, SameSite=Strict and path /. It adds Secure when `NODE_ENV=production`; production must use HTTPS. Development is on localhost. The web application forwards /auth requests to the API so browsers use the web origin and cookies remain same-origin. For host development, `API_INTERNAL_URL` defaults to http://127.0.0.1:24000. Compose builds the web application with http://api:4000. Change this build-time value when deploying to another topology.

Role middleware is available for future routes. Only POS is permitted to issue receipts; Super Admin controls staff and catalogue. Assignment checks remain separate, with no administrator bypass for custody acceptance. No catalogue, payment, receipt, production or release API is enabled by these permissions.

## Audit and database checks

The new migration normalizes staff emails and adds a constraint, sessions, and PostgreSQL triggers rejecting audit UPDATE, DELETE and TRUNCATE. Case-colliding emails cause the migration to fail and roll back for manual resolution. Database owners and superusers can disable triggers; production must use a separate restricted application role and a migration owner.

```powershell
npm test
npm run test:http
# Use a separate disposable PostgreSQL database, never the operating database.
$env:TEST_DATABASE_URL = 'postgresql://user:password@localhost:25433/curtain_test'
# Apply migrations to that database first, using DATABASE_URL in the API environment.
npm run test:integration
```

Integration tests are skipped when TEST_DATABASE_URL is absent. They create and remove synthetic staff/session records, and intentionally retain append-only audit records. They test session expiry, current account activity, stale credentials, duplicate-session rollback, concurrent logout and audit mutation rejection. HTTP tests require installed workspace dependencies and exercise cookies, origin rejection and login/logout.

