import { z } from "zod";
import { defaultTaxRateBps, flipStatuses, flipStrategies, listingStatuses } from "./constants.js";

export const uuidSchema = z.uuid();
export const gilSchema = z.number().int().nonnegative();
export const quantitySchema = z.number().int().positive();
export const basisPointsSchema = z.number().int().min(0).max(10000);

export const flipStatusSchema = z.enum(flipStatuses);
export const listingStatusSchema = z.enum(listingStatuses);
export const flipStrategySchema = z.enum(flipStrategies);

export const itemSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  iconUrl: z.string().url().nullable(),
  categoryName: z.string().nullable(),
  isMarketable: z.boolean(),
});

export const worldSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  dataCenter: z.string().min(1),
  region: z.string().min(1),
});

export const marketSnapshotSchema = z.object({
  id: uuidSchema,
  itemId: z.number().int().positive(),
  worldId: z.number().int().positive().nullable(),
  dataCenter: z.string().nullable(),
  lowestListingPrice: gilSchema.nullable(),
  recentAvgPrice: gilSchema.nullable(),
  saleVelocity7d: z.number().int().nonnegative().nullable(),
  saleCount14d: z.number().int().nonnegative().nullable(),
  capturedAt: z.string(),
});

export const purchaseSchema = z.object({
  id: uuidSchema,
  flipId: uuidSchema,
  quantity: quantitySchema,
  unitPrice: gilSchema,
  worldId: z.number().int().positive().nullable(),
  purchasedAt: z.string(),
  notes: z.string().nullable(),
});

export const listingSchema = z.object({
  id: uuidSchema,
  flipId: uuidSchema,
  quantity: quantitySchema,
  unitPrice: gilSchema,
  worldId: z.number().int().positive().nullable(),
  status: listingStatusSchema,
  listedAt: z.string().nullable(),
  endedAt: z.string().nullable(),
  notes: z.string().nullable(),
});

export const saleSchema = z.object({
  id: uuidSchema,
  flipId: uuidSchema,
  quantity: quantitySchema,
  unitPrice: gilSchema,
  taxRateBps: basisPointsSchema,
  worldId: z.number().int().positive().nullable(),
  soldAt: z.string(),
  notes: z.string().nullable(),
});

export const profitSummarySchema = z.object({
  purchasedQuantity: z.number().int().nonnegative(),
  soldQuantity: z.number().int().nonnegative(),
  remainingQuantity: z.number().int().nonnegative(),
  totalCostBasis: gilSchema,
  averageCostPerUnit: gilSchema,
  grossSaleValue: gilSchema,
  saleFees: gilSchema,
  netSaleValue: gilSchema,
  realizedCostBasis: gilSchema,
  realizedProfit: z.number().int(),
  realizedRoiBps: z.number().int().nullable(),
  estimatedInventoryValue: gilSchema.nullable(),
  estimatedUnrealizedProfit: z.number().int().nullable(),
});

export const flipSchema = z.object({
  id: uuidSchema,
  itemId: z.number().int().positive(),
  worldId: z.number().int().positive().nullable(),
  status: flipStatusSchema,
  strategy: flipStrategySchema.nullable(),
  targetSellPrice: gilSchema.nullable(),
  notes: z.string().nullable(),
  openedAt: z.string(),
  closedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  item: itemSchema.nullable(),
  world: worldSchema.nullable(),
  latestSnapshot: marketSnapshotSchema.nullable(),
  profit: profitSummarySchema,
});

export const flipDetailSchema = flipSchema.extend({
  purchases: z.array(purchaseSchema),
  listings: z.array(listingSchema),
  sales: z.array(saleSchema),
});

export const dashboardSchema = z.object({
  activeCostBasis: gilSchema,
  realizedProfit: z.number().int(),
  realizedRoiBps: z.number().int().nullable(),
  estimatedInventoryValue: gilSchema,
  activeFlipCount: z.number().int().nonnegative(),
  watchlistCount: z.number().int().nonnegative(),
  recentSales: z.array(saleSchema.extend({ itemName: z.string(), flipId: uuidSchema })),
  activeFlips: z.array(flipSchema),
});

