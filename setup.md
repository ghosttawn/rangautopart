# RANG Auto Parts: portable setup and Render + Neon deployment

This guide covers the portable source export, local setup, automatic database
initialization, and deployment to a separate Render API and Static Site backed
by Neon. When the API starts, it initializes the database by itself: it verifies
the connection, applies pending migrations, verifies the schema, and safely
populates the initial storefront when the catalog is empty. The initial
administrator is created automatically by the API from the `ADMIN_EMAIL` and
`ADMIN_PASSWORD` environment variables (see section 8). A fresh Neon database
therefore becomes a usable application database through the normal Render
deployment with no terminal, manual SQL, or separate migration command. The
storefront seed does not create customer accounts or orders.

## 1. Project contents and prerequisites

The clean download includes the storefront and API source, shared API and
database packages, migrations, tests, the exact catalog image fixtures, package
manifests and lockfile, `.env.example`, `.gitignore`, and this setup guide. It
excludes dependency folders, build output, uploaded/private attachments, caches,
Replit-only configuration, the mockup sandbox, and duplicate operations notes.

- Node.js 24 and pnpm 10.26.1. The repository pins these in `.node-version` and
  the root `package.json`.
- A PostgreSQL database for local development.
- A Neon PostgreSQL project and Render account for deployment.

The repository root is the pnpm workspace root. The API is in
`artifacts/api-server`; the static storefront is in
`artifacts/rang-auto-parts`; database schema and migrations are in `lib/db`.
Use the repository root as the Render root directory.

### Install and run locally

From the extracted project root:

```sh
pnpm install --frozen-lockfile
```

Set `DATABASE_URL` in your shell to a local PostgreSQL database or a disposable
Neon development branch. Do not use a production connection string for local
testing. Starting the API applies any pending migrations and seeds the
storefront automatically (see section 3), so no separate steps are required.
The committed migrations and the seed are also available as explicit one-off
commands if you prefer to prepare the database before starting the API:

```sh
pnpm --filter @workspace/db run migrate
```

To recreate the initial storefront in an empty local database without starting
the API, explicitly confirm the development seed:

```sh
NODE_ENV=development RANG_INITIAL_SEED_CONFIRM=development \
  pnpm --filter @workspace/scripts run seed-storefront
```

In one terminal, start the API (it listens on port 5000 by default):

```sh
DATABASE_URL="$DATABASE_URL" NODE_ENV=development \
FRONTEND_ORIGINS=http://localhost:5173 PORT=5000 \
  pnpm --filter @workspace/api-server run dev
```

In a second terminal, start the storefront (Vite listens on port 5173 by
default):

```sh
VITE_API_BASE_URL=http://localhost:5000 \
  pnpm --filter @workspace/rang-auto-parts run dev
```

Open `http://localhost:5173`. The frontend uses the API at
`http://localhost:5000`; `FRONTEND_ORIGINS` must match the local storefront
origin. Set these variables in the shell that starts each service. Never commit
a real `.env` file or database URL.

### Push the clean project to GitHub

1. Create a private GitHub repository under the account that should own the
   project.
2. Extract the download and review `git status --short`. Confirm that `.env`,
   database dumps, and personal attachments are not present.
3. From the project root, initialize Git if this is a new local checkout, then
   connect and push the repository:

   ```sh
   git init
   git add .
   git commit -m "Prepare RANG Auto Parts"
   git branch -M main
   git remote add origin https://github.com/<owner>/<repository>.git
   git push -u origin main
   ```

   If the repository already has a remote or history, inspect it before
   committing. Do not force-push or overwrite unrelated repository history.
4. On GitHub, confirm the source, `pnpm-lock.yaml`, migrations, seed files,
   `.env.example`, and `setup.md` are present.

## 2. Create the Neon database

1. Create a Neon project and database in the region closest to the Render
   backend.
2. Copy the pooled connection string from Neon for the application runtime.
   Keep the username, password, host, and database name private. Require TLS:
   the connection string should include `sslmode=require`.
3. Store this connection string only as the API Web Service's `DATABASE_URL`
   secret. Do not add it to a frontend variable, source file, or GitHub.
