import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { count, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../schema";
import {
  categoriesTable,
  compatibilityTable,
  productImagesTable,
  productsTable,
  seedRunsTable,
  storeSettingsTable,
} from "../schema";
import {
  initialCategories,
  initialProducts,
  initialSeedKey,
  initialStoreSettings,
} from "./initial-storefront-data";

export type StorefrontSeedResult =
  | {
      status: "seeded";
      categories: number;
      products: number;
      fitments: number;
    }
  | { status: "already-seeded" }
  | { status: "skipped-non-empty" };

/**
 * Populates the initial storefront catalog (categories, products, product and
 * category images, fitment records and store settings) from the committed
 * fixture and the JPEG images in `options.imageDirectory`.
 *
 * The seed is safe to call on every start and on every deployment:
 * - it is a no-op once its marker is present in `seed_runs`;
 * - it refuses to touch a database whose catalog/settings already contain data;
 * - every write happens in one transaction guarded by an advisory lock so
 *   concurrent API instances cannot double-seed.
 *
 * The `database` argument is passed in so this module stays free of any
 * connection side effects and can be reused by both the seed CLI and the
 * deployed API.
 */
export async function seedInitialStorefront(
  database: NodePgDatabase<typeof schema>,
  options: { imageDirectory: string },
): Promise<StorefrontSeedResult> {
  const { imageDirectory } = options;

  const readVerifiedImage = async (fileName: string, expectedSha256: string) => {
    const data = await readFile(resolve(imageDirectory, fileName));
    const actualSha256 = createHash("sha256").update(data).digest("hex");
    if (actualSha256 !== expectedSha256) {
      throw new Error(
        `Seed image ${fileName} failed its SHA-256 check; no database changes were made.`,
      );
    }
    return data;
  };

  const categoryImages = new Map(
    await Promise.all(
      initialCategories.map(async (category) => [
        category.slug,
        await readVerifiedImage(category.imageFile, category.imageSha256),
      ] as const),
    ),
  );
  const productImages = new Map(
    await Promise.all(
      initialProducts.map(async (product) => [
        product.sku,
        await readVerifiedImage(product.imageFile, product.imageSha256),
      ] as const),
    ),
  );
  const heroImage = await readVerifiedImage(
    initialStoreSettings.heroImageFile,
    initialStoreSettings.heroImageSha256,
  );

  return database.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext('rang-initial-storefront-seed-v1'))`,
    );

    const [existingRun] = await tx
      .select({ seedKey: seedRunsTable.seedKey })
      .from(seedRunsTable)
      .where(eq(seedRunsTable.seedKey, initialSeedKey))
      .limit(1);
    if (existingRun) return { status: "already-seeded" } as const;

    const [categoryCount] = await tx
      .select({ total: count() })
      .from(categoriesTable);
    const [productCount] = await tx
      .select({ total: count() })
      .from(productsTable);
    const [productImageCount] = await tx
      .select({ total: count() })
      .from(productImagesTable);
    const [compatibilityCount] = await tx
      .select({ total: count() })
      .from(compatibilityTable);
    const [settingsCount] = await tx
      .select({ total: count() })
      .from(storeSettingsTable);

    if (
      categoryCount.total > 0 ||
      productCount.total > 0 ||
      productImageCount.total > 0 ||
      compatibilityCount.total > 0 ||
      settingsCount.total > 0
    ) {
      return { status: "skipped-non-empty" } as const;
    }

    const categoryIds = new Map<string, string>();
    for (const category of initialCategories) {
      const image = categoryImages.get(category.slug);
      if (!image) throw new Error(`Missing verified image for ${category.slug}.`);
      const [inserted] = await tx
        .insert(categoriesTable)
        .values({
          name: category.name,
          slug: category.slug,
          description: category.description,
          active: category.active,
          imageData: image,
          imageContentType: "image/jpeg",
          imageSize: image.byteLength,
        })
        .returning({ id: categoriesTable.id });
      if (!inserted) throw new Error(`Could not seed category ${category.slug}.`);
      categoryIds.set(category.slug, inserted.id);
    }

    for (const product of initialProducts) {
      const categoryId = categoryIds.get(product.categorySlug);
      const image = productImages.get(product.sku);
      if (!categoryId) {
        throw new Error(`Missing category for product ${product.sku}.`);
      }
      if (!image) throw new Error(`Missing verified image for ${product.sku}.`);

      const [inserted] = await tx
        .insert(productsTable)
        .values({
          name: product.name,
          sku: product.sku,
          slug: product.slug,
          brand: product.brand,
          categoryId,
          priceMinor: product.priceMinor,
          salePriceMinor: product.salePriceMinor,
          stock: product.stock,
          published: product.published,
          featured: product.featured,
          description: product.description,
          specifications: product.specifications,
        })
        .returning({ id: productsTable.id });
      if (!inserted) throw new Error(`Could not seed product ${product.sku}.`);

      await tx.insert(productImagesTable).values({
        productId: inserted.id,
        contentType: "image/jpeg",
        size: image.byteLength,
        altText: product.imageAltText,
        sortOrder: 0,
        data: image,
      });

      if (product.compatibility.length > 0) {
        await tx.insert(compatibilityTable).values(
          product.compatibility.map((fitment) => ({
            productId: inserted.id,
            ...fitment,
          })),
        );
      }
    }

    await tx.insert(storeSettingsTable).values({
      id: initialStoreSettings.id,
      storeName: initialStoreSettings.storeName,
      currency: initialStoreSettings.currency,
      deliveryFeeMinor: initialStoreSettings.deliveryFeeMinor,
      deliveryRegions: initialStoreSettings.deliveryRegions,
      cashOnDeliveryEnabled: initialStoreSettings.cashOnDeliveryEnabled,
      onlinePaymentsEnabled: initialStoreSettings.onlinePaymentsEnabled,
      supportEmail: initialStoreSettings.supportEmail,
      contactPhone: initialStoreSettings.contactPhone,
      whatsAppCheckoutEnabled: initialStoreSettings.whatsAppCheckoutEnabled,
      whatsAppContactNumber: initialStoreSettings.whatsAppContactNumber,
      heroTitle: initialStoreSettings.heroTitle,
      heroHighlight: initialStoreSettings.heroHighlight,
      heroDescription: initialStoreSettings.heroDescription,
      heroImageData: heroImage,
      heroImageContentType: "image/jpeg",
      heroImageSize: heroImage.byteLength,
      promotionalTitle: initialStoreSettings.promotionalTitle,
      promotionalBody: initialStoreSettings.promotionalBody,
      promotionalActionLabel: initialStoreSettings.promotionalActionLabel,
      promotionalUrl: initialStoreSettings.promotionalUrl,
    });

    await tx.insert(seedRunsTable).values({
      seedKey: initialSeedKey,
      version: 1,
    });

    return {
      status: "seeded",
      categories: initialCategories.length,
      products: initialProducts.length,
      fitments: initialProducts.reduce(
        (total, product) => total + product.compatibility.length,
        0,
      ),
    } as const;
  });
}
