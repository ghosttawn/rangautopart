import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { productsTable } from "./catalog";
import { usersTable } from "./users";
import { z } from "zod/v4";

export const cartsTable = pgTable(
  "carts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").references(() => usersTable.id, {
      onDelete: "cascade",
    }),
    sessionId: text("session_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("carts_user_unique")
      .on(table.userId)
      .where(sql`${table.userId} IS NOT NULL`),
    uniqueIndex("carts_session_unique")
      .on(table.sessionId)
      .where(sql`${table.sessionId} IS NOT NULL`),
  ],
);

export const cartItemsTable = pgTable(
  "cart_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cartId: uuid("cart_id")
      .notNull()
      .references(() => cartsTable.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => productsTable.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("cart_items_cart_product_unique").on(
      table.cartId,
      table.productId,
    ),
    index("cart_items_cart_idx").on(table.cartId),
    check("cart_items_quantity_positive", sql`${table.quantity} > 0`),
  ],
);

export const ordersTable = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderNumber: text("order_number").notNull(),
    idempotencyKey: uuid("idempotency_key").notNull(),
    userId: text("user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    sessionId: text("session_id"),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email").notNull(),
    customerPhone: text("customer_phone").notNull(),
    orderStatus: text("order_status").notNull().default("submitted"),
    paymentStatus: text("payment_status").notNull().default("cod_due"),
    paymentMethod: text("payment_method").notNull().default("cash_on_delivery"),
    fulfillmentStatus: text("fulfillment_status").notNull().default("unfulfilled"),
    subtotalMinor: integer("subtotal_minor").notNull(),
    deliveryFeeMinor: integer("delivery_fee_minor").notNull(),
    totalMinor: integer("total_minor").notNull(),
    currency: text("currency").notNull(),
    staffNote: text("staff_note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("orders_number_unique").on(table.orderNumber),
    uniqueIndex("orders_idempotency_unique").on(table.idempotencyKey),
    index("orders_customer_created_idx").on(table.userId, table.createdAt),
    index("orders_session_created_idx").on(table.sessionId, table.createdAt),
    index("orders_status_created_idx").on(table.orderStatus, table.createdAt),
    check("orders_total_nonnegative", sql`${table.totalMinor} >= 0`),
  ],
);

export const orderItemsTable = pgTable(
  "order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => ordersTable.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => productsTable.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    sku: text("sku").notNull(),
    quantity: integer("quantity").notNull(),
    unitPriceMinor: integer("unit_price_minor").notNull(),
    lineTotalMinor: integer("line_total_minor").notNull(),
  },
  (table) => [
    index("order_items_order_idx").on(table.orderId),
    check("order_items_quantity_positive", sql`${table.quantity} > 0`),
  ],
);

export const paymentsTable = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => ordersTable.id, { onDelete: "cascade" }),
    method: text("method").notNull(),
    status: text("status").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    providerReference: text("provider_reference"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("payments_order_idx").on(table.orderId),
    check("payments_amount_nonnegative", sql`${table.amountMinor} >= 0`),
  ],
);

export const deliveriesTable = pgTable(
  "deliveries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => ordersTable.id, { onDelete: "cascade" }),
    address: text("address").notNull(),
    city: text("city").notNull(),
    region: text("region").notNull(),
    deliveryNotes: text("delivery_notes"),
    deliveryMethod: text("delivery_method").notNull().default("delivery"),
    trackingReference: text("tracking_reference"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("deliveries_order_unique").on(table.orderId),
    index("deliveries_region_idx").on(table.region),
  ],
);

export const insertCartSchema = createInsertSchema(cartsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertOrderSchema = createInsertSchema(ordersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  cancelledAt: true,
});
export const insertOrderItemSchema = createInsertSchema(orderItemsTable).omit({
  id: true,
});
export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertDeliverySchema = createInsertSchema(deliveriesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Cart = typeof cartsTable.$inferSelect;
export type CartItem = typeof cartItemsTable.$inferSelect;
export type Order = typeof ordersTable.$inferSelect;
export type OrderItem = typeof orderItemsTable.$inferSelect;
export type Payment = typeof paymentsTable.$inferSelect;
export type Delivery = typeof deliveriesTable.$inferSelect;
export type StoreSettingJson = Record<string, unknown>;