4. The automatic deployment migration uses this same `DATABASE_URL`. No
   additional migration URL or frontend database setting is required.

The API uses one PostgreSQL pool with a maximum of five connections per
instance. Neon usage and limits can still depend on traffic, queries, storage,
and egress; monitor the Neon dashboard and scale or reduce traffic if limits
are approached.

## 3. Automatic migrations, schema check, and initial seed

Database initialization is automatic. When the API process starts it runs the
following sequence before it accepts any request, using the API service's
production `DATABASE_URL`:

1. verify the connection to the configured PostgreSQL database;
2. discover and apply every pending Drizzle migration in order;
3. verify that the required tables exist;
4. safely populate the initial storefront when the catalog is empty;
5. provision the initial administrator from `ADMIN_EMAIL`/`ADMIN_PASSWORD`
   (section 8);
6. start serving normal application requests.

Every step is idempotent, so the same path is safe for a fresh deployment, a
backend restart, a subsequent deployment, and a fresh database
initialization. If any step fails, the API logs the reason (without printing
the connection string) and exits with a non-zero status instead of serving
requests against an incomplete schema.

The Render API build command (section 4) also attempts migrations at build
time when `DATABASE_URL` is set, as a fast-feedback optimization. This is
best-effort and never required: a build without database access still succeeds,
because the API applies any pending migrations at startup. The Static Site
build never connects to Neon.

The migration runner takes a PostgreSQL transaction-level advisory lock, reads
Drizzle's migration history (`drizzle.__drizzle_migrations`), and applies
pending SQL in order inside a transaction. Already-recorded migrations are
skipped, and a failing migration rolls back and prevents the API from starting.
The deployed API bundle is self-contained: the build copies the migration SQL
and the catalog image fixtures into `artifacts/api-server/dist`, next to the
bundled server. Review and commit generated migration SQL and metadata together
whenever the schema changes. Back up production before any schema change; do
not use `push` or `push-force` against production.

No manual migration command is needed for a fresh Neon database or subsequent
Render API deployments. The following guarded command remains available for a
trusted one-off operation if needed; enter the connection string without
echoing it or putting it in shell history:

```sh
pnpm install --frozen-lockfile
read -rsp "Neon DATABASE_URL: " DATABASE_URL
echo
export DATABASE_URL
pnpm --filter @workspace/db run migrate
unset DATABASE_URL
```

`migrate` applies the committed, ordered Drizzle SQL migrations, including
`lib/db/drizzle/0000_sloppy_cargill.sql` and later migrations. It uses the same
lock and transaction behavior as the API startup path.

For a database that already contains tables or was previously managed with
schema pushes, pause before the first startup against it. Compare its schema and
`drizzle.__drizzle_migrations` history with the committed SQL first; do not
assume an existing table means its migration was recorded.

### Automatic initial storefront seed

The initial seed recreates the current storefront population: five categories,
eight products, their prices, descriptions, specifications, stock, fitment
records, the current store settings and promotions, and the exact JPEG images.
The image fixtures are copied into the deployed bundle at build time (from
`attached_assets/generated_images`); the seed checks each file's SHA-256 hash
before writing it. Image bytes are stored in PostgreSQL `BYTEA`, then served
through the existing image endpoints.

The seed runs automatically at API startup, right after migrations, and is
guarded so it only ever applies once:

- It requires empty category, product, image, fitment, and store-settings
  tables, and writes all records plus its completion marker
  (`seed_runs` key `rang-initial-storefront-v1`) in one transaction.
- If the marker already exists, it is a no-op, so later administrator edits are
  never replaced on a restart or redeploy.
- If any of those tables already contain data and the marker is missing, it
  stops without changing the database, so an existing custom catalog is
  preserved.

A fresh Neon database is therefore seeded automatically during the first API
startup; no one-time command is required. The same seed is also available as a
guarded one-off command (useful for pre-seeding a local database). It does not
create customers, orders, or an administrator. The administrator is created
automatically by the API at startup from the `ADMIN_EMAIL`/`ADMIN_PASSWORD`
environment variables (section 8); in development, when both are unset, a
documented development fallback is used.

