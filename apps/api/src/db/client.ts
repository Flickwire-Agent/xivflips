import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { config } from "../config.js";
import * as schema from "./schema.js";

const { Pool } = pg;

export const pool = config.databaseUrl
  ? new Pool({
      connectionString: config.databaseUrl,
      max: 10,
      idleTimeoutMillis: 30_000,
    })
  : null;

export const db = pool ? drizzle(pool, { schema }) : null;

export function getDb() {
  if (!db) {
    throw new Error("DATABASE_URL is required");
  }
  return db;
}

export async function checkDatabaseHealth(): Promise<boolean> {
  if (!pool) return false;

  try {
    const result = await pool.query("SELECT 1 AS ok");
    return result.rows[0]?.ok === 1;
  } catch {
    return false;
  }
}

export async function closeDatabase(): Promise<void> {
  await pool?.end();
}
