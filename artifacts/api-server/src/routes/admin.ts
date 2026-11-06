import { and, asc, count, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import { Router, type IRouter, type RequestHandler } from "express";
import multer from "multer";
import {
  CreateCategoryBody,
  CreateCategoryResponse,
  CreateProductBody,
  CreateProductResponse,
  DeleteCategoryParams,
  DeleteCategoryResponse,
  DeleteProductImageParams,
  DeleteProductImageResponse,
  DeleteProductParams,
  DeleteProductResponse,
  GetAdminProductParams,
  GetAdminProductResponse,
  GetAdminOverviewResponse,
  GetAdminSettingsResponse,
  ListAdminCategoriesResponse,
  ListAdminCustomersQueryParams,
  ListAdminCustomersResponse,
  ListAdminOrdersQueryParams,
  ListAdminOrdersResponse,
  ListAdminSupportMessagesQueryParams,
  ListAdminSupportMessagesResponse,
  ListAdminProductsQueryParams,
  ListAdminProductsResponse,
  UpdateAdminSettingsBody,
  UpdateAdminSettingsResponse,
  UpdateAdminSupportMessageByIdBody,
  UpdateAdminSupportMessageByIdParams,
  UpdateAdminSupportMessageByIdResponse,
  UpdateCategoryBody,
  UpdateCategoryParams,
  UpdateCategoryResponse,
  UpdateOrderBody,
  UpdateOrderParams,
  UpdateOrderResponse,
  UpdateProductBody,
  UpdateProductParams,
  UpdateProductResponse,
  UploadCategoryImageParams,
  UploadCategoryImageResponse,
  UploadHeroImageResponse,
  UploadProductImageParams,
  UploadProductImageResponse,
} from "@workspace/api-zod";
import {
  cartItemsTable,
  categoriesTable,
  compatibilityTable,
  db,
  deliveriesTable,
  orderItemsTable,
  ordersTable,
  paymentsTable,
  productImagesTable,
  productsTable,
  storeSettingsTable,
  supportMessagesTable,
  usersTable,
} from "@workspace/db";
import { HttpError, requireUser } from "../middlewares/auth";
import { isSupportedCurrencyCode } from "../lib/currency";
import {
  categoryDto,
  categorySummarySelection,
  categoryDtos,
  getSettings,
  orderDto,
  orderDtos,
  productCards,
  publicImageDto,
  settingsSummarySelection,
  settingsDto,
} from "../lib/store";
import { IMAGE_MAX_BYTES, IMAGE_TYPES, imageSignatureMatches } from "../lib/image-validation";
import { normalizeWhatsAppContactNumber } from "../lib/whatsapp-contact";

const router: IRouter = Router();
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function errorResponse(message: string, code: string) {
  return { error: message, code };
}

function supportMessageDto(row: typeof supportMessagesTable.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    subject: row.subject,
    message: row.message,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

const staffOnly: RequestHandler = async (req, res, next): Promise<void> => {
  const user = await requireUser(req, res, ["admin", "staff"]);
  if (user) next();
};

const adminOnly: RequestHandler = async (req, res, next): Promise<void> => {
  const user = await requireUser(req, res, ["admin"]);
  if (user) next();
};

router.use("/admin", staffOnly);

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: IMAGE_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!IMAGE_TYPES.has(file.mimetype)) {
      callback(new HttpError(400, "INVALID_IMAGE_TYPE", "Use a JPEG, PNG, or WebP image."));
      return;
    }
    callback(null, true);
  },
});

async function productDto(productId: string) {
  const [product] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, productId))
    .limit(1);
  if (!product) return null;
  const [card, images, compatibility] = await Promise.all([
    productCards([product]),
    db
      .select({
        id: productImagesTable.id,
        contentType: productImagesTable.contentType,
        size: productImagesTable.size,
        altText: productImagesTable.altText,
      })
      .from(productImagesTable)
      .where(eq(productImagesTable.productId, product.id))
      .orderBy(asc(productImagesTable.sortOrder), asc(productImagesTable.createdAt)),
    db
      .select()
      .from(compatibilityTable)
      .where(eq(compatibilityTable.productId, product.id))
      .orderBy(asc(compatibilityTable.make), asc(compatibilityTable.model)),
  ]);
  return {
    ...card[0],
    description: product.description,
    specifications: product.specifications,
    images: images.map(publicImageDto),
    compatibility: compatibility.map((fit) => ({
      make: fit.make,
      model: fit.model,
      yearFrom: fit.yearFrom,
      yearTo: fit.yearTo,
      verified: fit.verified,
    })),
    createdAt: product.createdAt.toISOString(),
    related: [],
  };
}