To run the seed explicitly against a database without starting the API, first
verify in the Neon console that this is the intended, empty database, then run
one of:

```sh
# Production database (one-off, trusted checkout)
read -rsp "New Neon DATABASE_URL: " DATABASE_URL
echo
export DATABASE_URL
NODE_ENV=production RANG_INITIAL_SEED_CONFIRM=production \
  pnpm --filter @workspace/scripts run seed-storefront
unset DATABASE_URL
```

```sh
# Fresh local or disposable development database
NODE_ENV=development RANG_INITIAL_SEED_CONFIRM=development \
  pnpm --filter @workspace/scripts run seed-storefront
```

## 4. Render API Web Service

| Setting | Value |
| --- | --- |
| Root Directory | repository root (`.`); leave blank if Render treats blank as root |
| Runtime | Node |
| Build Command | `pnpm install --frozen-lockfile && pnpm --filter @workspace/api-server run render:build` |
| Start Command | `pnpm --filter @workspace/api-server run start` |
| Health Check Path | `/api/healthz` |

Set these API Web Service environment variables in Render:

| Variable | Purpose | Secret? |
| --- | --- | --- |
| `DATABASE_URL` | Neon PostgreSQL connection string; use the pooled TLS URL | Yes |
| `FRONTEND_ORIGINS` | Exact Static Site origin(s), comma-separated, without paths | No |
| `NODE_ENV` | Set to `production` | No |
| `PORT` | Render supplies this; do not hardcode it | No |
| `ADMIN_EMAIL` | Initial administrator email; created automatically on first startup | No |
| `ADMIN_PASSWORD` | Initial administrator password (at least 12 characters) | Yes |

`ADMIN_EMAIL` and `ADMIN_PASSWORD` are used only to create the initial
administrator the first time the API starts against a database that has no
administrator. After that they are ignored, so changing or removing them never
alters an existing administrator (see section 8).

The service listens on `0.0.0.0` using Render's `PORT`. The health endpoint
checks PostgreSQL and returns `503` if the database cannot be reached. Do not
mark the API healthy solely because its process has started.

The `render:build` command always builds the workspace. When `DATABASE_URL` is
present at build time it also applies pending migrations as a fast-feedback
optimization; when it is absent, or if that step fails, the build still
succeeds with a warning. Migrations are applied for real by the API at startup
(section 3), so a mismatched or missing build-time database configuration can
no longer leave a running service pointed at an empty database. Migration and
startup errors are logged without printing the database URL, and a startup
failure exits with a non-zero status so Render does not report the service
healthy. Keep migrations backward-compatible with the currently running API,
and review/back up production before introducing any destructive schema change.
The committed migrations currently create tables and add columns; none drops or
resets tables or records.

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

Product, category, and homepage uploads are multipart binary uploads stored as
raw PostgreSQL `bytea` data, not Base64 text and not files on the Web Service's
temporary filesystem. The API accepts JPEG, PNG, and WebP, checks the declared
type against the file signature, and rejects files over 5 MB. The storefront
also checks type and size before upload. Product images are stored one per
request; repeat the upload to add views, and remove an image from the product
editor to delete it. Replacing a category or homepage image updates its stored
image. A refresh retrieves the bytes from the database-backed image endpoint.
This matches the existing schema and survives Render restarts and redeploys; no
No persistent disk or separate object-storage service is required.

Database-backed images increase Neon storage and backup size as the catalog
grows. Keep product images optimized before upload and monitor database usage.
If the catalog grows beyond this modest per-file design, move image bytes to a
durable provider as a planned migration that preserves the existing image URLs
or updates all references; do not switch to Render's temporary filesystem.

## 6. First deployment and configuration

Use this order:

1. Create the Neon database and copy its pooled TLS connection string.
2. Create the API Web Service and add the connection string as its
   `DATABASE_URL` secret. Set `NODE_ENV=production`, the `FRONTEND_ORIGINS`
   placeholder, and the initial administrator credentials `ADMIN_EMAIL` and
   `ADMIN_PASSWORD` from section 4 before deploying.
