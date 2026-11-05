import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { Request, Response } from "express";
import {
  cartItemsTable,
  cartsTable,
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
  usersTable,
} from "@workspace/db";
import type { Cart as CartResponse, CartItem, ProductCard } from "@workspace/api-zod";
import type {
  Cart as DatabaseCart,
  Category,
  Order,
  Product,
  ProductImage,
  StoreSettings,
  User,
} from "@workspace/db";

const DEFAULT_SETTINGS: StoreSettings = {
  id: 1,
  storeName: "RANG Auto Parts",
  currency: "XAF",
  deliveryFeeMinor: 0,
  deliveryRegions: [],
  cashOnDeliveryEnabled: true,
  onlinePaymentsEnabled: false,
  supportEmail: null,
  contactPhone: null,
  heroTitle: "Keep your",
  heroHighlight: "machine moving.",
  heroDescription:
    "Reliable parts for ATVs, cars, motorcycles and utility vehicles. Find the right piece, know what you are getting, and get on with the repair.",
  heroImageData: null,
  heroImageContentType: null,
  heroImageSize: null,
  promotionalTitle: "Not sure it fits? Ask first.",
  promotionalBody:
    "Send us the make, model and year. We will help you narrow it down before you order.",
  promotionalActionLabel: "Talk to our parts desk",
  promotionalUrl: "/contact",
  updatedAt: new Date(0),
};

export async function getSettings(): Promise<StoreSettings> {
  const [settings] = await db.select().from(storeSettingsTable).limit(1);
  return settings ?? DEFAULT_SETTINGS;
}

export function settingsDto(settings: StoreSettings) {
  return {
    storeName: settings.storeName,
    currency: settings.currency,
    currencyConfigured: /^[A-Z]{3}$/.test(settings.currency),
    deliveryFeeMinor: settings.deliveryFeeMinor,
    deliveryRegions: settings.deliveryRegions,
    cashOnDeliveryEnabled: settings.cashOnDeliveryEnabled,
    onlinePaymentsEnabled: false,
    supportEmail: settings.supportEmail,
    contactPhone: settings.contactPhone,
    heroTitle: settings.heroTitle,
    heroHighlight: settings.heroHighlight,
    heroDescription: settings.heroDescription,
    heroImageUrl: settings.heroImageData
      ? "/api/storefront/hero-image"
      : "/rang-hero.jpg",
    promotionalTitle: settings.promotionalTitle,
    promotionalBody: settings.promotionalBody,
    promotionalActionLabel: settings.promotionalActionLabel,
    promotionalUrl: settings.promotionalUrl,
  };
}

export function unitPrice(product: Product): number {
  return product.salePriceMinor !== null &&
    product.salePriceMinor >= 0 &&
    product.salePriceMinor < product.priceMinor
    ? product.salePriceMinor
    : product.priceMinor;
}

export async function categoryDto(category: Category) {
  const [count] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(productsTable)
    .where(eq(productsTable.categoryId, category.id));
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    productCount: count?.count ?? 0,
    imageUrl: category.imageData ? `/api/category-images/${category.id}` : null,
    active: category.active,
  };
}

export async function categoryDtos(categories: Category[]) {
  if (categories.length === 0) return [];
  const ids = categories.map((category) => category.id);
  const counts = await db
    .select({
      categoryId: productsTable.categoryId,
      count: sql<number>`count(*)::int`,
    })
    .from(productsTable)
    .where(inArray(productsTable.categoryId, ids))
    .groupBy(productsTable.categoryId);
  const countById = new Map(counts.map((entry) => [entry.categoryId, entry.count]));
  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    productCount: countById.get(category.id) ?? 0,
    imageUrl: category.imageData ? `/api/category-images/${category.id}` : null,
    active: category.active,
  }));
}

