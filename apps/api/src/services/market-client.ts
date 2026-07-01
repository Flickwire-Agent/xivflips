import { config } from "../config.js";

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

export type {
  XivarbitrageWorld,
  XivarbitrageWorldsResponse,
  XivarbitrageItemDetails,
  XivarbitrageListing,
  XivarbitrageSale,
  XivarbitrageListingsResponse,
  XivarbitrageHistoryResponse,
};

export type SnapshotTarget = {
  itemId: number;
  worldId: number | null;
  dataCenter: string | null;
};

export type SnapshotResult = {
  target: SnapshotTarget;
  snapshot: import("../db/schema.js").MarketSnapshotRow | null;
  error: string | null;
};

export function itemDetailsFromResponse(
  itemId: number,
  details: Record<string, XivarbitrageItemDetails> | XivarbitrageItemDetails | undefined,
): XivarbitrageItemDetails | null {
  if (!details) return null;
  if ("name" in details || "Name" in details) return details;
  return (details as Record<string, XivarbitrageItemDetails>)[String(itemId)] ?? null;
}

export function normalizeIconUrl(icon: string | undefined): string | null {
  if (!icon) return null;
  if (icon.startsWith("http://") || icon.startsWith("https://")) return icon;
  return `https://v2.xivapi.com/api/asset?path=${encodeURIComponent(icon)}&format=png`;
}

export function normalizeItem(itemId: number, details: XivarbitrageItemDetails | null) {
  return {
    id: itemId,
    name: details?.name ?? details?.Name ?? `Item ${itemId}`,
    iconUrl: normalizeIconUrl(details?.iconUrl ?? details?.Icon),
    categoryName: details?.categoryName ?? details?.ItemUICategory?.Name ?? null,
    metadata: details ?? null,
  };
}

export function soldAtDate(sale: XivarbitrageSale): Date | null {
  if (sale.soldAt) {
    const date = new Date(sale.soldAt);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (sale.timestamp) return new Date(sale.timestamp * 1000);
  return null;
}

export function snapshotDate(date = new Date()): string {
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

export { fetchJson };

export async function fetchItemMetadata(itemId: number) {
  const response = await fetchJson<XivarbitrageItemDetails>(
    `/xivapi/sheet/Item/${itemId}?fields=Name,Icon,ItemUICategory.Name`,
  );
  return normalizeItem(itemId, response);
}
