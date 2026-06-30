import { randomUUID } from "node:crypto";
import { and, eq, ne } from "drizzle-orm";
import { jwtVerify, SignJWT } from "jose";
import { config } from "../config.js";
import { getDb } from "../db/client.js";
import { users, xivauthAccounts, xivauthCharacters, type UserRow } from "../db/schema.js";
import { badRequest, serviceUnavailable } from "../http/errors.js";

type XivauthState = {
  mode: "login" | "link";
  userId?: string;
  nonce: string;
};

type XivauthTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in?: number;
  scope?: string;
};

type XivauthUserResponse = {
  id: string;
  email?: string;
};

type XivauthCharacterResponse = {
  persistent_key: string;
  lodestone_id: number;
  name: string;
  home_world: string;
  data_center: string;
  avatar_url?: string | null;
  portrait_url?: string | null;
  verified_at?: string | null;
};

export type XivauthLoginResult = {
  user: UserRow;
};

const stateSecret = new TextEncoder().encode(config.appSessionSecret);

function requireAppSessionSecret() {
  if (!config.appSessionSecret) serviceUnavailable("APP_SESSION_SECRET is required");
}

function requireXivauthConfig() {
  requireAppSessionSecret();
  if (!config.xivauth.clientId || !config.xivauth.clientSecret) {
    serviceUnavailable("XIVAuth OAuth is not configured");
  }
}

function xivauthRedirectUri(): string {
  if (config.xivauth.redirectUri) return config.xivauth.redirectUri;
  const base = config.apiBaseUrl.endsWith("/api")
    ? config.apiBaseUrl.slice(0, -"/api".length)
    : config.apiBaseUrl;
  return `${base.replace(/\/$/, "")}/api/auth/xivauth/callback`;
}

async function signState(state: XivauthState): Promise<string> {
  return new SignJWT(state)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("xivflips")
    .setAudience("xivauth:oauth")
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(stateSecret);
}

async function verifyState(token: string): Promise<XivauthState> {
  try {
    const result = await jwtVerify(token, stateSecret, {
      issuer: "xivflips",
      audience: "xivauth:oauth",
      algorithms: ["HS256"],
    });
    const mode = result.payload.mode;
    const nonce = result.payload.nonce;
    const userId = result.payload.userId;

    if ((mode !== "login" && mode !== "link") || typeof nonce !== "string") {
      badRequest("Invalid XIVAuth state");
    }

    return typeof userId === "string" ? { mode, nonce, userId } : { mode, nonce };
  } catch (error) {
    if (error instanceof Error && error.name === "HttpError") throw error;
    badRequest("Invalid XIVAuth state");
  }
}

export async function buildXivauthAuthorizeUrl(mode: "login" | "link", userId?: string) {
  requireXivauthConfig();
  const state = await signState(
    userId ? { mode, userId, nonce: randomUUID() } : { mode, nonce: randomUUID() },
  );
  const url = new URL("/oauth/authorize", config.xivauth.baseUrl);
  url.searchParams.set("client_id", config.xivauth.clientId!);
  url.searchParams.set("redirect_uri", xivauthRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "user character");
  url.searchParams.set("state", state);
  return url.toString();
}

async function exchangeCode(code: string): Promise<XivauthTokenResponse> {
  const response = await fetch(new URL("/oauth/token", config.xivauth.baseUrl), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: config.xivauth.clientId!,
      client_secret: config.xivauth.clientSecret!,
      redirect_uri: xivauthRedirectUri(),
    }),
  });

  const data = (await response.json().catch(() => ({}))) as Partial<XivauthTokenResponse>;
  if (!response.ok || !data.access_token) {
    badRequest("XIVAuth token exchange failed");
  }
  return data as XivauthTokenResponse;
}

async function xivauthRequest<T>(path: string, token: string): Promise<T> {
  const response = await fetch(new URL(path, config.xivauth.baseUrl), {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  const data = (await response.json().catch(() => ({}))) as unknown;
  if (!response.ok) badRequest("XIVAuth API request failed");
  return data as T;
}

function parseOptionalDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function upsertCharacters(userId: string, characters: XivauthCharacterResponse[]) {
  const db = getDb();
  for (const character of characters) {
    await db
      .insert(xivauthCharacters)
      .values({
        userId,
        persistentKey: character.persistent_key,
        lodestoneId: character.lodestone_id,
        name: character.name,
        homeWorld: character.home_world,
        dataCenter: character.data_center,
        avatarUrl: character.avatar_url ?? null,
        portraitUrl: character.portrait_url ?? null,
        verifiedAt: parseOptionalDate(character.verified_at),
      })
      .onConflictDoUpdate({
        target: xivauthCharacters.persistentKey,
        set: {
          userId,
          lodestoneId: character.lodestone_id,
          name: character.name,
          homeWorld: character.home_world,
          dataCenter: character.data_center,
          avatarUrl: character.avatar_url ?? null,
          portraitUrl: character.portrait_url ?? null,
          verifiedAt: parseOptionalDate(character.verified_at),
          updatedAt: new Date(),
        },
      });
  }
}

export async function completeXivauthLogin(
  code: string,
  stateToken: string,
): Promise<XivauthLoginResult> {
  requireXivauthConfig();
  const state = await verifyState(stateToken);
  const token = await exchangeCode(code);
  const [xivauthUser, characters] = await Promise.all([
    xivauthRequest<XivauthUserResponse>("/api/v1/user", token.access_token),
    xivauthRequest<XivauthCharacterResponse[]>("/api/v1/characters", token.access_token),
  ]);
  const db = getDb();

  const [existingAccount] = await db
    .select()
    .from(xivauthAccounts)
    .where(eq(xivauthAccounts.xivauthUserId, xivauthUser.id))
    .limit(1);

  if (state.mode === "link" && state.userId) {
    const [linkedElsewhere] = await db
      .select()
      .from(xivauthAccounts)
      .where(
        and(
          eq(xivauthAccounts.xivauthUserId, xivauthUser.id),
          ne(xivauthAccounts.userId, state.userId),
        ),
      )
      .limit(1);
    if (linkedElsewhere) badRequest("That XIVAuth account is already linked to another user");
  }

  let user: UserRow | undefined;
  const targetUserId = state.mode === "link" ? state.userId : existingAccount?.userId;
  if (targetUserId) {
    [user] = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);
  }

  if (!user) {
    const displayName = characters[0]?.name ?? null;
    [user] = await db
      .insert(users)
      .values({
        auth0Subject: `xivauth:${xivauthUser.id}`,
        email: xivauthUser.email ?? null,
        displayName,
      })
      .returning();
  }

  if (!user) serviceUnavailable("Unable to create XIVAuth user");

  await db
    .insert(xivauthAccounts)
    .values({ userId: user.id, xivauthUserId: xivauthUser.id, email: xivauthUser.email ?? null })
    .onConflictDoUpdate({
      target: xivauthAccounts.xivauthUserId,
      set: { userId: user.id, email: xivauthUser.email ?? null, updatedAt: new Date() },
    });

  await upsertCharacters(user.id, characters);

  return { user };
}
