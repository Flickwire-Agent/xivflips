import type { Context, Hono } from "hono";
import { and, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { z } from "zod";
import {
  createFlipSchema,
  createListingSchema,
  createPurchaseSchema,
  createSaleSchema,
  createWatchlistItemSchema,
  flipStatusSchema,
  itemSearchQuerySchema,
  paginationQuerySchema,
  updateFlipSchema,
  updateListingSchema,
  updatePurchaseSchema,
  updateSaleSchema,
  updateUserSettingsSchema,
  updateWatchlistItemSchema,
} from "@xivflips/shared";
import { getDb } from "../db/client.js";
import {
  flips,
  items,
  listings,
  purchases,
  sales,
  users,
  watchlistItems,
  worlds,
  xivauthCharacters,
  type FlipRow,
  type ItemRow,
  type ListingRow,
  type PurchaseRow,
  type SaleRow,
  type WorldRow,
} from "../db/schema.js";
import type { AppEnv } from "../http/auth.js";
import { badRequest, notFound } from "../http/errors.js";
import {
  serializeFlip,
  serializeItem,
  serializeListing,
  serializePurchase,
  serializeSale,
  serializeUser,
  serializeWatchlistItem,
  serializeWorld,
  summarizeProfit,
} from "../http/serialize.js";
import {
  getLatestSnapshot,
  getLatestSnapshots,
  refreshWorldCache,
  scopeKey,
  searchItems,
  upsertItem,
} from "../services/market.js";
import { buildXivauthAuthorizeUrl } from "../services/xivauth.js";

const uuidParamSchema = z.object({ id: z.uuid() });
const flipUuidParamSchema = z.object({ id: z.uuid() });

type FlipBundle = {
  flip: FlipRow;
  item: ItemRow | null;
  world: WorldRow | null;
  purchases: PurchaseRow[];
  listings: ListingRow[];
  sales: SaleRow[];
};

async function readJson<TSchema extends z.ZodType>(
  c: Context<AppEnv>,
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  const body = await c.req.json().catch(() => badRequest("Request body must be JSON"));
  return schema.parse(body);
}

function parseOptionalDate(value: string | undefined, fallback?: Date): Date | undefined {
  if (!value) return fallback;
  return new Date(value);
}

function parseNullableDate(value: string | null | undefined): Date | null | undefined {
  if (value === null) return null;
  if (!value) return undefined;
  return new Date(value);
}

async function ensureWorldExists(worldId: number | null | undefined): Promise<void> {
  if (!worldId) return;
  const db = getDb();
  const [existing] = await db.select().from(worlds).where(eq(worlds.id, worldId)).limit(1);
  if (existing) return;
  await refreshWorldCache();
  const [refreshed] = await db.select().from(worlds).where(eq(worlds.id, worldId)).limit(1);
  if (!refreshed) badRequest(`Unknown world ID ${worldId}`);
}

async function getFlipBundle(userId: string, flipId: string): Promise<FlipBundle> {
  const db = getDb();
  const [row] = await db
    .select({ flip: flips, item: items, world: worlds })
    .from(flips)
    .innerJoin(items, eq(items.id, flips.itemId))
    .leftJoin(worlds, eq(worlds.id, flips.worldId))
    .where(and(eq(flips.id, flipId), eq(flips.userId, userId)))
    .limit(1);

  if (!row) notFound("Flip not found");

  const [purchaseRows, listingRows, saleRows] = await Promise.all([
    db
      .select()
      .from(purchases)
      .where(eq(purchases.flipId, flipId))
      .orderBy(desc(purchases.purchasedAt)),
    db.select().from(listings).where(eq(listings.flipId, flipId)).orderBy(desc(listings.listedAt)),
    db.select().from(sales).where(eq(sales.flipId, flipId)).orderBy(desc(sales.soldAt)),
  ]);

  return {
    flip: row.flip,
    item: row.item,
    world: row.world,
    purchases: purchaseRows,
    listings: listingRows,
    sales: saleRows,
  };
}

async function serializeBundle(bundle: FlipBundle) {
  const latestSnapshot = await getLatestSnapshot({
    itemId: bundle.flip.itemId,
    worldId: bundle.flip.worldId,
    dataCenter: bundle.world?.dataCenter ?? null,
  });

  return {
    ...serializeFlip({ ...bundle, latestSnapshot }),
    purchases: bundle.purchases.map(serializePurchase),
    listings: bundle.listings.map(serializeListing),
    sales: bundle.sales.map(serializeSale),
  };
}

function groupByFlip<T extends { flipId: string }>(rows: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const existing = grouped.get(row.flipId) ?? [];
    existing.push(row);
    grouped.set(row.flipId, existing);
  }
  return grouped;
}

