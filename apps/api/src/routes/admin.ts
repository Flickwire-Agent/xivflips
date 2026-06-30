import type { Hono } from "hono";
import { eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { users, xivauthCharacters } from "../db/schema.js";
import { createAppSessionToken, requireAdmin, type AppEnv } from "../http/auth.js";
import { badRequest, notFound } from "../http/errors.js";
import { writeSessionCookie } from "./xivauth.js";

export function registerAdminRoutes(app: Hono<AppEnv>) {
  app.use("/admin/*", requireAdmin);

  app.get("/admin/users", async (c) => {
    const db = getDb();
    const allUsers = await db.select().from(users).orderBy(users.createdAt);

    const usersWithCharacters = await Promise.all(
      allUsers.map(async (user) => {
        const characters = await db
          .select()
          .from(xivauthCharacters)
          .where(eq(xivauthCharacters.userId, user.id))
          .orderBy(xivauthCharacters.name);

        return {
          id: user.id,
          subject: user.subject,
          email: user.email,
          displayName: user.displayName,
          homeWorldId: user.homeWorldId,
          defaultTaxRateBps: user.defaultTaxRateBps,
          isAdmin: user.isAdmin,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
          characters: characters.map((char) => ({
            id: char.id,
            name: char.name,
            homeWorld: char.homeWorld,
            dataCenter: char.dataCenter,
          })),
        };
      }),
    );

    return c.json({ users: usersWithCharacters });
  });

  app.post("/admin/impersonate", async (c) => {
    const body = await c.req.json().catch(() => badRequest("Request body must be JSON"));
    const { userId } = body as { userId?: string };

    if (!userId) badRequest("userId is required");

    const db = getDb();
    const [targetUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!targetUser) notFound("User not found");

    const token = await createAppSessionToken(targetUser.id);
    writeSessionCookie(c, token);

    return c.json({
      ok: true,
      user: {
        id: targetUser.id,
        email: targetUser.email,
        displayName: targetUser.displayName,
        isAdmin: targetUser.isAdmin,
      },
    });
  });
}
