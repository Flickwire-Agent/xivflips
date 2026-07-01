import { randomUUID } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { config } from "../config.js";
import { badRequest, serviceUnavailable } from "../http/errors.js";

export type XivauthState = {
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

export type { XivauthTokenResponse, XivauthUserResponse, XivauthCharacterResponse };

const stateSecret = new TextEncoder().encode(config.appSessionSecret);

export function requireAppSessionSecret() {
  if (!config.appSessionSecret) serviceUnavailable("APP_SESSION_SECRET is required");
}

export function requireXivauthConfig() {
  requireAppSessionSecret();
  if (!config.xivauth.clientId || !config.xivauth.clientSecret) {
    serviceUnavailable("XIVAuth OAuth is not configured");
  }
}

export function xivauthRedirectUri(): string {
  if (config.xivauth.redirectUri) return config.xivauth.redirectUri;
  const base = config.apiBaseUrl.endsWith("/api")
    ? config.apiBaseUrl.slice(0, -"/api".length)
    : config.apiBaseUrl;
  return `${base.replace(/\/$/, "")}/api/auth/xivauth/callback`;
}

export async function signState(state: XivauthState): Promise<string> {
  return new SignJWT(state)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("xivflips")
    .setAudience("xivauth:oauth")
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(stateSecret);
}

export async function verifyState(token: string): Promise<XivauthState> {
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

export async function exchangeCode(code: string): Promise<XivauthTokenResponse> {
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

export async function xivauthRequest<T>(path: string, token: string): Promise<T> {
  const response = await fetch(new URL(path, config.xivauth.baseUrl), {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  const data = (await response.json().catch(() => ({}))) as unknown;
  if (!response.ok) badRequest("XIVAuth API request failed");
  return data as T;
}