function validCompatibility(
  items: Array<{ yearFrom: number; yearTo: number }> | undefined,
): boolean {
  return !items || items.every((item) => item.yearFrom <= item.yearTo);
}

function normalizeSpecifications(
  input: Record<string, unknown> | undefined,
): Record<string, string | number | boolean> | null {
  if (input === undefined) return {};
  const entries = Object.entries(input);
  if (entries.length > 80) return null;
  const normalized: Record<string, string | number | boolean> = {};
  for (const [key, value] of entries) {
    const label = key.trim();
    if (
      label.length === 0 ||
      label.length > 80 ||
      (typeof value !== "string" &&
        typeof value !== "number" &&
        typeof value !== "boolean") ||
      (typeof value === "string" && value.length > 500) ||
      (typeof value === "number" && !Number.isFinite(value))
    ) {
      return null;
    }
    normalized[label] = value;
  }
  return normalized;
}

async function replaceCompatibility(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  productId: string,
  items: Array<{
    make: string;
    model: string;
    yearFrom: number;
    yearTo: number;
    verified?: boolean;
  }>,
) {
  await tx.delete(compatibilityTable).where(eq(compatibilityTable.productId, productId));
  if (items.length > 0) {
    await tx.insert(compatibilityTable).values(
      items.map((item) => ({
        productId,
        make: item.make.trim(),
        model: item.model.trim(),
        yearFrom: item.yearFrom,
        yearTo: item.yearTo,
        verified: item.verified ?? false,
      })),
    );
  }
}

router.get("/admin/overview", async (_req, res): Promise<void> => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const [settings, [todayCount], [pendingCount], [lowStock], [customerCount], [sales]] =
    await Promise.all([
      db.select().from(storeSettingsTable).limit(1).then((rows) => rows[0]),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(ordersTable)
        .where(gte(ordersTable.createdAt, today)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(ordersTable)
        .where(eq(ordersTable.orderStatus, "submitted")),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(productsTable)
        .where(and(eq(productsTable.published, true), sql`${productsTable.stock} <= 5`)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(usersTable)
        .where(eq(usersTable.role, "customer")),
      db
        .select({ total: sql<number>`COALESCE(sum(${ordersTable.totalMinor}), 0)::int` })
        .from(ordersTable)
        .where(
          and(
            gte(ordersTable.createdAt, today),
            sql`${ordersTable.orderStatus} <> 'cancelled'`,
          ),
        ),
    ]);
  res.json(
    GetAdminOverviewResponse.parse({
      ordersToday: todayCount?.count ?? 0,
      pendingOrders: pendingCount?.count ?? 0,
      lowStockProducts: lowStock?.count ?? 0,
      customers: customerCount?.count ?? 0,
      salesTodayMinor: sales?.total ?? 0,
      currency: settings?.currency ?? "XAF",
    }),
  );
});

router.get("/admin/products", async (req, res): Promise<void> => {
  const rawLowStock = req.query.lowStock;
  if (
    rawLowStock !== undefined &&
    rawLowStock !== "true" &&
    rawLowStock !== "false"
  ) {
    res.status(400).json(errorResponse("Invalid product search.", "INVALID_QUERY"));
    return;
  }
  const parsed = ListAdminProductsQueryParams.safeParse({
    ...req.query,
    lowStock: rawLowStock === undefined ? undefined : rawLowStock === "true",
  });
  if (!parsed.success) {
    res.status(400).json(errorResponse("Invalid product search.", "INVALID_QUERY"));
    return;
  }
  const page = parsed.data.page ?? 1;
  const limit = parsed.data.limit ?? 30;
  const filters = [];
  if (parsed.data.lowStock) {
    filters.push(lte(productsTable.stock, 5));
  }
  if (parsed.data.q?.trim()) {
    const term = `%${parsed.data.q.trim().slice(0, 120)}%`;
    filters.push(
      or(
        ilike(productsTable.name, term),
        ilike(productsTable.sku, term),
        ilike(productsTable.brand, term),
      ),
    );
  }
  const filter = filters.length ? and(...filters) : undefined;
  const [count] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(productsTable)
    .where(filter);
  const rows = await db
    .select()
    .from(productsTable)
    .where(filter)
    .orderBy(desc(productsTable.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);
  res.json(
    ListAdminProductsResponse.parse({
      items: await productCards(rows),
      total: count?.total ?? 0,
      page,
      limit,
    }),
  );
});

router.get("/admin/products/:productId", async (req, res): Promise<void> => {
  const params = GetAdminProductParams.safeParse(req.params);
  if (!params.success || !UUID_PATTERN.test(params.data.productId)) {
    res.status(400).json(errorResponse("Invalid product.", "INVALID_PRODUCT"));
    return;
  }
  const product = await productDto(params.data.productId);
  if (!product) {
    res.status(404).json(errorResponse("Product not found.", "PRODUCT_NOT_FOUND"));
    return;
  }
  res.json(GetAdminProductResponse.parse(product));
});

router.post("/admin/products", async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(errorResponse("Check the product details and try again.", "INVALID_PRODUCT"));
    return;
  }
  const body = parsed.data;
  const specifications = normalizeSpecifications(body.specifications);
  if (
    !UUID_PATTERN.test(body.categoryId) ||
    !SLUG_PATTERN.test(body.slug) ||
    !validCompatibility(body.compatibility) ||
    specifications === null ||
    (body.salePriceMinor != null && body.salePriceMinor >= body.priceMinor)
  ) {
    res.status(400).json(errorResponse("Product prices, URL, category, or fitment are invalid.", "INVALID_PRODUCT"));
    return;
  }
  const [category] = await db
    .select({ id: categoriesTable.id })
    .from(categoriesTable)
    .where(eq(categoriesTable.id, body.categoryId))
    .limit(1);
  if (!category) {
    res.status(400).json(errorResponse("Select an existing category.", "CATEGORY_NOT_FOUND"));
    return;
  }
  const product = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(productsTable)
      .values({
        name: body.name.trim(),
        sku: body.sku.trim(),
        slug: body.slug.trim().toLowerCase(),
        brand: body.brand?.trim() || null,
        priceMinor: body.priceMinor,
        salePriceMinor: body.salePriceMinor ?? null,
        categoryId: body.categoryId,
        description: body.description,
        specifications,
        stock: body.stock,
        published: body.published ?? false,
        featured: body.featured ?? false,
      })
      .returning();
    if (!created) throw new Error("The product could not be created.");
    if (body.compatibility?.length) {
      await replaceCompatibility(tx, created.id, body.compatibility);
    }
    return created;
  });
  const response = await productDto(product.id);
  res.status(201).json(CreateProductResponse.parse(response));
});