async function listUserFlips(userId: string, status?: string, query?: string) {
  const db = getDb();
  const statusFilter = status ? flipStatusSchema.parse(status) : undefined;
  const where = and(
    eq(flips.userId, userId),
    statusFilter === "active"
      ? inArray(flips.status, ["active", "partially_sold"])
      : statusFilter
        ? eq(flips.status, statusFilter)
        : undefined,
    query ? or(ilike(items.name, `%${query}%`), ilike(flips.notes, `%${query}%`)) : undefined,
  );

  return db
    .select({ flip: flips, item: items, world: worlds })
    .from(flips)
    .innerJoin(items, eq(items.id, flips.itemId))
    .leftJoin(worlds, eq(worlds.id, flips.worldId))
    .where(where)
    .orderBy(desc(flips.updatedAt));
}

async function serializeFlipRows(
  rows: { flip: FlipRow; item: ItemRow | null; world: WorldRow | null }[],
) {
  const db = getDb();
  if (rows.length === 0) return [];
  const flipIds = rows.map((row) => row.flip.id);
  const [purchaseRows, saleRows] = await Promise.all([
    db.select().from(purchases).where(inArray(purchases.flipId, flipIds)),
    db.select().from(sales).where(inArray(sales.flipId, flipIds)),
  ]);
  const purchasesByFlip = groupByFlip(purchaseRows);
  const salesByFlip = groupByFlip(saleRows);
  const targets = rows.map((row) => ({
    itemId: row.flip.itemId,
    worldId: row.flip.worldId,
    dataCenter: row.world?.dataCenter ?? null,
  }));
  const snapshots = await getLatestSnapshots(targets);

  return rows.map((row) =>
    serializeFlip({
      flip: row.flip,
      item: row.item,
      world: row.world,
      purchases: purchasesByFlip.get(row.flip.id) ?? [],
      sales: salesByFlip.get(row.flip.id) ?? [],
      latestSnapshot:
        snapshots.get(
          `${row.flip.itemId}:${scopeKey({ itemId: row.flip.itemId, worldId: row.flip.worldId, dataCenter: row.world?.dataCenter ?? null })}`,
        ) ?? null,
    }),
  );
}

async function assertFlipOwner(userId: string, flipId: string): Promise<FlipRow> {
  const db = getDb();
  const [flip] = await db
    .select()
    .from(flips)
    .where(and(eq(flips.id, flipId), eq(flips.userId, userId)))
    .limit(1);
  if (!flip) notFound("Flip not found");
  return flip;
}

async function inferRestoredStatus(flipId: string): Promise<FlipRow["status"]> {
  const db = getDb();
  const [purchaseRows, saleRows, listingRows] = await Promise.all([
    db.select().from(purchases).where(eq(purchases.flipId, flipId)),
    db.select().from(sales).where(eq(sales.flipId, flipId)),
    db.select().from(listings).where(eq(listings.flipId, flipId)),
  ]);
  const purchasedQuantity = purchaseRows.reduce((total, purchase) => total + purchase.quantity, 0);
  const soldQuantity = saleRows.reduce((total, sale) => total + sale.quantity, 0);

  if (purchasedQuantity > 0 && soldQuantity >= purchasedQuantity) return "sold";
  if (soldQuantity > 0) return "partially_sold";
  if (listingRows.some((listing) => listing.status === "active")) return "listed";
  return "active";
}

