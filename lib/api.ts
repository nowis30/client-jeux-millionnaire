export const SUPABASE_URL = (
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://smwrpejnegtssmtmnecb.supabase.co"
).replace(/\/+$/, "");

export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_3-7XDsd5zEd-3rrqr0-xgQ_kk0z3ArR";

export const API_BASE = `${SUPABASE_URL}/functions/v1/heritier-api`;
export const IS_PRODUCTION = process.env.NODE_ENV === "production";
export const DEBUG_ENABLED = !IS_PRODUCTION;

const ACCESS_TOKEN_KEY = "HM_TOKEN";
const REFRESH_TOKEN_KEY = "HM_REFRESH_TOKEN";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem(key); } catch { return null; }
}

function writeStorage(key: string, value: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {}
}

export function clearAuthSession(): void {
  writeStorage(ACCESS_TOKEN_KEY, null);
  writeStorage(REFRESH_TOKEN_KEY, null);
  writeStorage("hm-token", null);
  writeStorage("hm-token-source", null);
  writeStorage("hm-session", null);
}

function storeAuthSession(data: any): void {
  const access = data?.access_token ?? data?.session?.access_token;
  const refresh = data?.refresh_token ?? data?.session?.refresh_token;
  if (typeof access === "string" && access) {
    writeStorage(ACCESS_TOKEN_KEY, access);
    writeStorage("hm-token", access);
    writeStorage("hm-token-source", "supabase");
  }
  if (typeof refresh === "string" && refresh) writeStorage(REFRESH_TOKEN_KEY, refresh);
}

