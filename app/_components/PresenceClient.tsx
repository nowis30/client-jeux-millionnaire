"use client";
import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { loadSession, saveSession } from "../../lib/session";
import { apiFetch, API_BASE } from "../../lib/api";

export default function PresenceClient() {
  const socketRef = useRef<Socket | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // 1) Récupérer l'email (sert de nickname)
        const me = await apiFetch<{ id: string; email: string }>("/api/auth/me").catch(() => null as any);
        if (!mounted || !me?.email) return;

        // 2) Récupérer/assurer un gameId et playerId via la session locale
        let { gameId, playerId, nickname } = loadSession() || { gameId: "", playerId: "", nickname: "" };
        if (!gameId || !playerId) {
          // Partie globale
          const list = await apiFetch<{ games: { id: string; code: string; status: string }[] }>(`/api/games`).catch(() => null as any);
          const g = list?.games?.[0];
          if (g) {
            const joined = await apiFetch<{ playerId: string; code: string }>(`/api/games/${g.id}/join`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({}),
            }).catch(() => null as any);
            if (joined?.playerId) {
              gameId = g.id; playerId = joined.playerId; nickname = me.email;
              saveSession({ gameId, playerId, nickname });
            }
          }
        }
        if (!gameId) return;

        // 3) Ouvrir un socket de présence pour TOUTES les pages
        const s = io(process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3001", {
          transports: ["websocket"],
          query: { gameId, nickname: me.email },
        });
        socketRef.current = s;
        setReady(true);

        // Optionnel: forcer le join si la query n'a pas pris effet
        s.emit("join-game", gameId, me.email);
      } catch {
        // no-op
      }
    })();

    return () => {
      mounted = false;
      try { socketRef.current?.close(); } catch {}
      socketRef.current = null;
    };
  }, []);

  // Pas d'UI, juste un ancrage logique
  return ready ? null : null;
}
