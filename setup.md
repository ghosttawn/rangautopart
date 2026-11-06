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

### Prepare and connect GitHub

1. Create or select the **private** GitHub repository that should hold this
   project. Keep it empty when creating it; do not add a second README, license,
   or `.gitignore` that could create an unrelated first commit.
2. In Replit, open the Repositories page at
   <https://replit.com/repos>, connect the intended GitHub account, and select
   the correct repository for this project. Replit's GitHub connection uses
   account authorization; do not paste a token into chat or project files.
3. Before committing, review `git status --short`. The project `.gitignore`
   keeps environment files, local databases, and non-demo uploaded attachments
   out of Git. Keep only the approved `attached_assets/generated_images`
   catalog fixtures if seed imagery is needed.
4. Commit the project from its repository root and push the current branch. In
   the Replit Git panel, confirm the repository owner/name and branch before
   pressing **Push**. For a command-line push, use the connected repository as
   `origin`, then run `git push -u origin main` for this project's current
   branch. Do not force-push or replace repository history to resolve an
   unrelated-history warning; stop and compare the two histories first.
5. Verify the push by checking that the GitHub repository shows the latest
   commit and that `pnpm-lock.yaml`, the migration SQL/metadata, seed script,
   setup guide, `.env.example`, and application source are present.

#### If a Personal Access Token is required

Prefer Replit's authorized GitHub connection above. If the Git workflow
specifically requires a Personal Access Token (PAT):

1. On GitHub, open **Settings → Developer settings → Personal access tokens →
   Fine-grained tokens**, or go directly to
   <https://github.com/settings/personal-access-tokens/new>.
2. Choose the correct resource owner, set repository access to **Only select
   repositories**, and select this project's repository.
3. Grant only the repository permission **Contents: Read and write**. GitHub
   supplies the required **Metadata: Read-only** permission. Do not grant
   organization administration, workflows, or other permissions for a normal
   source push. Set an expiry and follow any organization approval/SSO policy.
4. Copy the generated token once. In Replit's **Secrets** pane, create the
   secret `GIT_URL` with the credential URL value
   `https://<github-username>:<token>@github.com/<owner>/<repository>.git`.
   Use the Secrets pane's value field only; never put this URL in source code,
   `.env.example`, a committed Git remote, a screenshot, or chat. Remove or
   rotate this secret after the push if it is no longer needed.
5. Select the intended repository in Replit and push. Verify the new commit on
   GitHub. If authentication fails, check repository selection, token expiry,
   `Contents: Read and write`, and any organization approval; do not broaden
   permissions without identifying the missing permission.

The GitHub account/repository must be chosen and authorized by the owner. No
GitHub repository is assumed or claimed to be connected by this guide.

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

Product, category, and homepage uploads are multipart binary uploads stored as
raw PostgreSQL `bytea` data, not Base64 text and not files on the Web Service's
temporary filesystem. The API accepts JPEG, PNG, and WebP, checks the declared
type against the file signature, and rejects files over 5 MB. The storefront
also checks type and size before upload. Product images are stored one per
request; repeat the upload to add views, and remove an image from the product
editor to delete it. Replacing a category or homepage image updates its stored
image. A refresh retrieves the bytes from the database-backed image endpoint.
This matches the existing schema and survives Render restarts and redeploys; no
Render disk or Replit-only object-storage service is required.

Database-backed images increase Neon storage and backup size as the catalog
grows. Keep product images optimized before upload and monitor database usage.
If the catalog grows beyond this modest per-file design, move image bytes to a
durable provider as a planned migration that preserves the existing image URLs
or updates all references; do not switch to Render's temporary filesystem.

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
| `DATABASE_URL` | API, migrations, admin provisioning, development seed | Yes for database access | Yes | Neon PostgreSQL connection string; use TLS and the pooled runtime URL where appropriate. |
| `FRONTEND_ORIGINS` | API Web Service | Yes in production | No | Exact HTTPS frontend origin(s), comma-separated, with no path. |
| `FRONTEND_ORIGIN` | API Web Service | Optional legacy alias | No | Legacy single-origin fallback; prefer `FRONTEND_ORIGINS`. |
| `NODE_ENV` | API Web Service and one-off scripts | Set to `production` on Render | No | Enables production cookie/security behavior and guards production-only admin setup. |
| `PORT` | API Web Service | Render-supplied | No | Port assigned by Render; the API binds to `0.0.0.0:$PORT`. |
| `LOG_LEVEL` | API Web Service | Optional | No | Pino log level; defaults to `info`. |
| `VITE_API_BASE_URL` | Static Site build | Yes for separate Render services | No | Public API origin, without `/api` or a trailing slash. |
| `VITE_REQUIRE_API_BASE_URL` | Static Site build | Set to `true` for Render | No | Fails the build when the separate API origin is missing or malformed. |
| `BASE_PATH` | Vite build / Replit workflow | Optional; `/` for Render root | No | Base path for app assets and client routes. |
| `REPL_ID` | Replit development only | No | No | Enables Replit-only development plugins; Render does not need it. |
| `RANG_ADMIN_PROVISION_CONFIRM` | One-off administrator provisioning | Yes for that command | No | Must be `production` to confirm the guarded production administrator command; do not save it in Render. |
| `RANG_DEMO_SEED_CONFIRM` | One-off development seed | Yes for that command | No | Must be `development`; the seed also requires `NODE_ENV=development` and must never target production. |

`GIT_URL` is not an application variable. Only create it as a Replit Secret if
the GitHub PAT procedure above is required, and remove or rotate it when done.

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
