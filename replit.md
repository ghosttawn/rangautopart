# RANG Auto Parts

A parts storefront and operations dashboard for RANG ATV/AUTO PART/V ACCESSORIES, with catalog search, vehicle fitment data, persistent carts, cash-on-delivery orders, and staff-managed inventory.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/rang-auto-parts` — customer storefront and staff dashboard
- `artifacts/api-server` — API, native session authentication, authorization, commerce operations
- `lib/api-spec/openapi.yaml` — API contract source of truth
- `lib/db/src/schema/` — PostgreSQL schema source of truth
- `docs/OPERATIONS.md` — environment setup, schema changes, deployment, backup, and restore

## Architecture decisions

- Email/password accounts use password hashes and opaque, database-backed HTTP-only sessions; roles are enforced by the API and stored in PostgreSQL.
- Password reset tokens are one-time, hashed, and short-lived. Email delivery must be configured before customer self-service recovery is available.
- The API calculates prices and inventory changes during checkout; online payments remain disabled until a provider is fully verified.
- Product image bytes are stored in PostgreSQL so database backups include the catalog's images.

## Product

Customers can browse and search published parts, check verified fitment, keep a cart across visits, and place cash-on-delivery orders. Authorized staff can manage products, categories, orders, customer records, fulfillment, and store settings.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See `docs/OPERATIONS.md` for deployment configuration and data portability instructions
