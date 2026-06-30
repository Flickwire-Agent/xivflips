import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { jwtVerify, SignJWT } from "jose";
import { eq } from "drizzle-orm";
import { config } from "../config.js";
import { getDb } from "../db/client.js";
import { users, type UserRow } from "../db/schema.js";
import { unauthorized, serviceUnavailable } from "./errors.js";

export type AuthClaims = {
  subject: string;
  email: string | null;
  displayName: string | null;
  provider: "xivauth";
};

export type AuthVariables = {
  claims: AuthClaims;
  user: UserRow;
};

export type AppEnv = {
  Variables: AuthVariables;
};

const sessionSecret = new TextEncoder().encode(config.appSessionSecret);

function requireAppSessionSecret() {
  if (!config.appSessionSecret) serviceUnavailable("APP_SESSION_SECRET is required");
}

export async function createAppSessionToken(userId: string): Promise<string> {
  requireAppSessionSecret();
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer("xivflips")
    .setAudience("xivflips:web")
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(sessionSecret);
}

async function verifyAppSessionToken(token: string): Promise<UserRow> {
  requireAppSessionSecret();
  try {
    const result = await jwtVerify(token, sessionSecret, {
      issuer: "xivflips",
      audience: "xivflips:web",
      algorithms: ["HS256"],
    });

    if (!result.payload.sub) unauthorized("Session subject is required");

    const db = getDb();
    const [user] = await db.select().from(users).where(eq(users.id, result.payload.sub)).limit(1);
    if (!user) unauthorized("Session user not found");
    return user;
  } catch (error) {
    if (error instanceof Error && error.name === "HttpError") throw error;
    unauthorized("Invalid session");
  }
}

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const sessionToken = getCookie(c, "xivflips_session");
  if (!sessionToken) unauthorized("Missing session");

  const user = await verifyAppSessionToken(sessionToken);
  c.set("claims", {
    subject: user.subject,
    email: user.email,
    displayName: user.displayName,
    provider: "xivauth",
  });
  c.set("user", user);
  await next();
});
