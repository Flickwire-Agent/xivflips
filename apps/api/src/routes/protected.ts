import type { Context, Hono } from "hono";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  createFlipSchema,
  createListingSchema,
  createPurchaseSchema,
  createSaleSchema,
  createWatchlistItemSchema,
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
} from "../db/schema.js";
import type { AppEnv } from "../http/auth.js";
import { badRequest, notFound } from "../http/errors.js";
import {
  serializeItem,
  serializeUser,
  serializeWatchlistItem,
  serializeWorld,
  summarizeProfit,
} from "../http/serialize.js";
import { upsertItem, searchItems } from "../services/market-item.js";
import { buildXivauthAuthorizeUrl } from "../services/xivauth-client.js";
import {
  assertFlipOwner,
  assertSaleQuantity,
  ensureWorldExists,
  getEventFlip,
  getFlipBundle,
  inferRestoredStatus,
  listUserFlips,
  serializeBundle,
  serializeFlipRows,
} from "../services/flips.js";
import { getDashboardData } from "../services/dashboard.js";

const uuidParamSchema = z.object({ id: z.uuid() });
const flipUuidParamSchema = z.object({ id: z.uuid() });

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
      const { refreshWorldCache } = await import("../services/market-snapshot.js");
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
    return c.json(await getDashboardData(c.get("user").id));
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
    const { getLatestSnapshots, scopeKey } = await import("../services/market-snapshot.js");
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