export async function productCards(products: Product[]) {
  if (products.length === 0) return [] as ProductCard[];
  const ids = products.map((product) => product.id);
  const categoryIds = [...new Set(products.map((product) => product.categoryId))];
  const [categories, images, compatibility] = await Promise.all([
    db
      .select({ id: categoriesTable.id, name: categoriesTable.name })
      .from(categoriesTable)
      .where(inArray(categoriesTable.id, categoryIds)),
    db
      .select({
        id: productImagesTable.id,
        productId: productImagesTable.productId,
      })
      .from(productImagesTable)
      .where(inArray(productImagesTable.productId, ids))
      .orderBy(productImagesTable.sortOrder, productImagesTable.createdAt),
    db
      .select({
        productId: compatibilityTable.productId,
        verified: compatibilityTable.verified,
      })
      .from(compatibilityTable)
      .where(inArray(compatibilityTable.productId, ids)),
  ]);
  const categoryById = new Map(categories.map((category) => [category.id, category.name]));
  const imageByProduct = new Map<string, string>();
  for (const image of images) {
    if (!imageByProduct.has(image.productId)) {
      imageByProduct.set(image.productId, image.id);
    }
  }
  const verifiedByProduct = new Set(
    compatibility
      .filter((row) => row.verified)
      .map((row) => row.productId),
  );

  return products.map((product) => ({
    id: product.id,
    slug: product.slug,
    name: product.name,
    sku: product.sku,
    brand: product.brand,
    priceMinor: product.priceMinor,
    salePriceMinor: product.salePriceMinor,
    stock: product.stock,
    published: product.published,
    featured: product.featured,
    compatibilityStatus: verifiedByProduct.has(product.id) ? "verified" : "unknown",
    imageUrl: imageByProduct.has(product.id)
      ? `/api/product-images/${imageByProduct.get(product.id)}`
      : null,
    category: categoryById.get(product.categoryId) ?? null,
  })) satisfies ProductCard[];
}

export function publicImageDto(image: ProductImage) {
  return {
    id: image.id,
    url: `/api/product-images/${image.id}`,
    contentType: image.contentType,
    size: image.size,
    altText: image.altText,
  };
}

function getCartSessionId(req: Request, res: Response): string {
  const existing = req.cookies?.rang_cart_session;
  if (typeof existing === "string" && /^[0-9a-f-]{36}$/i.test(existing)) {
    return existing;
  }
  const id = randomUUID();
  res.cookie("rang_cart_session", id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 1000 * 60 * 60 * 24 * 30,
  });
  return id;
}

export async function getOrCreateCart(
  req: Request,
  res: Response,
  user: User | null,
) {
  const sessionId = getCartSessionId(req, res);
  return db.transaction(async (tx) => {
    let cart: DatabaseCart | undefined;
    if (user) {
      [cart] = await tx
        .select()
        .from(cartsTable)
        .where(eq(cartsTable.userId, user.id))
        .limit(1);
      let guestCart: DatabaseCart | undefined;
      [guestCart] = await tx
        .select()
        .from(cartsTable)
        .where(eq(cartsTable.sessionId, sessionId))
        .limit(1);

      if (!cart) {
        const [created] = await tx
          .insert(cartsTable)
          .values({ userId: user.id, sessionId: null })
          .onConflictDoNothing()
          .returning();
        cart = created;
        if (!cart) {
          [cart] = await tx
            .select()
            .from(cartsTable)
            .where(eq(cartsTable.userId, user.id))
            .limit(1);
        }
      }

      if (!cart) throw new Error("Cart could not be created.");
      if (guestCart && guestCart.id !== cart.id) {
        const guestItems = await tx
          .select()
          .from(cartItemsTable)
          .where(eq(cartItemsTable.cartId, guestCart.id));
        for (const guestItem of guestItems) {
          const [product] = await tx
            .select({ stock: productsTable.stock })
            .from(productsTable)
            .where(eq(productsTable.id, guestItem.productId))
            .limit(1);
          if (!product || product.stock <= 0) continue;
          const [existing] = await tx
            .select()
            .from(cartItemsTable)
            .where(
              and(
                eq(cartItemsTable.cartId, cart.id),
                eq(cartItemsTable.productId, guestItem.productId),
              ),
            )
            .limit(1);
          const quantity = Math.min(
            50,
            product.stock,
            (existing?.quantity ?? 0) + guestItem.quantity,
          );
          if (existing) {
            await tx
              .update(cartItemsTable)
              .set({ quantity, updatedAt: new Date() })
              .where(eq(cartItemsTable.id, existing.id));
          } else if (quantity > 0) {
            await tx.insert(cartItemsTable).values({
              cartId: cart.id,
              productId: guestItem.productId,
              quantity,
            });
          }
        }
        await tx.delete(cartsTable).where(eq(cartsTable.id, guestCart.id));
      }
      return { cartId: cart.id, sessionId };
    }

    [cart] = await tx
      .select()
      .from(cartsTable)
      .where(eq(cartsTable.sessionId, sessionId))
      .limit(1);
    if (!cart) {
      const [created] = await tx
        .insert(cartsTable)
        .values({ userId: null, sessionId })
        .onConflictDoNothing()
        .returning();
      cart = created;
      if (!cart) {
        [cart] = await tx
          .select()
          .from(cartsTable)
          .where(eq(cartsTable.sessionId, sessionId))
          .limit(1);
      }
    }
    if (!cart) throw new Error("Cart could not be created.");
    return { cartId: cart.id, sessionId };
  });
}

