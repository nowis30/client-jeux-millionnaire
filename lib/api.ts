export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";

let CSRF_TOKEN: string | null = null;
const TOKEN_KEY = "HM_TOKEN";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

async function ensureCsrf(): Promise<string | null> {
  try {
    if (CSRF_TOKEN) return CSRF_TOKEN;
    const res = await fetch(`${API_BASE}/api/auth/csrf`, { credentials: "include" });
    if (!res.ok) return null;
    const data = (await res.json()) as { csrf?: string };
    CSRF_TOKEN = data?.csrf ?? null;
    return CSRF_TOKEN;
  } catch {
    return null;
  }
}

export async function apiFetch<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method || "GET").toUpperCase();
  const headers: Record<string, string> = { ...(init.headers as any) };
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const token = await ensureCsrf();
    if (token) headers["x-csrf-token"] = token;
  }
  const bearer = getToken();
  if (bearer) headers["Authorization"] = `Bearer ${bearer}`;
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...init,
    headers,
  });
  if (!res.ok) {
    const status = res.status;
    throw new Error(`Erreur ${status}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}
