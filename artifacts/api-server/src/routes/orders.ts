import { randomBytes } from "node:crypto";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  GetAccountResponse,
  GetCustomerOrderParams,
  GetCustomerOrderResponse,
  ListCustomerOrdersResponse,
  SubmitOrderBody,
  SubmitOrderResponse,
  UpdateAccountBody,
  UpdateAccountResponse,
} from "@workspace/api-zod";
import {
  cartItemsTable,
  cartsTable,
  db,
  deliveriesTable,
  orderItemsTable,
  ordersTable,
  paymentsTable,
  productsTable,
  storeSettingsTable,
  usersTable,
} from "@workspace/db";
import { HttpError, resolveCurrentUser } from "../middlewares/auth";
import { getOrCreateCart, getSettings, orderDto, unitPrice } from "../lib/store";

const router: IRouter = Router();
const ORDER_NUMBER_PATTERN = /^RNG-[0-9]{4}-[A-F0-9]{8}$/;

function errorResponse(message: string, code: string) {
  return { error: message, code };
}

router.post("/checkout", async (req, res): Promise<void> => {
  const parsed = SubmitOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(
      errorResponse("Check the contact and delivery details and try again.", "INVALID_CHECKOUT"),
    );
    return;
  }

  const user = await resolveCurrentUser(req, res);
  const { cartId, sessionId } = await getOrCreateCart(req, res, user);
  const settings = await getSettings();
  const input = parsed.data;
  const orderNumber = `RNG-${new Date().getFullYear()}-${randomBytes(4).toString("hex").toUpperCase()}`;

  const result = await db.transaction(async (tx) => {
    const [existingOrder] = await tx
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.idempotencyKey, input.idempotencyKey))
      .limit(1);
    if (existingOrder) {
      const sameOwner =
        (user && existingOrder.userId === user.id) ||
        existingOrder.sessionId === sessionId;
      if (!sameOwner) {
        throw new HttpError(409, "DUPLICATE_ORDER_KEY", "This order has already been submitted.");
      }
      return existingOrder;
    }

    if (!settings.cashOnDeliveryEnabled) {
      throw new HttpError(
        503,
        "CHECKOUT_UNAVAILABLE",
        "Cash on delivery is not currently available.",
      );
    }
    if (
      settings.deliveryRegions.length > 0 &&
      !settings.deliveryRegions.some(
        (region) => region.trim().toLowerCase() === input.region.trim().toLowerCase(),
      )
    ) {
      throw new HttpError(
        400,
        "DELIVERY_REGION_UNAVAILABLE",
        "Delivery is not currently available in that region.",
      );
    }

    const cartItems = await tx
      .select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.cartId, cartId));
    if (cartItems.length === 0) {
      throw new HttpError(400, "EMPTY_CART", "Your cart is empty.");
    }

    const lines: Array<{
      productId: string;
      name: string;
      sku: string;
      quantity: number;
      unitPriceMinor: number;
      lineTotalMinor: number;
    }> = [];
    for (const item of cartItems) {
      const [product] = await tx
        .select()
        .from(productsTable)
        .where(eq(productsTable.id, item.productId))
        .for("update")
        .limit(1);
      if (!product || !product.published || item.quantity > product.stock) {
        throw new HttpError(
          409,
          "STOCK_CHANGED",
          "One or more items are no longer available in the requested quantity. Review your cart.",
        );
      }
      const price = unitPrice(product);
      lines.push({
        productId: product.id,
        name: product.name,
        sku: product.sku,
        quantity: item.quantity,
        unitPriceMinor: price,
        lineTotalMinor: price * item.quantity,
      });
    }
    const subtotalMinor = lines.reduce((sum, line) => sum + line.lineTotalMinor, 0);
    const deliveryFeeMinor = settings.deliveryFeeMinor;
    const totalMinor = subtotalMinor + deliveryFeeMinor;
    if (!Number.isSafeInteger(totalMinor) || totalMinor > 2_000_000_000) {
      throw new HttpError(400, "ORDER_TOTAL_INVALID", "The order total is outside the supported range.");
    }

    const [order] = await tx
      .insert(ordersTable)
      .values({
        orderNumber,
        idempotencyKey: input.idempotencyKey,
        userId: user?.id ?? null,
        sessionId,
        customerName: input.name.trim(),
        customerEmail: input.email.trim().toLowerCase(),
        customerPhone: input.phone.trim(),
        orderStatus: "submitted",
        paymentStatus: "cod_due",
        paymentMethod: "cash_on_delivery",
        fulfillmentStatus: "unfulfilled",
        subtotalMinor,
        deliveryFeeMinor,
        totalMinor,
        currency: settings.currency,
      })
      .returning();
    if (!order) throw new Error("The order could not be created.");

    await tx.insert(orderItemsTable).values(
      lines.map((line) => ({
        orderId: order.id,
        productId: line.productId,
        name: line.name,
        sku: line.sku,
        quantity: line.quantity,
        unitPriceMinor: line.unitPriceMinor,
        lineTotalMinor: line.lineTotalMinor,
      })),
    );
    await tx.insert(deliveriesTable).values({
      orderId: order.id,
      address: input.address.trim(),
      city: input.city.trim(),
      region: input.region.trim(),
      deliveryNotes: input.deliveryNotes?.trim() || null,
    });
    await tx.insert(paymentsTable).values({
      orderId: order.id,
      method: "cash_on_delivery",
      status: "cod_due",
      amountMinor: totalMinor,
    });
    for (const line of lines) {
      await tx
        .update(productsTable)
        .set({
          stock: sql`${productsTable.stock} - ${line.quantity}`,
          updatedAt: new Date(),
        })
        .where(and(eq(productsTable.id, line.productId), gte(productsTable.stock, line.quantity)));
    }
    await tx.delete(cartItemsTable).where(eq(cartItemsTable.cartId, cartId));
    return order;
  });

  res.status(201).json(
    SubmitOrderResponse.parse({
      orderNumber: result.orderNumber,
      orderStatus: result.orderStatus,
      paymentStatus: result.paymentStatus,
      fulfillmentStatus: result.fulfillmentStatus,
      totalMinor: result.totalMinor,
      currency: result.currency,
    }),
  );
});