router.patch("/admin/products/:productId", async (req, res): Promise<void> => {
  const params = UpdateProductParams.safeParse(req.params);
  const parsed = UpdateProductBody.safeParse(req.body);
  if (!params.success || !UUID_PATTERN.test(params.data.productId) || !parsed.success) {
    res.status(400).json(errorResponse("Check the product details and try again.", "INVALID_PRODUCT"));
    return;
  }
  const body = parsed.data;
  if (
    Object.keys(body).length === 0 ||
    (body.slug !== undefined && !SLUG_PATTERN.test(body.slug)) ||
    (body.categoryId !== undefined && !UUID_PATTERN.test(body.categoryId)) ||
    !validCompatibility(body.compatibility) ||
    (body.salePriceMinor != null &&
      body.priceMinor !== undefined &&
      body.salePriceMinor >= body.priceMinor)
  ) {
    res.status(400).json(errorResponse("Product prices, URL, category, or fitment are invalid.", "INVALID_PRODUCT"));
    return;
  }
  if (body.categoryId) {
    const [category] = await db
      .select({ id: categoriesTable.id })
      .from(categoriesTable)
      .where(eq(categoriesTable.id, body.categoryId))
      .limit(1);
    if (!category) {
      res.status(400).json(errorResponse("Select an existing category.", "CATEGORY_NOT_FOUND"));
      return;
    }
  }
  const {
    compatibility,
    specifications: rawSpecifications,
    ...productFields
  } = body;
  const specifications =
    rawSpecifications === undefined
      ? undefined
      : normalizeSpecifications(rawSpecifications);
  if (specifications === null) {
    res.status(400).json(errorResponse("Specifications must use short text or numeric values.", "INVALID_PRODUCT"));
    return;
  }
  const product = await db.transaction(async (tx) => {
    const [currentProduct] = await tx
      .select()
      .from(productsTable)
      .where(eq(productsTable.id, params.data.productId))
      .for("update")
      .limit(1);
    if (!currentProduct) return null;
    const nextPrice = productFields.priceMinor ?? currentProduct.priceMinor;
    const nextSalePrice =
      productFields.salePriceMinor === undefined
        ? currentProduct.salePriceMinor
        : productFields.salePriceMinor;
    if (nextSalePrice !== null && nextSalePrice >= nextPrice) {
      throw new HttpError(
        400,
        "INVALID_SALE_PRICE",
        "The sale price must be lower than the regular price.",
      );
    }
    if (compatibility !== undefined) {
      await replaceCompatibility(tx, params.data.productId, compatibility);
    }
    const [updated] = await tx
      .update(productsTable)
      .set({
        ...productFields,
        ...(specifications !== undefined ? { specifications } : {}),
        ...(productFields.name !== undefined ? { name: productFields.name.trim() } : {}),
        ...(productFields.sku !== undefined ? { sku: productFields.sku.trim() } : {}),
        ...(productFields.slug !== undefined
          ? { slug: productFields.slug.trim().toLowerCase() }
          : {}),
        ...(productFields.brand !== undefined
          ? { brand: productFields.brand?.trim() || null }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(productsTable.id, params.data.productId))
      .returning();
    return updated ?? null;
  });
  if (!product) {
    res.status(404).json(errorResponse("Product not found.", "PRODUCT_NOT_FOUND"));
    return;
  }
  const response = await productDto(product.id);
  res.json(UpdateProductResponse.parse(response));
});

router.delete("/admin/products/:productId", async (req, res): Promise<void> => {
  const params = DeleteProductParams.safeParse(req.params);
  if (!params.success || !UUID_PATTERN.test(params.data.productId)) {
    res.status(400).json(errorResponse("Invalid product.", "INVALID_PRODUCT"));
    return;
  }
  const [deleted] = await db
    .delete(productsTable)
    .where(eq(productsTable.id, params.data.productId))
    .returning({ id: productsTable.id });
  if (!deleted) {
    res.status(404).json(errorResponse("Product not found.", "PRODUCT_NOT_FOUND"));
    return;
  }
  res.status(204).send();
  DeleteProductResponse.parse(undefined);
});

router.post(
  "/admin/products/:productId/images",
  imageUpload.single("file"),
  async (req, res): Promise<void> => {
    const params = UploadProductImageParams.safeParse(req.params);
    if (!params.success || !UUID_PATTERN.test(params.data.productId)) {
      res.status(400).json(errorResponse("Invalid product.", "INVALID_PRODUCT"));
      return;
    }
    const file = req.file;
    if (!file || !imageSignatureMatches(file.mimetype, file.buffer)) {
      res.status(400).json(errorResponse("Choose a valid JPEG, PNG, or WebP image.", "INVALID_IMAGE"));
      return;
    }
    const [product] = await db
      .select({ id: productsTable.id })
      .from(productsTable)
      .where(eq(productsTable.id, params.data.productId))
      .limit(1);
    if (!product) {
      res.status(404).json(errorResponse("Product not found.", "PRODUCT_NOT_FOUND"));
      return;
    }
    const rawAltText = req.body?.altText;
    const altText =
      typeof rawAltText === "string" && rawAltText.length <= 200
        ? rawAltText.trim() || null
        : null;
    const [image] = await db
      .insert(productImagesTable)
      .values({
        productId: product.id,
        contentType: file.mimetype,
        size: file.size,
        altText,
        data: file.buffer,
      })
      .returning();
    res.status(201).json(
      UploadProductImageResponse.parse(image ? publicImageDto(image) : undefined),
    );
  },
);

router.delete(
  "/admin/products/:productId/images/:imageId",
  async (req, res): Promise<void> => {
    const params = DeleteProductImageParams.safeParse(req.params);
    if (
      !params.success ||
      !UUID_PATTERN.test(params.data.productId) ||
      !UUID_PATTERN.test(params.data.imageId)
    ) {
      res.status(400).json(errorResponse("Invalid product image.", "INVALID_IMAGE"));
      return;
    }
    const [deleted] = await db
      .delete(productImagesTable)
      .where(
        and(
          eq(productImagesTable.id, params.data.imageId),
          eq(productImagesTable.productId, params.data.productId),
        ),
      )
      .returning({ id: productImagesTable.id });
    if (!deleted) {
      res.status(404).json(errorResponse("Product image not found.", "IMAGE_NOT_FOUND"));
      return;
    }
    res.status(204).send();
    DeleteProductImageResponse.parse(undefined);
  },
);

router.get("/admin/categories", async (_req, res): Promise<void> => {
  const categories = await db
    .select(categorySummarySelection)
    .from(categoriesTable)
    .orderBy(asc(categoriesTable.name));
  res.json(ListAdminCategoriesResponse.parse(await categoryDtos(categories)));
});

router.post(
  "/admin/categories/:categoryId/image",
  imageUpload.single("file"),
  async (req, res): Promise<void> => {
    const params = UploadCategoryImageParams.safeParse(req.params);
    const file = req.file;
    if (!params.success || !UUID_PATTERN.test(params.data.categoryId)) {
      res.status(400).json(errorResponse("Invalid category.", "INVALID_CATEGORY"));
      return;
    }
    if (!file || !imageSignatureMatches(file.mimetype, file.buffer)) {
      res.status(400).json(errorResponse("Choose a valid JPEG, PNG, or WebP image.", "INVALID_IMAGE"));
      return;
    }
    const [category] = await db
      .update(categoriesTable)
      .set({
        imageData: file.buffer,
        imageContentType: file.mimetype,
        imageSize: file.size,
      })
      .where(eq(categoriesTable.id, params.data.categoryId))
      .returning({
        id: categoriesTable.id,
        name: categoriesTable.name,
        slug: categoriesTable.slug,
        description: categoriesTable.description,
        active: categoriesTable.active,
        hasImage: sql<boolean>`${categoriesTable.imageData} IS NOT NULL`,
      });
    if (!category) {
      res.status(404).json(errorResponse("Category not found.", "CATEGORY_NOT_FOUND"));
      return;
    }
    res.json(
      UploadCategoryImageResponse.parse(await categoryDto(category)),
    );
  },
);

router.post("/admin/categories", async (req, res): Promise<void> => {
  const parsed = CreateCategoryBody.safeParse(req.body);
  if (!parsed.success || !SLUG_PATTERN.test(parsed.data.slug)) {
    res.status(400).json(errorResponse("Enter a valid category name and URL.", "INVALID_CATEGORY"));
    return;
  }
  const [category] = await db
    .insert(categoriesTable)
    .values({
      name: parsed.data.name.trim(),
      slug: parsed.data.slug.trim().toLowerCase(),
      description: parsed.data.description?.trim() || null,
      active: parsed.data.active ?? true,
    })
    .returning();
  const [count] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(productsTable)
    .where(eq(productsTable.categoryId, category!.id));
  res.status(201).json(
    CreateCategoryResponse.parse({
      id: category!.id,
      name: category!.name,
      slug: category!.slug,
      description: category!.description,
      active: category!.active,
      productCount: count?.count ?? 0,
      imageUrl: null,
    }),
  );
});

router.patch("/admin/categories/:categoryId", async (req, res): Promise<void> => {
  const params = UpdateCategoryParams.safeParse(req.params);
  const parsed = UpdateCategoryBody.safeParse(req.body);
  if (
    !params.success ||
    !UUID_PATTERN.test(params.data.categoryId) ||
    !parsed.success ||
    !SLUG_PATTERN.test(parsed.data.slug)
  ) {
    res.status(400).json(errorResponse("Enter a valid category name and URL.", "INVALID_CATEGORY"));
    return;
  }
  const [category] = await db
    .update(categoriesTable)
    .set({
      name: parsed.data.name.trim(),
      slug: parsed.data.slug.trim().toLowerCase(),
      description: parsed.data.description?.trim() || null,
      active: parsed.data.active ?? true,
    })
    .where(eq(categoriesTable.id, params.data.categoryId))
    .returning({
      id: categoriesTable.id,
      name: categoriesTable.name,
      slug: categoriesTable.slug,
      description: categoriesTable.description,
      active: categoriesTable.active,
      hasImage: sql<boolean>`${categoriesTable.imageData} IS NOT NULL`,
    });
  if (!category) {
    res.status(404).json(errorResponse("Category not found.", "CATEGORY_NOT_FOUND"));
    return;
  }
  const [count] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(productsTable)
    .where(eq(productsTable.categoryId, category.id));
  res.json(
    UpdateCategoryResponse.parse({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      active: category.active,
      productCount: count?.count ?? 0,
      imageUrl: category.hasImage
        ? `/api/category-images/${category.id}`
        : null,
    }),
  );
});

router.delete("/admin/categories/:categoryId", async (req, res): Promise<void> => {
  const params = DeleteCategoryParams.safeParse(req.params);
  if (!params.success || !UUID_PATTERN.test(params.data.categoryId)) {
    res.status(400).json(errorResponse("Invalid category.", "INVALID_CATEGORY"));
    return;
  }
  const [count] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(productsTable)
    .where(eq(productsTable.categoryId, params.data.categoryId));
  if ((count?.count ?? 0) > 0) {
    res.status(409).json(errorResponse("Move or remove its products before deleting this category.", "CATEGORY_NOT_EMPTY"));
    return;
  }
  const [deleted] = await db
    .delete(categoriesTable)
    .where(eq(categoriesTable.id, params.data.categoryId))
    .returning({ id: categoriesTable.id });
  if (!deleted) {
    res.status(404).json(errorResponse("Category not found.", "CATEGORY_NOT_FOUND"));
    return;
  }
  res.status(204).send();
  DeleteCategoryResponse.parse(undefined);
});

router.get("/admin/orders", async (req, res): Promise<void> => {
  const parsed = ListAdminOrdersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json(errorResponse("Invalid order filter.", "INVALID_QUERY"));
    return;
  }
  const filters = parsed.data.status
    ? [eq(ordersTable.orderStatus, parsed.data.status)]
    : [];
  const orders = await db
    .select()
    .from(ordersTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(ordersTable.createdAt))
    .limit(parsed.data.limit ?? 30)
    .offset(((parsed.data.page ?? 1) - 1) * (parsed.data.limit ?? 30));
  res.json(ListAdminOrdersResponse.parse(await orderDtos(orders)));
});

router.patch("/admin/orders/:orderId", async (req, res): Promise<void> => {
  const params = UpdateOrderParams.safeParse(req.params);
  const parsed = UpdateOrderBody.safeParse(req.body);
  if (
    !params.success ||
    !UUID_PATTERN.test(params.data.orderId) ||
    !parsed.success ||
    Object.keys(parsed.data ?? {}).length === 0
  ) {
    res.status(400).json(errorResponse("Enter a valid order update.", "INVALID_ORDER"));
    return;
  }
  const updated = await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, params.data.orderId))
      .for("update")
      .limit(1);
    if (!current) return null;
    const nextStatus = parsed.data.orderStatus ?? current.orderStatus;
    const nextPayment = parsed.data.paymentStatus ?? current.paymentStatus;
    if (current.orderStatus === "cancelled" && nextStatus !== "cancelled") {
      throw new HttpError(
        409,
        "ORDER_ALREADY_CANCELLED",
        "A cancelled order cannot be reopened; create a new order instead.",
      );
    }
    if (
      nextPayment === "refunded" &&
      current.paymentStatus !== "paid" &&
      current.paymentStatus !== "refunded"
    ) {
      throw new HttpError(
        409,
        "PAYMENT_NOT_CAPTURED",
        "Only a payment already recorded as paid can be marked refunded.",
      );
    }
    if (
      nextStatus === "cancelled" &&
      current.paymentStatus === "paid" &&
      nextPayment !== "refunded"
    ) {
      throw new HttpError(
        409,
        "REFUND_REQUIRED",
        "Record the refund after it has been handled before cancelling this paid order.",
      );
    }
    if (nextStatus === "cancelled" && current.orderStatus !== "cancelled") {
      if (current.fulfillmentStatus === "fulfilled") {
        throw new HttpError(409, "ORDER_ALREADY_FULFILLED", "A fulfilled order cannot be cancelled.");
      }
      const items = await tx
        .select()
        .from(orderItemsTable)
        .where(eq(orderItemsTable.orderId, current.id));
      for (const item of items) {
        if (item.productId) {
          await tx
            .update(productsTable)
            .set({
              stock: sql`${productsTable.stock} + ${item.quantity}`,
              updatedAt: new Date(),
            })
            .where(eq(productsTable.id, item.productId));
        }
      }
    }
    const [result] = await tx
      .update(ordersTable)
      .set({
        ...(parsed.data.orderStatus !== undefined
          ? { orderStatus: parsed.data.orderStatus }
          : {}),
        ...(parsed.data.paymentStatus !== undefined
          ? { paymentStatus: parsed.data.paymentStatus }
          : {}),
        ...(parsed.data.fulfillmentStatus !== undefined
          ? { fulfillmentStatus: parsed.data.fulfillmentStatus }
          : {}),
        ...(parsed.data.staffNote !== undefined
          ? { staffNote: parsed.data.staffNote.trim() || null }
          : {}),
        ...(nextStatus === "cancelled" && current.orderStatus !== "cancelled"
          ? { cancelledAt: new Date() }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(ordersTable.id, current.id))
      .returning();
    if (result && parsed.data.paymentStatus !== undefined) {
      const [payment] = await tx
        .select()
        .from(paymentsTable)
        .where(eq(paymentsTable.orderId, result.id))
        .limit(1);
      if (payment) {
        await tx
          .update(paymentsTable)
          .set({ status: parsed.data.paymentStatus, updatedAt: new Date() })
          .where(eq(paymentsTable.id, payment.id));
      }
    }
    return result ?? null;
  });
  if (!updated) {
    res.status(404).json(errorResponse("Order not found.", "ORDER_NOT_FOUND"));
    return;
  }
  res.json(UpdateOrderResponse.parse(await orderDto(updated)));
});

