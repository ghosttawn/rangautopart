---
name: Development database target verification
description: Replit's shell environment label may not reliably identify the database used by a local app command.
---

Before writing sample or test data, verify the target database through Replit's database tooling rather than relying only on `REPLIT_ENVIRONMENT` reported by the shell. In one workspace session, the shell reported `production` while the development database connector confirmed the schema changes made by the local app command.

**Why:** Seeding the wrong environment can put demonstration records into live data.

**How to apply:** Use `executeSql` with `environment: "development"` to verify the development schema or data before running a local seed script, and require an explicit development confirmation in that script.
