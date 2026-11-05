# RANG Auto Parts: Render and Neon setup

This guide describes the existing RANG storefront and API. It does not seed demo
products into production, create shipping-provider integrations, send support
emails, or claim a destination is deliverable before staff confirms it.

## 1. Prerequisites and repository

- A GitHub repository containing this pnpm monorepo, `pnpm-lock.yaml`, and the
  committed SQL files in `lib/db/drizzle/`.
- Node.js 24 and pnpm 10.26.1. The repository pins the Node line in
  `.node-version` and pnpm in the root `package.json`.
- A Neon PostgreSQL project and Render account.

The repository root is the monorepo root. The API is in
`artifacts/api-server`; the static storefront is in
`artifacts/rang-auto-parts`; database schema and migrations are in `lib/db`.
Use the repository root as the Render root directory.

## 2. Create the Neon database

1. Create a Neon project and database in the region closest to the Render
   backend.
2. Copy the pooled connection string from Neon for the application runtime.
   Keep the username, password, host, and database name private. Require TLS:
   the connection string should include `sslmode=require`.
3. Store this connection string only as the API Web Service's `DATABASE_URL`
   secret. Do not add it to a frontend variable, source file, or GitHub.
4. Keep a separate direct connection string for one-off schema migrations if
   Neon recommends it for your database. Migrations use `DATABASE_URL`; no
   schema changes or sample data are applied automatically when the server
   starts.

The API uses one PostgreSQL pool with a maximum of five connections per
instance. Neon usage and limits can still depend on traffic, queries, storage,
and egress; monitor the Neon dashboard and scale or reduce traffic if limits
are approached.

## 3. Apply schema migrations

Run migrations against the intended Neon database before starting the new API
service. From a trusted clean checkout, install the workspace and enter the
connection string without echoing it or putting it in shell history:

```sh
pnpm install --frozen-lockfile
read -rsp "Neon DATABASE_URL: " DATABASE_URL
echo
export DATABASE_URL
pnpm --filter @workspace/db run migrate
unset DATABASE_URL
```

`migrate` applies the committed, ordered Drizzle SQL migrations, including
`lib/db/drizzle/0000_sloppy_cargill.sql` and later migrations. It is safe to run
again after a successful run. Review and commit generated migration SQL and
metadata together whenever the schema changes. Back up production before any
schema change; do not use `push` or `push-force` against production.

For a database that already contains tables or was previously managed with
schema pushes, pause before applying the migrations. Compare its schema and
`drizzle.__drizzle_migrations` history with the committed SQL first; do not
assume an existing table means its migration was recorded.

The existing catalog seed is for development/demo use only. It requires both
`NODE_ENV=development` and `RANG_DEMO_SEED_CONFIRM=development`, and refuses to
run in production. Do not run it against Neon production. Populate production
with business-approved catalog data through the admin dashboard or a separately
reviewed import.

To reproduce the existing development catalog, first confirm the selected
database is a disposable development database, then run:

```sh
read -rsp "Development DATABASE_URL: " DATABASE_URL
echo
export DATABASE_URL
NODE_ENV=development RANG_DEMO_SEED_CONFIRM=development \
  pnpm --filter @workspace/scripts run seed-demo
unset DATABASE_URL
```

The confirmation environment variable is only a guard; it does not prove which
database a connection string targets. Verify the database name and host in the
database provider's console before running the seed.

The seed uses the committed catalog and `attached_assets/generated_images`,
inserts only missing demo records, and preserves existing records. It does not
create an administrator; use the separately guarded provisioning command for
that. Re-running it is intended for development only.

## 4. Render API Web Service

| Setting | Value |
| --- | --- |
| Root Directory | repository root (`.`); leave blank if Render treats blank as root |
| Runtime | Node |
| Build Command | `pnpm install --frozen-lockfile && pnpm --filter @workspace/api-server run build` |
| Start Command | `pnpm --filter @workspace/api-server run start` |
| Health Check Path | `/api/healthz` |

Set these API Web Service environment variables in Render:

| Variable | Purpose | Secret? |
| --- | --- | --- |
| `DATABASE_URL` | Neon PostgreSQL connection string; use the pooled TLS URL | Yes |
| `FRONTEND_ORIGINS` | Exact Static Site origin(s), comma-separated, without paths | No |
| `NODE_ENV` | Set to `production` | No |
| `PORT` | Render supplies this; do not hardcode it | No |

The service listens on `0.0.0.0` using Render's `PORT`. The health endpoint
checks PostgreSQL and returns `503` if the database cannot be reached. Do not
mark the API healthy solely because its process has started.

`FRONTEND_ORIGINS` must match the deployed Static Site origin exactly, including
the scheme and any custom port. The API rejects cross-origin writes from origins
that are not listed.

