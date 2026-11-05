CREATE TABLE "auth_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "image_data" "bytea";--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "image_content_type" text;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "image_size" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "featured" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "deliveries" ADD COLUMN "country" text;--> statement-breakpoint
ALTER TABLE "store_settings" ADD COLUMN "hero_title" text DEFAULT 'Keep your' NOT NULL;--> statement-breakpoint
ALTER TABLE "store_settings" ADD COLUMN "hero_highlight" text DEFAULT 'machine moving.' NOT NULL;--> statement-breakpoint
ALTER TABLE "store_settings" ADD COLUMN "hero_description" text DEFAULT 'Reliable parts for ATVs, cars, motorcycles and utility vehicles. Find the right piece, know what you are getting, and get on with the repair.' NOT NULL;--> statement-breakpoint
ALTER TABLE "store_settings" ADD COLUMN "hero_image_data" "bytea";--> statement-breakpoint
ALTER TABLE "store_settings" ADD COLUMN "hero_image_content_type" text;--> statement-breakpoint
ALTER TABLE "store_settings" ADD COLUMN "hero_image_size" integer;--> statement-breakpoint
ALTER TABLE "store_settings" ADD COLUMN "promotional_title" text DEFAULT 'Not sure it fits? Ask first.' NOT NULL;--> statement-breakpoint
ALTER TABLE "store_settings" ADD COLUMN "promotional_body" text DEFAULT 'Send us the make, model and year. We will help you narrow it down before you order.' NOT NULL;--> statement-breakpoint
ALTER TABLE "store_settings" ADD COLUMN "promotional_action_label" text DEFAULT 'Talk to our parts desk' NOT NULL;--> statement-breakpoint
ALTER TABLE "store_settings" ADD COLUMN "promotional_url" text DEFAULT '/contact' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_sessions_token_hash_unique" ON "auth_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "auth_sessions_user_expiry_idx" ON "auth_sessions" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX "auth_sessions_expiry_idx" ON "auth_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "password_reset_tokens_hash_unique" ON "password_reset_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_user_expiry_idx" ON "password_reset_tokens" USING btree ("user_id","expires_at");