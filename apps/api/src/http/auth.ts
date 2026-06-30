import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { createRemoteJWKSet, jwtVerify, SignJWT, type JWTPayload } from "jose";
import { eq } from "drizzle-orm";
import { config } from "../config.js";
import { getDb } from "../db/client.js";
import { users, type UserRow } from "../db/schema.js";
import { unauthorized, serviceUnavailable } from "./errors.js";

export type AuthClaims = {
  subject: string;
  email: string | null;
  displayName: string | null;
  provider: "auth0" | "xivauth";
};

export type AuthVariables = {
  claims: AuthClaims;
  user: UserRow;
};

export type AppEnv = {
  Variables: AuthVariables;
};

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!config.auth0.issuerBaseUrl || !config.auth0.audience) {
    serviceUnavailable("Auth0 issuer and audience are required");
  }

  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(".well-known/jwks.json", config.auth0.issuerBaseUrl));
  }

  return jwks;
}

function getBearerToken(header: string | undefined): string {
  if (!header?.startsWith("Bearer ")) {
    unauthorized("Missing bearer token");
  }
  return header.slice("Bearer ".length).trim();
}

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

function getStringClaim(payload: JWTPayload, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

async function verifyToken(token: string): Promise<AuthClaims> {
  if (!config.auth0.issuerBaseUrl || !config.auth0.audience) {
    serviceUnavailable("Auth0 issuer and audience are required");
  }

  try {
    const result = await jwtVerify(token, getJwks(), {
      issuer: config.auth0.issuerBaseUrl,
      audience: config.auth0.audience,
      algorithms: ["RS256"],
    });

    if (!result.payload.sub) {
      unauthorized("Token subject is required");
    }

    return {
      subject: result.payload.sub,
      email: getStringClaim(result.payload, "email"),
      displayName:
        getStringClaim(result.payload, "name") ?? getStringClaim(result.payload, "nickname"),
      provider: "auth0",
    };
  } catch (error) {
    if (error instanceof Error && error.name === "HttpError") throw error;
    unauthorized("Invalid bearer token");
  }
}

async function ensureUser(claims: AuthClaims): Promise<UserRow> {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.auth0Subject, claims.subject))
    .limit(1);

  if (existing) {
    if (existing.email !== claims.email || existing.displayName !== claims.displayName) {
      const [updated] = await db
        .update(users)
        .set({
          email: claims.email,
          displayName: claims.displayName,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existing.id))
        .returning();
      return updated ?? existing;
    }
    return existing;
  }

  const [created] = await db
    .insert(users)
    .values({
      auth0Subject: claims.subject,
      email: claims.email,
      displayName: claims.displayName,
    })
    .returning();

  if (!created) {
    serviceUnavailable("Unable to create local user");
  }

  return created;
}

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const sessionToken = getCookie(c, "xivflips_session");
  const authorization = c.req.header("authorization");

  if (!authorization && sessionToken) {
    const user = await verifyAppSessionToken(sessionToken);
    c.set("claims", {
      subject: user.auth0Subject,
      email: user.email,
      displayName: user.displayName,
      provider: "xivauth",
    });
    c.set("user", user);
    await next();
    return;
  }

  const token = getBearerToken(authorization);
  const claims = await verifyToken(token);
  const user = await ensureUser(claims);
  c.set("claims", claims);
  c.set("user", user);
  await next();
});