router.get("/account", async (req, res): Promise<void> => {
  const user = await resolveCurrentUser(req, res);
  if (!user) {
    res.status(401).json(errorResponse("Sign in to view your account.", "UNAUTHENTICATED"));
    return;
  }
  const [count] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(ordersTable)
    .where(eq(ordersTable.userId, user.id));
  res.json(
    GetAccountResponse.parse({
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      orderCount: count?.count ?? 0,
    }),
  );
});

router.patch("/account", async (req, res): Promise<void> => {
  const body = UpdateAccountBody.safeParse(req.body);
  if (!body.success || Object.keys(body.data ?? {}).length === 0) {
    res.status(400).json(errorResponse("Enter a valid name or phone number.", "INVALID_ACCOUNT"));
    return;
  }
  const user = await resolveCurrentUser(req, res);
  if (!user) {
    res.status(401).json(errorResponse("Sign in to update your account.", "UNAUTHENTICATED"));
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({
      ...(body.data.name !== undefined ? { name: body.data.name.trim() } : {}),
      ...(body.data.phone !== undefined ? { phone: body.data.phone?.trim() || null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(usersTable.id, user.id))
    .returning();
  if (!updated) {
    res.status(404).json(errorResponse("Account not found.", "ACCOUNT_NOT_FOUND"));
    return;
  }
  const [count] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(ordersTable)
    .where(eq(ordersTable.userId, user.id));
  res.json(
    UpdateAccountResponse.parse({
      id: updated.id,
      email: updated.email,
      name: updated.name,
      phone: updated.phone,
      role: updated.role,
      orderCount: count?.count ?? 0,
    }),
  );
});

router.get("/orders", async (req, res): Promise<void> => {
  const user = await resolveCurrentUser(req, res);
  if (!user) {
    res.status(401).json(errorResponse("Sign in to view your orders.", "UNAUTHENTICATED"));
    return;
  }
  const orders = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.userId, user.id))
    .orderBy(desc(ordersTable.createdAt))
    .limit(100);
  const result = await Promise.all(orders.map(orderDto));
  res.json(ListCustomerOrdersResponse.parse(result));
});

router.get("/orders/:orderNumber", async (req, res): Promise<void> => {
  const params = GetCustomerOrderParams.safeParse(req.params);
  if (!params.success || !ORDER_NUMBER_PATTERN.test(params.data.orderNumber)) {
    res.status(404).json(errorResponse("Order not found.", "ORDER_NOT_FOUND"));
    return;
  }
  const user = await resolveCurrentUser(req, res);
  const sessionId = req.cookies?.rang_cart_session;
  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.orderNumber, params.data.orderNumber))
    .limit(1);
  if (
    !order ||
    (order.userId !== user?.id && (!sessionId || order.sessionId !== sessionId))
  ) {
    res.status(404).json(errorResponse("Order not found.", "ORDER_NOT_FOUND"));
    return;
  }
  res.json(GetCustomerOrderResponse.parse(await orderDto(order)));
});

export default router;