export const createFlipSchema = z.object({
  itemId: z.number().int().positive(),
  itemName: z.string().min(1).optional(),
  worldId: z.number().int().positive().nullable().optional(),
  status: flipStatusSchema.default("active"),
  strategy: flipStrategySchema.nullable().optional(),
  targetSellPrice: gilSchema.nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  openedAt: z.string().datetime().optional(),
  initialPurchase: z
    .object({
      quantity: quantitySchema,
      unitPrice: gilSchema,
      worldId: z.number().int().positive().nullable().optional(),
      purchasedAt: z.string().datetime().optional(),
      notes: z.string().max(1000).nullable().optional(),
    })
    .optional(),
});

export const updateFlipSchema = z.object({
  worldId: z.number().int().positive().nullable().optional(),
  status: flipStatusSchema.optional(),
  strategy: flipStrategySchema.nullable().optional(),
  targetSellPrice: gilSchema.nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  openedAt: z.string().datetime().optional(),
  closedAt: z.string().datetime().nullable().optional(),
});

export const createPurchaseSchema = z.object({
  quantity: quantitySchema,
  unitPrice: gilSchema,
  worldId: z.number().int().positive().nullable().optional(),
  purchasedAt: z.string().datetime().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export const updatePurchaseSchema = createPurchaseSchema.partial();

export const createListingSchema = z.object({
  quantity: quantitySchema,
  unitPrice: gilSchema,
  worldId: z.number().int().positive().nullable().optional(),
  status: listingStatusSchema.default("active"),
  listedAt: z.string().datetime().nullable().optional(),
  endedAt: z.string().datetime().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export const updateListingSchema = createListingSchema.partial();

export const createSaleSchema = z.object({
  quantity: quantitySchema,
  unitPrice: gilSchema,
  taxRateBps: basisPointsSchema.default(defaultTaxRateBps),
  worldId: z.number().int().positive().nullable().optional(),
  soldAt: z.string().datetime().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export const updateSaleSchema = createSaleSchema.partial();

export const watchlistItemSchema = z.object({
  id: uuidSchema,
  itemId: z.number().int().positive(),
  worldId: z.number().int().positive().nullable(),
  dataCenter: z.string().nullable(),
  targetBuyPrice: gilSchema.nullable(),
  targetSellPrice: gilSchema.nullable(),
  minRoiBps: z.number().int().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  item: itemSchema.nullable(),
  world: worldSchema.nullable(),
  latestSnapshot: marketSnapshotSchema.nullable(),
});

export const createWatchlistItemSchema = z.object({
  itemId: z.number().int().positive(),
  itemName: z.string().min(1).optional(),
  worldId: z.number().int().positive().nullable().optional(),
  dataCenter: z.string().max(40).nullable().optional(),
  targetBuyPrice: gilSchema.nullable().optional(),
  targetSellPrice: gilSchema.nullable().optional(),
  minRoiBps: z.number().int().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const updateWatchlistItemSchema = createWatchlistItemSchema.partial();

export const updateUserSettingsSchema = z.object({
  homeWorldId: z.number().int().positive().nullable().optional(),
  defaultTaxRateBps: basisPointsSchema.optional(),
});

export const itemSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(80),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(30),
});

export type ItemDto = z.infer<typeof itemSchema>;
export type WorldDto = z.infer<typeof worldSchema>;
export type MarketSnapshotDto = z.infer<typeof marketSnapshotSchema>;
export type PurchaseDto = z.infer<typeof purchaseSchema>;
export type ListingDto = z.infer<typeof listingSchema>;
export type SaleDto = z.infer<typeof saleSchema>;
export type FlipDto = z.infer<typeof flipSchema>;
export type FlipDetailDto = z.infer<typeof flipDetailSchema>;
export type DashboardDto = z.infer<typeof dashboardSchema>;
export type WatchlistItemDto = z.infer<typeof watchlistItemSchema>;
export type CreateFlipInput = z.infer<typeof createFlipSchema>;
export type UpdateFlipInput = z.infer<typeof updateFlipSchema>;
export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
export type UpdatePurchaseInput = z.infer<typeof updatePurchaseSchema>;
export type CreateListingInput = z.infer<typeof createListingSchema>;
export type UpdateListingInput = z.infer<typeof updateListingSchema>;
export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type UpdateSaleInput = z.infer<typeof updateSaleSchema>;
export type CreateWatchlistItemInput = z.infer<typeof createWatchlistItemSchema>;
export type UpdateWatchlistItemInput = z.infer<typeof updateWatchlistItemSchema>;
export type UpdateUserSettingsInput = z.infer<typeof updateUserSettingsSchema>;
