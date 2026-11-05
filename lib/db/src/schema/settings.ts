import { boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import {
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const storeSettingsTable = pgTable("store_settings", {
  id: integer("id").primaryKey().default(1),
  storeName: text("store_name").notNull().default("RANG Auto Parts"),
  currency: text("currency").notNull().default("XAF"),
  deliveryFeeMinor: integer("delivery_fee_minor").notNull().default(0),
  deliveryRegions: text("delivery_regions")
    .array()
    .notNull()
    .default([]),
  cashOnDeliveryEnabled: boolean("cash_on_delivery_enabled")
    .notNull()
    .default(true),
  onlinePaymentsEnabled: boolean("online_payments_enabled")
    .notNull()
    .default(false),
  supportEmail: text("support_email"),
  contactPhone: text("contact_phone"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertStoreSettingsSchema = createInsertSchema(storeSettingsTable);
export type InsertStoreSettings = z.infer<typeof insertStoreSettingsSchema>;
export type StoreSettings = typeof storeSettingsTable.$inferSelect;
