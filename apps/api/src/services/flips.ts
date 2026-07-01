import { and, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { flipStatusSchema } from "@xivflips/shared";
import { getDb } from "../db/client.js";
import {
  flips,
  items,
  listings,
  purchases,
  sales,
  worlds,
  type FlipRow,
  type ItemRow,
  type ListingRow,
  type PurchaseRow,
  type SaleRow,
  type WorldRow,
} from "../db/schema.js";
import { badRequest, notFound } from "../http/errors.js";
import {
  serializeFlip,
  serializeListing,
  serializePurchase,
  serializeSale,
} from "../http/serialize.js";
import {
  getLatestSnapshot,
  getLatestSnapshots,
  refreshWorldCache,
  scopeKey,
} from "./market-snapshot.js";

export type FlipBundle = {
  flip: FlipRow;
  item: ItemRow | null;
  world: WorldRow | null;
  purchases: PurchaseRow[];
  listings: ListingRow[];
  sales: SaleRow[];
};

export async function ensureWorldExists(worldId: number | null | undefined): Promise<void> {
  if (!worldId) return;
  const db = getDb();
  const [existing] = await db.select().from(worlds).where(eq(worlds.id, worldId)).limit(1);
  if (existing) return;
  await refreshWorldCache();
  const [refreshed] = await db.select().from(worlds).where(eq(worlds.id, worldId)).limit(1);
  if (!refreshed) badRequest(`Unknown world ID ${worldId}`);
}

export async function getFlipBundle(userId: string, flipId: string): Promise<FlipBundle> {
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

export async function serializeBundle(bundle: FlipBundle) {
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

export function groupByFlip<T extends { flipId: string }>(rows: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const existing = grouped.get(row.flipId) ?? [];
    existing.push(row);
    grouped.set(row.flipId, existing);
  }
  return grouped;
}

export async function listUserFlips(userId: string, status?: string, query?: string) {
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

export async function serializeFlipRows(
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

export async function assertFlipOwner(userId: string, flipId: string): Promise<FlipRow> {
  const db = getDb();
  const [flip] = await db
    .select()
    .from(flips)
    .where(and(eq(flips.id, flipId), eq(flips.userId, userId)))
    .limit(1);
  if (!flip) notFound("Flip not found");
  return flip;
}

export async function inferRestoredStatus(flipId: string): Promise<FlipRow["status"]> {
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

export async function assertSaleQuantity(
  flipId: string,
  nextSale?: { id?: string; quantity: number },
) {
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

export async function getEventFlip(
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
