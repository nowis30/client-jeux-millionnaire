export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(?:^|; )" + name.replace(/([.$?*|{}()\[\]\\\/\+^])/g, "\\$1") + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}

export async function apiFetch<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const csrf = typeof window !== "undefined" ? readCookie("hm_csrf") : null;
  const headers: Record<string, string> = { ...(init.headers as any) };
  if (csrf) headers["x-csrf-token"] = csrf;
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...init,
    headers,
  });
  if (!res.ok) {
    const status = res.status;
    throw new Error(`Erreur ${status}`);
  }
  // 204 No Content
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}
