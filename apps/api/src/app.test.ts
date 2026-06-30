import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";

describe("API auth boundary", () => {
  it("keeps health public", async () => {
    const app = createApp();
    const response = await app.fetch(new Request("http://localhost/api/health"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ ok: false, database: false });
  });

  it("rejects protected routes without a session", async () => {
    const app = createApp();
    const response = await app.fetch(new Request("http://localhost/api/dashboard"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "Missing session" });
  });
});
