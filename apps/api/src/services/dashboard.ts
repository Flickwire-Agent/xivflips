import { desc, eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { flips, items, sales, watchlistItems } from "../db/schema.js";
import { serializeSale } from "../http/serialize.js";
import { listUserFlips, serializeFlipRows } from "./flips.js";

export type DashboardData = {
  activeCostBasis: number;
  realizedProfit: number;
  realizedRoiBps: number | null;
  estimatedInventoryValue: number;
  activeFlipCount: number;
  watchlistCount: number;
  recentSales: Array<{
    id: string;
    flipId: string;
    quantity: number;
    unitPrice: number;
    taxRateBps: number;
    worldId: number | null;
    soldAt: string;
    notes: string | null;
    itemName: string;
  }>;
  activeFlips: Array<Record<string, unknown>>;
};

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const db = getDb();
  const rows = await listUserFlips(userId);
  const serialized = await serializeFlipRows(rows);
  const activeFlips = serialized.filter(
    (flip) => !["sold", "cancelled", "archived"].includes(flip.status),
  );

  const realizedCostBasis = serialized.reduce(
    (total, flip) => total + flip.profit.realizedCostBasis,
    0,
  );
  const realizedProfit = serialized.reduce((total, flip) => total + flip.profit.realizedProfit, 0);
  const activeCostBasis = activeFlips.reduce(
    (total, flip) =>
      total + Math.max(0, flip.profit.totalCostBasis - flip.profit.realizedCostBasis),
    0,
  );
  const estimatedInventoryValue = activeFlips.reduce(
    (total, flip) => total + (flip.profit.estimatedInventoryValue ?? 0),
    0,
  );

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

  return {
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
  };
}
