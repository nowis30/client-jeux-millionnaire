// Après mise en place du proxy Next (rewrites), on utilise des chemins relatifs.
// En dev sans proxy (si NEXT_PUBLIC_API_BASE non défini), fallback vers le serveur Render (plutôt que localhost) pour l'APK mobile.
// Pour Capacitor/mobile, on utilise toujours l'URL absolue
const ABS_BACKEND = process.env.NEXT_PUBLIC_API_BASE ?? "https://server-jeux-millionnaire.onrender.com";
const isCapacitor = typeof window !== 'undefined' && !!(window as any).Capacitor;
// Détection d'environnement:
// - En développement Next (localhost:3000) on peut utiliser les proxys/rewrite → chemins relatifs.
// - En export statique (APK / domaine production nowis.store) il n'y a PAS d'API Next embarquée → on doit pointer vers le backend Render.
// - Sur Capacitor (app mobile) on force toujours l'URL absolue.
const isBrowser = typeof window !== 'undefined';
const isLocalDev = isBrowser && /localhost:3000$/.test(window.location.host);
// Possibilité de forcer absolu avec NEXT_PUBLIC_FORCE_ABS=1
const forceAbs = process.env.NEXT_PUBLIC_FORCE_ABS === '1';
export const API_BASE = (isCapacitor || forceAbs || !isLocalDev) ? ABS_BACKEND : '';

console.log('[API] ABS_BACKEND:', ABS_BACKEND);
console.log('[API] isCapacitor:', isCapacitor);
console.log('[API] isLocalDev:', isLocalDev);
console.log('[API] forceAbs:', forceAbs);
console.log('[API] API_BASE:', API_BASE);

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
  
  console.log(`[API] ${method} ${API_BASE}${path}`);
  
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const token = await ensureCsrf();
    if (token) headers["x-csrf-token"] = token;
  }
  const bearer = getToken();
  if (bearer) headers["Authorization"] = `Bearer ${bearer}`;
  
  // Ajouter X-Player-ID pour iOS/Safari (si disponible dans localStorage)
  const playerId = getPlayerId();
  if (playerId) {
    headers["X-Player-ID"] = playerId;
  }
  
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      ...init,
      headers,
    });
    
    console.log(`[API] Response ${res.status} ${res.statusText}`);
    
  // Si 401 et on a un bearer local, tenter un refresh côté serveur puis rejouer 1x
  if (res.status === 401) {
    try {
      if (bearer) {
        // tenter un refresh silencieux
  const r = await fetch(`${API_BASE}/api/auth/refresh`, { credentials: "include", headers: { Authorization: `Bearer ${bearer}` } });
        if (r.ok) {
          const data = await r.json().catch(() => ({} as any));
          if (data?.token) {
            try { window.localStorage.setItem(TOKEN_KEY, data.token); } catch {}
            headers["Authorization"] = `Bearer ${data.token}`;
          }
          // rejouer la requête originale une seule fois
          const retry = await fetch(`${API_BASE}${path}`, { credentials: "include", ...init, headers });
          if (!retry.ok) throw new ApiError(retry.status, retry.statusText);
          if (retry.status === 204) return undefined as unknown as T;
          return (await retry.json()) as T;
        }
      }
    } catch {}
  }
  if (!res.ok) {
    // Essayer d'extraire le message d'erreur renvoyé par le serveur (JSON ou texte)
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
      // Si tout échoue, renvoyer un message d'état générique
      const fallback = res.statusText ? `${res.status} ${res.statusText}` : `Erreur ${res.status}`;
      if (e instanceof ApiError) throw e;
      throw new ApiError(res.status, fallback);
    }
  }
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
  } catch (fetchError: any) {
    console.error('[API] Fetch error:', fetchError);
    throw new ApiError(0, `Erreur réseau: ${fetchError.message || 'Failed to fetch'}`);
  }
}
