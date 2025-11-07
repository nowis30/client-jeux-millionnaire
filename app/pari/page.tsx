"use client";
import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3001";
const MIN_BET = 5000;

interface RollResult {
  dice: number[];
  combination: string;
  description: string;
  bet: number;
  gain: number;
  netResult: number;
  finalCash: number;
}

export default function PariPage() {
  const [gameId, setGameId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [cash, setCash] = useState<number | null>(null);
  const [bet, setBet] = useState<number>(MIN_BET);
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState<RollResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [animDice, setAnimDice] = useState<[number,number,number] | null>(null);

  // Charger session locale ou fallback partie globale
  useEffect(() => {
    try {
      const sessionStr = localStorage.getItem('hm-session');
      if (sessionStr) {
        const s = JSON.parse(sessionStr);
        if (s.gameId) setGameId(s.gameId);
        if (s.playerId) setPlayerId(s.playerId);
      }
    } catch {}
  }, []);

  // Fallback: récupérer partie globale si pas de gameId
  useEffect(() => {
    if (gameId) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/games`);
        if (!res.ok) return;
        const data = await res.json();
        const g = data.games?.[0];
        if (g?.id) setGameId(g.id);
      } catch {}
    })();
  }, [gameId]);

  // Charger infos joueur si gameId et playerId connus
  useEffect(() => {
    if (!gameId || !playerId) return;
    (async () => {
      try {
        const headers: Record<string,string> = {};
        headers['X-Player-ID'] = playerId;
        const res = await fetch(`${API_BASE}/api/games/${gameId}/me`, { headers, credentials:'include' });
        if (!res.ok) return;
        const data = await res.json();
        if (data.player?.cash != null) setCash(data.player.cash);
      } catch {}
    })();
  }, [gameId, playerId]);

  function adjustBet(v: number) {
    setBet(prev => {
      const next = Math.max(MIN_BET, v);
      if (cash != null) return Math.min(next, cash);
      return next;
    });
  }

  async function play() {
    if (!gameId || !playerId) {
      setError("Joueur ou partie inconnus (assurez-vous d'avoir déjà une session ailleurs)");
      return;
    }
    if (cash != null && bet > cash) {
      setError("Mise supérieure à votre cash disponible");
      return;
    }
    setError(null);
    setResult(null);
    setRolling(true);
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
        setResult(data);
        if (data.finalCash != null) setCash(data.finalCash);
        setAnimDice(data.dice as [number,number,number]);
      }
    } catch (e:any) {
      setError(e.message);
    } finally {
      clearInterval(animInterval);
      setRolling(false);
    }
  }

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
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold">Mise (min {MIN_BET.toLocaleString()} $)</label>
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
                <button onClick={()=>cash && adjustBet(cash)} className="px-2 py-1 text-xs bg-yellow-500/80 hover:bg-yellow-500 text-black rounded">MAX</button>
              </div>
            </div>
          </div>
          <button
            disabled={rolling || bet < MIN_BET || (cash!=null && bet>cash)}
            onClick={play}
            className="w-full py-3 rounded-lg font-bold text-lg bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed"
          >
            {rolling ? 'Lancement…' : 'Lancer les dés'}
          </button>
          {error && <div className="p-3 bg-red-600/80 rounded text-sm">{error}</div>}
        </div>
        <div className="bg-white/5 backdrop-blur rounded-xl p-6 space-y-6">
          <h2 className="text-xl font-semibold">Résultat</h2>
          <div className="flex justify-center gap-4">
            {(animDice || result?.dice || [1,1,1]).map((d,i)=>(
              <div key={i} className={`w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-bold shadow-lg transition transform ${rolling ? 'animate-pulse' : ''} bg-slate-800 border border-white/20`}>{d}</div>
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
            Règles: double = x2, triple = x3, suite (3 nombres consécutifs) = x3. Sinon la mise est perdue.
          </div>
        </div>
      </div>
    </div>
  );
}
