const SUPABASE_URL = "https://smwrpejnegtssmtmnecb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_3-7XDsd5zEd-3rrqr0-xgQ_kk0z3ArR";

const ACCESS_KEY = "HM_TOKEN";
const REFRESH_KEY = "HM_REFRESH_TOKEN";

type AuthUser = {
  id: string;
  email?: string | null;
};

type AuthSessionResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: AuthUser | null;
  msg?: string;
  message?: string;
  error_description?: string;
};

function authHeaders(accessToken?: string) {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
}

async function parseAuthResponse(response: Response): Promise<AuthSessionResponse> {
  const payload = (await response.json().catch(() => ({}))) as AuthSessionResponse;
  if (!response.ok) {
    const message = payload.error_description || payload.msg || payload.message || `Erreur d’authentification (${response.status})`;
    throw new Error(message);
  }
  return payload;
}

export function getStoredAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem(ACCESS_KEY); } catch { return null; }
}

export function getStoredRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem(REFRESH_KEY); } catch { return null; }
}

export function clearSupabaseSession() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
    window.localStorage.removeItem("hm-token");
    window.localStorage.removeItem("hm-token-source");
    window.localStorage.removeItem("hm-session");
  } catch {}
}

export function storeSupabaseSession(payload: AuthSessionResponse) {
  if (typeof window === "undefined") return;
  try {
    if (payload.access_token) {
      window.localStorage.setItem(ACCESS_KEY, payload.access_token);
      window.localStorage.setItem("hm-token", payload.access_token);
      window.localStorage.setItem("hm-token-source", "supabase");
    }
    if (payload.refresh_token) window.localStorage.setItem(REFRESH_KEY, payload.refresh_token);
  } catch {}
}

export async function signInWithSupabase(email: string, password: string) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });
  const payload = await parseAuthResponse(response);
  if (!payload.access_token || !payload.user?.id) throw new Error("Supabase n’a pas retourné de session valide.");
  storeSupabaseSession(payload);
  return payload;
}

export async function signUpWithSupabase(email: string, password: string) {
  const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/` : undefined;
  const url = new URL(`${SUPABASE_URL}/auth/v1/signup`);
  if (redirectTo) url.searchParams.set("redirect_to", redirectTo);
  const response = await fetch(url.toString(), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });
  const payload = await parseAuthResponse(response);
  if (payload.access_token) storeSupabaseSession(payload);
  return payload;
}

export async function refreshSupabaseSession() {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!response.ok) {
    clearSupabaseSession();
    return null;
  }
  const payload = await parseAuthResponse(response);
  if (!payload.access_token) {
    clearSupabaseSession();
    return null;
  }
  storeSupabaseSession(payload);
  return payload;
}

export async function signOutFromSupabase() {
  const accessToken = getStoredAccessToken();
  if (accessToken) {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: "POST",
      headers: authHeaders(accessToken),
    }).catch(() => undefined);
  }
  clearSupabaseSession();
}

export async function requestSupabasePasswordReset(email: string) {
  const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/reset` : "https://client-jeux-millionnaire.vercel.app/reset";
  const url = new URL(`${SUPABASE_URL}/auth/v1/recover`);
  url.searchParams.set("redirect_to", redirectTo);
  const response = await fetch(url.toString(), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });
  await parseAuthResponse(response);
}

export async function resendSupabaseSignup(email: string) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/resend`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ type: "signup", email: email.trim().toLowerCase() }),
  });
  await parseAuthResponse(response);
}

export function recoveryAccessTokenFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const type = hash.get("type");
  const token = hash.get("access_token");
  return type === "recovery" && token ? token : null;
}

export async function updateSupabasePassword(accessToken: string, password: string) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: "PUT",
    headers: authHeaders(accessToken),
    body: JSON.stringify({ password }),
  });
  await parseAuthResponse(response);
}
