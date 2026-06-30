import { useAuth0 } from "@auth0/auth0-react";
import type {
  DashboardDto,
  FlipDetailDto,
  FlipDto,
  ItemDto,
  WatchlistItemDto,
  WorldDto,
} from "@xivflips/shared";
import { env } from "./env";

type ApiOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
};

export type MeResponse = {
  user: {
    id: string;
    email: string | null;
    displayName: string | null;
    homeWorldId: number | null;
    defaultTaxRateBps: number;
  };
};

function apiUrl(path: string): string {
  const base = env.apiBaseUrl.endsWith("/") ? env.apiBaseUrl.slice(0, -1) : env.apiBaseUrl;
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

export function useApiClient() {
  const { getAccessTokenSilently } = useAuth0();

  async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
    const token = await getAccessTokenSilently({
      authorizationParams: { audience: env.auth0Audience },
    });
    const init: RequestInit = {
      method: options.method ?? "GET",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
    };

    if (options.body !== undefined) {
      init.body = JSON.stringify(options.body);
    }

    const response = await fetch(apiUrl(path), init);

    const data = (await response.json().catch(() => ({}))) as unknown;

    if (!response.ok) {
      const errorMessage =
        typeof data === "object" &&
        data !== null &&
        "error" in data &&
        typeof data.error === "string"
          ? data.error
          : `Request failed: ${response.status}`;
      throw new Error(errorMessage);
    }

    return data as T;
  }

  return {
    getMe: () => request<MeResponse>("/me"),
    updateSettings: (body: { homeWorldId?: number | null; defaultTaxRateBps?: number }) =>
      request<MeResponse>("/me/settings", { method: "PATCH", body }),
    getWorlds: () => request<{ worlds: WorldDto[] }>("/worlds"),
    searchItems: (query: string) =>
      request<{ items: ItemDto[] }>(`/items/search?q=${encodeURIComponent(query)}`),
    getDashboard: () => request<DashboardDto>("/dashboard"),
    getFlips: (status?: string) =>
      request<{ flips: FlipDto[]; total: number }>(status ? `/flips?status=${status}` : "/flips"),
    getFlip: (id: string) => request<{ flip: FlipDetailDto }>(`/flips/${id}`),
    createFlip: (body: unknown) =>
      request<{ flip: FlipDetailDto }>("/flips", { method: "POST", body }),
    updateFlip: (id: string, body: unknown) =>
      request<{ flip: FlipDetailDto }>(`/flips/${id}`, { method: "PATCH", body }),
    archiveFlip: (id: string) => request<{ ok: true }>(`/flips/${id}`, { method: "DELETE" }),
    restoreFlip: (id: string) =>
      request<{ flip: FlipDetailDto }>(`/flips/${id}/restore`, { method: "POST" }),
    addPurchase: (id: string, body: unknown) =>
      request<{ flip: FlipDetailDto }>(`/flips/${id}/purchases`, { method: "POST", body }),
    addListing: (id: string, body: unknown) =>
      request<{ flip: FlipDetailDto }>(`/flips/${id}/listings`, { method: "POST", body }),
    addSale: (id: string, body: unknown) =>
      request<{ flip: FlipDetailDto }>(`/flips/${id}/sales`, { method: "POST", body }),
    getWatchlist: () => request<{ watchlist: WatchlistItemDto[] }>("/watchlist"),
    createWatchlistItem: (body: unknown) =>
      request<{ watchlistItem: WatchlistItemDto }>("/watchlist", { method: "POST", body }),
    deleteWatchlistItem: (id: string) =>
      request<{ ok: true }>(`/watchlist/${id}`, { method: "DELETE" }),
    refreshMarket: (body?: unknown) =>
      request<{ checked: number; snapshots: number; failures: string[] }>("/market/refresh", {
        method: "POST",
        body: body ?? {},
      }),
  };
}