3. Deploy the API. Render installs dependencies and builds the API, then the
   service starts and initializes the database automatically: it applies any
   pending migrations, verifies the schema, seeds the initial storefront when
   the catalog is empty, and creates the initial administrator from
   `ADMIN_EMAIL`/`ADMIN_PASSWORD` if none exists. Check the API deployment logs
   for the initialization, seed, and administrator bootstrap messages, then
   verify `/api/healthz` returns HTTP `200`. No manual migration or seed step is
   required for a fresh, empty Neon database.
4. If this database already contains catalog data, the automatic seed safely
   skips it, so no action is needed. Do not run the optional seed command against
   a database that already has a catalog. Never add the seed command to the
   Render build or start commands.
5. For an existing database that already has tables but no matching Drizzle
   migration history, reconcile its schema and migration history before
   deploying. Do not treat an existing table as proof that its migration was
   recorded; the initial migration is not designed to adopt an untracked schema.
6. Create the Static Site in Render so both assigned service URLs are available.
7. Set the API's `FRONTEND_ORIGINS` to the exact Static Site origin. Set the
   Static Site's `VITE_API_BASE_URL` to the API origin and
   `VITE_REQUIRE_API_BASE_URL=true`. Redeploy both services after setting these
   values.
8. Open the Static Site and verify product browsing and direct navigation to
   `/catalog` and `/admin/login`.
9. Sign in at `/admin/login` with the `ADMIN_EMAIL` and `ADMIN_PASSWORD` you
   configured. The account already holds the highest administrator role; no
   manual provisioning step is required. Change the password from **Account**
   settings right after the first sign-in.
10. Open **Settings**. Set the store name, currency,
   delivery fee, and support email and/or phone. If offering WhatsApp inquiries,
   turn on **Offer WhatsApp as an alternative checkout inquiry** and enter a
   valid international number with its country code (for example,
   `+237 690 123 456`). Save the settings and confirm that the WhatsApp option
   appears in checkout. Customers can still submit a normal in-app order; opening
   WhatsApp creates no order or payment. Publish a staffed support channel before
   launch.

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

Use this table as the source of truth for Render and one-off commands. Do not
add secrets to `VITE_` variables; those values are embedded in public
JavaScript.

| Variable | Service / command | Required? | Secret? | Purpose |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | API, migrations, admin provisioning, initial seed | Yes for database access | Yes | Neon PostgreSQL connection string; use TLS and the pooled runtime URL where appropriate. |
| `FRONTEND_ORIGINS` | API Web Service | Yes in production | No | Exact HTTPS frontend origin(s), comma-separated, with no path. |
| `FRONTEND_ORIGIN` | API Web Service | Optional legacy alias | No | Legacy single-origin fallback; prefer `FRONTEND_ORIGINS`. |
| `NODE_ENV` | API Web Service and one-off scripts | Set to `production` on Render | No | Enables production cookie/security behavior and guards production-only admin setup. |
| `PORT` | API Web Service | Render-supplied | No | Port assigned by Render; the API binds to `0.0.0.0:$PORT`. |
| `ADMIN_EMAIL` | API Web Service (initial administrator) | Yes in production until an administrator exists | No | Email of the initial administrator, created automatically once when no administrator exists. |
| `ADMIN_PASSWORD` | API Web Service (initial administrator) | Yes in production until an administrator exists | Yes | Password (12–128 characters) for the initial administrator; hashed before storage. |
| `LOG_LEVEL` | API Web Service | Optional | No | Pino log level; defaults to `info`. |
| `VITE_API_BASE_URL` | Static Site build | Yes for separate Render services | No | Public API origin, without `/api` or a trailing slash. |
| `VITE_REQUIRE_API_BASE_URL` | Static Site build | Set to `true` for Render | No | Fails the build when the separate API origin is missing or malformed. |
| `BASE_PATH` | Vite build | Optional; `/` for Render root | No | Base path for app assets and client routes. |
| `RANG_ADMIN_PROVISION_CONFIRM` | One-off administrator provisioning / recovery | Yes for that command | No | Must be `production` to confirm the guarded production administrator command; do not save it in Render. |
| `RANG_INITIAL_SEED_CONFIRM` | One-time initial storefront seed | Yes for that command | No | Must match `NODE_ENV` (`development` or `production`); never configure it as a Render service variable. |

