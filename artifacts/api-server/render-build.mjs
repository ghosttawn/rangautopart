import { spawnSync } from "node:child_process";

if (process.env.RENDER !== "true") {
  throw new Error("Render build is only allowed to run on Render.");
}

if (process.env.NODE_ENV !== "production") {
  throw new Error("Render build requires NODE_ENV=production.");
}

if (!process.env.DATABASE_URL) {
  throw new Error("Render build requires the API service DATABASE_URL secret.");
}

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
runPnpm(["--filter", "@workspace/db", "run", "migrate"]);
