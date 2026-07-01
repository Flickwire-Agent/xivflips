import { deleteCookie, setCookie } from "hono/cookie";
import type { Context, Hono } from "hono";
import { config, isProduction } from "../config.js";
import { createAppSessionToken, type AppEnv } from "../http/auth.js";
import { badRequest } from "../http/errors.js";
import { buildXivauthAuthorizeUrl } from "../services/xivauth-client.js";
import { completeXivauthLogin } from "../services/xivauth-user.js";

const sessionCookie = "xivflips_session";

export function writeSessionCookie(c: Context<AppEnv>, token: string) {
  setCookie(c, sessionCookie, token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearSessionCookie(c: Context<AppEnv>) {
  deleteCookie(c, sessionCookie, { path: "/" });
}

export function registerXivauthRoutes(app: Hono<AppEnv>) {
  app.get("/auth/xivauth/start", async (c) => {
    return c.redirect(await buildXivauthAuthorizeUrl("login"));
  });

  app.get("/auth/xivauth/callback", async (c) => {
    const code = c.req.query("code");
    const state = c.req.query("state");
    if (!code || !state) badRequest("Missing XIVAuth callback parameters");

    const { user } = await completeXivauthLogin(code, state);
    const token = await createAppSessionToken(user.id);
    writeSessionCookie(c, token);
    return c.redirect(new URL("/dashboard", config.appBaseUrl).toString());
  });

  app.post("/auth/logout", (c) => {
    clearSessionCookie(c);
    return c.json({ ok: true });
  });
}
