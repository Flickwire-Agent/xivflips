export function formatGil(value: number): string {
  return new Intl.NumberFormat("en-GB").format(Math.round(value)) + " gil";
}

export function formatPercentFromBps(value: number): string {
  return `${(value / 100).toFixed(2)}%`;
}
