export type SessionState = {
  gameId: string;
  playerId: string;
  nickname?: string;
};

const SESSION_KEY = "hm-session";

function safeWindow() {
  return typeof window === "undefined" ? null : window;
}

export function loadSession(): SessionState | null {
  const w = safeWindow();
  if (!w) return null;
  try {
    const raw = w.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionState;
    if (!parsed.gameId) return null;
    return parsed;
  } catch (err) {
    console.error("loadSession error", err);
    return null;
  }
}

export function saveSession(session: SessionState) {
  const w = safeWindow();
  if (!w) return;
  w.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  const w = safeWindow();
  if (!w) return;
  w.localStorage.removeItem(SESSION_KEY);
}
