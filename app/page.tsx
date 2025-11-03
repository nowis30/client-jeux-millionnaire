"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { clearSession, loadSession, saveSession } from "../lib/session";
import { apiFetch, API_BASE } from "../lib/api";

type Entry = { playerId: string; nickname: string; netWorth: number };
type GamePlayer = { id: string; nickname: string; cash: number; netWorth: number };
type LobbySummary = { id: string; code: string; status: string; players: number; createdAt: string };

// API_BASE fourni par lib/api
const DEFAULT_STATUS = "lobby";

export default function DashboardPage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  // Vérifier la session utilisateur (auth)
  useEffect(() => {
    (async () => {
      try {
        const me = await apiFetch<{ id: string; email: string; isAdmin: boolean }>("/api/auth/me");
        setIsLoggedIn(true);
        setIsAdmin(!!me.isAdmin);
      } catch {
        setIsLoggedIn(false);
        setIsAdmin(false);
        // Redirection automatique vers /login si non connecté
        router.replace("/login");
      }
    })();
  }, [router]);
  const [leaderboard, setLeaderboard] = useState<Entry[]>([]);
  const [gameId, setGameId] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [gameCode, setGameCode] = useState("");
  // Pseudo n'est plus saisi: il sera l'email de l'utilisateur connecté
  const [gameStatus, setGameStatus] = useState(DEFAULT_STATUS);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [gameCodeInput, setGameCodeInput] = useState("");
  const [lobbies, setLobbies] = useState<LobbySummary[]>([]);
  const [knownNickname, setKnownNickname] = useState("");
  const [events, setEvents] = useState<Array<{ at: string; text: string }>>([]);
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  useEffect(() => {
    const session = loadSession();
    if (session) {
      setGameId(session.gameId);
      setPlayerId(session.playerId ?? "");
      if (session.nickname) setKnownNickname(session.nickname);
    }
  }, []);

  // La connexion socket est initialisée après la définition des callbacks

  const refreshSession = useCallback(
    (partial?: Partial<{ gameId: string; playerId: string; nickname: string }>) => {
      const next = {
        gameId: partial?.gameId ?? gameId,
        playerId: partial?.playerId ?? playerId,
        nickname: partial?.nickname ?? knownNickname,
      };
      if (next.gameId) saveSession(next);
    },
    [gameId, playerId, knownNickname]
  );

  const updateState = useCallback(async () => {
    if (!gameId) return;
    try {
  const data = await apiFetch<{ status: string; players: GamePlayer[]; code: string }>(`/api/games/${gameId}/state`);
      setGameStatus(data.status);
      setPlayers(data.players ?? []);
      setGameCode(data.code ?? "");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de récupération de l'état");
    }
  }, [gameId]);

  // Partie unique: plus de lobbies à charger

  // Partie unique: bouton "Rejoindre la partie" -> récupère GLOBAL et rejoint
  const handleJoinGlobal = useCallback(async () => {
    try {
      const list = await apiFetch<{ games: { id: string; code: string; status: string }[] }>(`/api/games`);
      const g = list.games?.[0];
      if (!g) throw new Error("Partie introuvable");
      const data = await apiFetch<{ playerId: string; code: string }>(`/api/games/${g.id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      setGameId(g.id);
      setPlayerId(data.playerId);
      setGameCode(g.code);
      refreshSession({ gameId: g.id, playerId: data.playerId });
      setError(null);
      setMessage(`Rejoint la partie ${g.code}`);
      updateState();
    } catch (err: any) {
      setMessage(null);
      setError(err instanceof Error ? err.message : "Impossible de rejoindre la partie");
    }
  }, [refreshSession, updateState]);

  // Ancien join par gameId: inutile en mode partie unique

  // Ancien join par code: retiré

  // Actions admin (start/restart)
  const adminStart = useCallback(async () => {
    try {
      let gid = gameId;
      if (!gid) {
        const list = await apiFetch<{ games: { id: string }[] }>("/api/games");
        gid = list.games?.[0]?.id ?? "";
        if (!gid) throw new Error("Partie introuvable");
        setGameId(gid);
      }
      await apiFetch(`/api/games/${gid}/start`, { method: "POST" });
      setMessage("Partie démarrée");
      updateState();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du démarrage");
    }
  }, [gameId, updateState]);

  const adminRestart = useCallback(async () => {
    try {
      if (!window.confirm("Redémarrer la partie effacera joueurs, annonces, positions et historique. Continuer ?")) return;
      let gid = gameId;
      if (!gid) {
        const list = await apiFetch<{ games: { id: string }[] }>("/api/games");
        gid = list.games?.[0]?.id ?? "";
        if (!gid) throw new Error("Partie introuvable");
        setGameId(gid);
      }
      await apiFetch(`/api/games/${gid}/restart`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: true }) });
      setMessage("Partie redémarrée");
      setError(null);
      updateState();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du redémarrage");
    }
  }, [gameId, updateState]);

  const handleClearSession = useCallback(() => {
    clearSession();
    setGameId("");
    setPlayerId("");
    setKnownNickname("");
    setGameCode("");
    setPlayers([]);
    setLeaderboard([]);
    setGameStatus(DEFAULT_STATUS);
    setMessage("Session effacée");
  }, []);

  const shareUrl = typeof window !== "undefined" ? window.location.origin : "";
  const handleShare = useCallback(async () => {
    const url = shareUrl;
    const title = "Rejoins le jeu du Millionnaire";
    const text = "Clique pour te connecter et rejoindre la partie globale.";
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        setShareStatus("Lien partagé");
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setShareStatus("Lien copié dans le presse-papiers");
      } else {
        setShareStatus("Partage non supporté. Copiez l'URL du navigateur.");
      }
    } catch (e) {
      setShareStatus("Partage annulé");
    }
  }, [shareUrl]);

  useEffect(() => {
    if (!gameId) return;
    updateState();
    const timer = setInterval(updateState, 10_000);
    return () => clearInterval(timer);
  }, [gameId, updateState]);

  // Socket: classement et mises à jour lobby en temps réel
  useEffect(() => {
  const socket: Socket = io(API_BASE, { withCredentials: true, ...(gameId ? { query: { gameId } } : {}) });
    socket.on("hourly-tick", (payload: { leaderboard: Entry[] }) => {
      setLeaderboard(payload.leaderboard);
    });
    socket.on("lobby-update", () => {
      if (gameId) updateState();
    });
    socket.on("event-feed", (e: any) => {
      const text = (() => {
        if (e.type === "property:purchase") return `Achat immobilier (template ${e.templateId})`;
        if (e.type === "property:refinance") return `Refinancement propriété ${e.holdingId} à ${(e.newRate * 100).toFixed(2)}%`;
        if (e.type === "property:sell") return `Vente propriété ${e.holdingId} (+$${Number(e.proceeds ?? 0).toLocaleString()})`;
        if (e.type === "market:buy") return `Achat ${e.quantity} ${e.symbol} @ $${Number(e.price ?? 0).toFixed(2)}`;
        if (e.type === "market:sell") return `Vente ${e.quantity} ${e.symbol} @ $${Number(e.price ?? 0).toFixed(2)}`;
        if (e.type === "listing:create") return `Nouvelle annonce publiée`;
        if (e.type === "listing:cancel") return `Annonce annulée`;
        if (e.type === "listing:accept") return `Annonce acceptée (achat)`;
        return e.type ?? "événement";
      })();
      setEvents((prev) => [{ at: e.at ?? new Date().toISOString(), text }, ...prev].slice(0, 20));
    });
    if (gameId) socket.emit("join-game", gameId);
    return () => {
      socket.disconnect();
    };
  }, [gameId, updateState]);

  // Tente de récupérer mon joueur courant si playerId manquant
  useEffect(() => {
    if (!gameId || playerId) return;
    (async () => {
      try {
        try {
          const data = await apiFetch<{ player: { id: string; nickname: string } }>(`/api/games/${gameId}/me`);
          setPlayerId(data.player.id);
          if (data.player.nickname) setKnownNickname(data.player.nickname);
          refreshSession({ gameId, playerId: data.player.id, nickname: data.player.nickname });
        } catch {}
      } catch {}
    })();
  }, [gameId, playerId, refreshSession]);

  const displayedLeaderboard = useMemo(() => {
    if (leaderboard.length > 0) return leaderboard;
    return players
      .map((p) => ({ playerId: p.id, nickname: p.nickname, netWorth: p.netWorth }))
      .sort((a, b) => b.netWorth - a.netWorth);
  }, [leaderboard, players]);

  return (
    <main className="space-y-6">
      {!isLoggedIn ? (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Connexion requise</h2>
          <p className="text-neutral-300">Veuillez vous connecter pour créer ou rejoindre une partie.</p>
          <a href="/login" className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 inline-block">Aller à la page de connexion</a>
        </section>
      ) : (
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Rejoindre la partie mondiale</h2>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <button onClick={handleJoinGlobal} className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500">Rejoindre (pseudo = votre email)</button>
          <button onClick={handleClearSession} className="px-4 py-2 rounded bg-neutral-700 hover:bg-neutral-600">Effacer session</button>
          <button
            onClick={async () => {
              try { await apiFetch<{ ok: boolean }>("/api/auth/logout", { method: "POST" }); } catch {}
              try { if (typeof window !== "undefined") window.localStorage.removeItem("HM_TOKEN"); } catch {}
              clearSession(); setIsLoggedIn(false); setIsAdmin(false); router.replace("/login");
            }}
            className="px-4 py-2 rounded bg-rose-700 hover:bg-rose-600"
          >Se déconnecter</button>
          <button onClick={handleShare} className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500">Partager le jeu</button>
          <a href={`mailto:?subject=${encodeURIComponent("Rejoins le jeu du Millionnaire")}&body=${encodeURIComponent("Rejoins-moi: " + shareUrl)}`} className="px-4 py-2 rounded bg-indigo-700 hover:bg-indigo-600 text-center">Inviter par email</a>
        </div>
        {shareStatus && <p className="text-xs text-neutral-400">{shareStatus}</p>}
        {/* Ne plus afficher le code ou les identifiants */}
        {/* Ne plus afficher le playerId technique */}
        {knownNickname && <p className="text-xs text-neutral-400">Pseudo enregistré: {knownNickname}</p>}
        {message && <p className="text-sm text-emerald-400">{message}</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
      </section>
      )}

      <section>
        <h2 className="text-xl font-semibold">Tableau de bord</h2>
        <p className="text-sm text-neutral-300">Classement en temps réel (statut: {gameStatus})</p>
        <div className="mt-4 bg-neutral-900 rounded border border-neutral-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="p-2">#</th>
                <th className="p-2">Joueur</th>
                <th className="p-2">Valeur nette</th>
              </tr>
            </thead>
            <tbody>
              {displayedLeaderboard.map((e, i) => (
                <tr key={e.playerId} className="border-t border-neutral-800">
                  <td className="p-2">{i + 1}</td>
                  <td className="p-2">{e.nickname}</td>
                  <td className="p-2">${e.netWorth.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {players.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold">Joueurs</h3>
          <ul className="mt-2 space-y-1 text-sm text-neutral-300">
            {players.map((p) => (
              <li key={p.id} className="flex items-center justify-between border border-neutral-800 rounded px-3 py-2 bg-neutral-900 gap-3">
                <span>{p.nickname}</span>
                <div className="flex items-center gap-2">
                  <span>Cash: ${p.cash.toLocaleString()} | Net: ${p.netWorth.toLocaleString()}</span>
                  {isAdmin && (
                    <button
                      title="Supprimer ce joueur"
                      onClick={async () => {
                        if (!gameId) return;
                        if (!window.confirm(`Supprimer ${p.nickname} ? Tous ses biens, annonces et positions seront effacés.`)) return;
                        try {
                          await apiFetch(`/api/games/${gameId}/players/${p.id}`, { method: 'DELETE' });
                          setMessage(`Joueur supprimé: ${p.nickname}`);
                          updateState();
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'Échec de suppression');
                        }
                      }}
                      className="px-2 py-1 rounded bg-red-700 hover:bg-red-600 text-xs"
                    >
                      Poubelle
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isAdmin && (
        <section className="space-y-2 border border-red-900/40 bg-red-950/20 rounded p-3">
          <h3 className="text-lg font-semibold text-red-300">Admin</h3>
          <p className="text-sm text-red-200/80">Contrôles réservés à l'administrateur. Le redémarrage efface toutes les données de la partie.</p>
          <div className="flex gap-2">
            <button onClick={adminStart} className="px-3 py-2 rounded bg-orange-600 hover:bg-orange-500 text-sm">Démarrer</button>
            <button onClick={adminRestart} className="px-3 py-2 rounded bg-red-700 hover:bg-red-600 text-sm">Redémarrer (destructif)</button>
          </div>
        </section>
      )}

      {/* Lobbies publics supprimés en mode partie unique */}

      {events.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-lg font-semibold">Activité</h3>
          <ul className="text-sm space-y-1">
            {events.map((ev, idx) => (
              <li key={idx} className="border border-neutral-800 rounded bg-neutral-900 px-3 py-2 flex justify-between">
                <span>{ev.text}</span>
                <span className="text-xs text-neutral-400">{new Date(ev.at).toLocaleTimeString()}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex gap-4">
        <Link href="/immobilier" className="px-4 py-2 rounded bg-sky-600 hover:bg-sky-500">Immobilier</Link>
        <Link href="/bourse" className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500">Bourse</Link>
        <Link href="/listings" className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500">Annonces</Link>
        <Link href="/summary" className="px-4 py-2 rounded bg-amber-600 hover:bg-amber-500">Résumé</Link>
      </section>
    </main>
  );
}
