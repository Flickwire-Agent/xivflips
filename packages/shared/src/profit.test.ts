import { describe, expect, it } from "vitest";
import { calculateProfitSummary } from "./profit.js";

describe("calculateProfitSummary", () => {
  it("calculates a fully sold flip with tax", () => {
    const summary = calculateProfitSummary(
      [{ quantity: 10, unitPrice: 1000 }],
      [{ quantity: 10, unitPrice: 1500, taxRateBps: 500 }],
    );

    expect(summary).toMatchObject({
      purchasedQuantity: 10,
      soldQuantity: 10,
      remainingQuantity: 0,
      totalCostBasis: 10000,
      averageCostPerUnit: 1000,
      grossSaleValue: 15000,
      saleFees: 750,
      netSaleValue: 14250,
      realizedCostBasis: 10000,
      realizedProfit: 4250,
      realizedRoiBps: 4250,
      estimatedInventoryValue: null,
      estimatedUnrealizedProfit: null,
    });
  });

  it("calculates a partial sale with remaining inventory value", () => {
    const summary = calculateProfitSummary(
      [{ quantity: 10, unitPrice: 2000 }],
      [{ quantity: 4, unitPrice: 3000, taxRateBps: 500 }],
      { currentUnitPrice: 2800 },
    );

    expect(summary.remainingQuantity).toBe(6);
    expect(summary.realizedProfit).toBe(3400);
    expect(summary.estimatedInventoryValue).toBe(16800);
    expect(summary.estimatedUnrealizedProfit).toBe(4800);
  });

  it("handles unsold inventory", () => {
    const summary = calculateProfitSummary([{ quantity: 3, unitPrice: 1200 }], [], {
      currentUnitPrice: 1400,
    });

    expect(summary.soldQuantity).toBe(0);
    expect(summary.realizedProfit).toBe(0);
    expect(summary.realizedRoiBps).toBeNull();
    expect(summary.estimatedInventoryValue).toBe(4200);
    expect(summary.estimatedUnrealizedProfit).toBe(600);
  });

  it("rejects zero quantity purchases", () => {
    expect(() => calculateProfitSummary([{ quantity: 0, unitPrice: 1000 }], [])).toThrowError(
      "purchase quantity must be a positive integer",
    );
  });

  it("rejects negative values", () => {
    expect(() => calculateProfitSummary([{ quantity: 1, unitPrice: -1000 }], [])).toThrowError(
      "purchase unit price must be a non-negative integer",
    );
  });

  it("rejects sales above purchased quantity", () => {
    expect(() =>
      calculateProfitSummary(
        [{ quantity: 1, unitPrice: 1000 }],
        [{ quantity: 2, unitPrice: 1500, taxRateBps: 500 }],
      ),
    ).toThrowError("sold quantity cannot exceed purchased quantity");
  });
});