router.get("/admin/customers", async (req, res): Promise<void> => {
  const parsed = ListAdminCustomersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json(errorResponse("Invalid customer search.", "INVALID_QUERY"));
    return;
  }
  const filters = [];
  if (parsed.data.q?.trim()) {
    const term = `%${parsed.data.q.trim().slice(0, 120)}%`;
    filters.push(or(ilike(usersTable.email, term), ilike(usersTable.name, term)));
  }
  const customers = await db
    .select()
    .from(usersTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(asc(usersTable.name))
    .limit(parsed.data.limit ?? 30)
    .offset(((parsed.data.page ?? 1) - 1) * (parsed.data.limit ?? 30));
  const customerIds = customers.map((customer) => customer.id);
  const orderCounts = customerIds.length
    ? await db
        .select({
          userId: ordersTable.userId,
          count: count(),
        })
        .from(ordersTable)
        .where(inArray(ordersTable.userId, customerIds))
        .groupBy(ordersTable.userId)
    : [];
  const countByUserId = new Map(
    orderCounts.map((row) => [row.userId, Number(row.count)]),
  );
  const customerRows = customers.map((customer) => ({
    id: customer.id,
    email: customer.email,
    name: customer.name,
    phone: customer.phone,
    role: customer.role,
    orderCount: countByUserId.get(customer.id) ?? 0,
  }));
  res.json(ListAdminCustomersResponse.parse(customerRows));
});

