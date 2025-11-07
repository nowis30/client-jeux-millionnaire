"use client";
import Link from "next/link";
import { io, Socket } from "socket.io-client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clearSession, loadSession, saveSession } from "../lib/session";
import OnboardingHome from "../components/OnboardingHome";
import { apiFetch, API_BASE } from "../lib/api";
import { formatMoney } from "../lib/format";

type Entry = { playerId: string; nickname: string; netWorth: number };
type GamePlayer = { id: string; nickname: string; cash: number; netWorth: number };
type LobbySummary = { id: string; code: string; status: string; players: number; createdAt: string };

// API_BASE fourni par lib/api
const DEFAULT_STATUS = "lobby";

export default function DashboardPage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("");
  // Vérifier la session utilisateur (auth)
  useEffect(() => {
    (async () => {
      try {
        const me = await apiFetch<{ id: string; email: string; isAdmin: boolean }>("/api/auth/me");
        setIsLoggedIn(true);
        setIsAdmin(!!me.isAdmin);
        setUserEmail(me.email);
      } catch {
        setIsLoggedIn(false);
        setIsAdmin(false);
        setUserEmail("");
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
  // Plus de suivi client: on retire le feed d'événements temps réel
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [portfolioPlayer, setPortfolioPlayer] = useState<GamePlayer | null>(null);
  const [portfolioProps, setPortfolioProps] = useState<any[]>([]);
  const [portfolioMkts, setPortfolioMkts] = useState<any[]>([]);
  const [priceMap, setPriceMap] = useState<Record<string, number>>({});
  const [economy, setEconomy] = useState<{ baseMortgageRate: number; appreciationAnnual: number; schedule: number[] } | null>(null);
  const [proj, setProj] = useState<Array<{ year: number; net: number }>>([]);
  const [projLoading, setProjLoading] = useState(false);
  const [projRequested, setProjRequested] = useState(false);
  const [autoJoinAttempted, setAutoJoinAttempted] = useState(false);
  const [questionStats, setQuestionStats] = useState<{
    remaining?: number;
    remainingByDifficulty?: { easy: number; medium: number; hard: number };
    remainingByCategory?: { finance: number; economy: number; realEstate: number };
    categories?: Array<{ category: string; total?: number; used?: number; remaining: number }>;
  } | null>(null);
  const [showHomeTutorial, setShowHomeTutorial] = useState(false);
  const [inviteAccepted, setInviteAccepted] = useState<string | null>(null);
  const [onlineEmails, setOnlineEmails] = useState<string[]>([]);
  const [socketRef, setSocketRef] = useState<Socket | null>(null);

  useEffect(() => {
    const session = loadSession();
    if (session) {
      setGameId(session.gameId);
      setPlayerId(session.playerId ?? "");
      if (session.nickname) setKnownNickname(session.nickname);
    }
  }, []);

  // Tutoriel d'accueil: afficher une fois
  useEffect(() => {
    try {
      const seen = localStorage.getItem("hm-tutorial-home");
      if (!seen) setShowHomeTutorial(true);
    } catch {}
  }, []);

  // Accepter une invitation via ?invite=CODE quand gameId/playerId connus
  useEffect(() => {
    if (!gameId || !playerId) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("invite");
      if (!code) return;
      if (localStorage.getItem(`hm-invite-accepted-${code}`)) return;
      (async () => {
        try {
          await apiFetch(`/api/games/${gameId}/referrals/accept`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
          localStorage.setItem(`hm-invite-accepted-${code}`, '1');
          setInviteAccepted(code);
        } catch (e) {
          // ignore erreurs d'invite
        }
      })();
    } catch {}
  }, [gameId, playerId]);

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

  // Rejoindre automatiquement la partie globale dès la connexion
  const autoJoinGlobal = useCallback(async () => {
    if (autoJoinAttempted || !isLoggedIn || gameId) return;
    setAutoJoinAttempted(true);
    
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
      setKnownNickname(userEmail);
      refreshSession({ gameId: g.id, playerId: data.playerId, nickname: userEmail });
      setError(null);
      setMessage(`Vous avez rejoint la partie mondiale en tant que ${userEmail}`);
      updateState();
    } catch (err: any) {
      console.error("[AutoJoin] Erreur:", err);
      // Ne pas afficher d'erreur si l'utilisateur existe déjà
    }
  }, [autoJoinAttempted, isLoggedIn, gameId, userEmail, refreshSession, updateState]);

  // Déclencher le auto-join dès que l'utilisateur est connecté
  useEffect(() => {
    autoJoinGlobal();
  }, [autoJoinGlobal]);

  // Connexion Socket.IO légère pour présence et polling online list
  useEffect(() => {
    if (!gameId || !userEmail) return;
    try {
      const s = io(process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3001", {
        transports: ["websocket"],
        query: { gameId, nickname: userEmail },
      });
      setSocketRef(s);
      const poll = async () => {
        try {
          const res = await fetch(`${API_BASE}/api/games/${gameId}/online`);
          if (!res.ok) return;
          const data = await res.json();
          setOnlineEmails(Array.isArray(data.users) ? data.users : []);
        } catch {}
      };
      poll();
      const iv = setInterval(poll, 15000);
      return () => { try { clearInterval(iv); } catch {}; s.close(); setSocketRef(null); };
    } catch {
      // ignore en cas d’échec de connexion socket
    }
  }, [gameId, userEmail]);

  const openPortfolio = useCallback(async (p: GamePlayer) => {
    if (!gameId) return;
    setPortfolioPlayer(p);
    try {
      const [propsRes, mktRes, pricesRes, ecoRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/api/games/${gameId}/properties/holdings/${p.id}`),
        fetch(`${API_BASE}/api/games/${gameId}/markets/holdings/${p.id}`),
        fetch(`${API_BASE}/api/games/${gameId}/markets/latest`),
        fetch(`${API_BASE}/api/games/${gameId}/economy`),
        fetch(`${API_BASE}/api/quiz/public-stats`),
      ]);
      const propsData = propsRes.ok ? await propsRes.json() : { holdings: [] };
      const mktData = mktRes.ok ? await mktRes.json() : { holdings: [] };
      const pricesData = pricesRes.ok ? await pricesRes.json() : { prices: [] };
      const ecoData = ecoRes.ok ? await ecoRes.json() : null;
  const statsData = statsRes.ok ? await statsRes.json() : null;
      setPortfolioProps(propsData.holdings ?? []);
      setPortfolioMkts(mktData.holdings ?? []);
      const pm: Record<string, number> = {};
      for (const p of (pricesData.prices ?? [])) pm[p.symbol] = p.price;
      setPriceMap(pm);
      if (ecoData) setEconomy({ baseMortgageRate: Number(ecoData.baseMortgageRate ?? 0.05), appreciationAnnual: Number(ecoData.appreciationAnnual ?? 0.02), schedule: Array.isArray(ecoData.schedule) ? ecoData.schedule : [] });
      if (statsData) {
        // Support dynamique des catégories: server envoie statsData.categories
        const dynamicCats: Array<{ category: string; total?: number; used?: number; remaining: number }> | undefined = Array.isArray(statsData.categories)
          ? statsData.categories.map((c: any) => ({ category: String(c.category ?? 'autre'), total: Number(c.total ?? 0), used: Number(c.used ?? 0), remaining: Number(c.remaining ?? 0) }))
          : undefined;
        setQuestionStats({
          remaining: Number(statsData.remaining ?? 0),
          remainingByDifficulty: statsData.remainingByDifficulty,
          remainingByCategory: statsData.remainingByCategory,
          categories: dynamicCats,
        });
      }
    } catch (e) {
      // mute
    }
  }, [gameId]);

  // --- Helpers projection portefeuille 10 ans ---
  function computeWeeklyMortgage(principal: number, annualRate: number, years = 25): number {
    const n = Math.max(1, Math.round(52 * years));
    const r = annualRate / 52;
    if (principal <= 0) return 0;
    if (r <= 0) return principal / n;
    const a = r * principal;
    const b = 1 - Math.pow(1 + r, -n);
    return a / b;
  }

  function expectedReturn(symbol: string): number {
    switch (symbol) {
      case "SP500":
      case "VFV":
      case "XLF":
      case "XLE":
      case "IWM":
        return 0.06;
      case "QQQ":
      case "AAPL":
      case "MSFT":
      case "AMZN":
      case "META":
      case "GOOGL":
      case "NVDA":
      case "TSLA":
      case "COST":
        return 0.08;
      case "TSX":
      case "VDY":
        return 0.05;
      case "UPRO":
        return 0.18; // ~3x SP500 (simplifié)
      case "TQQQ":
        return 0.24; // ~3x QQQ (simplifié)
      case "GLD":
        return 0.02;
      case "TLT":
        return 0.03;
      default:
        return 0.05;
    }
  }

  const computeProjection = useCallback(() => {
    if (!portfolioPlayer) { setProj([]); return; }
    const YEARS = 10;
    const sched = (economy?.schedule && economy.schedule.length ? economy.schedule : Array.from({ length: YEARS }, () => 0.02)).slice(0, YEARS);
    const baseRate = economy?.baseMortgageRate ?? 0.05;

    // Immobilier: valeur et dette, amortissement via weeklyPayment si fourni sinon approx par formule
    const immo = (portfolioProps || []).map((h: any) => {
      const value = Number(h.currentValue ?? 0);
      const debt = Number(h.mortgageDebt ?? 0);
      const payW = Number(h.weeklyPayment ?? 0) || computeWeeklyMortgage(debt, baseRate, 25);
      return { value, debt, rate: baseRate, payW };
    });

    // Marchés: valeur initiale par position
    const mkts = (portfolioMkts || []).map((m: any) => {
      const last = priceMap[m.symbol] ?? Number(m.avgPrice ?? 0);
      const val = Number(m.quantity ?? 0) * Number(last ?? 0);
      const er = expectedReturn(String(m.symbol));
      return { value: val, er };
    });

    // Cash: gardé constant (sans intérêt) pour simplicité
    const cash0 = Number(portfolioPlayer.cash ?? 0);

    const out: Array<{ year: number; net: number }>= [];
    const net0 = immo.reduce((s, x) => s + (x.value - x.debt), 0) + mkts.reduce((s, x) => s + x.value, 0) + cash0;
    out.push({ year: 0, net: net0 });
    let immoState = immo.map((x) => ({ ...x }));
    let mktState = mkts.map((x) => ({ ...x }));
    for (let y = 1; y <= YEARS; y++) {
      // Immobilier: amortissement + appréciation annuelle
      for (const s of immoState) {
        const annualPayment = s.payW * 52;
        const interest = s.debt * s.rate;
        const principal = Math.max(0, annualPayment - interest);
        s.debt = Math.max(0, s.debt - principal);
        s.value = s.value * (1 + (sched[y - 1] ?? 0.02));
      }
      // Marchés: croissance composée à retour attendu (total return simplifié)
      for (const s of mktState) s.value = s.value * (1 + s.er);
      const net = immoState.reduce((sum, s) => sum + (s.value - s.debt), 0) + mktState.reduce((sum, s) => sum + s.value, 0) + cash0;
      out.push({ year: y, net });
    }
    setProj(out);
  }, [portfolioPlayer, portfolioProps, portfolioMkts, priceMap, economy]);

  // Ne pas calculer automatiquement: uniquement à la demande
  useEffect(() => {
    if (!projRequested) { setProj([]); return; }
    setProjLoading(true);
    try {
      computeProjection();
    } finally {
      setProjLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projRequested, portfolioPlayer, portfolioProps, portfolioMkts, priceMap, economy]);

  function PortfolioProjectionChart({ data }: { data: { year: number; net: number }[] }) {
    if (!data || data.length === 0) return null;
    const w = 800, h = 200, pad = 28;
    const minY = Math.min(...data.map((d) => d.net));
    const maxY = Math.max(...data.map((d) => d.net));
    const y0 = minY === maxY ? minY * 0.95 : minY * 0.98;
    const y1 = minY === maxY ? maxY * 1.05 : maxY * 1.02;
    const x = (i: number) => pad + (i * (w - pad * 2)) / Math.max(1, data.length - 1);
    const y = (v: number) => h - pad - ((v - y0) * (h - pad * 2)) / Math.max(1, (y1 - y0));
    const points = data.map((d, i) => `${x(i)},${y(d.net)}`).join(" ");
    const fmt = (n: number) => n >= 1_000_000 ? `${(n/1_000_000).toFixed(2)} M$` : n >= 1_000 ? `${(n/1_000).toFixed(1)} k$` : `$${Math.round(n)}`;
    return (
      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-48 bg-neutral-950 border border-neutral-800 rounded">
          <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="#333" />
          <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="#333" />
          <text x={pad} y={pad - 8} fill="#9ca3af" fontSize="10" textAnchor="start">{fmt(y1)}</text>
          <text x={pad} y={h - pad + 12} fill="#9ca3af" fontSize="10" textAnchor="start">{fmt(y0)}</text>
          <polyline fill="none" stroke="#22c55e" strokeWidth={2} points={points} />
        </svg>
      </div>
    );
  }

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
      console.log(`[DEBUG] Calling restart for game ${gid}`);
      await apiFetch(`/api/games/${gid}/restart`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: true }) });
      console.log(`[DEBUG] Restart successful`);
      setMessage("Partie redémarrée avec succès!");
      setError(null);
      // Effacer la session locale pour forcer rechargement
      clearSession();
      setGameId("");
      setPlayerId("");
      setKnownNickname("");
      updateState();
    } catch (err) {
      console.error(`[DEBUG] Restart error:`, err);
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
  const [inviteLink, setInviteLink] = useState<string>("");
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
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

  const createInvite = useCallback(async () => {
    try {
      if (!gameId) throw new Error("Partie introuvable");
      const res = await apiFetch<{ code: string; url: string; reward: number }>(`/api/games/${gameId}/referrals/create`, { method: 'POST' });
  setInviteLink(res.url);
  setInviteMsg(`Lien généré. Récompense: ${formatMoney(res.reward || 1000000)}`);
      if (navigator.share) {
        await navigator.share({ title: 'Rejoins le Millionnaire', text: 'Accepte mon invitation et commençons !', url: res.url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(res.url);
        setInviteMsg((m) => (m ? m + ' — Lien copié' : 'Lien copié'));
      }
    } catch (e: any) {
      setInviteMsg(e?.message || 'Échec de création du lien');
    }
  }, [gameId]);

  // Ne plus faire de polling: un seul chargement + bouton manuel
  useEffect(() => {
    if (!gameId) return;
    updateState();
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
    <>
  <main className="space-y-6 overflow-x-hidden">
      {/* Bandeau prix Amazon 20$ fin d'année */}
      <PrizeBanner />
      {!isLoggedIn ? (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Connexion requise</h2>
          <p className="text-neutral-300">Veuillez vous connecter pour créer ou rejoindre une partie.</p>
          <a href="/login" className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 inline-block">Aller à la page de connexion</a>
        </section>
      ) : (
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Partie Mondiale du Millionnaire</h2>
          <div className="flex items-center gap-3">
            {userEmail && (
              <p className="text-sm text-neutral-400 flex items-center gap-2">
                Connecté: <span className="text-emerald-400 flex items-center gap-1">
                  {onlineEmails.includes(userEmail) && <span className="inline-block w-2 h-2 rounded-full bg-green-500" title="En ligne" />}
                  {userEmail}
                </span>
              </p>
            )}
            {isAdmin && <span className="px-2 py-1 rounded bg-red-700 text-xs font-semibold">ADMIN</span>}
          </div>
        </div>
        {gameId && playerId && (
          <div className="bg-emerald-900/30 border border-emerald-700/50 rounded-lg p-3">
            <p className="text-emerald-300 text-sm">✅ Vous êtes automatiquement inscrit à la partie mondiale !</p>
            <p className="text-neutral-400 text-xs mt-1">Pseudo: {knownNickname || userEmail}</p>
          </div>
        )}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full">
          <button
            onClick={async () => {
              try { await apiFetch<{ ok: boolean }>("/api/auth/logout", { method: "POST" }); } catch {}
              try { if (typeof window !== "undefined") window.localStorage.removeItem("HM_TOKEN"); } catch {}
              clearSession(); setIsLoggedIn(false); setIsAdmin(false); router.replace("/login");
            }}
            className="px-4 py-2 rounded bg-rose-700 hover:bg-rose-600 w-full sm:w-auto"
          >Se déconnecter</button>
          <button onClick={createInvite} className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 w-full sm:w-auto">Inviter un ami (gagne 1M$)</button>
          <button onClick={handleShare} className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 w-full sm:w-auto">Partager le jeu</button>
          <a href={`mailto:?subject=${encodeURIComponent("Rejoins le jeu du Millionnaire")}&body=${encodeURIComponent("Rejoins-moi: " + shareUrl)}`} className="px-4 py-2 rounded bg-indigo-700 hover:bg-indigo-600 text-center w-full sm:w-auto">Inviter par email</a>
        </div>
        {inviteLink && (
          <div className="text-xs text-neutral-300">Lien d'invitation: <a href={inviteLink} className="underline break-all">{inviteLink}</a></div>
        )}
        {(inviteMsg || shareStatus) && <p className="text-xs text-neutral-400">{inviteMsg || shareStatus}</p>}
        {inviteAccepted && <p className="text-xs text-emerald-400">Invitation appliquée. Merci !</p>}
        {message && <p className="text-sm text-emerald-400">{message}</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
      </section>
      )}

      <section>
        <h2 className="text-xl font-semibold">Tableau de bord</h2>
        <p className="text-sm text-neutral-300">Classement (rafraîchissement manuel) — statut: {gameStatus}</p>
        <div className="mt-2 flex gap-2">
          <button onClick={updateState} className="px-3 py-2 rounded bg-neutral-700 hover:bg-neutral-600 text-sm">Actualiser</button>
        </div>
        <div className="mt-4 bg-neutral-900 rounded border border-neutral-800 overflow-x-auto">
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
                  <td className="p-2 flex items-center gap-2">
                    {onlineEmails.includes(e.nickname) && <span className="inline-block w-2 h-2 rounded-full bg-green-500" title="En ligne" />}
                    {e.nickname}
                  </td>
                  <td className="p-2">{formatMoney(e.netWorth)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {players.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold">Joueurs</h3>
          <ul className="mt-2 space-y-2 text-sm text-neutral-300">
            {players.map((p) => (
              <li key={p.id} className="border border-neutral-800 rounded px-3 py-2 bg-neutral-900">
                <div className="text-base font-medium mb-2 flex items-center gap-2">
                  {onlineEmails.includes(p.nickname) && <span className="inline-block w-2 h-2 rounded-full bg-green-500" title="En ligne" />}
                  {p.nickname}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>Cash: {formatMoney(p.cash)} | Net: {formatMoney(p.netWorth)}</span>
                  <div className="flex items-center gap-2">
                    <button
                      title="Voir le portefeuille"
                      onClick={() => openPortfolio(p)}
                      className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-xs"
                    >
                      Voir portefeuille
                    </button>
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

      {/* Activité temps réel retirée (pas de suivi client) */}

      <section className="grid grid-cols-2 sm:grid-cols-5 gap-3 w-full">
        <Link href="/immobilier" className="px-4 py-2 rounded bg-sky-600 hover:bg-sky-500 text-center w-full">Immobilier</Link>
        <Link href="/bourse" className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-center w-full">Bourse</Link>
        <Link href="/listings" className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-center w-full">Annonces</Link>
        <Link href="/summary" className="px-4 py-2 rounded bg-amber-600 hover:bg-amber-500 text-center w-full">Résumé</Link>
        <Link href="/quiz" className="px-4 py-2 rounded bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 font-bold text-center w-full">💰 Quiz</Link>
      </section>

      {portfolioPlayer && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4" onClick={() => setPortfolioPlayer(null)}>
          <div className="w-full max-w-4xl bg-neutral-900 border border-neutral-800 rounded-lg flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
              <h4 className="font-semibold">Portefeuille — {portfolioPlayer.nickname}</h4>
              <div className="flex items-center gap-2">
                {typeof questionStats?.remaining === 'number' && (
                  <span className="text-xs px-2 py-1 rounded bg-emerald-800/50 border border-emerald-700 text-emerald-200">
                    Questions en banque: {questionStats.remaining}
                  </span>
                )}
                {/* Catégories dynamiques si disponibles, sinon fallback 3 catégories */}
                {questionStats?.categories && questionStats.categories.length > 0 ? (
                  <div className="flex items-center gap-1 flex-wrap max-w-[60vw]">
                    {questionStats.categories.slice(0, 5).map((c) => (
                      <span key={c.category} className="text-[10px] px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-neutral-300">
                        {c.category} {c.remaining}
                      </span>
                    ))}
                    {questionStats.categories.length > 5 && (
                      <span className="text-[10px] px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-neutral-300">
                        +{questionStats.categories.length - 5} autres
                      </span>
                    )}
                  </div>
                ) : (
                  questionStats?.remainingByCategory && (
                    <span className="text-[10px] px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-neutral-300">
                      {`Finance ${questionStats.remainingByCategory.finance} · Économie ${questionStats.remainingByCategory.economy} · Immo ${questionStats.remainingByCategory.realEstate}`}
                    </span>
                  )
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 grid gap-4 md:grid-cols-2">
              <div>
                <h5 className="font-semibold mb-2">Immobilier</h5>
                {portfolioProps.length === 0 ? (
                  <p className="text-sm text-neutral-400">Aucun bien.</p>
                ) : (
                  <table className="w-full text-sm bg-neutral-950 border border-neutral-800 rounded">
                    <thead>
                      <tr className="text-left">
                        <th className="p-2">Bien</th>
                        <th className="p-2">Valeur</th>
                        <th className="p-2">Dette</th>
                      </tr>
                    </thead>
                    <tbody>
                      {portfolioProps.map((h: any) => (
                        <tr key={h.id} className="border-t border-neutral-800">
                          <td className="p-2">{h.template?.name ?? 'Bien'}<div className="text-xs text-neutral-500">{h.template?.city ?? ''}</div></td>
                          <td className="p-2">{formatMoney(Number(h.currentValue ?? 0))}</td>
                          <td className="p-2">{formatMoney(Number(h.mortgageDebt ?? 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div>
                <h5 className="font-semibold mb-2">Bourse</h5>
                {portfolioMkts.length === 0 ? (
                  <p className="text-sm text-neutral-400">Aucune position.</p>
                ) : (
                  <table className="w-full text-sm bg-neutral-950 border border-neutral-800 rounded">
                    <thead>
                      <tr className="text-left">
                        <th className="p-2">Actif</th>
                        <th className="p-2">Qté</th>
                        <th className="p-2">Prix moy.</th>
                        <th className="p-2">Valeur</th>
                        <th className="p-2">Gain %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {portfolioMkts.map((m: any) => {
                        const last = priceMap[m.symbol] ?? m.avgPrice;
                        const value = Number(m.quantity ?? 0) * Number(last ?? 0);
                        const avg = Number(m.avgPrice ?? 0) || 0;
                        const gainPct = avg > 0 ? ((Number(last ?? 0) - avg) / avg) * 100 : 0;
                        return (
                          <tr key={m.id} className="border-t border-neutral-800">
                            <td className="p-2">{m.symbol}</td>
                            <td className="p-2">{Number(m.quantity ?? 0).toFixed(2)}</td>
                            <td className="p-2">${Number(m.avgPrice ?? 0).toFixed(2)}</td>
                            <td className="p-2">${value.toFixed(2)}</td>
                            <td className="p-2">
                              <span className={gainPct >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                                {gainPct.toFixed(2)}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
              </div>
              <div className="px-4 pb-4">
                <div className="mt-2 space-y-2">
                  <button
                    className="px-3 py-2 rounded bg-neutral-700 hover:bg-neutral-600 text-sm"
                    onClick={() => setProjRequested(true)}
                    disabled={projRequested && projLoading}
                  >
                    {projRequested ? (projLoading ? "Calcul en cours…" : "Recalculer la projection") : "Afficher la projection 10 ans"}
                  </button>
                  {projRequested && proj.length > 0 && (
                    <>
                      <div className="flex items-baseline justify-between">
                        <h5 className="font-semibold">Projection 10 ans (valeur nette totale)</h5>
                        <span className="text-xs text-neutral-400">de {formatMoney(Math.round(proj[0].net))} à {formatMoney(Math.round(proj[proj.length - 1].net))}</span>
                      </div>
                      <PortfolioProjectionChart data={proj} />
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-neutral-800 flex justify-center">
              <button onClick={() => setPortfolioPlayer(null)} className="px-4 py-2 rounded bg-neutral-700 hover:bg-neutral-600 text-sm">Fermer</button>
            </div>
          </div>
        </div>
      )}
    </main>
    {showHomeTutorial && (
      <OnboardingHome onClose={() => setShowHomeTutorial(false)} />
    )}
  </>
  );
}

  function PrizeBanner() {
    const target = new Date('2025-12-31T23:00:00-05:00');
    const [now, setNow] = useState<Date>(() => new Date());
    useEffect(() => {
      const id = setInterval(() => setNow(new Date()), 60000);
      return () => clearInterval(id);
    }, []);
    if (now > target) return null;
    const diffMs = target.getTime() - now.getTime();
    const days = Math.max(0, Math.floor(diffMs / (1000*60*60*24)));
    return (
      <div className="rounded-lg border border-amber-600 bg-gradient-to-r from-amber-700/60 to-yellow-700/50 p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2 shadow">
        <div className="text-sm md:text-base font-semibold text-amber-100 flex items-center gap-2">
          <span>🏆 Prix spécial: Carte cadeau Amazon 20$ attribuée le 31 décembre 2025 au joueur #1 (valeur nette).</span>
        </div>
        <div className="text-xs text-amber-200 flex items-center gap-3">
          <span>Compte à rebours: {days} jour{days!==1?'s':''}</span>
          <Link href="/quiz" className="px-3 py-1 rounded bg-amber-500 hover:bg-amber-400 text-black font-medium text-xs">Booster ton net</Link>
        </div>
      </div>
    );
  }
