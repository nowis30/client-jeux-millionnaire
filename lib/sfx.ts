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

function ensureCtx(): AudioContext | null {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(()=>{});
    return audioCtx;
  } catch { return null; }
}

function playNotes(notes: Array<{ freq: number; dur: number; }>, vol: number, type: OscillatorType = 'sine') {
  const ctx = ensureCtx();
  if (!ctx) return;
  let t = ctx.currentTime;
  const g = ctx.createGain();
  g.gain.value = 0;
  g.connect(ctx.destination);
  const o = ctx.createOscillator();
  o.type = type;
  o.connect(g);
  o.start(t);
  for (const n of notes) {
    // petite enveloppe ADSR pour éviter les clicks
    o.frequency.setValueAtTime(n.freq, t);
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(Math.min(1, Math.max(0, vol)), t + 0.01);
    g.gain.linearRampToValueAtTime(0, t + Math.max(0.08, n.dur - 0.02));
    t += n.dur;
  }
  o.stop(t + 0.02);
}

function playSfxPattern(kind: 'correct'|'wrong'|'reward', vol: number) {
  // Durées en secondes
  if (kind === 'correct') {
    // petit arpège montant
    playNotes([
      { freq: 523.25, dur: 0.12 }, // C5
      { freq: 659.25, dur: 0.12 }, // E5
      { freq: 783.99, dur: 0.16 }, // G5
    ], vol, 'triangle');
  } else if (kind === 'wrong') {
    // deux notes graves avec timbre square
    playNotes([
      { freq: 220.00, dur: 0.16 }, // A3
      { freq: 196.00, dur: 0.22 }, // G3
    ], vol * 0.9, 'square');
  } else {
    // reward: motif montant plus long
    playNotes([
      { freq: 523.25, dur: 0.12 },
      { freq: 659.25, dur: 0.12 },
      { freq: 783.99, dur: 0.14 },
      { freq: 1046.50, dur: 0.18 },
    ], Math.min(1, vol), 'sine');
  }
}

export function playSfx(name: 'correct'|'wrong'|'reward', volume = 1) {
  try {
    const entry = load(name);
    const baseVol = Math.min(1, Math.max(0, volume));
    const a = entry.audio.cloneNode() as HTMLAudioElement; // clone pour rejouer simultanément
    a.volume = baseVol;
    a.play().catch(() => {
      // fallback pattern si autoplay bloqué ou erreur
      playSfxPattern(name, baseVol);
    });
    // si le fichier est manquant (entry.loaded true mais a.duration === Infinity ou 0 après délai) => beep immédiat
    setTimeout(() => {
      if ((a.duration === Infinity || a.duration === 0) && a.paused) {
        playSfxPattern(name, baseVol);
      }
    }, 250);
  } catch {
    // fallback global
    playSfxPattern('correct', Math.min(1, Math.max(0, volume)));
  }
}

// API pratique pour le quiz
export const SFX = {
  correct: () => playSfx('correct', 0.9),
  wrong: () => playSfx('wrong', 0.9),
  reward: () => playSfx('reward', 1)
};
