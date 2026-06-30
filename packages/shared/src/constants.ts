export const flipStatuses = [
  "active",
  "listed",
  "partially_sold",
  "sold",
  "cancelled",
  "archived",
] as const;
export const listingStatuses = ["active", "sold", "cancelled", "expired"] as const;
export const flipStrategies = [
  "undercut",
  "velocity",
  "dc_arbitrage",
  "patch_speculation",
  "crafted",
  "other",
] as const;

export type FlipStatus = (typeof flipStatuses)[number];
export type ListingStatus = (typeof listingStatuses)[number];
export type FlipStrategy = (typeof flipStrategies)[number];

export const defaultTaxRateBps = 500;
