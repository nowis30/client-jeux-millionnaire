import { getStoredAccessToken, refreshSupabaseSession } from "./supabase-auth";

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
export const API_BASE = shouldUseSameOriginProxy ? "" : ABS_BACKEND;
export const SOCKET_BASE = process.env.NEXT_PUBLIC_SOCKET_BASE ?? "";

const RETRYABLE_PROXY_STATUSES = new Set([502, 503, 504]);

function debugLog(...args: unknown[]) {
  if (DEBUG_ENABLED) console.log(...args);
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

async function prepareRequestInit(init: RequestInit = {}): Promise<RequestInit> {
  const method = (init.method || "GET").toUpperCase();
  const headers: Record<string, string> = { ...(init.headers as any) };

  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const csrf = await ensureCsrf();
    if (csrf) headers["x-csrf-token"] = csrf;
  }

  const bearer = getStoredAccessToken();
  if (bearer) headers.Authorization = `Bearer ${bearer}`;

  const playerId = getPlayerId();
  if (playerId) headers["X-Player-ID"] = playerId;

  return { credentials: "include", ...init, headers };
}

debugLog("[API] ABS_BACKEND:", ABS_BACKEND);
debugLog("[API] API_BASE:", API_BASE || "(same-origin proxy)");
debugLog("[API] SOCKET_BASE:", SOCKET_BASE || "(Supabase Realtime)");

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
    const res = await fetch(getApiUrl(path, base), init);
    return { res, baseUsed: base };
  };

  try {
    const primary = await attempt(API_BASE);
    if (shouldRetryWithAbsoluteBackend(primary.baseUsed, primary.res.status)) return attempt(ABS_BACKEND);
    return primary;
  } catch (error) {
    if (shouldRetryWithAbsoluteBackend(API_BASE)) return attempt(ABS_BACKEND);
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

async function ensureCsrf(): Promise<string | null> {
  try {
    if (CSRF_TOKEN) return CSRF_TOKEN;
    const { res } = await fetchWithFallback("/api/auth/csrf", { credentials: "include" });
    if (!res.ok) return null;
    const data = (await res.json()) as { csrf?: string | null };
    CSRF_TOKEN = data?.csrf ?? null;
    return CSRF_TOKEN;
  } catch {
    return null;
  }
}

async function responseError(res: Response): Promise<ApiError> {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    const data = (await res.json().catch(() => ({}))) as any;
    const msg = data?.error || data?.message || `Erreur ${res.status}`;
    return new ApiError(res.status, String(msg));
  }
  const text = (await res.text().catch(() => "")).trim();
  return new ApiError(res.status, text || res.statusText || `Erreur ${res.status}`);
}

export async function apiFetch<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  try {
    let preparedInit = await prepareRequestInit(init);
    let result = await fetchWithFallback(path, preparedInit);

    if (result.res.status === 401 && getStoredAccessToken()) {
      const refreshed = await refreshSupabaseSession();
      if (refreshed?.access_token) {
        preparedInit = await prepareRequestInit(init);
        result = await fetchWithFallback(path, preparedInit);
      }
    }

    if (!result.res.ok) throw await responseError(result.res);
    if (result.res.status === 204) return undefined as unknown as T;
    return (await result.res.json()) as T;
  } catch (error: any) {
    if (error instanceof ApiError) throw error;
    if (DEBUG_ENABLED) console.error("[API] Fetch error:", error);
    throw new ApiError(0, `Erreur réseau: ${error?.message || "Failed to fetch"}`);
  }
}
