import { describe, expect, it } from "vitest";
import {
  itemDetailsFromResponse,
  normalizeIconUrl,
  normalizeItem,
  scopeKey,
  snapshotDate,
  soldAtDate,
} from "./market-client.js";

describe("scopeKey", () => {
  it("returns world scope when worldId is set", () => {
    expect(scopeKey({ itemId: 1, worldId: 42, dataCenter: null })).toBe("world:42");
  });

  it("returns dc scope when dataCenter is set and no worldId", () => {
    expect(scopeKey({ itemId: 1, worldId: null, dataCenter: "Chaos" })).toBe("dc:chaos");
  });

  it("lowercases dataCenter in dc scope", () => {
    expect(scopeKey({ itemId: 1, worldId: null, dataCenter: "Light" })).toBe("dc:light");
  });

  it("returns global when neither worldId nor dataCenter", () => {
    expect(scopeKey({ itemId: 1, worldId: null, dataCenter: null })).toBe("global");
  });
});

describe("normalizeIconUrl", () => {
  it("returns null for undefined", () => {
    expect(normalizeIconUrl(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(normalizeIconUrl("")).toBeNull();
  });

  it("passes through absolute URLs", () => {
    expect(normalizeIconUrl("https://example.com/icon.png")).toBe("https://example.com/icon.png");
  });

  it("converts relative paths to xivapi URLs", () => {
    expect(normalizeIconUrl("/i/040000/040123.png")).toBe(
      "https://v2.xivapi.com/api/asset?path=%2Fi%2F040000%2F040123.png&format=png",
    );
  });
});

describe("normalizeItem", () => {
  it("uses name from details", () => {
    const result = normalizeItem(12345, { name: "Potion" });
    expect(result.id).toBe(12345);
    expect(result.name).toBe("Potion");
  });

  it("falls back to Name (capitalized) key", () => {
    const result = normalizeItem(12345, { Name: "Potion" });
    expect(result.name).toBe("Potion");
  });

  it("falls back to Item {id} when no name", () => {
    const result = normalizeItem(12345, null);
    expect(result.name).toBe("Item 12345");
  });

  it("extracts iconUrl from iconUrl field", () => {
    const result = normalizeItem(1, {
      name: "Test",
      iconUrl: "https://example.com/i.png",
    });
    expect(result.iconUrl).toBe("https://example.com/i.png");
  });

  it("extracts iconUrl from Icon field", () => {
    const result = normalizeItem(1, {
      name: "Test",
      Icon: "/i/040000/040123.png",
    });
    expect(result.iconUrl).toContain("040123");
  });

  it("uses ItemUICategory.Name for categoryName", () => {
    const result = normalizeItem(1, {
      name: "Test",
      ItemUICategory: { Name: "Medicine" },
    });
    expect(result.categoryName).toBe("Medicine");
  });
});

describe("itemDetailsFromResponse", () => {
  it("returns null when details is undefined", () => {
    expect(itemDetailsFromResponse(1, undefined)).toBeNull();
  });

  it("returns details directly when it has name field", () => {
    const details = { name: "Potion" };
    expect(itemDetailsFromResponse(1, details)).toBe(details);
  });

  it("looks up by itemId in a record", () => {
    const details = { "12345": { name: "Potion" } };
    const result = itemDetailsFromResponse(12345, details);
    expect(result).toEqual({ name: "Potion" });
  });

  it("returns null when itemId not found in record", () => {
    const details = { "99999": { name: "Other" } };
    expect(itemDetailsFromResponse(12345, details)).toBeNull();
  });
});

describe("soldAtDate", () => {
  it("parses soldAt string", () => {
    const result = soldAtDate({ pricePerUnit: 100, quantity: 1, soldAt: "2024-01-15T12:00:00Z" });
    expect(result).toBeInstanceOf(Date);
    expect(result!.toISOString()).toBe("2024-01-15T12:00:00.000Z");
  });

  it("parses timestamp field", () => {
    const result = soldAtDate({ pricePerUnit: 100, quantity: 1, timestamp: 1705310400 });
    expect(result).toBeInstanceOf(Date);
    expect(result!.getTime()).toBe(1705310400 * 1000);
  });

  it("returns null when no date info", () => {
    const result = soldAtDate({ pricePerUnit: 100, quantity: 1 });
    expect(result).toBeNull();
  });

  it("returns null for invalid date string", () => {
    const result = soldAtDate({ pricePerUnit: 100, quantity: 1, soldAt: "not-a-date" });
    expect(result).toBeNull();
  });
});

describe("snapshotDate", () => {
  it("returns YYYY-MM-DD format", () => {
    const result = snapshotDate(new Date("2024-06-15T10:00:00Z"));
    expect(result).toBe("2024-06-15");
  });

  it("defaults to today", () => {
    const result = snapshotDate();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
