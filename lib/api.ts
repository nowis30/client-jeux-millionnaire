const ABS_BACKEND = (
  process.env.NEXT_PUBLIC_SUPABASE_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE ??
  "https://smwrpejnegtssmtmnecb.supabase.co/functions/v1/heritier-api"
).replace(/\/+$/, "");

const isBrowser = typeof window !== "undefined";
const host = isBrowser ? window.location.host : "";
const isCapacitor = isBrowser && !!(window as any).Capacitor;
const isLocalDev = isBrowser && /(^|:)(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host);
const forceAbs = process.env.NEXT_PUBLIC_FORCE_ABS === "1";
const forceProxy = process.env.NEXT_PUBLIC_USE_PROXY === "1";

export const IS_PRODUCTION = process.env.NODE_ENV === "production";
export const DEBUG_ENABLED = !IS_PRODUCTION;

const shouldUseSameOriginProxy = !isCapacitor && !forceAbs && (forceProxy || !isLocalDev);

// Sur le Web, /api/* est réécrit par Vercel vers l'Edge Function Supabase.
// Sur Android/Capacitor et en secours réseau, les appels vont directement à Supabase.
export const API_BASE = shouldUseSameOriginProxy ? "" : ABS_BACKEND;

// Socket.IO Render est retiré. Le temps réel sera migré vers Supabase Realtime.
export const SOCKET_BASE = process.env.NEXT_PUBLIC_SOCKET_BASE ?? "";

const RETRYABLE_PROXY_STATUSES = new Set([502, 503, 504]);

function debugLog(...args: unknown[]) {
  if (DEBUG_ENABLED) console.log(...args);
}

async function prepareRequestInit(init: RequestInit = {}): Promise<RequestInit> {
  const method = (init.method || "GET").toUpperCase();
  const headers: Record<string, string> = { ...(init.headers as any) };

  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const token = await ensureCsrf();
    if (token) headers["x-csrf-token"] = token;
  }

  const bearer = getToken();
  if (bearer) headers["Authorization"] = `Bearer ${bearer}`;

  const playerId = getPlayerId();
  if (playerId) {
    headers["X-Player-ID"] = playerId;
  }

  return {
    credentials: "include",
    ...init,
    headers,
  };
}

debugLog("[API] ABS_BACKEND:", ABS_BACKEND);
debugLog("[API] isCapacitor:", isCapacitor);
debugLog("[API] isLocalDev:", isLocalDev);
debugLog("[API] forceAbs:", forceAbs);
debugLog("[API] forceProxy:", forceProxy);
debugLog("[API] API_BASE:", API_BASE || "(same-origin proxy)");
debugLog("[API] SOCKET_BASE:", SOCKET_BASE || "(Supabase Realtime à venir)");

export function getApiUrl(path: string, base = API_BASE): string {
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

function shouldRetryWithAbsoluteBackend(base: string, status?: number) {
  return shouldUseSameOriginProxy && base !== ABS_BACKEND && (status == null || RETRYABLE_PROXY_STATUSES.has(status));
}

async function fetchWithFallback(path: string, init: RequestInit): Promise<{ res: Response; baseUsed: string }> {
  const attempt = async (base: string) => {
    debugLog(`[API] ${init.method || "GET"} ${getApiUrl(path, base)}`);
    const res = await fetch(getApiUrl(path, base), init);
    return { res, baseUsed: base };
  };

  try {
    const primary = await attempt(API_BASE);
    if (shouldRetryWithAbsoluteBackend(primary.baseUsed, primary.res.status)) {
      debugLog(`[API] Proxy Vercel ${primary.res.status}, tentative directe Supabase`);
      return attempt(ABS_BACKEND);
    }
    return primary;
  } catch (error) {
    if (shouldRetryWithAbsoluteBackend(API_BASE)) {
      debugLog("[API] Échec proxy, tentative directe Supabase");
      return attempt(ABS_BACKEND);
    }
    throw error;
  }
}

export async function apiFetchRaw(path: string, init: RequestInit = {}): Promise<Response> {
  const preparedInit = await prepareRequestInit(init);
  const { res } = await fetchWithFallback(path, preparedInit);
  return res;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

let CSRF_TOKEN: string | null = null;
const TOKEN_KEY = "HM_TOKEN";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

function getPlayerId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const session = window.localStorage.getItem("hm-session");
    if (!session) return null;
    const data = JSON.parse(session);
    return data.playerId || null;
  } catch {
    return null;
  }
}

async function ensureCsrf(): Promise<string | null> {
  try {
    if (CSRF_TOKEN) return CSRF_TOKEN;
    const { res } = await fetchWithFallback("/api/auth/csrf", { credentials: "include" });
    if (!res.ok) return null;
    const data = (await res.json()) as { csrf?: string };
    CSRF_TOKEN = data?.csrf ?? null;
    return CSRF_TOKEN;
  } catch {
    return null;
  }
}

export async function apiFetch<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const bearer = getToken();
  const preparedInit = await prepareRequestInit(init);
  const headers = (preparedInit.headers as Record<string, string>) || {};

  try {
    const { res, baseUsed } = await fetchWithFallback(path, {
      ...preparedInit,
    });

    debugLog(`[API] Response ${res.status} ${res.statusText}`);

    if (res.status === 401) {
      try {
        if (bearer) {
          const r = await fetch(getApiUrl("/api/auth/refresh", baseUsed), { credentials: "include", headers: { Authorization: `Bearer ${bearer}` } });
          if (r.ok) {
            const data = await r.json().catch(() => ({} as any));
            if (data?.token) {
              try { window.localStorage.setItem(TOKEN_KEY, data.token); } catch {}
              headers["Authorization"] = `Bearer ${data.token}`;
            }
            const retry = await fetch(getApiUrl(path, baseUsed), { credentials: "include", ...init, headers });
            if (!retry.ok) throw new ApiError(retry.status, retry.statusText);
            if (retry.status === 204) return undefined as unknown as T;
            return (await retry.json()) as T;
          }
        }
      } catch {}
    }
    if (!res.ok) {
      try {
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
          const data = (await res.json()) as any;
          const msg = (data && (data.error || data.message)) ? String(data.error || data.message) : `Erreur ${res.status}`;
          throw new ApiError(res.status, msg);
        } else {
          const text = await res.text();
          const trimmed = (text || '').trim();
          const msg = trimmed.length ? trimmed : (res.statusText ? `${res.status} ${res.statusText}` : `Erreur ${res.status}`);
          throw new ApiError(res.status, msg);
        }
      } catch (e) {
        const fallback = res.statusText ? `${res.status} ${res.statusText}` : `Erreur ${res.status}`;
        if (e instanceof ApiError) throw e;
        throw new ApiError(res.status, fallback);
      }
    }
    if (res.status === 204) return undefined as unknown as T;
    return (await res.json()) as T;
  } catch (fetchError: any) {
    if (DEBUG_ENABLED) {
      console.error('[API] Fetch error:', fetchError);
    }
    throw new ApiError(0, `Erreur réseau: ${fetchError.message || 'Failed to fetch'}`);
  }
}
