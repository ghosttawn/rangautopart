import { and, asc, desc, eq, gt, gte, ilike, lte, or, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  AddCartItemBody,
  AddCartItemResponse,
  GetCartResponse,
  GetProductParams,
  GetProductResponse,
  GetStorefrontResponse,
  ListCategoriesResponse,
  ListProductsQueryParams,
  ListProductsResponse,
  RemoveCartItemParams,
  RemoveCartItemResponse,
  UpdateCartItemBody,
  UpdateCartItemParams,
  UpdateCartItemResponse,
} from "@workspace/api-zod";
import {
  cartItemsTable,
  categoriesTable,
  compatibilityTable,
  db,
  productImagesTable,
  productsTable,
} from "@workspace/db";
import { hasStaffAccess, resolveCurrentUser } from "../middlewares/auth";
import { HttpError } from "../middlewares/auth";
import {
  cartDto,
  categoryDtos,
  getOrCreateCart,
  getSettings,
  productCards,
  publicImageDto,
  settingsDto,
  unitPrice,
} from "../lib/store";

const router: IRouter = Router();
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function errorResponse(message: string, code: string) {
  return { error: message, code };
}

router.get("/storefront", async (_req, res): Promise<void> => {
  const [settings, categories, featuredProducts] = await Promise.all([
    getSettings(),
    db
      .select()
      .from(categoriesTable)
      .where(eq(categoriesTable.active, true))
      .orderBy(asc(categoriesTable.name)),
    db
      .select()
      .from(productsTable)
      .where(and(eq(productsTable.published, true), gt(productsTable.stock, 0)))
      .orderBy(desc(productsTable.createdAt))
      .limit(8),
  ]);
  const [categoryData, featured] = await Promise.all([
    categoryDtos(categories),
    productCards(featuredProducts),
  ]);
  res.json(
    GetStorefrontResponse.parse({
      settings: settingsDto(settings),
      categories: categoryData,
      featured,
    }),
  );
});

router.get("/categories", async (_req, res): Promise<void> => {
  const categories = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.active, true))
    .orderBy(asc(categoriesTable.name));
  res.json(ListCategoriesResponse.parse(await categoryDtos(categories)));
});

router.get("/products", async (req, res): Promise<void> => {
  const parsed = ListProductsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json(errorResponse("Invalid catalog filters.", "INVALID_QUERY"));
    return;
  }
  const query = parsed.data;
  const page = query.page ?? 1;
  const limit = query.limit ?? 24;
  const searchText = query.q?.trim().slice(0, 120);
  const where: ReturnType<typeof eq>[] = [
    eq(productsTable.published, true),
    eq(categoriesTable.active, true),
  ];
  if (searchText) {
    const term = `%${searchText}%`;
    where.push(
      or(
        ilike(productsTable.name, term),
        ilike(productsTable.sku, term),
        ilike(productsTable.brand, term),
        ilike(productsTable.description, term),
        sql`${productsTable.specifications}::text ILIKE ${term}`,
      )!,
    );
  }
  if (query.category) where.push(eq(categoriesTable.slug, query.category));
  if (query.brand) where.push(ilike(productsTable.brand, query.brand));
  if (query.availability === "in_stock") where.push(gt(productsTable.stock, 0));

  const effectivePrice = sql<number>`CASE WHEN ${productsTable.salePriceMinor} IS NOT NULL AND ${productsTable.salePriceMinor} < ${productsTable.priceMinor} THEN ${productsTable.salePriceMinor} ELSE ${productsTable.priceMinor} END`;
  if (query.minPrice !== undefined) {
    where.push(gte(effectivePrice, query.minPrice));
  }
  if (query.maxPrice !== undefined) {
    where.push(lte(effectivePrice, query.maxPrice));
  }
  if (query.compatibilityMake?.trim()) {
    where.push(ilike(compatibilityTable.make, query.compatibilityMake.trim()));
  }
  if (query.compatibilityModel?.trim()) {
    where.push(ilike(compatibilityTable.model, query.compatibilityModel.trim()));
  }
  if (query.compatibilityYear !== undefined) {
    where.push(
      and(
        lte(compatibilityTable.yearFrom, query.compatibilityYear),
        gte(compatibilityTable.yearTo, query.compatibilityYear),
      )!,
    );
  }
  if (
    query.compatibilityMake?.trim() ||
    query.compatibilityModel?.trim() ||
    query.compatibilityYear !== undefined
  ) {
    where.push(eq(compatibilityTable.verified, true));
  }

  const filter = and(...where);
  const useFitment =
    Boolean(query.compatibilityMake || query.compatibilityModel) ||
    query.compatibilityYear !== undefined;
  const sort = query.sort ?? "relevance";
  const relevanceRank = searchText
    ? sql<number>`CASE
        WHEN ${productsTable.name} ILIKE ${searchText}
          OR ${productsTable.sku} ILIKE ${searchText} THEN 0
        WHEN ${productsTable.name} ILIKE ${`${searchText}%`}
          OR ${productsTable.sku} ILIKE ${`${searchText}%`} THEN 1
        ELSE 2
      END`
    : undefined;
  const orderBy =
    sort === "price_asc"
      ? [asc(effectivePrice), asc(productsTable.name)]
      : sort === "price_desc"
        ? [desc(effectivePrice), asc(productsTable.name)]
        : sort === "relevance" && relevanceRank
          ? [
              relevanceRank,
              desc(productsTable.createdAt),
              asc(productsTable.name),
            ]
          : [desc(productsTable.createdAt), asc(productsTable.name)];
  const [countResult, resultRows] = await Promise.all([
    db
      .select({ total: sql<number>`count(DISTINCT ${productsTable.id})::int` })
      .from(productsTable)
      .innerJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
      .where(filter),
    useFitment
      ? db
          .selectDistinct({ product: productsTable })
          .from(productsTable)
          .innerJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
          .innerJoin(compatibilityTable, eq(compatibilityTable.productId, productsTable.id))
          .where(filter)
          .orderBy(...orderBy)
          .limit(limit)
          .offset((page - 1) * limit)
      : db
          .select({ product: productsTable })
          .from(productsTable)
          .innerJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
          .where(filter)
          .orderBy(...orderBy)
          .limit(limit)
          .offset((page - 1) * limit),
  ]);
  const products = resultRows.map((row) => row.product);
  const items = await productCards(products);
  res.json(
    ListProductsResponse.parse({
      items,
      total: countResult[0]?.total ?? 0,
      page,
      limit,
    }),
  );
});

