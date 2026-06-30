import type {
  FlipRow,
  ItemRow,
  ListingRow,
  MarketSnapshotRow,
  PurchaseRow,
  SaleRow,
  UserRow,
  WatchlistItemRow,
  WorldRow,
} from "../db/schema.js";
import { calculateProfitSummary, type ProfitSummary } from "@xivflips/shared";

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export function serializeUser(user: UserRow) {
  return {
    id: user.id,
    auth0Subject: user.auth0Subject,
    email: user.email,
    displayName: user.displayName,
    homeWorldId: user.homeWorldId,
    defaultTaxRateBps: user.defaultTaxRateBps,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export function serializeItem(item: ItemRow | null) {
  if (!item) return null;
  return {
    id: item.id,
    name: item.name,
    iconUrl: item.iconUrl,
    categoryName: item.categoryName,
    isMarketable: item.isMarketable,
  };
}

export function serializeWorld(world: WorldRow | null) {
  if (!world) return null;
  return {
    id: world.id,
    name: world.name,
    dataCenter: world.dataCenter,
    region: world.region,
  };
}

export function serializeSnapshot(snapshot: MarketSnapshotRow | null) {
  if (!snapshot) return null;
  return {
    id: snapshot.id,
    itemId: snapshot.itemId,
    worldId: snapshot.worldId,
    dataCenter: snapshot.dataCenter,
    lowestListingPrice: snapshot.lowestListingPrice,
    recentAvgPrice: snapshot.recentAvgPrice,
    saleVelocity7d: snapshot.saleVelocity7d,
    saleCount14d: snapshot.saleCount14d,
    capturedAt: snapshot.capturedAt.toISOString(),
  };
}

export function serializePurchase(purchase: PurchaseRow) {
  return {
    id: purchase.id,
    flipId: purchase.flipId,
    quantity: purchase.quantity,
    unitPrice: purchase.unitPrice,
    worldId: purchase.worldId,
    purchasedAt: purchase.purchasedAt.toISOString(),
    notes: purchase.notes,
  };
}

export function serializeListing(listing: ListingRow) {
  return {
    id: listing.id,
    flipId: listing.flipId,
    quantity: listing.quantity,
    unitPrice: listing.unitPrice,
    worldId: listing.worldId,
    status: listing.status,
    listedAt: iso(listing.listedAt),
    endedAt: iso(listing.endedAt),
    notes: listing.notes,
  };
}

export function serializeSale(sale: SaleRow) {
  return {
    id: sale.id,
    flipId: sale.flipId,
    quantity: sale.quantity,
    unitPrice: sale.unitPrice,
    taxRateBps: sale.taxRateBps,
    worldId: sale.worldId,
    soldAt: sale.soldAt.toISOString(),
    notes: sale.notes,
  };
}

export function summarizeProfit(
  purchaseRows: PurchaseRow[],
  saleRows: SaleRow[],
  snapshot: MarketSnapshotRow | null,
): ProfitSummary {
  return calculateProfitSummary(
    purchaseRows.map((purchase) => ({
      quantity: purchase.quantity,
      unitPrice: purchase.unitPrice,
    })),
    saleRows.map((sale) => ({
      quantity: sale.quantity,
      unitPrice: sale.unitPrice,
      taxRateBps: sale.taxRateBps,
    })),
    { currentUnitPrice: snapshot?.lowestListingPrice ?? snapshot?.recentAvgPrice ?? null },
  );
}

export function serializeFlip(input: {
  flip: FlipRow;
  item: ItemRow | null;
  world: WorldRow | null;
  latestSnapshot: MarketSnapshotRow | null;
  purchases: PurchaseRow[];
  sales: SaleRow[];
}) {
  const profit = summarizeProfit(input.purchases, input.sales, input.latestSnapshot);

  return {
    id: input.flip.id,
    itemId: input.flip.itemId,
    worldId: input.flip.worldId,
    status: input.flip.status,
    strategy: input.flip.strategy,
    targetSellPrice: input.flip.targetSellPrice,
    notes: input.flip.notes,
    openedAt: input.flip.openedAt.toISOString(),
    closedAt: iso(input.flip.closedAt),
    createdAt: input.flip.createdAt.toISOString(),
    updatedAt: input.flip.updatedAt.toISOString(),
    item: serializeItem(input.item),
    world: serializeWorld(input.world),
    latestSnapshot: serializeSnapshot(input.latestSnapshot),
    profit,
  };
}

export function serializeWatchlistItem(input: {
  watchlistItem: WatchlistItemRow;
  item: ItemRow | null;
  world: WorldRow | null;
  latestSnapshot: MarketSnapshotRow | null;
}) {
  return {
    id: input.watchlistItem.id,
    itemId: input.watchlistItem.itemId,
    worldId: input.watchlistItem.worldId,
    dataCenter: input.watchlistItem.dataCenter,
    targetBuyPrice: input.watchlistItem.targetBuyPrice,
    targetSellPrice: input.watchlistItem.targetSellPrice,
    minRoiBps: input.watchlistItem.minRoiBps,
    notes: input.watchlistItem.notes,
    createdAt: input.watchlistItem.createdAt.toISOString(),
    updatedAt: input.watchlistItem.updatedAt.toISOString(),
    item: serializeItem(input.item),
    world: serializeWorld(input.world),
    latestSnapshot: serializeSnapshot(input.latestSnapshot),
  };
}
