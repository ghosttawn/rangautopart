# RANG Auto Parts: deployment and operations

This guide covers setup, schema changes, and portable database backups for the
RANG Auto Parts application. PostgreSQL is the source of truth for catalog,
orders, customer records, and product images. Product image bytes are stored in
PostgreSQL `BYTEA` columns, so a database backup includes them.

## Required configuration

Set these in the hosting platform's environment/secret manager. Do not commit
secret values or copy development credentials into production.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| — | No email-delivery transport is currently wired; password recovery remains unavailable until one is configured |

The app uses native email/password accounts. Passwords are scrypt-hashed;
session cookies are HTTP-only and database-backed, and the API checks admin
and staff roles on every protected request. Existing customer, order, cart, and
role records remain in PostgreSQL. Accounts migrated from the former provider
need a password reset before their old account can be used with the native login.

## Development sample data

The development database can be populated with repeatable sample categories,
products, images, customers, COD orders, payments, and deliveries:

```sh
pnpm --filter @workspace/db run push
RANG_DEMO_SEED_CONFIRM=development pnpm --filter @workspace/scripts run seed-demo
```

The seed is additive and idempotent: it preserves existing records and fills
only missing sample records or sample images. It refuses to run when
`NODE_ENV=production` and always requires the explicit development confirmation
shown above. Sample
customers use reserved `.test` email addresses, and sample vehicle fitment is
marked unverified. Do not publish invented inventory or compatibility claims.
Development rows are not copied to production by schema publishing. Replace
demonstration products, prices, stock, and fitment with business-verified data
before launch.

## Development administrator access

Create an actual database-backed development admin with the controlled
provisioning command. It is not exposed as a public endpoint and refuses to run
unless both development safeguards are set:

```sh
NODE_ENV=development RANG_ADMIN_PROVISION_CONFIRM=development \
  pnpm --filter @workspace/api-server run provision-admin
```

The command prints a one-time temporary password. The default account email is
`rang.admin@rang-auto-parts.test`; pass a different email as the first argument
to create or promote an account for that address. It can promote an existing
legacy user without changing the user's ID or order history. An account that
already has a password is never overwritten by this command.

1. Open `/admin/login` and sign in with the printed email and password.
2. Change the temporary password under Account settings before using the
   account for normal work.
3. Create additional administrators by running the same command with their
   email address. Share the one-time password through a private channel; they
   should change it immediately after signing in.
4. Run this command only against the development database. It refuses to run
   with `NODE_ENV=production`; never publish a development account or password.

Password recovery currently returns a clear service-unavailable response.
Until an email-delivery transport is selected and configured, customers who
cannot sign in must contact the RANG parts desk.

## Run locally

Install dependencies with `pnpm install`, configure the variables above, and
start the configured API and web workflows. Useful checks:

```sh
pnpm run typecheck
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/rang-auto-parts run typecheck
```

## Database schema changes

The schema source of truth is `lib/db/src/schema/`. For the Replit-managed
PostgreSQL database, apply development schema changes with:

```sh
pnpm --filter @workspace/db run push
```

The Replit Publish flow compares development and production schemas and applies
the production diff. Review any rename or destructive-change prompt carefully;
do not run schema pushes against production or add schema changes to application
startup.

For a portable PostgreSQL deployment outside Replit, generate and apply the
checked-in Drizzle SQL migrations:

```sh
pnpm --filter @workspace/db run generate
pnpm --filter @workspace/db run migrate
```

Commit generated SQL and snapshot files together with the schema change. Review
the SQL before applying it to a live database, and take a backup first. Do not
use the external-database migration command against Replit-managed production.

## Export and restore application data

Use a PostgreSQL client with `pg_dump` and `pg_restore`. Store backup files in a
private location with access controls; these backups contain customer and order
information.

Create a complete compressed backup:

```sh
pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" > rang-backup.dump
```

This includes schema, rows, and binary product images. Transfer the dump
securely to the new host, provision a compatible PostgreSQL database, and
restore into a new or empty target:

```sh
pg_restore --no-owner --no-acl --dbname="$TARGET_DATABASE_URL" rang-backup.dump
```

Restoring into a non-empty database can conflict with existing tables or
duplicate data. For a deliberate replacement, first make a separate backup of
the target and confirm that it is safe to replace; then use:

```sh
pg_restore --clean --if-exists --no-owner --no-acl \
  --dbname="$TARGET_DATABASE_URL" rang-backup.dump
```

After restoring, configure the target environment variables, apply any newer
portable migrations, start the application, and verify the storefront,
administrator access, product images, and order history. Keep periodic,
off-host backups and test restoring them; an untested backup is not a recovery
plan.

## Payments and checkout

Cash on delivery is the only configured payment method. The API calculates
prices, delivery fees, totals, and stock from PostgreSQL and records payment as
due on delivery. Do not enable or describe online payments as operational until
a provider is configured, server-side payment verification is implemented, and
the complete payment flow has been tested.

## Current operating boundaries

- Customer accounts use native email/password sessions stored in PostgreSQL.
- The contact form stores messages in the staff support inbox; it does not send
  automatic email notifications. Account password recovery remains unavailable
  until an email-delivery transport is configured.
- Staff order and product operations require a database-backed `admin` or
  `staff` role. Initial admin access is provisioned using the guarded
  development-only command above; there is no public admin-creation endpoint.
- Delivery fee, store currency, contact details, and cash-on-delivery
  availability are managed in the admin settings. Checkout accepts valid
  destination details from any country; staff confirm delivery arrangements
  after an order request is submitted.
- Changing the store currency does not convert existing catalog prices or
  delivery fees. Review those amounts manually; each order keeps the currency
  recorded when it was placed.
- Product images are limited to JPEG, PNG, or WebP, up to 5 MB per upload.
- Vehicle compatibility is shown as verified only when the catalog contains a
  verified fitment record; otherwise customers are told to confirm with staff.