`.env.example` contains placeholders only. `.gitignore` excludes `.env` files
and local secrets. Do not commit a real connection string, password, or local
database dump.

## 8. Secure initial administrator

There is no public admin-registration route and no default production password.
The initial administrator is created **automatically** by the API. You do not
need a script, a terminal, or direct database access.

### Where to enter the credentials in Render

In the Render dashboard, open the API **Web Service** → **Environment** tab and
add two variables, then save (Render redeploys automatically):

| Key | Value |
| --- | --- |
| `ADMIN_EMAIL` | The administrator's real email address, for example `owner@example.com` |
| `ADMIN_PASSWORD` | A strong password of at least 12 characters |

Keep `ADMIN_PASSWORD` as a secret value. Do not put either value in a `VITE_`
variable, in GitHub, or in a ticket.

### How the initial administrator is created automatically

On every start the API checks whether any account has the `admin` role:

- **No administrator exists and both variables are set:** the API creates one
  administrator account with the configured email, the highest administrator
  role, and the password hashed with the existing scrypt scheme. No plaintext
  password is ever stored. This runs after the API has applied the database
  migrations at startup, so it also works on a brand-new empty Neon database.
- **An administrator already exists:** the API leaves it completely unchanged.
  The variables are ignored from then on.
- **No administrator exists and the variables are missing (production):** the
  API refuses to start and logs a clear error naming `ADMIN_EMAIL` and
  `ADMIN_PASSWORD`, rather than starting without an accessible administrator.
- **No administrator exists and the variables are missing (development):** the
  API creates a development administrator using the documented fallback
  `admin@rang-auto-parts.test` / `rang-development-admin`. This fallback is
  never used when `NODE_ENV=production`.

The bootstrap is idempotent. It is guarded by a PostgreSQL advisory lock, only
inserts when no administrator exists, and never updates an existing account, so
it cannot create duplicates or reset a password.

### How to log in after the first deployment

1. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` before the first deploy (section 4).
2. After the deploy succeeds, open `https://<storefront-host>/admin/login`.
3. Sign in with the email and password you configured.
4. Change the password immediately from **Account** settings.

### How to change administrator credentials

Sign in and open **Account**:

- **Change password:** enter the current password and a new password (12–128
  characters). This revokes other sessions and keeps you signed in.
- **Change email:** enter the new email and confirm your current password. An
  email already used by another account is rejected.

Both changes are stored in the database and remain effective after any
redeploy. Because the bootstrap only runs when no administrator exists, later
changes to `ADMIN_EMAIL`/`ADMIN_PASSWORD` in Render do not overwrite the account.

### How to recover access if credentials are lost

Password-recovery email is not configured in this project, so a deliberate,
guarded recovery command is provided. It only runs when you explicitly pass the
`recover` mode and the confirmation variable, so it can never change
credentials during a normal deployment. Run it from a trusted checkout, entering
the production Neon connection string only at the private prompt:

```sh
read -rsp "Neon DATABASE_URL: " DATABASE_URL
echo
export DATABASE_URL
NODE_ENV=production RANG_ADMIN_PROVISION_CONFIRM=production \
  pnpm --filter @workspace/api-server run provision-admin -- admin@example.com recover
unset DATABASE_URL
```

Replace `admin@example.com` with the existing administrator's email. The command
resets that account's password to a new random one-time password, keeps the
`admin` role, and revokes all of its sessions. It prints the temporary password
once; keep it private, sign in at `/admin/login`, and change it immediately.

To create a brand-new administrator instead (for example with a different email
on an installation that has none), run the same command **without** `recover`.
It refuses an email that already has a password and never overwrites an
existing account.

### What happens when the application is redeployed

- The Render build applies any pending database migrations, then the API starts
  and runs the bootstrap.
- If an administrator already exists, the bootstrap is a no-op: it does not
  create duplicates and does not reset the email or password. Administrator
  changes made in the dashboard are preserved.
