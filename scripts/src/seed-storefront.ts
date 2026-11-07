import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "@workspace/db";
import { seedInitialStorefront } from "@workspace/db/seed";
import { assertInitialSeedIntent } from "./seed-storefront-guard";

assertInitialSeedIntent(
  process.env.NODE_ENV,
  process.env.RANG_INITIAL_SEED_CONFIRM,
);

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const imageDirectory = resolve(workspaceRoot, "attached_assets/generated_images");

try {
  const result = await seedInitialStorefront(db, { imageDirectory });

  if (result.status === "already-seeded") {
    process.stdout.write(
      "The initial storefront seed was already applied. No records were changed.\n",
    );
  } else if (result.status === "skipped-non-empty") {
    throw new Error(
      "The storefront seed only runs against an empty catalog. Existing catalog/settings data were left unchanged.",
    );
  } else {
    process.stdout.write(
      `Initial storefront seed complete: ${result.categories} categories, ${result.products} products, ${result.fitments} fitment records, product and category images, and store settings.\n`,
    );
  }
} finally {
  await db.$client.end();
}
