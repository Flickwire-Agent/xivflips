import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { config } from "../config.js";
import { getDb } from "../db/client.js";
import { items, marketSnapshots, worlds } from "../db/schema.js";
import { updateItemAveragePrice } from "./market-item.js";
import {
  fetchJson,
  itemDetailsFromResponse,
  normalizeItem,
  scopeKey,
  soldAtDate,
  snapshotDate,
  type SnapshotTarget,
  type SnapshotResult,
  type XivarbitrageHistoryResponse,
  type XivarbitrageListingsResponse,
  type XivarbitrageWorldsResponse,
} from "./market-client.js";
import type { MarketSnapshotRow } from "../db/schema.js";

export type { SnapshotTarget, SnapshotResult };

export { scopeKey } from "./market-client.js";

export async function refreshWorldCache(): Promise<number> {
  const db = getDb();
  const response = await fetchJson<XivarbitrageWorldsResponse>("/worlds");

  if (response.worlds.length === 0) return 0;

  await db
    .insert(worlds)
    .values(
      response.worlds.map((world) => ({
        id: world.id,
        name: world.name,
        dataCenter: world.dataCenter,
        region: world.region,
        updatedAt: new Date(),
      })),
    )
    .onConflictDoUpdate({
      target: worlds.id,
      set: {
        name: sql`excluded.name`,
        dataCenter: sql`excluded.data_center`,
        region: sql`excluded.region`,
        updatedAt: new Date(),
      },
    });

  return response.worlds.length;
}

export async function getLatestSnapshot(target: SnapshotTarget): Promise<MarketSnapshotRow | null> {
  const db = getDb();
  const [snapshot] = await db
    .select()
    .from(marketSnapshots)
    .where(
      and(
        eq(marketSnapshots.itemId, target.itemId),
        eq(marketSnapshots.scopeKey, scopeKey(target)),
      ),
    )
    .orderBy(sql`${marketSnapshots.capturedAt} DESC`)
    .limit(1);

  return snapshot ?? null;
}

export async function getLatestSnapshots(targets: SnapshotTarget[]) {
  const db = getDb();
  if (targets.length === 0) return new Map<string, MarketSnapshotRow>();

  const itemIds = [...new Set(targets.map((target) => target.itemId))];
  const rows = await db
    .select()
    .from(marketSnapshots)
    .where(inArray(marketSnapshots.itemId, itemIds))
    .orderBy(sql`${marketSnapshots.capturedAt} DESC`);

  const wanted = new Set(targets.map((target) => `${target.itemId}:${scopeKey(target)}`));
  const latest = new Map<string, MarketSnapshotRow>();

  for (const row of rows) {
    const key = `${row.itemId}:${row.scopeKey}`;
    if (wanted.has(key) && !latest.has(key)) latest.set(key, row);
  }

  return latest;
}

export async function captureMarketSnapshot(target: SnapshotTarget): Promise<SnapshotResult> {
  try {
    const [listings, history] = await Promise.all([
      fetchJson<XivarbitrageListingsResponse>(`/items/${target.itemId}/listings`),
      fetchJson<XivarbitrageHistoryResponse>(`/items/${target.itemId}/history`),
    ]);

    const details =
      itemDetailsFromResponse(target.itemId, listings.itemDetails) ??
      itemDetailsFromResponse(target.itemId, history.itemDetails);
    const item = normalizeItem(target.itemId, details);
    const db = getDb();

    await db
      .insert(items)
      .values({
        id: item.id,
        name: item.name,
        iconUrl: item.iconUrl,
        categoryName: item.categoryName,
        metadata: item.metadata,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: items.id,
        set: {
          name: item.name,
          iconUrl: item.iconUrl,
          categoryName: item.categoryName,
          metadata: item.metadata,
          updatedAt: new Date(),
        },
      });

    const targetListings = (listings.listings ?? []).filter((listing) => {
      if (target.worldId) return listing.worldId === target.worldId;
      if (target.dataCenter) return listing.dataCenter === target.dataCenter;
      return true;
    });
    const targetSales = (history.sales ?? []).filter((sale) => {
      if (target.worldId) return sale.worldId === target.worldId;
      if (target.dataCenter) return sale.dataCenter === target.dataCenter;
      return true;
    });

    const lowestListingPrice = targetListings.length
      ? Math.min(...targetListings.map((listing) => listing.pricePerUnit))
      : null;
    const avgFromStats = target.dataCenter
      ? listings.saleStats?.perDataCenter?.[target.dataCenter]?.avgPrice
      : listings.saleStats?.avgPrice;
    const recentAvgPrice = avgFromStats
      ? Math.round(avgFromStats)
      : targetSales.length
        ? Math.round(
            targetSales.reduce((total, sale) => total + sale.pricePerUnit, 0) / targetSales.length,
          )
        : null;

    if (recentAvgPrice !== null) {
      await updateItemAveragePrice(target.itemId, recentAvgPrice);
    }

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;
    const saleVelocity7d = targetSales.filter((sale) => {
      const date = soldAtDate(sale);
      return date ? date.getTime() >= sevenDaysAgo : false;
    }).length;
    const saleCount14d = targetSales.filter((sale) => {
      const date = soldAtDate(sale);
      return date ? date.getTime() >= fourteenDaysAgo : false;
    }).length;
    const capturedAt = new Date();
    const scope = scopeKey(target);

    const [snapshot] = await db
      .insert(marketSnapshots)
      .values({
        itemId: target.itemId,
        worldId: target.worldId,
        dataCenter: target.dataCenter,
        scopeKey: scope,
        lowestListingPrice,
        recentAvgPrice,
        saleVelocity7d,
        saleCount14d,
        snapshotData: { listings, history },
        snapshotDate: snapshotDate(capturedAt),
        capturedAt,
      })
      .onConflictDoUpdate({
        target: [marketSnapshots.itemId, marketSnapshots.scopeKey, marketSnapshots.snapshotDate],
        set: {
          lowestListingPrice,
          recentAvgPrice,
          saleVelocity7d,
          saleCount14d,
          snapshotData: { listings, history },
          capturedAt,
        },
      })
      .returning();

    return { target, snapshot: snapshot ?? null, error: null };
  } catch (error) {
    return {
      target,
      snapshot: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function pruneOldSnapshots(retentionDays = config.marketSnapshotRetentionDays) {
  const db = getDb();
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  await db.delete(marketSnapshots).where(lt(marketSnapshots.capturedAt, cutoff));
}

export async function refreshAllMarketableItemPrices(): Promise<void> {
  const db = getDb();
  const marketableItems = await db.query.items.findMany({
    where: (table, { eq }) => eq(table.isMarketable, true),
  });

  for (const item of marketableItems) {
    try {
      const history = await fetchJson<XivarbitrageHistoryResponse>(`/items/${item.id}/history`);
      const sales = history.sales ?? [];
      if (sales.length === 0) continue;

      const avgPrice = Math.round(
        sales.reduce((total, sale) => total + sale.pricePerUnit, 0) / sales.length,
      );

      await updateItemAveragePrice(item.id, avgPrice);
    } catch {
      // skip items that fail
    }
  }
}
