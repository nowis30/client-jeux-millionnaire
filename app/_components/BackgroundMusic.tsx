"use client";
import { useEffect, useRef, useState } from "react";

// Simple lecteur de musique de fond avec mémoire volume et play/pause
// Placez vos mp3 dans public/audio/, ex: /audio/theme.mp3

const LS_KEY_ENABLED = "hm-music-enabled";
const LS_KEY_VOLUME = "hm-music-volume";

export default function BackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [enabled, setEnabled] = useState<boolean>(true);
  const [volume, setVolume] = useState<number>(0.35);
  const [ready, setReady] = useState(false);
  const [missingFile, setMissingFile] = useState(false);
  // Forcer une pause (ex: lors du quiz) jusqu'à réception d'un event de reprise
  const forcedPauseRef = useRef<boolean>(false);
  // Contexte Web Audio pour fallback si le fichier /audio/theme.mp3 est absent
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);

  // Charger préférences
  useEffect(() => {
    try {
      const e = localStorage.getItem(LS_KEY_ENABLED);
      const v = localStorage.getItem(LS_KEY_VOLUME);
      if (e != null) setEnabled(e === "1");
      if (v != null) {
        const nv = Number(v);
        if (!Number.isNaN(nv)) setVolume(Math.min(1, Math.max(0, nv)));
      }
    } catch {}
  }, []);

  // Préparer l'élément audio en testant plusieurs candidats (sensibilité à la casse)
  useEffect(() => {
    let disposed = false;
    const candidates = [
      "/audio/theme.mp3",
      "/audio/Theme.mp3",
      "/audio/theme.MP3"
    ];
    const tryNext = async (idx: number) => {
      if (disposed || idx >= candidates.length) {
        setMissingFile(true);
        return;
      }
      const src = candidates[idx];
      // Préflight HEAD pour aider au diagnostic
      try {
        const res = await fetch(src, { method: 'HEAD', cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
      } catch {
        // essaie suivant si HEAD échoue
        return tryNext(idx + 1);
      }
      const a = new Audio(src);
      a.loop = true;
      a.preload = "auto";
      a.volume = volume;
      audioRef.current = a;
      const onCanPlay = () => { if (!disposed) { setReady(true); setMissingFile(false); } };
      const onError = () => { if (!disposed) { a.pause(); a.removeEventListener("canplay", onCanPlay); a.removeEventListener("error", onError); tryNext(idx + 1); } };
      a.addEventListener("canplay", onCanPlay);
      a.addEventListener("error", onError);
    };
    tryNext(0);
    return () => {
      disposed = true;
      const a = audioRef.current;
      if (a) {
        a.pause();
        a.removeAttribute('src');
        audioRef.current = null;
      }
      stopFallbackTone();
    };
  }, []);

  // Appliquer volume en direct
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    try { localStorage.setItem(LS_KEY_VOLUME, String(volume)); } catch {}
  }, [volume]);

  // Gestion autoplay (nécessite interaction utilisateur sur Android/iOS)
  // Fallback: démarrer un petit tone si fichier manquant
  const startFallbackTone = () => {
    if (oscRef.current || !enabled || forcedPauseRef.current) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 220; // basse discrète
      gain.gain.value = Math.min(1, Math.max(0, volume * 0.3)); // un peu plus fort pour PC
      osc.connect(gain).connect(ctx.destination);
      // reprendre le contexte si suspendu (Chrome desktop)
      if (ctx.state === 'suspended') { ctx.resume().catch(()=>{}); }
      osc.start();
      oscRef.current = osc;
    } catch {}
  };
  const stopFallbackTone = () => {
    if (oscRef.current) {
      try { oscRef.current.stop(); } catch {}
      oscRef.current.disconnect();
      oscRef.current = null;
    }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch {}
      audioCtxRef.current = null;
    }
  };

  useEffect(() => {
    if (!audioRef.current) return;
    if (!enabled || forcedPauseRef.current) {
      audioRef.current.pause();
      stopFallbackTone();
      return;
    }
    // Si le fichier existe, tenter play après interaction
    const tryPlay = () => {
      if (forcedPauseRef.current) return;
      // tenter de reprendre le contexte audio Web si présent
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(()=>{});
      }
      if (missingFile) { startFallbackTone(); cleanupInteraction(); return; }
      if (!audioRef.current) return;
      audioRef.current.play().catch(() => {
        // si échec (autoplay bloqué), on laissera interactions suivantes
      });
    };
    const cleanupInteraction = () => {
      window.removeEventListener("touchend", tryPlay);
      window.removeEventListener("pointerdown", tryPlay);
      window.removeEventListener("click", tryPlay);
      window.removeEventListener("keydown", tryPlay);
    };
    window.addEventListener("touchend", tryPlay, { once: true });
    window.addEventListener("pointerdown", tryPlay, { once: true });
    window.addEventListener("click", tryPlay, { once: true });
    window.addEventListener("keydown", tryPlay, { once: true });
    // tentative initiale (si déjà interactif)
    setTimeout(() => { tryPlay(); }, 350);
    return cleanupInteraction;
  }, [enabled, ready, missingFile]);

  // Pause quand on perd le focus (optimisation UX)
  useEffect(() => {
    const onVis = () => {
      const a = audioRef.current;
      if (document.hidden) {
        if (a) a.pause();
        stopFallbackTone();
      } else if (enabled && !forcedPauseRef.current) {
        if (missingFile) {
          // reprendre AudioContext si nécessaire puis fallback
          if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
            audioCtxRef.current.resume().catch(()=>{});
          }
          startFallbackTone();
        } else if (a) a.play().catch(()=>{});
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [enabled, missingFile]);

  // Écoute des événements globaux pour pause/reprise forcée
  useEffect(() => {
    const onPause = () => {
      forcedPauseRef.current = true;
      const a = audioRef.current; if (a) a.pause();
      stopFallbackTone();
    };
    const onResume = () => {
      forcedPauseRef.current = false;
      const a = audioRef.current;
      if (enabled && !document.hidden) {
        if (missingFile) {
          if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
            audioCtxRef.current.resume().catch(()=>{});
          }
          startFallbackTone();
        } else if (a) a.play().catch(()=>{});
      }
    };
    window.addEventListener("hm-music/pause", onPause as EventListener);
    window.addEventListener("hm-music/resume", onResume as EventListener);
    return () => {
      window.removeEventListener("hm-music/pause", onPause as EventListener);
      window.removeEventListener("hm-music/resume", onResume as EventListener);
    };
  }, [enabled]);

  return (
    <div className="fixed z-40 bottom-24 right-4 md:right-6 flex items-center gap-2 bg-neutral-900/80 backdrop-blur border border-neutral-800 rounded-full px-3 py-1.5">
      <button
        aria-label={enabled ? "Couper la musique" : "Activer la musique"}
        onClick={() => {
          const next = !enabled;
          setEnabled(next);
          try { localStorage.setItem(LS_KEY_ENABLED, next ? "1" : "0"); } catch {}
          const a = audioRef.current;
          if (!a) return;
          if (next) {
            // Si l'utilisateur active manuellement, on ignore temporairement forcedPause
            forcedPauseRef.current = false;
            if (missingFile) startFallbackTone(); else a.play().catch(()=>{});
          } else {
            a.pause();
            stopFallbackTone();
          }
        }}
        className="px-2 py-1 text-xs rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-700"
      >{enabled ? "Musique: ON" : "Musique: OFF"}</button>
      <input
        aria-label="Volume musique"
        type="range" min={0} max={1} step={0.01}
        value={volume}
        onChange={(e) => setVolume(parseFloat(e.target.value))}
        className="w-28 accent-indigo-400"
      />
      {missingFile && (
        <span className="text-[10px] text-amber-300" title="Placez /public/audio/theme.mp3 pour musique complète">(fallback tonal)</span>
      )}
    </div>
  );
}
