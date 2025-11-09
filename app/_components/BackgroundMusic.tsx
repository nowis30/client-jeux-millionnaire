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
  // Forcer une pause (ex: lors du quiz) jusqu'à réception d'un event de reprise
  const forcedPauseRef = useRef<boolean>(false);

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

  // Préparer l'élément audio
  useEffect(() => {
    const a = new Audio("/audio/theme.mp3");
    a.loop = true;
    a.preload = "auto";
    a.volume = volume;
    audioRef.current = a;
    const onCanPlay = () => setReady(true);
    a.addEventListener("canplay", onCanPlay);
    return () => {
      a.pause();
      a.removeEventListener("canplay", onCanPlay);
      audioRef.current = null;
    };
  }, []);

  // Appliquer volume en direct
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    try { localStorage.setItem(LS_KEY_VOLUME, String(volume)); } catch {}
  }, [volume]);

  // Gestion autoplay (nécessite interaction utilisateur sur Android/iOS)
  useEffect(() => {
    if (!audioRef.current) return;
    if (!enabled || forcedPauseRef.current) { audioRef.current.pause(); return; }
    // tenter play après une interaction utilisateur
    const tryPlay = () => {
      if (!audioRef.current || forcedPauseRef.current) return;
      audioRef.current.play().catch(() => {});
      window.removeEventListener("touchend", tryPlay);
      window.removeEventListener("click", tryPlay);
    };
    // si déjà prêt, on attend la première interaction
    window.addEventListener("touchend", tryPlay, { once: true });
    window.addEventListener("click", tryPlay, { once: true });
    // si l'utilisateur a déjà interagi (navigation), on essaie maintenant
    setTimeout(() => {
      if (!audioRef.current || forcedPauseRef.current) return;
      audioRef.current.play().catch(() => {});
    }, 300);
  }, [enabled, ready]);

  // Pause quand on perd le focus (optimisation UX)
  useEffect(() => {
    const onVis = () => {
      const a = audioRef.current;
      if (!a) return;
      if (document.hidden) a.pause(); else if (enabled && !forcedPauseRef.current) a.play().catch(()=>{});
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [enabled]);

  // Écoute des événements globaux pour pause/reprise forcée
  useEffect(() => {
    const onPause = () => {
      forcedPauseRef.current = true;
      const a = audioRef.current; if (a) a.pause();
    };
    const onResume = () => {
      forcedPauseRef.current = false;
      const a = audioRef.current; if (a && enabled && !document.hidden) a.play().catch(()=>{});
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
            a.play().catch(()=>{});
          } else a.pause();
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
    </div>
  );
}
