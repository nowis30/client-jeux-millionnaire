/**
 * Système de publicités AdMob
 * Utilise le plugin natif AdMob pour Android via Capacitor
 * Sur le web, les fonctions ne font rien (no-op)
 */

// Type pour le plugin AdMob
interface AdMobPlugin {
  initialize(): Promise<void>;
  loadInterstitial(): Promise<void>;
  showInterstitial(): Promise<void>;
  isAdReady(): Promise<{ ready: boolean }>;
}

let isInitialized = false;
let lastAdShown = 0;
const MIN_AD_INTERVAL = 120000; // 2 minutes entre chaque pub

/**
 * Vérifier si on est sur une plateforme native
 */
function isNativePlatform(): boolean {
  return typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();
}

/**
 * Obtenir le plugin AdMob via Capacitor
 */
function getAdMobPlugin(): AdMobPlugin | null {
  if (typeof window === 'undefined') return null;
  
  const Capacitor = (window as any).Capacitor;
  if (!Capacitor?.Plugins) return null;
  
  return Capacitor.Plugins.AdMob as AdMobPlugin;
}

/**
 * Initialiser AdMob (à appeler au démarrage de l'app)
 */
export async function initializeAds(): Promise<void> {
  if (isInitialized || !isNativePlatform()) {
    return;
  }

  try {
    const AdMob = getAdMobPlugin();
    if (!AdMob) {
      console.log('[Ads] AdMob plugin not available');
      return;
    }
    
    await AdMob.initialize();
    isInitialized = true;
    
    // Précharger la première annonce
    await loadInterstitialAd();
    
    console.log('[Ads] AdMob initialized successfully');
  } catch (error) {
    console.error('[Ads] Failed to initialize AdMob:', error);
  }
}

/**
 * Charger une annonce interstitielle
 */
async function loadInterstitialAd(): Promise<void> {
  if (!isNativePlatform()) return;
  
  const AdMob = getAdMobPlugin();
  if (!AdMob || !isInitialized) return;

  try {
    await AdMob.loadInterstitial();
    console.log('[Ads] Interstitial ad loaded');
  } catch (error) {
    console.error('[Ads] Failed to load interstitial ad:', error);
  }
}

/**
 * Afficher une annonce interstitielle
 * @returns true si l'annonce a été affichée, false sinon
 */
export async function showInterstitialAd(): Promise<boolean> {
  if (!isNativePlatform()) {
    console.log('[Ads] Not on native platform');
    return false;
  }
  
  const AdMob = getAdMobPlugin();
  if (!AdMob || !isInitialized) {
    console.log('[Ads] AdMob not initialized');
    return false;
  }

  // Vérifier l'intervalle minimum entre les pubs
  const now = Date.now();
  if (now - lastAdShown < MIN_AD_INTERVAL) {
    console.log('[Ads] Too soon to show another ad');
    return false;
  }

  try {
    // Vérifier si une annonce est prête
    const { ready } = await AdMob.isAdReady();
    if (!ready) {
      console.log('[Ads] No ad ready to show, loading new one...');
      // Essayer de charger une nouvelle annonce pour la prochaine fois
      loadInterstitialAd();
      return false;
    }

    // Afficher l'annonce
    await AdMob.showInterstitial();
    lastAdShown = now;
    
    // Précharger la prochaine annonce
    loadInterstitialAd();
    
    console.log('[Ads] Interstitial ad shown successfully');
    return true;
  } catch (error) {
    console.error('[Ads] Failed to show interstitial ad:', error);
    return false;
  }
}

/**
 * Fonction deprecated (vidéos récompensées)
 * Gardée pour compatibilité, retourne toujours false
 * @deprecated Utilisez showInterstitialAd() à la place
 */
export async function showRewardedAd(_adUnitId?: string): Promise<boolean> {
  console.log('[Ads] showRewardedAd is deprecated, use showInterstitialAd instead');
  return showInterstitialAd();
}

/**
 * Vérifier si une annonce est prête à être affichée
 */
export async function isAdReady(): Promise<boolean> {
  if (!isNativePlatform()) {
    return false;
  }
  
  const AdMob = getAdMobPlugin();
  if (!AdMob || !isInitialized) {
    return false;
  }

  try {
    const { ready } = await AdMob.isAdReady();
    return ready;
  } catch (error) {
    return false;
  }
}

/**
 * Fonction deprecated
 * @deprecated Non utilisée avec le nouveau système AdMob
 */
export function getAdUnit(_idFromEnv?: string): string | undefined {
  return undefined;
}



