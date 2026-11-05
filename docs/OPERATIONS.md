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
| `CLERK_PUBLISHABLE_KEY` | Server-side Clerk request verification |
| `CLERK_SECRET_KEY` | Server-side Clerk API access |
| `VITE_CLERK_PUBLISHABLE_KEY` | Browser sign-in/sign-up |
| `SESSION_SECRET` | Session signing secret where session-backed services are enabled |
| `RANG_ADMIN_EMAILS` | Comma-separated trusted email allowlist for initial admin access |
| `VITE_CLERK_PROXY_URL` | Optional Clerk proxy URL when the deployment requires it |

Use separate Clerk development and production environments. Add the verified
email address of the business administrator to `RANG_ADMIN_EMAILS` in the
target environment before staff sign in. Admin and staff permissions are
checked by the API; hiding dashboard links in the browser is not the security
boundary. Keep this allowlist limited to business-controlled accounts.

## Initial catalog setup

The development database starts with the five broad categories requested for
ATVs, cars, motorcycles, vehicle accessories, and other automotive products. It
contains no sample products, customers, or orders. Development rows are not
copied into production when the schema is published. After provisioning the
production administrator, create or adjust categories and load verified SKUs,
prices, stock, product images, and vehicle fitment from the business catalog.
Do not publish invented inventory or compatibility claims.

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

- Customer accounts use Clerk; development and production account directories
  are separate.
- Staff order and product operations require a database-backed `admin` or
  `staff` role. The `RANG_ADMIN_EMAILS` allowlist provisions the initial admin
  role on sign-in.
- Delivery regions and fee, store contact details, and cash-on-delivery
  availability are managed in the admin settings.
- Product images are limited to JPEG, PNG, or WebP, up to 5 MB per upload.
- Vehicle compatibility is shown as verified only when the catalog contains a
  verified fitment record; otherwise customers are told to confirm with staff.
