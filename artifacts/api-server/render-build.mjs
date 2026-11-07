import { spawnSync } from "node:child_process";

// Render-specific build entrypoint. It builds the workspace and, when a
// database URL is available at build time, applies migrations early for fast
// feedback. Migrations are NOT required here: the API applies any pending
// migrations at startup, so a build without database access still succeeds and
// the deployment stays correct.

function runPnpm(args) {
  const result = spawnSync("pnpm", args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `Render build step failed${result.status === null ? " after being terminated" : ` with exit code ${result.status}`}.`,
    );
  }
}

runPnpm(["run", "build"]);

if (process.env.DATABASE_URL) {
  try {
    runPnpm(["--filter", "@workspace/db", "run", "migrate"]);
  } catch (error) {
    // Do not fail the build on a migration error: the API applies migrations at
    // startup and surfaces a clear error there if the database is unreachable.
    console.warn(
      `Build-time migration skipped: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
} else {
  console.warn(
    "DATABASE_URL is not set at build time; skipping build-time migrations. The API applies migrations at startup.",
  );
}