export function captureAuthSessionFromUrl(): { accessToken?: string; refreshToken?: string; type?: string } {
  if (typeof window === "undefined" || !window.location.hash) return {};
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const accessToken = params.get("access_token") ?? undefined;
  const refreshToken = params.get("refresh_token") ?? undefined;
  const type = params.get("type") ?? undefined;
  if (accessToken) storeAuthSession({ access_token: accessToken, refresh_token: refreshToken });
  if (accessToken && type !== "recovery") {
    try { window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`); } catch {}
  }
  return { accessToken, refreshToken, type };
}

function tokenExpiresSoon(token: string): boolean {
  try {
    const payload = token.split(".")[1];
    if (!payload) return true;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")));
    return typeof decoded.exp !== "number" || decoded.exp * 1000 <= Date.now() + 30_000;
  } catch {
    return true;
  }
}

function getPlayerId(): string | null {
  const raw = readStorage("hm-session");
  if (!raw) return null;
  try { return JSON.parse(raw)?.playerId ?? null; } catch { return null; }
}

function authHeaders(token?: string | null): Record<string, string> {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function parseSupabaseError(response: Response): Promise<string> {
  const data = await response.clone().json().catch(() => ({} as any));
  const raw = String(data?.msg ?? data?.message ?? data?.error_description ?? data?.error ?? `Erreur ${response.status}`);
  const lower = raw.toLowerCase();
  if (lower.includes("invalid login credentials")) return "Adresse e-mail ou mot de passe incorrect.";
  if (lower.includes("email not confirmed")) return "Votre adresse e-mail n’est pas encore vérifiée.";
  if (lower.includes("user already registered")) return "Un compte existe déjà avec cette adresse e-mail.";
  if (lower.includes("password should be")) return "Le mot de passe doit contenir au moins 6 caractères.";
  if (lower.includes("rate limit")) return "Trop de tentatives. Réessayez dans quelques minutes.";
  return raw;
}

async function refreshSession(): Promise<string | null> {
  const refreshToken = readStorage(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!response.ok) {
    clearAuthSession();
    return null;
  }
  const data = await response.json();
  storeAuthSession(data);
  return typeof data?.access_token === "string" ? data.access_token : null;
}

async function getValidAccessToken(): Promise<string | null> {
  captureAuthSessionFromUrl();
  const token = readStorage(ACCESS_TOKEN_KEY);
  if (!token) return null;
  if (!tokenExpiresSoon(token)) return token;
  return refreshSession();
}

function responseJson(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

function redirectOrigin(path: string): string {
  if (typeof window === "undefined") return `https://client-jeux-millionnaire.vercel.app${path}`;
  return `${window.location.origin}${path}`;
}

async function handleAuthRoute(path: string, init: RequestInit): Promise<Response | null> {
  const method = (init.method ?? "GET").toUpperCase();
  let payload: any = {};
  if (typeof init.body === "string") {
    try { payload = JSON.parse(init.body || "{}"); } catch { return responseJson({ error: "Corps JSON invalide." }, 400); }
  }

  if (path === "/api/auth/login" && method === "POST") {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST", headers: authHeaders(), body: JSON.stringify({ email: payload.email, password: payload.password }),
    });
    if (!response.ok) return responseJson({ error: await parseSupabaseError(response) }, response.status);
    const data = await response.json();
    storeAuthSession(data);
    return responseJson({ id: data.user?.id, email: data.user?.email, token: data.access_token, refreshToken: data.refresh_token });
  }

  if (path === "/api/auth/register" && method === "POST") {
    const endpoint = `${SUPABASE_URL}/auth/v1/signup?redirect_to=${encodeURIComponent(redirectOrigin("/"))}`;
    const response = await fetch(endpoint, {
      method: "POST", headers: authHeaders(), body: JSON.stringify({ email: payload.email, password: payload.password }),
    });
    if (!response.ok) return responseJson({ error: await parseSupabaseError(response) }, response.status);
    const data = await response.json();
    storeAuthSession(data);
    const token = data?.access_token ?? data?.session?.access_token;
    return responseJson({ id: data.user?.id, email: data.user?.email, token, requiresEmailConfirmation: !token, message: token ? "Compte créé." : "Vérifiez votre boîte de réception pour confirmer votre compte." });
  }

  if (path === "/api/auth/resend-verification" && method === "POST") {
    const endpoint = `${SUPABASE_URL}/auth/v1/resend?redirect_to=${encodeURIComponent(redirectOrigin("/"))}`;
    const response = await fetch(endpoint, {
      method: "POST", headers: authHeaders(), body: JSON.stringify({ type: "signup", email: payload.email }),
    });
    if (!response.ok) return responseJson({ error: await parseSupabaseError(response) }, response.status);
    return responseJson({ ok: true });
  }

  if (path === "/api/auth/request-reset" && method === "POST") {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectOrigin("/reset"))}`, {
      method: "POST", headers: authHeaders(), body: JSON.stringify({ email: payload.email }),
    });
    if (!response.ok) return responseJson({ error: await parseSupabaseError(response) }, response.status);
    return responseJson({ ok: true });
  }

  if (path === "/api/auth/reset" && method === "POST") {
    const recoveryToken = String(payload.token || readStorage(ACCESS_TOKEN_KEY) || "");
    if (!recoveryToken) return responseJson({ error: "Lien de réinitialisation invalide ou expiré." }, 400);
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: "PUT", headers: authHeaders(recoveryToken), body: JSON.stringify({ password: payload.password }),
    });
    if (!response.ok) return responseJson({ error: await parseSupabaseError(response) }, response.status);
    clearAuthSession();
    return responseJson({ ok: true });
  }

  if (path === "/api/auth/refresh") {
    const token = await refreshSession();
    return token ? responseJson({ token }) : responseJson({ error: "Session expirée." }, 401);
  }

  if (path === "/api/auth/logout" && method === "POST") {
    const token = readStorage(ACCESS_TOKEN_KEY);
    if (token) {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, { method: "POST", headers: authHeaders(token) }).catch(() => null);
    }
    clearAuthSession();
    return responseJson({ ok: true });
  }

  return null;
}

export function getApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

async function requestApi(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const authResponse = await handleAuthRoute(path, init);
  if (authResponse) return authResponse;

  const token = await getValidAccessToken();
  const headers: Record<string, string> = { ...(init.headers as Record<string, string> | undefined) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const playerId = getPlayerId();
  if (playerId && !headers["X-Player-ID"] && !headers["x-player-id"]) headers["X-Player-ID"] = playerId;

  const response = await fetch(getApiUrl(path), { ...init, headers });
  if (response.status === 401 && retry && readStorage(REFRESH_TOKEN_KEY)) {
    const refreshed = await refreshSession();
    if (refreshed) return requestApi(path, init, false);
  }
  return response;
}

export async function apiFetchRaw(path: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await requestApi(path, init);
  } catch (error) {
    throw new ApiError(0, `Erreur réseau : ${error instanceof Error ? error.message : "connexion impossible"}`);
  }
}

export async function apiFetch<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await apiFetchRaw(path, init);
  if (!response.ok) {
    const data = await response.clone().json().catch(() => null as any);
    const text = data ? "" : await response.text().catch(() => "");
    const message = data?.error ?? data?.message ?? text ?? `Erreur ${response.status}`;
    throw new ApiError(response.status, String(message || `Erreur ${response.status}`));
  }
  if (response.status === 204) return undefined as T;
  return await response.json() as T;
}