## 5. Render Static Site

Create a separate **Static Site** from the same GitHub repository:

| Setting | Value |
| --- | --- |
| Root Directory | repository root (`.`); leave blank if Render treats blank as root |
| Build Command | `pnpm install --frozen-lockfile && pnpm --filter @workspace/rang-auto-parts run build` |
| Publish Directory | `artifacts/rang-auto-parts/dist/public` |

Add a rewrite rule so client-side routes such as `/catalog` and `/admin/login`
load the app:

| Source | Destination | Action |
| --- | --- | --- |
| `/*` | `/index.html` | Rewrite, status `200` |

Set this Static Site build environment:

| Variable | Purpose | Secret? |
| --- | --- | --- |
| `VITE_API_BASE_URL` | API origin only, with no trailing slash or `/api`; e.g. `https://your-api.onrender.com` | No |
| `VITE_REQUIRE_API_BASE_URL` | Set to `true` so a missing or invalid API origin fails the Static Site build | No |

The generated client already calls `/api/...`; the app prepends this origin at
build time. Set `VITE_REQUIRE_API_BASE_URL=true` so the build fails if the API
origin is missing or malformed. `FRONTEND_ORIGINS` on the API must match this
Static Site origin exactly; the API rejects unlisted cross-origin writes.

For reliable cookie-based sign-in and cart persistence, use HTTPS custom domains
for the Static Site and API under the same parent domain, such as
`shop.example.com` and `api.example.com`. Browser cookie rules can block those
flows across separate default hosting domains, so test the actual deployed
domains in the target browsers. Do not put `DATABASE_URL`, a password, or any
other private value in a `VITE_` variable: Vite embeds those values in public
JavaScript.

Product, category, and homepage uploads are stored in PostgreSQL, not on the
Web Service's temporary filesystem. No persistent Render disk or object-storage
service is required for these existing uploads. Public catalog images are
cached, while upload validation and the 5 MB limit remain enforced by the API.

## 6. First deployment and configuration

Use this order:

1. Create Neon and set the API Web Service `DATABASE_URL`.
2. Apply committed migrations to Neon.
3. Create the API Web Service and the Static Site in Render so both assigned
   service URLs are available.
4. Set the API's `FRONTEND_ORIGINS` to the exact Static Site origin. Set the
   Static Site's `VITE_API_BASE_URL` to the API origin and
   `VITE_REQUIRE_API_BASE_URL=true`. Redeploy both services after setting these
   values.
5. Confirm `/api/healthz` returns HTTP `200`; open the Static Site and verify
   product browsing and direct navigation to `/catalog` and `/admin/login`.
6. Provision the administrator using the guarded procedure below.
7. Sign in at `/admin/login` and open **Settings**. Set the store name, currency,
   delivery fee, and support email and/or phone. Publish a staffed support
   channel before launch.

Checkout accepts valid destination details from any country. Country and address
fields are saved with the order; they are not used as an eligibility rule. An
accepted order request is not a promise that a carrier serves the address: the
parts desk must confirm delivery before dispatch. No carrier, tax, or
online-payment provider is configured. The state/region field at checkout is
optional. The configured delivery fee is one flat amount; country-specific
quotes and taxes are not calculated.

Changing the store currency changes how current prices are labeled and how new
orders record their currency. It does not convert product prices or delivery
fees using exchange rates. Review catalog prices and the delivery fee manually
after changing currency; existing orders retain the currency recorded when
they were placed.

The contact form submits feedback to the authenticated staff support inbox.
Configured email and phone are optional `mailto:` and `tel:` links; messages are
stored for staff review but are not emailed automatically. Account password
recovery also remains unavailable until an email-delivery provider is
deliberately added.

### Optional custom domain

1. Add sibling custom domains for the Static Site and API Web Service under the
   same parent domain (for example, `shop.example.com` and `api.example.com`).
   Follow the DNS records Render displays and wait until HTTPS is active.
2. Set `FRONTEND_ORIGINS` to the exact frontend origin and
   `VITE_API_BASE_URL` to the API origin. Rebuild both services and verify
   sign-in and cart persistence using the custom domains.

No real URL, DNS record, or custom domain is assumed in this repository.

## 7. Environment variables by service

### API Web Service

- `DATABASE_URL` — required secret; Neon PostgreSQL TLS connection string.
- `FRONTEND_ORIGINS` — required in production; comma-separated exact Static
  Site origins, without path or trailing slash.
- `NODE_ENV=production` — enables production behavior and secure session cookies.
- `PORT` — supplied by Render; the API binds to it.

### Static Site