router.get("/products/:slug", async (req, res): Promise<void> => {
  const params = GetProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json(errorResponse("Invalid product.", "INVALID_PRODUCT"));
    return;
  }
  const [product] = await db
    .select({ product: productsTable })
    .from(productsTable)
    .innerJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(
      and(
        eq(productsTable.slug, params.data.slug),
        eq(productsTable.published, true),
        eq(categoriesTable.active, true),
      ),
    )
    .limit(1);
  if (!product) {
    res.status(404).json(errorResponse("Product not found.", "PRODUCT_NOT_FOUND"));
    return;
  }
  const [cards, images, compatibility, relatedProducts] = await Promise.all([
    productCards([product.product]),
    db
      .select()
      .from(productImagesTable)
      .where(eq(productImagesTable.productId, product.product.id))
      .orderBy(asc(productImagesTable.sortOrder), asc(productImagesTable.createdAt)),
    db
      .select()
      .from(compatibilityTable)
      .where(eq(compatibilityTable.productId, product.product.id))
      .orderBy(asc(compatibilityTable.make), asc(compatibilityTable.model)),
    db
      .select()
      .from(productsTable)
      .where(
        and(
          eq(productsTable.categoryId, product.product.categoryId),
          eq(productsTable.published, true),
          gt(productsTable.stock, 0),
          sql`${productsTable.id} <> ${product.product.id}`,
        ),
      )
      .orderBy(desc(productsTable.createdAt))
      .limit(4),
  ]);
  const response = {
    ...cards[0],
    description: product.product.description,
    specifications: product.product.specifications,
    images: images.map(publicImageDto),
    compatibility: compatibility.map((fit) => ({
      make: fit.make,
      model: fit.model,
      yearFrom: fit.yearFrom,
      yearTo: fit.yearTo,
      verified: fit.verified,
    })),
    createdAt: product.product.createdAt.toISOString(),
    related: await productCards(relatedProducts),
  };
  res.json(GetProductResponse.parse(response));
});

