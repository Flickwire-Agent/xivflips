import { describe, expect, it } from "vitest";
import { groupByFlip } from "./flips.js";

describe("groupByFlip", () => {
  it("groups rows by flipId", () => {
    const rows = [
      { flipId: "a", value: 1 },
      { flipId: "b", value: 2 },
      { flipId: "a", value: 3 },
    ];
    const result = groupByFlip(rows);
    expect(result.size).toBe(2);
    expect(result.get("a")).toEqual([
      { flipId: "a", value: 1 },
      { flipId: "a", value: 3 },
    ]);
    expect(result.get("b")).toEqual([{ flipId: "b", value: 2 }]);
  });

  it("returns empty map for empty input", () => {
    const result = groupByFlip([]);
    expect(result.size).toBe(0);
  });

  it("handles single row", () => {
    const rows = [{ flipId: "x", value: 42 }];
    const result = groupByFlip(rows);
    expect(result.size).toBe(1);
    expect(result.get("x")).toEqual([{ flipId: "x", value: 42 }]);
  });
});
