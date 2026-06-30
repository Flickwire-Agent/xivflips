import type { Hono } from "hono";
import { checkDatabaseHealth } from "../db/client.js";
import type { AppEnv } from "../http/auth.js";

export function registerHealthRoute(app: Hono<AppEnv>) {
  app.get("/health", async (c) => {
    const database = await checkDatabaseHealth();
    const status = database ? 200 : 503;
    return c.json({ ok: database, database }, status);
  });
}
