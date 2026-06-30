export type ProfitPurchaseInput = {
  quantity: number;
  unitPrice: number;
};

export type ProfitSaleInput = {
  quantity: number;
  unitPrice: number;
  taxRateBps: number;
};

export type ProfitSnapshotInput = {
  currentUnitPrice?: number | null;
};

export type ProfitSummary = {
  purchasedQuantity: number;
  soldQuantity: number;
  remainingQuantity: number;
  totalCostBasis: number;
  averageCostPerUnit: number;
  grossSaleValue: number;
  saleFees: number;
  netSaleValue: number;
  realizedCostBasis: number;
  realizedProfit: number;
  realizedRoiBps: number | null;
  estimatedInventoryValue: number | null;
  estimatedUnrealizedProfit: number | null;
};

function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
}

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
}

function saleFee(unitPrice: number, quantity: number, taxRateBps: number): number {
  return Math.round((unitPrice * quantity * taxRateBps) / 10000);
}

export function calculateProfitSummary(
  purchases: ProfitPurchaseInput[],
  sales: ProfitSaleInput[],
  snapshot: ProfitSnapshotInput = {},
): ProfitSummary {
  for (const purchase of purchases) {
    assertPositiveInteger(purchase.quantity, "purchase quantity");
    assertNonNegativeInteger(purchase.unitPrice, "purchase unit price");
  }

  for (const sale of sales) {
    assertPositiveInteger(sale.quantity, "sale quantity");
    assertNonNegativeInteger(sale.unitPrice, "sale unit price");
    assertNonNegativeInteger(sale.taxRateBps, "sale tax rate");
  }

  if (snapshot.currentUnitPrice !== undefined && snapshot.currentUnitPrice !== null) {
    assertNonNegativeInteger(snapshot.currentUnitPrice, "current unit price");
  }

  const purchasedQuantity = purchases.reduce((total, purchase) => total + purchase.quantity, 0);
  const soldQuantity = sales.reduce((total, sale) => total + sale.quantity, 0);

  if (soldQuantity > purchasedQuantity) {
    throw new Error("sold quantity cannot exceed purchased quantity");
  }

  const totalCostBasis = purchases.reduce(
    (total, purchase) => total + purchase.quantity * purchase.unitPrice,
    0,
  );
  const averageCostPerUnit =
    purchasedQuantity > 0 ? Math.round(totalCostBasis / purchasedQuantity) : 0;
  const grossSaleValue = sales.reduce((total, sale) => total + sale.quantity * sale.unitPrice, 0);
  const saleFees = sales.reduce(
    (total, sale) => total + saleFee(sale.unitPrice, sale.quantity, sale.taxRateBps),
    0,
  );
  const netSaleValue = grossSaleValue - saleFees;
  const realizedCostBasis = soldQuantity * averageCostPerUnit;
  const realizedProfit = netSaleValue - realizedCostBasis;
  const realizedRoiBps =
    realizedCostBasis > 0 ? Math.round((realizedProfit / realizedCostBasis) * 10000) : null;
  const remainingQuantity = purchasedQuantity - soldQuantity;
  const estimatedInventoryValue =
    snapshot.currentUnitPrice !== undefined && snapshot.currentUnitPrice !== null
      ? remainingQuantity * snapshot.currentUnitPrice
      : null;
  const remainingCostBasis = remainingQuantity * averageCostPerUnit;
  const estimatedUnrealizedProfit =
    estimatedInventoryValue !== null ? estimatedInventoryValue - remainingCostBasis : null;

  return {
    purchasedQuantity,
    soldQuantity,
    remainingQuantity,
    totalCostBasis,
    averageCostPerUnit,
    grossSaleValue,
    saleFees,
    netSaleValue,
    realizedCostBasis,
    realizedProfit,
    realizedRoiBps,
    estimatedInventoryValue,
    estimatedUnrealizedProfit,
  };
}