- `VITE_API_BASE_URL` — public API origin, no `/api` suffix. Required for the
  Render Static Site + Web Service setup above. It is not secret.
- `VITE_REQUIRE_API_BASE_URL=true` — makes a missing or malformed API origin
  fail the Static Site build. It is not secret.

### One-off commands only

- `RANG_ADMIN_PROVISION_CONFIRM=production` — explicit confirmation for the
  administrator provisioning command; do not save it as a persistent service
  variable.
- `RANG_DEMO_SEED_CONFIRM=development` — development-only sample seed
  confirmation; never use it with production.

`.env.example` contains placeholders only. `.gitignore` excludes `.env` files
and local secrets. Do not commit a real connection string, password, or local
database dump.

## 8. Secure initial administrator

There is no public admin-registration route or default production password.
Provision the intended account from a trusted checkout, using the production
Neon connection string only in a private terminal prompt:

```sh
read -rsp "Neon DATABASE_URL: " DATABASE_URL
echo
export DATABASE_URL
NODE_ENV=production RANG_ADMIN_PROVISION_CONFIRM=production \
  pnpm --filter @workspace/api-server run provision-admin -- admin@example.com
unset DATABASE_URL
```

Replace `admin@example.com` with the authorized administrator's real address.
The command refuses an account that already has a password, never overwrites
one, and revokes old sessions if it promotes an existing passwordless account.
It prints a random one-time password once. Keep that output private, sign in at
`/admin/login`, and immediately change the password from **Account**. Email
changes also require the current password. Do not put the temporary password in
Render logs, a ticket, or GitHub.

For a lost admin password, use the configured recovery email only after an
email-delivery provider is implemented. Until then, an authorized operator can
use this guarded CLI to provision a new account with a different email; it
cannot replace a password on an existing account.

## 9. Verify the deployment

1. Open `https://<api-service-host>/api/healthz`; expect HTTP `200` and
   `{"status":"ok"}`. If Neon is unavailable, expect HTTP `503` with a
   structured error.
2. Open `https://<api-service-host>/api/storefront`; expect JSON and the
   configured storefront settings.
3. Open the storefront and verify product browsing, search, and product details.
   In browser developer tools, confirm requests go to the configured API host's
   `/api/...` paths, not a local address.
4. Verify sign-up/sign-in, sign-out, cart persistence, a cash-on-delivery test
   order, and order visibility in the admin dashboard. Use a test product and
   customer record, not a live customer's details.
5. Verify an allowed destination and a destination excluded by the admin
   delivery list. Prices, stock, fee, and order totals are recalculated by the
   API; checkout rejects missing fields, changed stock, and duplicate order
   submissions.
6. Verify the storefront origin is allowed and an unrelated origin is rejected
   for a write request. Check both `FRONTEND_ORIGINS` and browser CORS errors if
   the API request fails.
7. Test direct navigation and refresh on `/catalog`, `/cart`, `/checkout`, and
   `/admin/login` to confirm the Static Site rewrite is active.

## 10. Deploy future changes and troubleshoot

- Push the reviewed changes to GitHub. Render rebuilds the API Web Service and
  Static Site.
- If a change adds a database column or index, generate and commit its Drizzle
  migration, back up production, run `pnpm --filter @workspace/db run migrate`
  against Neon, then deploy the code that uses it. Migrations are not run on
  API startup.
- If the API returns `503` at `/api/healthz`, check the API logs, `DATABASE_URL`,
  Neon status, connection limit, and TLS requirement.
- If the frontend shows a connection error or CORS failure, check
  `VITE_API_BASE_URL`, `FRONTEND_ORIGINS`, and that both services use HTTPS.
  Rebuild the Static Site after changing its API origin.
- If `/catalog` or another nested page returns `404` on refresh, check the
  Static Site rewrite to `/index.html`.
- If a migration fails, stop and inspect the migration output and current
  schema; do not use `push-force` or drop production tables to recover.
- Checkout does not use a country or region allowlist. The parts desk confirms
  actual delivery arrangements after an order request is submitted.
- If the support inbox has no new message, verify the contact form's success
  state and `/api/support/messages` request. The form stores messages in the
  database; it does not send an email notification.
- If contact links are missing, publish a staffed email address or phone in
  **Settings**. Email delivery for account recovery is not configured by this
  project.
- Before testing or reseeding, confirm that the command targets a development
  database. The sample seed is additive and repeatable but must not be run
  against production.

## 11. Repository checks

From a clean checkout:

```sh
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/rang-auto-parts run build
pnpm --filter @workspace/api-server run test
```

Configure the required database and service variables before running the API.
The checks above verify compilation and builds only; they do not replace live
Neon migration, Render health, browser-origin/CORS, authentication, or order
flow verification.
