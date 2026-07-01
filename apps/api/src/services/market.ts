import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { config } from "../config.js";
import { getDb } from "../db/client.js";
import { items, marketSnapshots, worlds, type MarketSnapshotRow } from "../db/schema.js";

type XivarbitrageWorld = {
  id: number;
  name: string;
  dataCenter: string;
  region: string;
};

type XivarbitrageWorldsResponse = {
  worlds: XivarbitrageWorld[];
};

type XivarbitrageItemDetails = {
  id?: number;
  itemId?: number;
  name?: string;
  Name?: string;
  iconUrl?: string;
  Icon?: string;
  categoryName?: string;
  ItemUICategory?: { Name?: string };
};

type XivarbitrageListing = {
  worldId?: number;
  worldName?: string;
  dataCenter?: string;
  pricePerUnit: number;
  quantity: number;
  recentAvgPrice?: number;
};

type XivarbitrageSale = {
  worldId?: number;
  worldName?: string;
  dataCenter?: string;
  pricePerUnit: number;
  quantity: number;
  soldAt?: string;
  timestamp?: number;
};

type XivarbitrageListingsResponse = {
  itemId: number;
  itemDetails?: Record<string, XivarbitrageItemDetails> | XivarbitrageItemDetails;
  listings?: XivarbitrageListing[];
  saleStats?: {
    avgPrice?: number;
    count?: number;
    perDataCenter?: Record<string, { avgPrice: number; count: number }>;
  };
};

type XivarbitrageHistoryResponse = {
  itemId: number;
  itemDetails?: Record<string, XivarbitrageItemDetails> | XivarbitrageItemDetails;
  sales?: XivarbitrageSale[];
};

export type SnapshotTarget = {
  itemId: number;
  worldId: number | null;
  dataCenter: string | null;
};

export type SnapshotResult = {
  target: SnapshotTarget;
  snapshot: MarketSnapshotRow | null;
  error: string | null;
};

function itemDetailsFromResponse(
  itemId: number,
  details: Record<string, XivarbitrageItemDetails> | XivarbitrageItemDetails | undefined,
): XivarbitrageItemDetails | null {
  if (!details) return null;
  if ("name" in details || "Name" in details) return details;
  return (details as Record<string, XivarbitrageItemDetails>)[String(itemId)] ?? null;
}

function normalizeIconUrl(icon: string | undefined): string | null {
  if (!icon) return null;
  if (icon.startsWith("http://") || icon.startsWith("https://")) return icon;
  if (icon.startsWith("/")) return `https://v2.xivapi.com${icon}`;
  return icon;
}

function normalizeItem(itemId: number, details: XivarbitrageItemDetails | null) {
  return {
    id: itemId,
    name: details?.name ?? details?.Name ?? `Item ${itemId}`,
    iconUrl: normalizeIconUrl(details?.iconUrl ?? details?.Icon),
    categoryName: details?.categoryName ?? details?.ItemUICategory?.Name ?? null,
    metadata: details ?? null,
  };
}

function soldAtDate(sale: XivarbitrageSale): Date | null {
  if (sale.soldAt) {
    const date = new Date(sale.soldAt);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (sale.timestamp) return new Date(sale.timestamp * 1000);
  return null;
}

function snapshotDate(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function scopeKey(target: SnapshotTarget): string {
  if (target.worldId) return `world:${target.worldId}`;
  if (target.dataCenter) return `dc:${target.dataCenter.toLowerCase()}`;
  return "global";
}

async function fetchJson<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(`${config.xivarbitrageApiBaseUrl}${path}`, {
      headers: { "User-Agent": "xivflips/0.1.0" },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`xivarbitrage request failed: ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

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

export async function fetchItemMetadata(itemId: number) {
  const response = await fetchJson<XivarbitrageItemDetails>(
    `/xivapi/sheet/Item/${itemId}?fields=Name,Icon,ItemUICategory.Name`,
  );
  return normalizeItem(itemId, response);
}

export async function upsertItem(itemId: number, fallbackName?: string) {
  const db = getDb();
  let item = {
    id: itemId,
    name: fallbackName ?? `Item ${itemId}`,
    iconUrl: null as string | null,
    categoryName: null as string | null,
    metadata: null as unknown,
  };

  if (!fallbackName) {
    try {
      item = await fetchItemMetadata(itemId);
    } catch {
      // Item metadata is helpful but not required to track a flip.
    }
  }

  const [row] = await db
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
    })
    .returning();

  return row;
}

export async function searchItems(query: string) {
  const db = getDb();
  const trimmed = query.trim();
  const numericId = Number(trimmed);

  if (Number.isInteger(numericId) && numericId > 0) {
    const item = await upsertItem(numericId);
    return item ? [item] : [];
  }

  try {
    const params = new URLSearchParams();
    const sanitized = trimmed.replace(/["\\]/g, "");
    params.set("query", `Name~"${sanitized}"`);
    params.set("sheets", "Item");
    params.set("fields", "Name,Icon,ItemUICategory.Name");
    params.set("limit", "20");

    const response = await fetchJson<{
      results?: Array<{
        row_id: number;
        fields: {
          Name?: string;
          Icon?: { path?: string; path_hr1?: string };
          ItemUICategory?: { fields?: { Name?: string } };
        };
      }>;
    }>(`/xivapi/search?${params.toString()}`);

    const results = response.results ?? [];

    if (results.length > 0) {
      const itemsToUpsert = results.map((result) => {
        const iconPath = result.fields.Icon?.path ?? result.fields.Icon?.path_hr1;
        return {
          id: result.row_id,
          name: result.fields.Name ?? `Item ${result.row_id}`,
          iconUrl: normalizeIconUrl(iconPath),
          categoryName: result.fields.ItemUICategory?.fields?.Name ?? null,
          metadata: result.fields,
          updatedAt: new Date(),
        };
      });

      await db
        .insert(items)
        .values(itemsToUpsert)
        .onConflictDoUpdate({
          target: items.id,
          set: {
            name: sql`excluded.name`,
            iconUrl: sql`excluded.icon_url`,
            categoryName: sql`excluded.category_name`,
            metadata: sql`excluded.metadata`,
            updatedAt: new Date(),
          },
        });

      const itemIds = itemsToUpsert.map((item) => item.id);
      return db.query.items.findMany({
        where: (table, { inArray }) => inArray(table.id, itemIds),
      });
    }
  } catch {
    // Fall through to local search if XIVAPI fails
  }

  return db.query.items.findMany({
    where: (table, { ilike }) => ilike(table.name, `%${trimmed}%`),
    limit: 20,
    orderBy: (table, { asc }) => [asc(table.name)],
  });
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
