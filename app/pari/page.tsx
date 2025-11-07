"use client";
import { useEffect, useState, useRef } from "react";

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
  ts?: number; // timestamp
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
  const [history, setHistory] = useState<RollResult[]>([]);
  const [cooldown, setCooldown] = useState<number>(0); // ms remaining
  const cooldownRef = useRef<NodeJS.Timeout | null>(null);

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
    if (cooldown > 0) {
      setError("Cooldown actif");
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
      }
    } catch (e:any) {
      setError(e.message);
    } finally {
      clearInterval(animInterval);
      setRolling(false);
    }
  }

  // Stats cumulées
  const totalBets = history.reduce((acc,h)=> acc + (h.bet||0), 0);
  const totalGains = history.reduce((acc,h)=> acc + (h.gain||0), 0);
  const totalNet = history.reduce((acc,h)=> acc + (h.netResult||0), 0);

  // Composant Dé 3D
  function Die({ value, rolling }: { value: number; rolling: boolean }) {
    // Map face -> rotation (front = face 1). We'll orient so chosen value faces front.
    const rotations: Record<number,string> = {
      1: 'rotateX(0deg) rotateY(0deg)',
      2: 'rotateX(-90deg) rotateY(0deg)',
      3: 'rotateY(90deg)',
      4: 'rotateY(-90deg)',
      5: 'rotateX(90deg)',
      6: 'rotateY(180deg)'
    };
    return (
      <div className={`dice3d ${rolling ? 'rolling' : ''}`} style={{ transform: rolling ? undefined : rotations[value] }}>
        <div className="face f1">1</div>
        <div className="face f2">2</div>
        <div className="face f3">3</div>
        <div className="face f4">4</div>
        <div className="face f5">5</div>
        <div className="face f6">6</div>
      </div>
    );
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
            <div className="px-3 py-2 bg-white/5 rounded-md">Total misé: {totalBets.toLocaleString()} $</div>
            <div className="px-3 py-2 bg-white/5 rounded-md">Total gagné: {totalGains.toLocaleString()} $</div>
            <div className="px-3 py-2 bg-white/5 rounded-md">Net: {totalNet.toLocaleString()} $</div>
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
            disabled={rolling || bet < MIN_BET || (cash!=null && bet>cash) || cooldown>0}
            onClick={play}
            className="relative w-full py-3 rounded-lg font-bold text-lg bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed"
          >
            {rolling ? 'Lancement…' : cooldown>0 ? `Cooldown ${(cooldown/1000).toFixed(1)}s` : 'Lancer les dés'}
          </button>
          {error && <div className="p-3 bg-red-600/80 rounded text-sm">{error}</div>}
        </div>
        <div className="bg-white/5 backdrop-blur rounded-xl p-6 space-y-6">
          <h2 className="text-xl font-semibold">Résultat</h2>
          <div className="flex justify-center gap-6">
            {(animDice || result?.dice || [1,1,1]).map((d,i)=>(
              <Die key={i} value={d} rolling={rolling} />
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
      {/* Styles 3D dés */}
      <style jsx>{`
        .dice3d {
          width:4rem; height:4rem; position:relative; transform-style:preserve-3d; transition:transform 0.9s cubic-bezier(.19,.57,.3,.98); perspective:800px;
        }
        .dice3d.rolling { animation: spin 0.6s linear infinite; }
        @keyframes spin { from { transform: rotateX(0deg) rotateY(0deg); } to { transform: rotateX(360deg) rotateY(360deg); } }
        .dice3d .face { position:absolute; width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:1.5rem; background:#0f172a; border:2px solid rgba(255,255,255,0.15); border-radius:0.75rem; box-shadow:0 4px 12px rgba(0,0,0,0.4); color:#fff; }
        .dice3d .f1 { transform: translateZ(2rem); }
        .dice3d .f6 { transform: rotateY(180deg) translateZ(2rem); }
        .dice3d .f2 { transform: rotateX(90deg) translateZ(2rem); }
        .dice3d .f5 { transform: rotateX(-90deg) translateZ(2rem); }
        .dice3d .f3 { transform: rotateY(-90deg) translateZ(2rem); }
        .dice3d .f4 { transform: rotateY(90deg) translateZ(2rem); }
      `}</style>
    </div>
  );
}
