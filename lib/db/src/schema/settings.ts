import { boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import {
  customType,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

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
  heroTitle: text("hero_title").notNull().default("Keep your"),
  heroHighlight: text("hero_highlight").notNull().default("machine moving."),
  heroDescription: text("hero_description")
    .notNull()
    .default(
      "Reliable parts for ATVs, cars, motorcycles and utility vehicles. Find the right piece, know what you are getting, and get on with the repair.",
    ),
  heroImageData: bytea("hero_image_data"),
  heroImageContentType: text("hero_image_content_type"),
  heroImageSize: integer("hero_image_size"),
  promotionalTitle: text("promotional_title")
    .notNull()
    .default("Not sure it fits? Ask first."),
  promotionalBody: text("promotional_body")
    .notNull()
    .default(
      "Send us the make, model and year. We will help you narrow it down before you order.",
    ),
  promotionalActionLabel: text("promotional_action_label")
    .notNull()
    .default("Talk to our parts desk"),
  promotionalUrl: text("promotional_url").notNull().default("/contact"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertStoreSettingsSchema = createInsertSchema(storeSettingsTable);
export type InsertStoreSettings = z.infer<typeof insertStoreSettingsSchema>;
export type StoreSettings = typeof storeSettingsTable.$inferSelect;
