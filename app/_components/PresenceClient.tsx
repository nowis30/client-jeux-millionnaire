"use client";
import { useEffect } from "react";
import { loadSession, saveSession } from "../../lib/session";
import { apiFetch } from "../../lib/api";

export default function PresenceClient() {
  useEffect(() => {
    let mounted = true;
    let interval: ReturnType<typeof setInterval> | undefined;

    const start = async () => {
      try {
        const me = await apiFetch<{ email: string }>("/api/auth/me");
        if (!mounted || !me?.email) return;
        let { gameId, playerId, nickname } = loadSession() || { gameId: "", playerId: "", nickname: "" };
        if (!gameId || !playerId) {
          const list = await apiFetch<{ games: { id: string }[] }>("/api/games");
          const game = list.games?.[0];
          if (!game) return;
          const joined = await apiFetch<{ playerId: string }>(`/api/games/${game.id}/join`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
          gameId = game.id;
          playerId = joined.playerId;
          nickname = me.email;
          saveSession({ gameId, playerId, nickname });
        }

        const heartbeat = () => apiFetch(`/api/games/${gameId}/presence`, { method: "POST" }).catch(() => null);
        await heartbeat();
        interval = setInterval(heartbeat, 20_000);
      } catch {}
    };

    void start();
    return () => {
      mounted = false;
      if (interval) clearInterval(interval);
    };
  }, []);

  return null;
}
