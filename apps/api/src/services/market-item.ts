import { eq, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { items } from "../db/schema.js";
import { fetchItemMetadata, fetchJson, normalizeIconUrl } from "./market-client.js";

export async function updateItemAveragePrice(
  itemId: number,
  avgPrice: number | null,
): Promise<void> {
  const db = getDb();
  await db
    .update(items)
    .set({
      averageSoldPrice: avgPrice,
      updatedAt: new Date(),
    })
    .where(eq(items.id, itemId));
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