export async function cartDto(cartId: string) {
  const [settings] = await Promise.all([getSettings()]);
  const rows = await db
    .select({ item: cartItemsTable, product: productsTable })
    .from(cartItemsTable)
    .innerJoin(productsTable, eq(cartItemsTable.productId, productsTable.id))
    .where(eq(cartItemsTable.cartId, cartId))
    .orderBy(cartItemsTable.createdAt);
  const cards = await productCards(rows.map((row) => row.product));
  const cardById = new Map(cards.map((card) => [card.id, card]));
  const items = rows.map(({ item, product }) => ({
    productId: product.id,
    quantity: item.quantity,
    unitPriceMinor: unitPrice(product),
    lineTotalMinor: unitPrice(product) * item.quantity,
    product: cardById.get(product.id)!,
  })) satisfies CartItem[];
  const subtotalMinor = items.reduce((sum, item) => sum + item.lineTotalMinor, 0);
  const deliveryFeeMinor = items.length > 0 ? settings.deliveryFeeMinor : 0;
  const response = {
    items,
    currency: settings.currency,
    subtotalMinor,
    deliveryFeeMinor,
    totalMinor: subtotalMinor + deliveryFeeMinor,
  } satisfies CartResponse;
  return response;
}

export async function orderDtos(orders: Order[]) {
  if (orders.length === 0) return [];
  const orderIds = orders.map((order) => order.id);
  const [items, deliveries] = await Promise.all([
    db
      .select()
      .from(orderItemsTable)
      .where(inArray(orderItemsTable.orderId, orderIds)),
    db
      .select()
      .from(deliveriesTable)
      .where(inArray(deliveriesTable.orderId, orderIds)),
  ]);
  const itemsByOrder = new Map<string, typeof items>();
  for (const item of items) {
    const orderItems = itemsByOrder.get(item.orderId) ?? [];
    orderItems.push(item);
    itemsByOrder.set(item.orderId, orderItems);
  }
  const deliveryByOrder = new Map(deliveries.map((delivery) => [delivery.orderId, delivery]));

  return orders.map((order) => {
    const delivery = deliveryByOrder.get(order.id);
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      fulfillmentStatus: order.fulfillmentStatus,
      totalMinor: order.totalMinor,
      currency: order.currency,
      createdAt: order.createdAt.toISOString(),
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      deliveryAddress: delivery?.address ?? "",
      deliveryCity: delivery?.city ?? "",
      deliveryRegion: delivery?.region ?? "",
      deliveryCountry: delivery?.country ?? null,
      deliveryNotes: delivery?.deliveryNotes ?? null,
      deliveryFeeMinor: order.deliveryFeeMinor,
      staffNote: order.staffNote,
      items: (itemsByOrder.get(order.id) ?? []).map((item) => ({
        name: item.name,
        sku: item.sku,
        quantity: item.quantity,
        unitPriceMinor: item.unitPriceMinor,
        lineTotalMinor: item.lineTotalMinor,
      })),
    };
  });
}

export async function orderDto(order: Order) {
  const [result] = await orderDtos([order]);
  return result;
}

export type CartData = Awaited<ReturnType<typeof cartDto>>;
export type OrderData = Awaited<ReturnType<typeof orderDto>>;
