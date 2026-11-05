import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

export const categoriesTable = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("categories_name_unique").on(table.name),
    uniqueIndex("categories_slug_unique").on(table.slug),
  ],
);

export const productsTable = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    sku: text("sku").notNull(),
    slug: text("slug").notNull(),
    brand: text("brand"),
    priceMinor: integer("price_minor").notNull(),
    salePriceMinor: integer("sale_price_minor"),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categoriesTable.id, { onDelete: "restrict" }),
    description: text("description").notNull().default(""),
    specifications: jsonb("specifications")
      .$type<Record<string, string | number | boolean>>()
      .notNull()
      .default({}),
    stock: integer("stock").notNull().default(0),
    published: boolean("published").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("products_sku_unique").on(table.sku),
    uniqueIndex("products_slug_unique").on(table.slug),
    index("products_category_idx").on(table.categoryId),
    index("products_published_created_idx").on(table.published, table.createdAt),
    check("products_price_nonnegative", sql`${table.priceMinor} >= 0`),
    check(
      "products_sale_price_nonnegative",
      sql`${table.salePriceMinor} IS NULL OR ${table.salePriceMinor} >= 0`,
    ),
    check("products_stock_nonnegative", sql`${table.stock} >= 0`),
  ],
);

export const productImagesTable = pgTable(
  "product_images",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => productsTable.id, { onDelete: "cascade" }),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    altText: text("alt_text"),
    sortOrder: integer("sort_order").notNull().default(0),
    data: bytea("data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("product_images_product_order_idx").on(table.productId, table.sortOrder),
    check("product_images_size_positive", sql`${table.size} > 0`),
  ],
);

export const compatibilityTable = pgTable(
  "product_compatibility",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => productsTable.id, { onDelete: "cascade" }),
    make: text("make").notNull(),
    model: text("model").notNull(),
    yearFrom: integer("year_from").notNull(),
    yearTo: integer("year_to").notNull(),
    verified: boolean("verified").notNull().default(false),
  },
  (table) => [
    index("compatibility_vehicle_idx").on(
      table.make,
      table.model,
      table.yearFrom,
      table.yearTo,
    ),
    index("compatibility_product_idx").on(table.productId),
    check("compatibility_year_range", sql`${table.yearFrom} <= ${table.yearTo}`),
  ],
);

export const insertCategorySchema = createInsertSchema(categoriesTable).omit({
  id: true,
  createdAt: true,
});
export const insertProductSchema = createInsertSchema(productsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertProductImageSchema = createInsertSchema(productImagesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertCompatibilitySchema = createInsertSchema(compatibilityTable).omit({
  id: true,
});

export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categoriesTable.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
export type ProductImage = typeof productImagesTable.$inferSelect;
export type Compatibility = typeof compatibilityTable.$inferSelect;
