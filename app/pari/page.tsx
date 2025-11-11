"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { API_BASE, apiFetch, ApiError } from "../../lib/api";
import { initializeAds, showRewardedAdForReward, isRewardedAdReady, getRewardedAdCooldown, isAdsSupported } from "../../lib/ads";
const MIN_BET = 5000; 
const DYN_FACTOR = 0.5; // 50% du cash comme plafond dynamique côté client (indicatif) 
const AUTO_ROLL_MIN_DELAY_MS = 2500; // Délai minimum entre deux lancers auto

interface RollResult {
  dice: number[];
  combination: string;
  description: string;
  bet: number;
  gain: number;
  netResult: number;
  finalCash: number;
  ts?: number; // timestamp
}

export default function PariPage() {
  const [gameId, setGameId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [cash, setCash] = useState<number | null>(null);
  const [pariTokens, setPariTokens] = useState<number>(0);
  const [nextTokenSec, setNextTokenSec] = useState<number>(0);
  const [bet, setBet] = useState<number>(MIN_BET);
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState<RollResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [animDice, setAnimDice] = useState<[number,number,number] | null>(null);
  const [history, setHistory] = useState<RollResult[]>([]);
  const [cooldown, setCooldown] = useState<number>(0); // ms remaining
  const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [autoRoll, setAutoRoll] = useState(false);
  const [autoCountdown, setAutoCountdown] = useState<number>(0);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoRollRef = useRef(false);
  const rollingRef = useRef(false);
  const pariTokensRef = useRef(0);
  const cooldownStateRef = useRef(0);
  const nextTokenSecRef = useRef(0);
  const dynamicCap = cash != null ? Math.min(1_000_000_000, Math.max(MIN_BET, Math.floor(Math.max(0, cash) * DYN_FACTOR))) : null;
  const [adReady, setAdReady] = useState(false);
  const [adCooldown, setAdCooldown] = useState(0);
  const [adLoading, setAdLoading] = useState(false);
  const [adMessage, setAdMessage] = useState<string | null>(null);
  const [adErrorMessage, setAdErrorMessage] = useState<string | null>(null);
  const [adsSupported, setAdsSupported] = useState<boolean>(false);

  // Charger historique depuis localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('pari-history');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setHistory(arr.slice(0,100));
      }
    } catch {}
  }, []);

  // Persister historique
  useEffect(() => {
    try {
      localStorage.setItem('pari-history', JSON.stringify(history.slice(0,100)));
    } catch {}
  }, [history]);

  // Gestion cooldown countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown(prev => prev - 200);
    }, 200);
    return () => clearInterval(interval);
  }, [cooldown]);

  useEffect(() => {
    autoRollRef.current = autoRoll;
    if (!autoRoll) {
      clearAutoTimers();
    }
  }, [autoRoll]);

  useEffect(() => { rollingRef.current = rolling; }, [rolling]);
  useEffect(() => { pariTokensRef.current = pariTokens; }, [pariTokens]);
  useEffect(() => { cooldownStateRef.current = cooldown; }, [cooldown]);
  useEffect(() => { nextTokenSecRef.current = nextTokenSec; }, [nextTokenSec]);

  useEffect(() => {
    return () => {
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
      if (autoCountdownRef.current) clearInterval(autoCountdownRef.current);
    };
  }, []);

  useEffect(() => {
    void initializeAds();
    setAdsSupported(isAdsSupported());
  }, []);

  useEffect(() => {
    let cancelled = false;
    const update = async () => {
      try {
        const ready = await isRewardedAdReady();
        if (!cancelled) setAdReady(ready);
        if (!cancelled) {
          const pluginCooldown = getRewardedAdCooldown();
          if (pluginCooldown > 0) {
            setAdCooldown(prev => Math.max(prev, pluginCooldown));
          }
        }
      } catch {}
    };
    update();
    const interval = setInterval(update, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  useEffect(() => {
    if (adCooldown <= 0) return;
    const timer = setInterval(() => {
      setAdCooldown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [adCooldown > 0]);

  function clearAutoTimers() {
    if (autoTimerRef.current) {
      clearTimeout(autoTimerRef.current);
      autoTimerRef.current = null;
    }
    if (autoCountdownRef.current) {
      clearInterval(autoCountdownRef.current);
      autoCountdownRef.current = null;
    }
    setAutoCountdown(0);
  }

  function scheduleAutoRoll(customDelay?: number) {
    if (!autoRollRef.current) return;
    clearAutoTimers();

    let delay = customDelay ?? AUTO_ROLL_MIN_DELAY_MS;
    if (cooldownStateRef.current > 0) {
      delay = Math.max(delay, cooldownStateRef.current + 500);
    }

    if (pariTokensRef.current <= 0) {
      if (nextTokenSecRef.current > 0) {
        delay = Math.max(delay, nextTokenSecRef.current * 1000 + 500);
      } else {
        setAutoRoll(false);
        setError(prev => prev ?? "Auto-roll arrêté (plus de tokens).");
        return;
      }
    }

    const start = Date.now();
    setAutoCountdown(delay);
    autoTimerRef.current = setTimeout(() => {
      autoTimerRef.current = null;
      if (autoCountdownRef.current) {
        clearInterval(autoCountdownRef.current);
        autoCountdownRef.current = null;
      }
      setAutoCountdown(0);
      if (!autoRollRef.current) return;

      if (rollingRef.current) {
        scheduleAutoRoll(500);
        return;
      }

      if (pariTokensRef.current <= 0) {
        if (nextTokenSecRef.current > 0) {
          scheduleAutoRoll(Math.max(AUTO_ROLL_MIN_DELAY_MS, nextTokenSecRef.current * 1000 + 500));
          return;
        }
        setAutoRoll(false);
        setError(prev => prev ?? "Auto-roll arrêté (plus de tokens).");
        return;
      }

      void play();
    }, delay);

    autoCountdownRef.current = setInterval(() => {
      const remaining = Math.max(0, delay - (Date.now() - start));
      setAutoCountdown(remaining);
    }, 200);
  }

  const ensureSession = useCallback(async () => {
    try {
      const raw = localStorage.getItem('hm-session');
      console.log('[Pari] session localStorage:', raw);
      if (raw) {
        const s = JSON.parse(raw);
        if (s?.gameId) {
          setGameId(s.gameId);
          setPlayerId(s.playerId);
          return true;
        }
      }
      console.warn('[Pari] Pas de session — fallback auto-join');
      const list = await apiFetch<{ games: { id: string; code: string; status: string }[] }>(`/api/games`);
      const g = list.games?.[0];
      if (!g) throw new Error('Aucune partie disponible');
      const joined = await apiFetch<{ playerId: string; code: string }>(`/api/games/${g.id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const sess = { gameId: g.id, playerId: joined.playerId, nickname: '' };
      try { localStorage.setItem('hm-session', JSON.stringify(sess)); } catch {}
      setGameId(g.id);
      setPlayerId(joined.playerId);
      console.log('[Pari] Auto-join OK');
      return true;
    } catch (e:any) {
      console.error('[Pari] ensureSession erreur:', e.message);
      return false;
    }
  }, []);

  useEffect(() => { (async () => { await ensureSession(); })(); }, [ensureSession]);

  const refreshPariStatus = useCallback(async () => {
    if (!gameId || !playerId) return;
    try {
      const data = await apiFetch<{ pari?: { tokens?: number; secondsUntilNext?: number; adCooldownSeconds?: number } }>(
        `/api/games/${gameId}/tokens`,
        { headers: { 'X-Player-ID': playerId } }
      );
      const t = Number(data?.pari?.tokens ?? 0);
      const s = Number(data?.pari?.secondsUntilNext ?? 0);
      setPariTokens(t);
      setNextTokenSec(s);
      if (typeof data?.pari?.adCooldownSeconds === 'number') {
        setAdCooldown(prev => Math.max(prev, Number(data.pari!.adCooldownSeconds)));
      }
    } catch (e: any) {
      console.warn('[Pari] /tokens erreur', e?.message ?? e);
    }
  }, [gameId, playerId]);

  // Charger infos joueur si gameId et playerId connus
  useEffect(() => {
    if (!gameId || !playerId) return;
    (async () => {
      try {
        const headers: Record<string,string> = { 'X-Player-ID': playerId };
        const res = await fetch(`${API_BASE}/api/games/${gameId}/me`, { headers, credentials:'include' });
        if (!res.ok) return;
        const data = await res.json();
        if (data.player?.cash != null) setCash(data.player.cash);
      } catch (e:any) {
        console.warn('[Pari] /me erreur', e.message);
      }
    })();
  }, [gameId, playerId]);

  // Charger statut tokens Pari
  useEffect(() => {
    if (!gameId || !playerId) return;
    let mounted = true;
    const load = async () => {
      if (!mounted) return;
      await refreshPariStatus();
    };
    void load();
    const iv = setInterval(load, 15000);
    return () => { mounted = false; clearInterval(iv); };
  }, [gameId, playerId, refreshPariStatus]);

  function adjustBet(v: number) {
    setBet(prev => {
      const next = Math.max(MIN_BET, v);
      if (cash != null) {
        const cap = dynamicCap != null ? Math.min(dynamicCap, cash) : cash;
        return Math.min(next, cap);
      }
      return next;
    });
  }

  const handleWatchAd = useCallback(async () => {
    if (!gameId || !playerId) {
      setAdErrorMessage("Session inconnue. Rejoignez une partie depuis l'accueil.");
      return;
    }
    if (adLoading) return;

    setAdLoading(true);
    setAdErrorMessage(null);
    setAdMessage(null);

    try {
      const ready = await isRewardedAdReady();
      if (!ready) {
        const pluginCooldown = getRewardedAdCooldown();
        if (pluginCooldown > 0) {
          setAdCooldown(prev => Math.max(prev, pluginCooldown));
        }
        throw new Error("La publicité n'est pas prête. Réessayez dans quelques instants.");
      }

      const displayed = await showRewardedAdForReward();
      if (!displayed) {
        throw new Error("Impossible d'afficher la publicité pour le moment.");
      }

      const res = await apiFetch<{ tokens?: number; added?: number; cooldownSeconds?: number }>(
        `/api/games/${gameId}/tokens/ads`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Player-ID': playerId },
          body: JSON.stringify({ type: 'pari' }),
        }
      );

      const added = Number(res?.added ?? 0);
      if (typeof res?.tokens === 'number') {
        setPariTokens(res.tokens);
      }
      setAdMessage(added > 0 ? `+${added} tokens ajoutés ✅` : 'Tokens déjà au maximum ✅');

      const serverCooldown = Number(res?.cooldownSeconds ?? 0);
      const pluginCooldown = getRewardedAdCooldown();
      const nextCooldown = Math.max(serverCooldown, pluginCooldown);
      if (nextCooldown > 0) {
        setAdCooldown(prev => Math.max(prev, nextCooldown));
      }

      await refreshPariStatus();
    } catch (err: any) {
      if (err instanceof ApiError) {
        setAdErrorMessage(err.message);
        if (err.status === 429) {
          const match = err.message.match(/(\d+)/);
          if (match) {
            const minutes = Number(match[1]);
            if (!Number.isNaN(minutes)) {
              setAdCooldown(prev => Math.max(prev, minutes * 60));
            }
          }
        }
      } else if (err instanceof Error) {
        setAdErrorMessage(err.message);
      } else {
        setAdErrorMessage('Impossible de recharger via publicité.');
      }
    } finally {
      setAdLoading(false);
      setTimeout(() => {
        void isRewardedAdReady().then(ready => setAdReady(ready));
      }, 500);
    }
  }, [gameId, playerId, adLoading, refreshPariStatus]);

  async function play() {
    if (!gameId || !playerId) {
      setError("Joueur ou partie inconnus (assurez-vous d'avoir déjà une session ailleurs)");
      return;
    }
    if (cooldown > 0) {
      setError("Cooldown actif");
      return;
    }
    if (pariTokens <= 0) {
      setError("Pas assez de tokens Pari (🎟️)");
      return;
    }
    if (cash != null && bet > cash) {
      setError("Mise supérieure à votre cash disponible");
      return;
    }
    setError(null);
    setResult(null);
    setRolling(true);
    setCooldown(2000); // 2s
    if (cooldownRef.current) clearTimeout(cooldownRef.current);
    cooldownRef.current = setTimeout(() => setCooldown(0), 2000);
    // Animation simple: lancer des dés aléatoires pendant 800ms
    const animInterval = setInterval(() => {
      setAnimDice([1,2,3].map(()=> Math.floor(Math.random()*6)+1) as [number,number,number]);
    }, 120);
    try {
      const headers: Record<string,string> = { 'Content-Type':'application/json', 'X-Player-ID': playerId };
      const res = await fetch(`${API_BASE}/api/games/${gameId}/pari/play`, {
        method:'POST', credentials:'include', headers,
        body: JSON.stringify({ bet })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erreur pari');
      } else {
        const enriched: RollResult = { ...data, ts: Date.now() };
        setResult(enriched);
        if (data.finalCash != null) setCash(data.finalCash);
        setAnimDice(data.dice as [number,number,number]);
        setHistory(prev => [enriched, ...prev].slice(0,50));
        if (typeof data.tokensLeft === 'number') setPariTokens(Number(data.tokensLeft));
      }
    } catch (e:any) {
      setError(e.message);
    } finally {
      clearInterval(animInterval);
      setRolling(false);
      if (autoRollRef.current) {
        scheduleAutoRoll();
      }
    }
  }

  useEffect(() => {
    if (!autoRoll) return;
    if (rolling) return;
    if (autoTimerRef.current) return;

    if (pariTokens > 0 && cooldown <= 0) {
      scheduleAutoRoll(400);
      return;
    }

    if (pariTokens <= 0 && nextTokenSec > 0) {
      scheduleAutoRoll(Math.max(AUTO_ROLL_MIN_DELAY_MS, nextTokenSec * 1000 + 500));
    }
  }, [autoRoll, rolling, pariTokens, cooldown, nextTokenSec]);

  // Stats cumulées
  const totalBets = history.reduce((acc,h)=> acc + (h.bet||0), 0);
  const totalGains = history.reduce((acc,h)=> acc + (h.gain||0), 0);
  const totalNet = history.reduce((acc,h)=> acc + (h.netResult||0), 0);

  const formatCooldown = useCallback((seconds: number) => {
    if (seconds <= 0) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}m ${secs.toString().padStart(2, '0')}s`;
    }
    return `${secs}s`;
  }, []);

  // Rendu simple des dés (lisible, compatible mobile)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 text-white p-4">
      <div className="max-w-2xl mx-auto space-y-8">
        <header className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">🎲 Pari (Prototype)</h1>
          <a href="/" className="text-sm underline hover:text-yellow-300">← Retour</a>
        </header>
        <div className="bg-white/10 backdrop-blur rounded-xl p-6 space-y-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="px-3 py-2 bg-white/5 rounded-md">Game: {gameId ? gameId.slice(0,8)+'…' : '—'}</div>
            <div className="px-3 py-2 bg-white/5 rounded-md">Player: {playerId ? playerId.slice(0,8)+'…' : '—'}</div>
            <div className="px-3 py-2 bg-white/5 rounded-md">Cash: {cash != null ? cash.toLocaleString()+' $' : '—'}</div>
            <div className="px-3 py-2 bg-white/5 rounded-md">Tokens 🎟️: {pariTokens}/{100} {pariTokens<=0 && nextTokenSec>0 ? `(+5 dans ${Math.floor(nextTokenSec/60)}m)` : ''}</div>
            <div className="px-3 py-2 bg-white/5 rounded-md">Total misé: {totalBets.toLocaleString()} $</div>
            <div className="px-3 py-2 bg-white/5 rounded-md">Total gagné: {totalGains.toLocaleString()} $</div>
            <div className="px-3 py-2 bg-white/5 rounded-md">Net: {totalNet.toLocaleString()} $</div>
          </div>
          {pariTokens <= 0 && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded text-sm text-center">
              Plus de tokens. Attendez la régénération (+5/h) ou regardez une pub pour une recharge max (100 tokens).
            </div>
          )}
          {adsSupported ? (
            <div className="bg-indigo-900/40 border border-indigo-500/30 rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-indigo-100">Recharge publicitaire 🎁</div>
                  <p className="text-xs text-indigo-200/70">Regardez une pub pour une recharge MAX (jusqu'à 100) · cooldown 5 min.</p>
                </div>
                <button
                  type="button"
                  onClick={() => { try { localStorage.removeItem('hm-ad-consent'); } catch {}; setAdMessage('Consentement réinitialisé.'); }}
                  className="text-[11px] px-2 py-1 rounded bg-white/10 hover:bg-white/20 border border-white/20"
                  title="Effacer le consentement pubs (UMP se réaffichera sur Android)"
                >
                  Réinitialiser consentement
                </button>
              </div>
              <button
                type="button"
                onClick={handleWatchAd}
                disabled={adLoading || adCooldown > 0 || !adReady || pariTokens >= 100}
                className={`w-full py-2 rounded-lg font-semibold transition ${adLoading || adCooldown > 0 || !adReady || pariTokens >= 100 ? 'bg-white/10 text-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-emerald-400 to-green-500 text-black hover:from-emerald-300 hover:to-green-400'}`}
              >
                {adLoading
                  ? 'Lecture en cours…'
                  : adCooldown > 0
                    ? `Disponible dans ${formatCooldown(adCooldown)}`
                    : pariTokens >= 100
                      ? 'Tokens déjà au maximum'
                    : adReady
                      ? '📺 Pub: Recharge MAX'
                      : 'Préparation de la pub…'}
              </button>
              {adMessage && <div className="text-xs text-emerald-300">{adMessage}</div>}
              {adErrorMessage && <div className="text-xs text-red-300">{adErrorMessage}</div>}
            </div>
          ) : (
            <div className="bg-white/10 border border-white/20 rounded-lg p-4 space-y-2">
              <div className="text-sm font-semibold">Recharge par publicité disponible sur Android</div>
              <p className="text-xs text-gray-300">Installez l’application Android pour regarder une pub et recharger vos tokens jusqu’à 100.</p>
              <a href="/telecharger" className="inline-block mt-1 px-3 py-1 text-xs rounded bg-gradient-to-r from-yellow-300 to-orange-400 text-black font-semibold hover:from-yellow-200 hover:to-orange-300">
                Télécharger l’APK
              </a>
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm font-semibold">Mise (min {MIN_BET.toLocaleString()} $){dynamicCap!=null ? ` · plafond dynamique ${dynamicCap.toLocaleString()} $` : ''}</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={MIN_BET}
                value={bet}
                onChange={e=>adjustBet(Number(e.target.value))}
                className="bg-white/10 px-3 py-2 rounded w-40 outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <div className="flex gap-1">
                {[5000,10000,20000,50000].map(v => (
                  <button key={v} onClick={()=>adjustBet(v)} className="px-2 py-1 text-xs bg-white/10 hover:bg-white/20 rounded">{v/1000}k</button>
                ))}
              </div>
            </div>
          </div>
          <button
            disabled={rolling || bet < MIN_BET || (cash!=null && bet>cash) || cooldown>0 || pariTokens<=0}
            onClick={play}
            className="relative w-full py-3 rounded-lg font-bold text-lg bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed"
          >
            {rolling ? 'Lancement…' : cooldown>0 ? `Cooldown ${(cooldown/1000).toFixed(1)}s` : pariTokens<=0 ? 'Pas de tokens' : 'Lancer les dés'}
          </button>
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-gray-300">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAutoRoll(prev => !prev)}
                className={`px-3 py-1 rounded-full border text-xs font-semibold transition ${autoRoll ? 'bg-emerald-400 text-black border-emerald-300 hover:bg-emerald-300' : 'bg-white/10 border-white/20 text-gray-200 hover:bg-white/20'}`}
                title="Active lancers automatiques tant que des tokens sont disponibles"
              >
                {autoRoll ? 'Auto-roll activé' : 'Activer auto-roll'}
              </button>
              <span className="font-medium text-gray-200">Auto-roll</span>
            </div>
            {autoRoll && (
              <span className="text-xs text-indigo-200">
                {pariTokens <= 0
                  ? `En attente de tokens… (~${Math.max(0, nextTokenSec)}s)`
                  : autoCountdown > 0
                    ? `Prochain lancer auto dans ${(autoCountdown/1000).toFixed(1)}s`
                    : 'Lancer auto imminent'}
              </span>
            )}
          </div>
          {error && <div className="p-3 bg-red-600/80 rounded text-sm">{error}</div>}
        </div>
        <div className="bg-white/5 backdrop-blur rounded-xl p-6 space-y-6">
          <h2 className="text-xl font-semibold">Résultat</h2>
          <div className="flex justify-center gap-4">
            {(animDice || result?.dice || [1,1,1]).map((d,i)=>(
              <div
                key={i}
                className={`w-20 h-20 rounded-xl flex items-center justify-center text-3xl font-extrabold shadow-lg transition ${rolling ? 'animate-pulse' : ''} bg-white text-black border border-black/20`}
              >
                {d}
              </div>
            ))}
          </div>
          <div className="text-center text-sm text-gray-300">
            {result ? (
              <>
                <div className="text-lg font-bold mt-2">{result.description}</div>
                <div className="mt-1">Mise: {result.bet.toLocaleString()} $</div>
                <div className={result.netResult>=0 ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
                  {result.netResult>=0 ? `+${result.netResult.toLocaleString()} $ net` : `${result.netResult.toLocaleString()} $ net`}
                </div>
                <div className="mt-1 text-gray-400">Cash final: {result.finalCash?.toLocaleString()} $</div>
              </>
            ) : (
              <div>Aucun lancer encore.</div>
            )}
          </div>
          <div className="text-xs text-gray-400 text-center">
            Règles: triple = somme des 3 dés (ex: 6-6-6 ⇒ x18), double = valeur du dé doublé (ex: 4-4-1 ⇒ x4), suite (3 consécutifs) = x2. Sinon la mise est perdue.
          </div>
        </div>
        <div className="bg-white/10 backdrop-blur rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold">Historique récent</h2>
          <div className="space-y-2 max-h-72 overflow-auto text-sm">
            {history.length === 0 && <div className="text-gray-400">Aucun lancer sauvegardé.</div>}
            {history.slice(0,15).map(h => (
              <div key={h.ts} className="flex items-center justify-between bg-white/5 rounded px-3 py-2">
                <div className="flex items-center gap-3">
                  <div className="text-xs text-gray-400">{new Date(h.ts!).toLocaleTimeString()}</div>
                  <div className="flex gap-1">
                    {h.dice.map((d,i)=>(<span key={i} className="inline-block w-6 text-center font-mono">{d}</span>))}
                  </div>
                  <span className="text-indigo-300">{h.combination}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-gray-300">Mise {h.bet.toLocaleString()}$</span>
                  <span className={h.netResult>=0 ? 'text-green-400' : 'text-red-400'}>{h.netResult>=0? '+' : ''}{h.netResult.toLocaleString()}$</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Pas de styles 3D pour maximiser la compatibilité et la lisibilité */}
    </div>
  );
}
