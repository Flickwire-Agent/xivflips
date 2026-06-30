import "dotenv/config";

function optionalUrl(value: string | undefined): string | undefined {
  if (!value || value.trim().length === 0) return undefined;
  return value;
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4010),
  databaseUrl: optionalUrl(process.env.DATABASE_URL),
  appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:5173",
  apiBaseUrl: process.env.API_BASE_URL ?? "http://localhost:4010",
  appSessionSecret:
    process.env.APP_SESSION_SECRET ??
    (process.env.NODE_ENV === "production" ? "" : "xivflips-local-session-secret"),
  xivauth: {
    baseUrl: process.env.XIVAUTH_BASE_URL ?? "https://xivauth.net",
    clientId: optionalUrl(process.env.XIVAUTH_CLIENT_ID),
    clientSecret: optionalUrl(process.env.XIVAUTH_CLIENT_SECRET),
    redirectUri: optionalUrl(process.env.XIVAUTH_REDIRECT_URI),
  },
  xivarbitrageApiBaseUrl:
    process.env.XIVARBITRAGE_API_BASE_URL ?? "https://xivarbitrage.projects.blueskye.co.uk/api",
  marketSnapshotRetentionDays: Number(process.env.MARKET_SNAPSHOT_RETENTION_DAYS ?? 90),
};

export function isProduction(): boolean {
  return config.nodeEnv === "production";
}
