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
  const [nickname, setNickname] = useState("");
  const [gameStatus, setGameStatus] = useState(DEFAULT_STATUS);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [gameCodeInput, setGameCodeInput] = useState("");
  const [lobbies, setLobbies] = useState<LobbySummary[]>([]);
  const [knownNickname, setKnownNickname] = useState("");
  const [events, setEvents] = useState<Array<{ at: string; text: string }>>([]);

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

  const loadLobbies = useCallback(async () => {
    try {
      const data = await apiFetch<{ games: LobbySummary[] }>(`/api/games?status=lobby`);
      setLobbies(data.games ?? []);
    } catch (err) {
      console.warn("Impossible de récupérer les lobbies", err);
    }
  }, []);

  useEffect(() => {
    loadLobbies();
    const timer = setInterval(loadLobbies, 30_000);
    return () => clearInterval(timer);
  }, [loadLobbies]);

  const handleCreate = useCallback(async () => {
    try {
      const payload: any = nickname ? { hostNickname: nickname } : {};
      const data = await apiFetch<{ id: string; code: string; status: string; playerId?: string }>(`/api/games`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setGameId(data.id);
      setGameStatus(data.status);
      setPlayers([]);
      setPlayerId(data.playerId ?? "");
      setGameCode(data.code);
      refreshSession({ gameId: data.id, playerId: data.playerId ?? "", nickname: nickname || knownNickname });
      setMessage(`Partie créée avec le code ${data.code}${data.playerId ? " et joueur associé" : ""}`);
      setError(null);
      loadLobbies();
    } catch (err) {
      setMessage(null);
      setError(err instanceof Error ? err.message : "Impossible de créer la partie");
    }
  }, [loadLobbies, refreshSession]);

  const handleJoin = useCallback(async () => {
    if (!gameId || !nickname) {
      setError("Fournissez gameId et pseudo");
      return;
    }
    try {
      const data = await apiFetch<{ playerId: string; code: string }>(`/api/games/${gameId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname }),
      });
      setPlayerId(data.playerId);
      setKnownNickname(nickname);
      setNickname("");
      refreshSession({ gameId, playerId: data.playerId, nickname });
      setError(null);
      setMessage(`Rejoint la partie ${data.code}`);
      updateState();
      loadLobbies();
    } catch (err) {
      setMessage(null);
      setError(err instanceof Error ? err.message : "Impossible de rejoindre la partie");
    }
  }, [gameId, nickname, updateState, refreshSession, loadLobbies]);

  const handleJoinByCode = useCallback(async () => {
    if (!gameCodeInput || !nickname) {
      setError("Fournissez le code et un pseudo");
      return;
    }
    try {
      const data = await apiFetch<{ playerId: string; gameId: string; code: string }>(`/api/games/code/${gameCodeInput}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname }),
      });
      setGameId(data.gameId);
      setPlayerId(data.playerId);
      setGameCode(data.code);
      setKnownNickname(nickname);
      setNickname("");
      refreshSession({ gameId: data.gameId, playerId: data.playerId, nickname });
      setError(null);
      setMessage(`Rejoint la partie ${data.code}`);
      updateState();
      loadLobbies();
    } catch (err) {
      setMessage(null);
      setError(err instanceof Error ? err.message : "Impossible de rejoindre par code");
    }
  }, [gameCodeInput, nickname, refreshSession, updateState, loadLobbies]);

  const handleStart = useCallback(async () => {
    if (!gameId) return;
    try {
  const data = await apiFetch<{ status: string }>(`/api/games/${gameId}/start`, { method: "POST" });
      setGameStatus(data.status);
      setError(null);
      setMessage("Partie démarrée");
      updateState();
      loadLobbies();
    } catch (err) {
      setMessage(null);
      setError(err instanceof Error ? err.message : "Impossible de démarrer la partie");
    }
  }, [gameId, updateState, loadLobbies]);

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
      loadLobbies();
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
  }, [gameId, loadLobbies, updateState]);

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
        <h2 className="text-xl font-semibold">Gestion de partie</h2>
  <div className="flex flex-wrap gap-3 items-end">
          <button onClick={handleCreate} className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500">Créer une partie</button>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <input
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              placeholder="Game ID"
              className="px-3 py-2 rounded bg-neutral-900 border border-neutral-700 text-sm"
            />
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Pseudo"
              className="px-3 py-2 rounded bg-neutral-900 border border-neutral-700 text-sm"
            />
            <button onClick={handleJoin} className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500">Rejoindre (ID)</button>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <input
              value={gameCodeInput}
              onChange={(e) => setGameCodeInput(e.target.value.toUpperCase())}
              placeholder="Code (ABC123)"
              className="px-3 py-2 rounded bg-neutral-900 border border-neutral-700 text-sm uppercase"
            />
            <button onClick={handleJoinByCode} className="px-4 py-2 rounded bg-sky-600 hover:bg-sky-500">Rejoindre (code)</button>
          </div>
          <button onClick={handleStart} disabled={!gameId || !isAdmin} className="px-4 py-2 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-50">Démarrer (admin)</button>
          <button onClick={handleClearSession} className="px-4 py-2 rounded bg-neutral-700 hover:bg-neutral-600">Effacer session</button>
          <button
            onClick={async () => {
              try {
                await apiFetch<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
              } catch {}
              // Nettoyage local et redirection login
              clearSession();
              setIsLoggedIn(false);
              setIsAdmin(false);
              router.replace("/login");
            }}
            className="px-4 py-2 rounded bg-rose-700 hover:bg-rose-600"
          >
            Se déconnecter
          </button>
        </div>
        {gameCode && <p className="text-sm text-neutral-300">Code de partie: <span className="font-mono text-lg">{gameCode}</span></p>}
        {playerId && <p className="text-xs text-neutral-400">Votre playerId: {playerId}</p>}
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
              <li key={p.id} className="flex justify-between border border-neutral-800 rounded px-3 py-2 bg-neutral-900">
                <span>{p.nickname}</span>
                <span>Cash: ${p.cash.toLocaleString()} | Net: ${p.netWorth.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {lobbies.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-lg font-semibold">Lobbies publics</h3>
          <div className="grid gap-2 md:grid-cols-2">
            {lobbies.map((lobby) => (
              <article key={lobby.id} className="border border-neutral-800 rounded bg-neutral-900 p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Code {lobby.code}</span>
                  <span className="text-xs text-neutral-400">{new Date(lobby.createdAt).toLocaleTimeString()}</span>
                </div>
                <p className="text-sm text-neutral-300">Joueurs: {lobby.players}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setGameId(lobby.id);
                      setGameCode(lobby.code);
                      refreshSession({ gameId: lobby.id });
                    }}
                    className="px-3 py-2 rounded bg-neutral-700 hover:bg-neutral-600 text-sm"
                  >
                    Utiliser l'ID
                  </button>
                  <button
                    onClick={() => setGameCodeInput(lobby.code)}
                    className="px-3 py-2 rounded bg-sky-600 hover:bg-sky-500 text-sm"
                  >
                    Copier le code
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

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