router.get("/admin/support/messages", async (req, res): Promise<void> => {
  const parsed = ListAdminSupportMessagesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json(errorResponse("Invalid support inbox filter.", "INVALID_QUERY"));
    return;
  }

  const page = parsed.data.page ?? 1;
  const limit = parsed.data.limit ?? 20;
  const where = parsed.data.status
    ? eq(supportMessagesTable.status, parsed.data.status)
    : undefined;
  const [rows, [totalRow]] = await Promise.all([
    db
      .select()
      .from(supportMessagesTable)
      .where(where)
      .orderBy(desc(supportMessagesTable.createdAt), desc(supportMessagesTable.id))
      .limit(limit)
      .offset((page - 1) * limit),
    db.select({ total: count() }).from(supportMessagesTable).where(where),
  ]);

  res.json(
    ListAdminSupportMessagesResponse.parse({
      items: rows.map(supportMessageDto),
      total: Number(totalRow?.total ?? 0),
    }),
  );
});

router.patch("/admin/support/messages/:messageId", async (req, res): Promise<void> => {
  const params = UpdateAdminSupportMessageByIdParams.safeParse(req.params);
  const parsed = UpdateAdminSupportMessageByIdBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res
      .status(400)
      .json(errorResponse("Enter a valid support message update.", "INVALID_SUPPORT_MESSAGE"));
    return;
  }

  const [updated] = await db
    .update(supportMessagesTable)
    .set({ status: parsed.data.status })
    .where(eq(supportMessagesTable.id, params.data.messageId))
    .returning();
  if (!updated) {
    res.status(404).json(errorResponse("Support message not found.", "SUPPORT_MESSAGE_NOT_FOUND"));
    return;
  }
  res.json(UpdateAdminSupportMessageByIdResponse.parse(supportMessageDto(updated)));
});

