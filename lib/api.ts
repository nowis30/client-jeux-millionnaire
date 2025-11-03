export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";

export async function apiFetch<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const status = res.status;
    throw new Error(`Erreur ${status}`);
  }
  // 204 No Content
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}
