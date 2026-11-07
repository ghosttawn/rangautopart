import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  initialCategories,
  initialProducts,
  initialSeedKey,
  initialStoreSettings,
} from "../src/initial-storefront-data.ts";
import { assertInitialSeedIntent } from "../src/seed-storefront-guard.ts";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(testDirectory, "../..");
const imageDirectory = path.join(
  workspaceRoot,
  "attached_assets/generated_images",
);

function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

test("the initial fixture contains the current storefront population", () => {
  assert.equal(initialSeedKey, "rang-initial-storefront-v1");
  assert.equal(initialCategories.length, 5);
  assert.equal(initialProducts.length, 8);
  assert.equal(
    initialProducts.reduce(
      (total, product) => total + product.compatibility.length,
      0,
    ),
    5,
  );

  const categorySlugs = new Set(initialCategories.map((category) => category.slug));
  assert.equal(categorySlugs.size, initialCategories.length);
  assert.ok(
    initialProducts.every((product) => categorySlugs.has(product.categorySlug)),
  );
  assert.equal(
    new Set(initialProducts.map((product) => product.sku)).size,
    initialProducts.length,
  );
  assert.equal(initialStoreSettings.currency, "XAF");
  assert.equal(initialStoreSettings.promotionalTitle, "Not sure it fits? Ask first.");
});

test("all seeded image fixtures match the stored catalog image checksums", async () => {
  const fixtureImages = [
    ...initialCategories.map(({ imageFile, imageSha256 }) => ({
      imageFile,
      imageSha256,
    })),
    ...initialProducts.map(({ imageFile, imageSha256 }) => ({
      imageFile,
      imageSha256,
    })),
    {
      imageFile: initialStoreSettings.heroImageFile,
      imageSha256: initialStoreSettings.heroImageSha256,
    },
  ];

  for (const fixture of fixtureImages) {
    const bytes = await readFile(path.join(imageDirectory, fixture.imageFile));
    assert.equal(
      sha256(bytes),
      fixture.imageSha256,
      `${fixture.imageFile} should be byte-identical to the current database image`,
    );
  }
});

test("the one-time seed requires a matching explicit environment confirmation", () => {
  assert.equal(assertInitialSeedIntent("development", "development"), undefined);
  assert.equal(assertInitialSeedIntent("production", "production"), undefined);
  assert.throws(() => assertInitialSeedIntent("production", undefined));
  assert.throws(() => assertInitialSeedIntent("production", "development"));
  assert.throws(() => assertInitialSeedIntent("test", "test"));
});