router.get("/admin/settings", adminOnly, async (_req, res): Promise<void> => {
  res.set("Cache-Control", "private, no-store").json(
    GetAdminSettingsResponse.parse(settingsDto(await getSettings())),
  );
});

router.post(
  "/admin/settings/hero-image",
  adminOnly,
  imageUpload.single("file"),
  async (req, res): Promise<void> => {
    const file = req.file;
    if (!file || !imageSignatureMatches(file.mimetype, file.buffer)) {
      res.status(400).json(errorResponse("Choose a valid JPEG, PNG, or WebP image.", "INVALID_IMAGE"));
      return;
    }
    const values = {
      heroImageData: file.buffer,
      heroImageContentType: file.mimetype,
      heroImageSize: file.size,
      updatedAt: new Date(),
    };
    const [existing] = await db.select().from(storeSettingsTable).limit(1);
    if (existing) {
      await db
          .update(storeSettingsTable)
          .set(values)
          .where(eq(storeSettingsTable.id, existing.id))
    } else {
      await db
          .insert(storeSettingsTable)
          .values({ id: 1, ...values });
    }
    res.json(
      UploadHeroImageResponse.parse({
        url: "/api/storefront/hero-image",
        contentType: file.mimetype,
        size: file.size,
      }),
    );
  },
);