router.get("/product-images/:imageId", async (req, res): Promise<void> => {
  const imageId = String(req.params["imageId"] ?? "");
  if (!UUID_PATTERN.test(imageId)) {
    res.status(404).end();
    return;
  }
  const [row] = await db
    .select({
      image: productImagesTable,
      published: productsTable.published,
    })
    .from(productImagesTable)
    .innerJoin(productsTable, eq(productImagesTable.productId, productsTable.id))
    .where(eq(productImagesTable.id, imageId))
    .limit(1);
  if (!row) {
    res.status(404).end();
    return;
  }
  if (!row.published && !(await hasStaffAccess(req))) {
    res.status(404).end();
    return;
  }
  res
    .status(200)
    .type(row.image.contentType)
    .set("Cache-Control", row.published ? "public, max-age=86400" : "private, no-store")
    .send(row.image.data);
});

router.get("/cart", async (req, res): Promise<void> => {
  const user = await resolveCurrentUser(req);
  const { cartId } = await getOrCreateCart(req, res, user);
  res.json(GetCartResponse.parse(await cartDto(cartId)));
});

router.post("/cart/items", async (req, res): Promise<void> => {
  const body = AddCartItemBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json(errorResponse("Choose a valid product quantity.", "INVALID_CART_ITEM"));
    return;
  }
  const user = await resolveCurrentUser(req);
  const { cartId } = await getOrCreateCart(req, res, user);
  const [product] = await db
    .select()
    .from(productsTable)
    .where(
      and(
        eq(productsTable.id, body.data.productId),
        eq(productsTable.published, true),
      ),
    )
    .limit(1);
  if (!product || product.stock < 1) {
    res.status(409).json(errorResponse("This product is currently unavailable.", "OUT_OF_STOCK"));
    return;
  }
  const [existing] = await db
    .select()
    .from(cartItemsTable)
    .where(
      and(
        eq(cartItemsTable.cartId, cartId),
        eq(cartItemsTable.productId, product.id),
      ),
    )
    .limit(1);
  const quantity = (existing?.quantity ?? 0) + body.data.quantity;
  if (quantity > 50 || quantity > product.stock) {
    res.status(409).json(
      errorResponse(
        `Only ${Math.min(50, product.stock)} units are currently available.`,
        "INSUFFICIENT_STOCK",
      ),
    );
    return;
  }
  if (existing) {
    await db
      .update(cartItemsTable)
      .set({ quantity, updatedAt: new Date() })
      .where(eq(cartItemsTable.id, existing.id));
  } else {
    await db.insert(cartItemsTable).values({
      cartId,
      productId: product.id,
      quantity,
    });
  }
  res.json(AddCartItemResponse.parse(await cartDto(cartId)));
});

router.patch("/cart/items/:productId", async (req, res): Promise<void> => {
  const params = UpdateCartItemParams.safeParse(req.params);
  const body = UpdateCartItemBody.safeParse(req.body);
  if (!params.success || !body.success || !UUID_PATTERN.test(params.data.productId)) {
    res.status(400).json(errorResponse("Choose a valid product quantity.", "INVALID_CART_ITEM"));
    return;
  }
  const user = await resolveCurrentUser(req);
  const { cartId } = await getOrCreateCart(req, res, user);
  const [product] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, params.data.productId))
    .limit(1);
  if (!product || !product.published || body.data.quantity > product.stock) {
    res.status(409).json(errorResponse("The requested quantity is unavailable.", "INSUFFICIENT_STOCK"));
    return;
  }
  const [item] = await db
    .select()
    .from(cartItemsTable)
    .where(
      and(
        eq(cartItemsTable.cartId, cartId),
        eq(cartItemsTable.productId, product.id),
      ),
    )
    .limit(1);
  if (!item) {
    res.status(404).json(errorResponse("That product is not in your cart.", "CART_ITEM_NOT_FOUND"));
    return;
  }
  await db
    .update(cartItemsTable)
    .set({ quantity: body.data.quantity, updatedAt: new Date() })
    .where(eq(cartItemsTable.id, item.id));
  res.json(UpdateCartItemResponse.parse(await cartDto(cartId)));
});

router.delete("/cart/items/:productId", async (req, res): Promise<void> => {
  const params = RemoveCartItemParams.safeParse(req.params);
  if (!params.success || !UUID_PATTERN.test(params.data.productId)) {
    res.status(400).json(errorResponse("Invalid product.", "INVALID_PRODUCT"));
    return;
  }
  const user = await resolveCurrentUser(req);
  const { cartId } = await getOrCreateCart(req, res, user);
  await db
    .delete(cartItemsTable)
    .where(
      and(
        eq(cartItemsTable.cartId, cartId),
        eq(cartItemsTable.productId, params.data.productId),
      ),
    );
  res.json(RemoveCartItemResponse.parse(await cartDto(cartId)));
});

export default router;
