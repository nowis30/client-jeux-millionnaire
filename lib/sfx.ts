// Utilitaire de sons d'effets (SFX) pour le quiz
// Placez les fichiers dans public/audio/ :
//  - sfx-correct.mp3
//  - sfx-wrong.mp3
//  - sfx-reward.mp3
// Fallback silencieux si fichier absent.

const FILES: Record<string,string> = {
  correct: '/audio/sfx-correct.mp3',
  wrong: '/audio/sfx-wrong.mp3',
  reward: '/audio/sfx-reward.mp3'
};

interface LoadedSfx {
  audio: HTMLAudioElement;
  loaded: boolean;
}

const cache: Map<string, LoadedSfx> = new Map();
let audioCtx: AudioContext | null = null;

function load(name: string): LoadedSfx {
  if (cache.has(name)) return cache.get(name)!;
  const src = FILES[name];
  const audio = new Audio(src || '');
  audio.preload = 'auto';
  const entry: LoadedSfx = { audio, loaded: false };
  audio.addEventListener('canplay', () => { entry.loaded = true; });
  // Si erreur (fichier manquant), marquer comme loaded pour éviter blocage
  audio.addEventListener('error', () => { entry.loaded = true; });
  cache.set(name, entry);
  return entry;
}

function playBeep(vol: number, freq: number) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const ctx = audioCtx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.value = vol * 0.1; // faible
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    setTimeout(() => { try { osc.stop(); } catch {}; }, 170);
  } catch {}
}

export function playSfx(name: 'correct'|'wrong'|'reward', volume = 1) {
  try {
    const entry = load(name);
    const baseVol = Math.min(1, Math.max(0, volume));
    const a = entry.audio.cloneNode() as HTMLAudioElement; // clone pour rejouer simultanément
    a.volume = baseVol;
    a.play().catch(() => {
      // fallback beep si autoplay bloqué ou erreur
      if (name === 'correct') playBeep(baseVol, 660);
      else if (name === 'wrong') playBeep(baseVol, 220);
      else playBeep(baseVol, 880);
    });
    // si le fichier est manquant (entry.loaded true mais a.duration === Infinity ou 0 après délai) => beep immédiat
    setTimeout(() => {
      if ((a.duration === Infinity || a.duration === 0) && a.paused) {
        if (name === 'correct') playBeep(baseVol, 660);
        else if (name === 'wrong') playBeep(baseVol, 220);
        else playBeep(baseVol, 880);
      }
    }, 250);
  } catch {
    // fallback global
    playBeep(volume, 440);
  }
}

// API pratique pour le quiz
export const SFX = {
  correct: () => playSfx('correct', 0.9),
  wrong: () => playSfx('wrong', 0.9),
  reward: () => playSfx('reward', 1)
};
