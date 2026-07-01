import { and, eq, inArray } from "drizzle-orm";
import { closeDatabase, getDb } from "../db/client.js";
import { flips, watchlistItems, worlds } from "../db/schema.js";
import {
  captureMarketSnapshot,
  pruneOldSnapshots,
  refreshAllMarketableItemPrices,
  refreshWorldCache,
  scopeKey,
  type SnapshotTarget,
} from "../services/market.js";

function dedupeTargets(targets: SnapshotTarget[]): SnapshotTarget[] {
  return Array.from(
    new Map(targets.map((target) => [`${target.itemId}:${scopeKey(target)}`, target])).values(),
  );
}

async function getSnapshotTargets(): Promise<SnapshotTarget[]> {
  const db = getDb();
  const [flipTargets, watchTargets] = await Promise.all([
    db
      .select({ itemId: flips.itemId, worldId: flips.worldId, dataCenter: worlds.dataCenter })
      .from(flips)
      .leftJoin(worlds, eq(worlds.id, flips.worldId))
      .where(and(inArray(flips.status, ["active", "listed", "partially_sold"]))),
    db
      .select({
        itemId: watchlistItems.itemId,
        worldId: watchlistItems.worldId,
        dataCenter: watchlistItems.dataCenter,
        worldDataCenter: worlds.dataCenter,
      })
      .from(watchlistItems)
      .leftJoin(worlds, eq(worlds.id, watchlistItems.worldId)),
  ]);

  return dedupeTargets([
    ...flipTargets.map((target) => ({
      itemId: target.itemId,
      worldId: target.worldId,
      dataCenter: target.dataCenter,
    })),
    ...watchTargets.map((target) => ({
      itemId: target.itemId,
      worldId: target.worldId,
      dataCenter: target.dataCenter ?? target.worldDataCenter,
    })),
  ]);
}

async function main() {
  const startedAt = Date.now();
  console.log("[market-snapshot] Starting 6-hourly market snapshot job");

  await refreshWorldCache().catch((error) => {
    console.warn(
      `[market-snapshot] World cache refresh failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  });

  const targets = await getSnapshotTargets();
  console.log(`[market-snapshot] Found ${targets.length} distinct target(s)`);

  let inserted = 0;
  const failures: string[] = [];

  for (const target of targets) {
    const result = await captureMarketSnapshot(target);
    if (result.snapshot) inserted += 1;
    if (result.error) failures.push(`${target.itemId}/${scopeKey(target)}: ${result.error}`);
  }

  await refreshAllMarketableItemPrices();
  await pruneOldSnapshots();

  const durationSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `[market-snapshot] Complete: checked=${targets.length} snapshots=${inserted} failures=${failures.length} duration=${durationSeconds}s`,
  );

  for (const failure of failures) {
    console.warn(`[market-snapshot] ${failure}`);
  }
}

main()
  .catch((error) => {
    console.error(
      `[market-snapshot] Failed: ${error instanceof Error ? error.stack : String(error)}`,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