- You can safely leave, change, or remove `ADMIN_EMAIL`/`ADMIN_PASSWORD` after
  the first administrator exists; they are ignored.

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
8. Confirm the initial administrator: sign in at
   `https://<storefront-host>/admin/login` with the configured `ADMIN_EMAIL` and
   `ADMIN_PASSWORD`, and confirm the admin dashboard loads with full access.
   Then change the password from **Account** and confirm sign-in still works.

### Verify database readiness

Initialization completes before the API accepts requests, so readiness is simply
"the API is up". Confirm it directly:

1. In the API deployment logs, look for the initialization messages: the
   connection is verified, migrations are current, the schema is verified, and
   the seed reports `seeded`, `already-seeded`, or `skipped-non-empty`.
2. `GET https://<api-service-host>/api/healthz` returns HTTP `200` with
   `{"status":"ok"}`; this confirms the API can reach Neon.
3. `GET https://<api-service-host>/api/storefront` returns the store settings,
   and the storefront shows products, which confirms the schema exists and the
   catalog is populated.
4. If any step failed, the API would have logged the reason and exited rather
   than serving; a healthy process therefore implies a verified schema.

## 10. Deploy future changes and troubleshoot

- Push the reviewed changes to GitHub. Render rebuilds the API Web Service and
  Static Site. On startup the API runs the same automatic initialization as a
  first deploy, so it applies any pending migrations, re-verifies the schema,
  and re-checks the storefront seed before serving requests. No manual migration
  or seed step is needed for a subsequent deployment.
- If a change adds a database column or index, generate and commit its Drizzle
  migration. The API applies pending migrations at startup (and, best-effort, at
  build time when `DATABASE_URL` is set). Back up production before schema
  changes, and keep migrations compatible with the currently running API. The
  idempotent administrator bootstrap runs at startup after those migrations.
- If the API fails to start with an `Administrator bootstrap failed` message,
  set `ADMIN_EMAIL` and `ADMIN_PASSWORD` on the API Web Service (Environment tab)
  and redeploy; the message names the missing or invalid variables. See section 8.
- If the API returns `503` at `/api/healthz`, check the API logs, `DATABASE_URL`,
  Neon status, connection limit, and TLS requirement.
- If the frontend shows a connection error or CORS failure, check
  `VITE_API_BASE_URL`, `FRONTEND_ORIGINS`, and that both services use HTTPS.
  Rebuild the Static Site after changing its API origin.
- If `/catalog` or another nested page returns `404` on refresh, check the
  Static Site rewrite to `/index.html`.
- If a migration fails at startup, the API logs the error (without the database
  URL) and exits non-zero; Render keeps the previous version or marks the deploy
  failed. Inspect the API logs and the current schema, then fix or add a
  corrective migration. Do not use `push-force` or drop production tables to
  recover. The Static Site may still serve, but requests fail until the API
  starts.
- If the API starts but `/api/storefront` or the catalog is empty, check the API
  logs for the seed messages. A `skipped-non-empty` result means the catalog was
  not empty and the seed was deliberately skipped; if logs show initialization
  failed and the API exited, no seed ran. See section 3.
- Checkout does not use a country or region allowlist. The parts desk confirms
  actual delivery arrangements after an order request is submitted.
- If the support inbox has no new message, verify the contact form's success
  state and `/api/support/messages` request. The form stores messages in the
  database; it does not send an email notification.
- If contact links are missing, publish a staffed email address or phone in
  **Settings**. Email delivery for account recovery is not configured by this
  project.
- The automatic seed only ever applies to an empty catalog and is a no-op once
  its `seed_runs` marker exists, so it is safe on production. Still confirm the
  target database before running the optional manual seed command; do not run it
  against a production database that already has a catalog.

## 11. Repository checks

From a clean checkout:

```sh
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run build
pnpm --filter @workspace/scripts run test
pnpm --filter @workspace/db run test:migrations
pnpm --filter @workspace/api-server run test
pnpm --filter @workspace/rang-auto-parts run test
```

Configure the required database and service variables before running the API.
The checks above verify compilation and builds only; they do not replace live
Neon migration, Render health, browser-origin/CORS, authentication, or order
flow verification.
