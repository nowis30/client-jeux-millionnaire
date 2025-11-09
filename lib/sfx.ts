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

export function playSfx(name: 'correct'|'wrong'|'reward', volume = 1) {
  try {
    const entry = load(name);
    const a = entry.audio.cloneNode() as HTMLAudioElement; // clone pour rejouer simultanément
    a.volume = Math.min(1, Math.max(0, volume));
    a.play().catch(()=>{});
  } catch {}
}

// API pratique pour le quiz
export const SFX = {
  correct: () => playSfx('correct', 0.9),
  wrong: () => playSfx('wrong', 0.9),
  reward: () => playSfx('reward', 1)
};