async function assertSaleQuantity(flipId: string, nextSale?: { id?: string; quantity: number }) {
  const db = getDb();
  const [purchaseRows, saleRows] = await Promise.all([
    db.select().from(purchases).where(eq(purchases.flipId, flipId)),
    db.select().from(sales).where(eq(sales.flipId, flipId)),
  ]);
  const purchasedQuantity = purchaseRows.reduce((total, purchase) => total + purchase.quantity, 0);
  const currentSoldQuantity = saleRows
    .filter((sale) => sale.id !== nextSale?.id)
    .reduce((total, sale) => total + sale.quantity, 0);
  const nextSoldQuantity = currentSoldQuantity + (nextSale?.quantity ?? 0);

  if (nextSoldQuantity > purchasedQuantity) {
    badRequest("Sold quantity cannot exceed purchased quantity");
  }
}

async function getEventFlip(
  userId: string,
  eventId: string,
  table: typeof purchases | typeof listings | typeof sales,
) {
  const db = getDb();
  const [event] = await db.select().from(table).where(eq(table.id, eventId)).limit(1);
  if (!event) notFound("Record not found");
  const flip = await assertFlipOwner(userId, event.flipId);
  return { event, flip };
}

export function registerProtectedRoutes(app: Hono<AppEnv>) {
  app.get("/me", async (c) => {
    const db = getDb();
    const characters = await db
      .select()
      .from(xivauthCharacters)
      .where(eq(xivauthCharacters.userId, c.get("user").id))
      .orderBy(xivauthCharacters.name);

    return c.json({
      user: serializeUser(c.get("user")),
      claims: c.get("claims"),
      xivauthCharacters: characters.map((character) => ({
        id: character.id,
        persistentKey: character.persistentKey,
        lodestoneId: character.lodestoneId,
        name: character.name,
        homeWorld: character.homeWorld,
        dataCenter: character.dataCenter,
        avatarUrl: character.avatarUrl,
        portraitUrl: character.portraitUrl,
        verifiedAt: character.verifiedAt?.toISOString() ?? null,
      })),
    });
  });

  app.get("/auth/xivauth/link", async (c) => {
    return c.json({ url: await buildXivauthAuthorizeUrl("link", c.get("user").id) });
  });

  app.patch("/me/settings", async (c) => {
    const input = await readJson(c, updateUserSettingsSchema);
    await ensureWorldExists(input.homeWorldId);
    const db = getDb();
    const [user] = await db
      .update(users)
      .set({
        homeWorldId: input.homeWorldId,
        defaultTaxRateBps: input.defaultTaxRateBps,
        updatedAt: new Date(),
      })
      .where(eq(users.id, c.get("user").id))
      .returning();
    return c.json({ user: serializeUser(user ?? c.get("user")) });
  });

  app.get("/worlds", async (c) => {
    const db = getDb();
    let rows = await db.select().from(worlds).orderBy(worlds.name);
    if (rows.length === 0) {
      await refreshWorldCache();
      rows = await db.select().from(worlds).orderBy(worlds.name);
    }
    return c.json({ worlds: rows.map(serializeWorld).filter(Boolean) });
  });

  app.get("/items/search", async (c) => {
    const query = itemSearchQuerySchema.parse({ q: c.req.query("q") });
    const rows = await searchItems(query.q);
    return c.json({ items: rows.map(serializeItem).filter(Boolean) });
  });

  app.get("/dashboard", async (c) => {
    const userId = c.get("user").id;
    const rows = await listUserFlips(userId);
    const serialized = await serializeFlipRows(rows);
    const activeFlips = serialized.filter(
      (flip) => !["sold", "cancelled", "archived"].includes(flip.status),
    );
    const realizedCostBasis = serialized.reduce(
      (total, flip) => total + flip.profit.realizedCostBasis,
      0,
    );
    const realizedProfit = serialized.reduce(
      (total, flip) => total + flip.profit.realizedProfit,
      0,
    );
    const activeCostBasis = activeFlips.reduce(
      (total, flip) =>
        total + Math.max(0, flip.profit.totalCostBasis - flip.profit.realizedCostBasis),
      0,
    );
    const estimatedInventoryValue = activeFlips.reduce(
      (total, flip) => total + (flip.profit.estimatedInventoryValue ?? 0),
      0,
    );
    const db = getDb();
    const recentSaleRows = await db
      .select({ sale: sales, item: items, flip: flips })
      .from(sales)
      .innerJoin(flips, eq(flips.id, sales.flipId))
      .innerJoin(items, eq(items.id, flips.itemId))
      .where(eq(flips.userId, userId))
      .orderBy(desc(sales.soldAt))
      .limit(5);
    const watchlistCount = await db
      .select({ id: watchlistItems.id })
      .from(watchlistItems)
      .where(eq(watchlistItems.userId, userId));

    return c.json({
      activeCostBasis,
      realizedProfit,
      realizedRoiBps:
        realizedCostBasis > 0 ? Math.round((realizedProfit / realizedCostBasis) * 10000) : null,
      estimatedInventoryValue,
      activeFlipCount: activeFlips.length,
      watchlistCount: watchlistCount.length,
      recentSales: recentSaleRows.map((row) => ({
        ...serializeSale(row.sale),
        itemName: row.item.name,
        flipId: row.flip.id,
      })),
      activeFlips: activeFlips.slice(0, 8),
    });
  });

  app.get("/flips", async (c) => {
    paginationQuerySchema.parse({ page: c.req.query("page"), perPage: c.req.query("perPage") });
    const rows = await listUserFlips(c.get("user").id, c.req.query("status"), c.req.query("q"));
    const serialized = await serializeFlipRows(rows);
    return c.json({ flips: serialized, total: serialized.length });
  });

  app.post("/flips", async (c) => {
    const input = await readJson(c, createFlipSchema);
    const db = getDb();
    await Promise.all([
      upsertItem(input.itemId, input.itemName),
      ensureWorldExists(input.worldId),
      ensureWorldExists(input.initialPurchase?.worldId ?? input.worldId),
    ]);
    const [flip] = await db
      .insert(flips)
      .values({
        userId: c.get("user").id,
        itemId: input.itemId,
        worldId: input.worldId ?? null,
        status: input.status,
        strategy: input.strategy ?? null,
        targetSellPrice: input.targetSellPrice ?? null,
        notes: input.notes ?? null,
        openedAt: parseOptionalDate(input.openedAt, new Date()) ?? new Date(),
      })
      .returning();

    if (!flip) badRequest("Unable to create flip");

    if (input.initialPurchase) {
      await db.insert(purchases).values({
        flipId: flip.id,
        quantity: input.initialPurchase.quantity,
        unitPrice: input.initialPurchase.unitPrice,
        worldId: input.initialPurchase.worldId ?? input.worldId ?? null,
        purchasedAt: parseOptionalDate(input.initialPurchase.purchasedAt, new Date()) ?? new Date(),
        notes: input.initialPurchase.notes ?? null,
      });
    }

    return c.json(
      { flip: await serializeBundle(await getFlipBundle(c.get("user").id, flip.id)) },
      201,
    );
  });

  app.get("/flips/:id", async (c) => {
    const { id } = flipUuidParamSchema.parse(c.req.param());
    return c.json({ flip: await serializeBundle(await getFlipBundle(c.get("user").id, id)) });
  });

  app.patch("/flips/:id", async (c) => {
    const { id } = flipUuidParamSchema.parse(c.req.param());
    const input = await readJson(c, updateFlipSchema);
    await assertFlipOwner(c.get("user").id, id);
    await ensureWorldExists(input.worldId);
    const db = getDb();
    await db
      .update(flips)
      .set({
        worldId: input.worldId,
        status: input.status,
        strategy: input.strategy,
        targetSellPrice: input.targetSellPrice,
        notes: input.notes,
        openedAt: parseOptionalDate(input.openedAt),
        closedAt: parseNullableDate(input.closedAt),
        updatedAt: new Date(),
      })
      .where(eq(flips.id, id));
    return c.json({ flip: await serializeBundle(await getFlipBundle(c.get("user").id, id)) });
  });

  app.delete("/flips/:id", async (c) => {
    const { id } = uuidParamSchema.parse(c.req.param());
    await assertFlipOwner(c.get("user").id, id);
    const db = getDb();
    await db
      .update(flips)
      .set({ status: "archived", updatedAt: new Date() })
      .where(eq(flips.id, id));
    return c.json({ ok: true });
  });

  app.post("/flips/:id/restore", async (c) => {
    const { id } = uuidParamSchema.parse(c.req.param());
    await assertFlipOwner(c.get("user").id, id);
    const status = await inferRestoredStatus(id);
    const db = getDb();
    await db
      .update(flips)
      .set({
        status,
        closedAt: status === "sold" ? undefined : null,
        updatedAt: new Date(),
      })
      .where(eq(flips.id, id));
    return c.json({ flip: await serializeBundle(await getFlipBundle(c.get("user").id, id)) });
  });

  app.post("/flips/:id/purchases", async (c) => {
    const { id } = uuidParamSchema.parse(c.req.param());
    const input = await readJson(c, createPurchaseSchema);
    await assertFlipOwner(c.get("user").id, id);
    await ensureWorldExists(input.worldId);
    const db = getDb();
    await db.insert(purchases).values({
      flipId: id,
      quantity: input.quantity,
      unitPrice: input.unitPrice,
      worldId: input.worldId ?? null,
      purchasedAt: parseOptionalDate(input.purchasedAt, new Date()) ?? new Date(),
      notes: input.notes ?? null,
    });
    return c.json({ flip: await serializeBundle(await getFlipBundle(c.get("user").id, id)) }, 201);
  });

  app.patch("/purchases/:id", async (c) => {
    const { id } = uuidParamSchema.parse(c.req.param());
    const input = await readJson(c, updatePurchaseSchema);
    const { flip } = await getEventFlip(c.get("user").id, id, purchases);
    await ensureWorldExists(input.worldId);
    const db = getDb();
    await db
      .update(purchases)
      .set({
        quantity: input.quantity,
        unitPrice: input.unitPrice,
        worldId: input.worldId,
        purchasedAt: parseOptionalDate(input.purchasedAt),
        notes: input.notes,
        updatedAt: new Date(),
      })
      .where(eq(purchases.id, id));
    return c.json({ flip: await serializeBundle(await getFlipBundle(c.get("user").id, flip.id)) });
  });

  app.delete("/purchases/:id", async (c) => {
    const { id } = uuidParamSchema.parse(c.req.param());
    const { flip } = await getEventFlip(c.get("user").id, id, purchases);
    const db = getDb();
    await db.delete(purchases).where(eq(purchases.id, id));
    return c.json({ flip: await serializeBundle(await getFlipBundle(c.get("user").id, flip.id)) });
  });

  app.post("/flips/:id/listings", async (c) => {
    const { id } = uuidParamSchema.parse(c.req.param());
    const input = await readJson(c, createListingSchema);
    await assertFlipOwner(c.get("user").id, id);
    await ensureWorldExists(input.worldId);
    const db = getDb();
    await db.insert(listings).values({
      flipId: id,
      quantity: input.quantity,
      unitPrice: input.unitPrice,
      worldId: input.worldId ?? null,
      status: input.status,
      listedAt: parseNullableDate(input.listedAt) ?? new Date(),
      endedAt: parseNullableDate(input.endedAt),
      notes: input.notes ?? null,
    });
    await db.update(flips).set({ status: "listed", updatedAt: new Date() }).where(eq(flips.id, id));
    return c.json({ flip: await serializeBundle(await getFlipBundle(c.get("user").id, id)) }, 201);
  });

  app.patch("/listings/:id", async (c) => {
    const { id } = uuidParamSchema.parse(c.req.param());
    const input = await readJson(c, updateListingSchema);
    const { flip } = await getEventFlip(c.get("user").id, id, listings);
    await ensureWorldExists(input.worldId);
    const db = getDb();
    await db
      .update(listings)
      .set({
        quantity: input.quantity,
        unitPrice: input.unitPrice,
        worldId: input.worldId,
        status: input.status,
        listedAt: parseNullableDate(input.listedAt),
        endedAt: parseNullableDate(input.endedAt),
        notes: input.notes,
        updatedAt: new Date(),
      })
      .where(eq(listings.id, id));
    return c.json({ flip: await serializeBundle(await getFlipBundle(c.get("user").id, flip.id)) });
  });

  app.delete("/listings/:id", async (c) => {
    const { id } = uuidParamSchema.parse(c.req.param());
    const { flip } = await getEventFlip(c.get("user").id, id, listings);
    const db = getDb();
    await db.delete(listings).where(eq(listings.id, id));
    return c.json({ flip: await serializeBundle(await getFlipBundle(c.get("user").id, flip.id)) });
  });

  app.post("/flips/:id/sales", async (c) => {
    const { id } = uuidParamSchema.parse(c.req.param());
    const input = await readJson(c, createSaleSchema);
    await assertFlipOwner(c.get("user").id, id);
    await assertSaleQuantity(id, { quantity: input.quantity });
    await ensureWorldExists(input.worldId);
    const db = getDb();
    await db.insert(sales).values({
      flipId: id,
      quantity: input.quantity,
      unitPrice: input.unitPrice,
      taxRateBps: input.taxRateBps,
      worldId: input.worldId ?? null,
      soldAt: parseOptionalDate(input.soldAt, new Date()) ?? new Date(),
      notes: input.notes ?? null,
    });
    const bundle = await getFlipBundle(c.get("user").id, id);
    const profit = summarizeProfit(bundle.purchases, bundle.sales, null);
    await db
      .update(flips)
      .set({
        status: profit.remainingQuantity === 0 ? "sold" : "partially_sold",
        closedAt: profit.remainingQuantity === 0 ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(flips.id, id));
    return c.json({ flip: await serializeBundle(await getFlipBundle(c.get("user").id, id)) }, 201);
  });

  app.patch("/sales/:id", async (c) => {
    const { id } = uuidParamSchema.parse(c.req.param());
    const input = await readJson(c, updateSaleSchema);
    const { event, flip } = await getEventFlip(c.get("user").id, id, sales);
    await assertSaleQuantity(flip.id, { id, quantity: input.quantity ?? event.quantity });
    await ensureWorldExists(input.worldId);
    const db = getDb();
    await db
      .update(sales)
      .set({
        quantity: input.quantity,
        unitPrice: input.unitPrice,
        taxRateBps: input.taxRateBps,
        worldId: input.worldId,
        soldAt: parseOptionalDate(input.soldAt),
        notes: input.notes,
        updatedAt: new Date(),
      })
      .where(eq(sales.id, id));
    return c.json({ flip: await serializeBundle(await getFlipBundle(c.get("user").id, flip.id)) });
  });

  app.delete("/sales/:id", async (c) => {
    const { id } = uuidParamSchema.parse(c.req.param());
    const { flip } = await getEventFlip(c.get("user").id, id, sales);
    const db = getDb();
    await db.delete(sales).where(eq(sales.id, id));
    return c.json({ flip: await serializeBundle(await getFlipBundle(c.get("user").id, flip.id)) });
  });

  app.get("/watchlist", async (c) => {
    const db = getDb();
    const rows = await db
      .select({ watchlistItem: watchlistItems, item: items, world: worlds })
      .from(watchlistItems)
      .innerJoin(items, eq(items.id, watchlistItems.itemId))
      .leftJoin(worlds, eq(worlds.id, watchlistItems.worldId))
      .where(eq(watchlistItems.userId, c.get("user").id))
      .orderBy(desc(watchlistItems.updatedAt));
    const targets = rows.map((row) => ({
      itemId: row.watchlistItem.itemId,
      worldId: row.watchlistItem.worldId,
      dataCenter: row.watchlistItem.dataCenter ?? row.world?.dataCenter ?? null,
    }));
    const snapshots = await getLatestSnapshots(targets);
    const watchlist = rows.map((row) =>
      serializeWatchlistItem({
        ...row,
        latestSnapshot:
          snapshots.get(
            `${row.watchlistItem.itemId}:${scopeKey({ itemId: row.watchlistItem.itemId, worldId: row.watchlistItem.worldId, dataCenter: row.watchlistItem.dataCenter ?? row.world?.dataCenter ?? null })}`,
          ) ?? null,
      }),
    );
    return c.json({ watchlist });
  });

  app.post("/watchlist", async (c) => {
    const input = await readJson(c, createWatchlistItemSchema);
    const db = getDb();
    await Promise.all([upsertItem(input.itemId, input.itemName), ensureWorldExists(input.worldId)]);
    const [row] = await db
      .insert(watchlistItems)
      .values({
        userId: c.get("user").id,
        itemId: input.itemId,
        worldId: input.worldId ?? null,
        dataCenter: input.dataCenter ?? null,
        targetBuyPrice: input.targetBuyPrice ?? null,
        targetSellPrice: input.targetSellPrice ?? null,
        minRoiBps: input.minRoiBps ?? null,
        notes: input.notes ?? null,
      })
      .returning();
    if (!row) badRequest("Unable to create watchlist item");
    return c.json({ watchlistItem: row }, 201);
  });

  app.patch("/watchlist/:id", async (c) => {
    const { id } = uuidParamSchema.parse(c.req.param());
    const input = await readJson(c, updateWatchlistItemSchema);
    const db = getDb();
    const [existing] = await db
      .select()
      .from(watchlistItems)
      .where(and(eq(watchlistItems.id, id), eq(watchlistItems.userId, c.get("user").id)))
      .limit(1);
    if (!existing) notFound("Watchlist item not found");
    await Promise.all([
      input.itemId ? upsertItem(input.itemId, input.itemName) : Promise.resolve(),
      ensureWorldExists(input.worldId),
    ]);
    const [row] = await db
      .update(watchlistItems)
      .set({
        itemId: input.itemId,
        worldId: input.worldId,
        dataCenter: input.dataCenter,
        targetBuyPrice: input.targetBuyPrice,
        targetSellPrice: input.targetSellPrice,
        minRoiBps: input.minRoiBps,
        notes: input.notes,
        updatedAt: new Date(),
      })
      .where(eq(watchlistItems.id, id))
      .returning();
    return c.json({ watchlistItem: row ?? existing });
  });

  app.delete("/watchlist/:id", async (c) => {
    const { id } = uuidParamSchema.parse(c.req.param());
    const db = getDb();
    const result = await db
      .delete(watchlistItems)
      .where(and(eq(watchlistItems.id, id), eq(watchlistItems.userId, c.get("user").id)))
      .returning();
    if (result.length === 0) notFound("Watchlist item not found");
    return c.json({ ok: true });
  });
}
