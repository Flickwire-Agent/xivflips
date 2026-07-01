import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { flipStatuses, flipStrategies, listingStatuses } from "@xivflips/shared";

export const flipStatusEnum = pgEnum("flip_status", flipStatuses);
export const listingStatusEnum = pgEnum("listing_status", listingStatuses);
export const flipStrategyEnum = pgEnum("flip_strategy", flipStrategies);

function timestamps() {
  return {
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  };
}

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subject: text("subject").notNull().unique(),
    email: text("email"),
    displayName: text("display_name"),
    homeWorldId: integer("home_world_id"),
    defaultTaxRateBps: integer("default_tax_rate_bps").notNull().default(500),
    isAdmin: boolean("is_admin").notNull().default(false),
    ...timestamps(),
  },
  (table) => [index("users_subject_idx").on(table.subject)],
);

export const xivauthAccounts = pgTable(
  "xivauth_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    xivauthUserId: text("xivauth_user_id").notNull().unique(),
    email: text("email"),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("xivauth_accounts_user_idx").on(table.userId),
    index("xivauth_accounts_user_id_idx").on(table.xivauthUserId),
  ],
);

export const xivauthCharacters = pgTable(
  "xivauth_characters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    persistentKey: text("persistent_key").notNull().unique(),
    lodestoneId: integer("lodestone_id").notNull(),
    name: text("name").notNull(),
    homeWorld: text("home_world").notNull(),
    dataCenter: text("data_center").notNull(),
    avatarUrl: text("avatar_url"),
    portraitUrl: text("portrait_url"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    index("xivauth_characters_user_idx").on(table.userId),
    uniqueIndex("xivauth_characters_user_lodestone_idx").on(table.userId, table.lodestoneId),
  ],
);

export const items = pgTable(
  "items",
  {
    id: integer("id").primaryKey(),
    name: text("name").notNull(),
    iconUrl: text("icon_url"),
    categoryName: text("category_name"),
    isMarketable: boolean("is_marketable").notNull().default(true),
    averageSoldPrice: integer("average_sold_price"),
    metadata: jsonb("metadata"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("items_name_idx").on(table.name)],
);

export const worlds = pgTable(
  "worlds",
  {
    id: integer("id").primaryKey(),
    name: text("name").notNull(),
    dataCenter: text("data_center").notNull(),
    region: text("region").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("worlds_name_idx").on(table.name),
    index("worlds_data_center_idx").on(table.dataCenter),
  ],
);

export const flips = pgTable(
  "flips",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    itemId: integer("item_id")
      .notNull()
      .references(() => items.id),
    worldId: integer("world_id").references(() => worlds.id),
    status: flipStatusEnum("status").notNull().default("active"),
    strategy: flipStrategyEnum("strategy"),
    targetSellPrice: integer("target_sell_price"),
    notes: text("notes"),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    index("flips_user_status_idx").on(table.userId, table.status),
    index("flips_item_idx").on(table.itemId),
  ],
);

export const purchases = pgTable(
  "purchases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    flipId: uuid("flip_id")
      .notNull()
      .references(() => flips.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    unitPrice: integer("unit_price").notNull(),
    worldId: integer("world_id").references(() => worlds.id),
    purchasedAt: timestamp("purchased_at", { withTimezone: true }).notNull().defaultNow(),
    notes: text("notes"),
    ...timestamps(),
  },
  (table) => [index("purchases_flip_idx").on(table.flipId)],
);

export const listings = pgTable(
  "listings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    flipId: uuid("flip_id")
      .notNull()
      .references(() => flips.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    unitPrice: integer("unit_price").notNull(),
    worldId: integer("world_id").references(() => worlds.id),
    status: listingStatusEnum("status").notNull().default("active"),
    listedAt: timestamp("listed_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    notes: text("notes"),
    ...timestamps(),
  },
  (table) => [index("listings_flip_idx").on(table.flipId)],
);

export const sales = pgTable(
  "sales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    flipId: uuid("flip_id")
      .notNull()
      .references(() => flips.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    unitPrice: integer("unit_price").notNull(),
    taxRateBps: integer("tax_rate_bps").notNull().default(500),
    worldId: integer("world_id").references(() => worlds.id),
    soldAt: timestamp("sold_at", { withTimezone: true }).notNull().defaultNow(),
    notes: text("notes"),
    ...timestamps(),
  },
  (table) => [
    index("sales_flip_idx").on(table.flipId),
    index("sales_sold_at_idx").on(table.soldAt),
  ],
);

export const watchlistItems = pgTable(
  "watchlist_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    itemId: integer("item_id")
      .notNull()
      .references(() => items.id),
    worldId: integer("world_id").references(() => worlds.id),
    dataCenter: text("data_center"),
    targetBuyPrice: integer("target_buy_price"),
    targetSellPrice: integer("target_sell_price"),
    minRoiBps: integer("min_roi_bps"),
    notes: text("notes"),
    ...timestamps(),
  },
  (table) => [
    index("watchlist_user_idx").on(table.userId),
    uniqueIndex("watchlist_unique_target_idx").on(
      table.userId,
      table.itemId,
      table.worldId,
      table.dataCenter,
    ),
  ],
);

export const marketSnapshots = pgTable(
  "market_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: integer("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    worldId: integer("world_id").references(() => worlds.id),
    dataCenter: text("data_center"),
    scopeKey: text("scope_key").notNull(),
    source: text("source").notNull().default("xivarbitrage"),
    lowestListingPrice: integer("lowest_listing_price"),
    recentAvgPrice: integer("recent_avg_price"),
    saleVelocity7d: integer("sale_velocity_7d"),
    saleCount14d: integer("sale_count_14d"),
    snapshotData: jsonb("snapshot_data").notNull(),
    snapshotDate: text("snapshot_date").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("market_snapshots_daily_unique_idx").on(
      table.itemId,
      table.scopeKey,
      table.snapshotDate,
    ),
    index("market_snapshots_item_captured_idx").on(table.itemId, table.capturedAt),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type XivauthAccountRow = typeof xivauthAccounts.$inferSelect;
export type XivauthCharacterRow = typeof xivauthCharacters.$inferSelect;
export type ItemRow = typeof items.$inferSelect;
export type WorldRow = typeof worlds.$inferSelect;
export type FlipRow = typeof flips.$inferSelect;
export type PurchaseRow = typeof purchases.$inferSelect;
export type ListingRow = typeof listings.$inferSelect;
export type SaleRow = typeof sales.$inferSelect;
export type WatchlistItemRow = typeof watchlistItems.$inferSelect;
export type MarketSnapshotRow = typeof marketSnapshots.$inferSelect;
