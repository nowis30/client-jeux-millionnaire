// Ads désactivées temporairement en attente du code SDK réel.
// Les fonctions exportées restent pour ne pas casser les imports existants,
// mais retournent toujours false / undefined.
// TODO: Réactiver quand l'implémentation vidéo récompensée sera prête.

export async function showRewardedAd(_adUnitId?: string): Promise<boolean> {
  return false; // vidéo récompense désactivée
}

export function getAdUnit(_idFromEnv?: string): string | undefined {
  return undefined; // aucun ad unit exposé
}
