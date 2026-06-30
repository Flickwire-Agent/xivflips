CREATE EXTENSION IF NOT EXISTS "pgcrypto";--> statement-breakpoint
CREATE TYPE "public"."flip_status" AS ENUM('active', 'listed', 'partially_sold', 'sold', 'cancelled', 'archived');--> statement-breakpoint
CREATE TYPE "public"."flip_strategy" AS ENUM('undercut', 'velocity', 'dc_arbitrage', 'patch_speculation', 'crafted', 'other');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('active', 'sold', 'cancelled', 'expired');--> statement-breakpoint
CREATE TABLE "flips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"item_id" integer NOT NULL,
	"world_id" integer,
	"status" "flip_status" DEFAULT 'active' NOT NULL,
	"strategy" "flip_strategy",
	"target_sell_price" integer,
	"notes" text,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"icon_url" text,
	"category_name" text,
	"is_marketable" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"flip_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" integer NOT NULL,
	"world_id" integer,
	"status" "listing_status" DEFAULT 'active' NOT NULL,
	"listed_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" integer NOT NULL,
	"world_id" integer,
	"data_center" text,
	"scope_key" text NOT NULL,
	"source" text DEFAULT 'xivarbitrage' NOT NULL,
	"lowest_listing_price" integer,
	"recent_avg_price" integer,
	"sale_velocity_7d" integer,
	"sale_count_14d" integer,
	"snapshot_data" jsonb NOT NULL,
	"snapshot_date" text NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"flip_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" integer NOT NULL,
	"world_id" integer,
	"purchased_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"flip_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" integer NOT NULL,
	"tax_rate_bps" integer DEFAULT 500 NOT NULL,
	"world_id" integer,
	"sold_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth0_subject" text NOT NULL,
	"email" text,
	"display_name" text,
	"home_world_id" integer,
	"default_tax_rate_bps" integer DEFAULT 500 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_auth0_subject_unique" UNIQUE("auth0_subject")
);
--> statement-breakpoint
CREATE TABLE "watchlist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"item_id" integer NOT NULL,
	"world_id" integer,
	"data_center" text,
	"target_buy_price" integer,
	"target_sell_price" integer,
	"min_roi_bps" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "worlds" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"data_center" text NOT NULL,
	"region" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "flips" ADD CONSTRAINT "flips_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flips" ADD CONSTRAINT "flips_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flips" ADD CONSTRAINT "flips_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_flip_id_flips_id_fk" FOREIGN KEY ("flip_id") REFERENCES "public"."flips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_snapshots" ADD CONSTRAINT "market_snapshots_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_snapshots" ADD CONSTRAINT "market_snapshots_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_flip_id_flips_id_fk" FOREIGN KEY ("flip_id") REFERENCES "public"."flips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_flip_id_flips_id_fk" FOREIGN KEY ("flip_id") REFERENCES "public"."flips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "flips_user_status_idx" ON "flips" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "flips_item_idx" ON "flips" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "items_name_idx" ON "items" USING btree ("name");--> statement-breakpoint
CREATE INDEX "listings_flip_idx" ON "listings" USING btree ("flip_id");--> statement-breakpoint
CREATE UNIQUE INDEX "market_snapshots_daily_unique_idx" ON "market_snapshots" USING btree ("item_id","scope_key","snapshot_date");--> statement-breakpoint
CREATE INDEX "market_snapshots_item_captured_idx" ON "market_snapshots" USING btree ("item_id","captured_at");--> statement-breakpoint
CREATE INDEX "purchases_flip_idx" ON "purchases" USING btree ("flip_id");--> statement-breakpoint
CREATE INDEX "sales_flip_idx" ON "sales" USING btree ("flip_id");--> statement-breakpoint
CREATE INDEX "sales_sold_at_idx" ON "sales" USING btree ("sold_at");--> statement-breakpoint
CREATE INDEX "users_auth0_subject_idx" ON "users" USING btree ("auth0_subject");--> statement-breakpoint
CREATE INDEX "watchlist_user_idx" ON "watchlist_items" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "watchlist_unique_target_idx" ON "watchlist_items" USING btree ("user_id","item_id","world_id","data_center");--> statement-breakpoint
CREATE INDEX "worlds_name_idx" ON "worlds" USING btree ("name");--> statement-breakpoint
CREATE INDEX "worlds_data_center_idx" ON "worlds" USING btree ("data_center");
