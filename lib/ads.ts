// Helper d'annonces récompensées (rewarded). Version web: simulation/placeholder.
// En production mobile (AdMob), remplacez par l'appel SDK réel puis retour true quand l'évènement "rewarded" est reçu.

export async function showRewardedAd(adUnitId?: string): Promise<boolean> {
  try {
    // Si un pont SDK est disponible (ex: window.hmShowRewardedAd), l'utiliser
    if (typeof window !== 'undefined' && (window as any).hmShowRewardedAd) {
      const ok = await (window as any).hmShowRewardedAd(adUnitId);
      return !!ok;
    }
    // Fallback web: simulation avec petit compte à rebours pour dev/staging
    const confirmStart = typeof window !== 'undefined' ? window.confirm('Voir la vidéo pour obtenir la récompense ?') : true;
    if (!confirmStart) return false;
    await new Promise((res) => setTimeout(res, 5000)); // simule 5s de visionnage
    return true;
  } catch {
    return false;
  }
}

// Optionnel: vérifier qu'on a un ad unit (utile pour log/debug)
export function getAdUnit(idFromEnv?: string): string | undefined {
  return idFromEnv && String(idFromEnv).trim().length > 0 ? idFromEnv : undefined;
}
