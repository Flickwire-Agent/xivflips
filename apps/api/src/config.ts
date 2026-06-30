import "dotenv/config";

function optionalUrl(value: string | undefined): string | undefined {
  if (!value || value.trim().length === 0) return undefined;
  return value;
}

function withTrailingSlash(value: string | undefined): string | undefined {
  if (!value || value.trim().length === 0) return undefined;
  return value.endsWith("/") ? value : `${value}/`;
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4010),
  databaseUrl: optionalUrl(process.env.DATABASE_URL),
  appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:5173",
  apiBaseUrl: process.env.API_BASE_URL ?? "http://localhost:4010",
  auth0: {
    domain: optionalUrl(process.env.AUTH0_DOMAIN),
    audience: optionalUrl(process.env.AUTH0_AUDIENCE),
    issuerBaseUrl: withTrailingSlash(process.env.AUTH0_ISSUER_BASE_URL),
  },
  xivarbitrageApiBaseUrl:
    process.env.XIVARBITRAGE_API_BASE_URL ?? "https://xivarbitrage.projects.blueskye.co.uk/api",
  marketSnapshotRetentionDays: Number(process.env.MARKET_SNAPSHOT_RETENTION_DAYS ?? 90),
};

export function isProduction(): boolean {
  return config.nodeEnv === "production";
}