router.patch("/admin/settings", adminOnly, async (req, res): Promise<void> => {
  const parsed = UpdateAdminSettingsBody.safeParse(req.body);
  if (
    !parsed.success ||
    Object.keys(parsed.data ?? {}).length === 0
  ) {
    res.status(400).json(
      errorResponse(
        "Online payment is disabled until a provider is configured and verified.",
        "INVALID_SETTINGS",
      ),
    );
    return;
  }
  if (
    parsed.data.currency !== undefined &&
    !isSupportedCurrencyCode(parsed.data.currency)
  ) {
    res.status(400).json(
      errorResponse(
        "Use a supported three-letter ISO 4217 currency code.",
        "INVALID_CURRENCY",
      ),
    );
    return;
  }
  let whatsAppContactNumber: string | null | undefined;
  if (parsed.data.whatsAppContactNumber !== undefined) {
    try {
      whatsAppContactNumber = normalizeWhatsAppContactNumber(
        parsed.data.whatsAppContactNumber,
      );
    } catch (error) {
      res.status(400).json(
        errorResponse(
          error instanceof Error
            ? error.message
            : "Enter a valid international WhatsApp number.",
          "INVALID_WHATSAPP_NUMBER",
        ),
      );
      return;
    }
  }
  const values = {
    ...(parsed.data.storeName !== undefined
      ? { storeName: parsed.data.storeName.trim() }
      : {}),
    ...(parsed.data.currency !== undefined ? { currency: parsed.data.currency } : {}),
    ...(parsed.data.deliveryFeeMinor !== undefined
      ? { deliveryFeeMinor: parsed.data.deliveryFeeMinor }
      : {}),
    ...(parsed.data.cashOnDeliveryEnabled !== undefined
      ? { cashOnDeliveryEnabled: parsed.data.cashOnDeliveryEnabled }
      : {}),
    onlinePaymentsEnabled: false,
    ...(parsed.data.supportEmail !== undefined
      ? { supportEmail: parsed.data.supportEmail?.trim().toLowerCase() || null }
      : {}),
    ...(parsed.data.contactPhone !== undefined
      ? { contactPhone: parsed.data.contactPhone?.trim() || null }
      : {}),
    ...(parsed.data.whatsAppCheckoutEnabled !== undefined
      ? { whatsAppCheckoutEnabled: parsed.data.whatsAppCheckoutEnabled }
      : {}),
    ...(parsed.data.whatsAppContactNumber !== undefined
      ? { whatsAppContactNumber: whatsAppContactNumber ?? null }
      : {}),
    ...(parsed.data.heroTitle !== undefined
      ? { heroTitle: parsed.data.heroTitle.trim() }
      : {}),
    ...(parsed.data.heroHighlight !== undefined
      ? { heroHighlight: parsed.data.heroHighlight.trim() }
      : {}),
    ...(parsed.data.heroDescription !== undefined
      ? { heroDescription: parsed.data.heroDescription.trim() }
      : {}),
    ...(parsed.data.promotionalTitle !== undefined
      ? { promotionalTitle: parsed.data.promotionalTitle.trim() }
      : {}),
    ...(parsed.data.promotionalBody !== undefined
      ? { promotionalBody: parsed.data.promotionalBody.trim() }
      : {}),
    ...(parsed.data.promotionalActionLabel !== undefined
      ? { promotionalActionLabel: parsed.data.promotionalActionLabel.trim() }
      : {}),
    ...(parsed.data.promotionalUrl !== undefined
      ? { promotionalUrl: parsed.data.promotionalUrl.trim() }
      : {}),
    updatedAt: new Date(),
  };
  const [settings] = await db
    .insert(storeSettingsTable)
    .values({ id: 1, ...values })
    .onConflictDoUpdate({ target: storeSettingsTable.id, set: values })
    .returning(settingsSummarySelection);
  const dto = settingsDto(settings!);
  res.set("Cache-Control", "private, no-store").json(
    UpdateAdminSettingsResponse.parse(dto),
  );
});

export default router;
