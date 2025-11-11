/**
 * Système de publicités AdMob
 * Utilise le plugin natif AdMob pour Android via Capacitor
 * Sur le web, les fonctions ne font rien (no-op)
 */

// Type pour le plugin AdMob
interface RewardEarned {
  amount: number;
  type: string;
}

interface AdMobPlugin {
  initialize(): Promise<void>;
  loadInterstitial(): Promise<void>;
  showInterstitial(): Promise<void>;
  isAdReady(): Promise<{ ready: boolean }>;
  loadRewardedAd(): Promise<void>;
  showRewardedAd(): Promise<RewardEarned>;
  isRewardedAdReady(): Promise<{ ready: boolean }>;
  // UMP consent (natif). Retourne { npa: boolean }
  requestConsent?: () => Promise<{ npa: boolean }>;
  // Capacitor event bridge
  addListener?: (eventName: string, callback: (data: any) => void) => { remove: () => void };
}

let isInitialized = false;
let lastAdShown = 0;
let lastRewardedAdShown = 0;
// Charger le dernier timestamp depuis localStorage pour conserver le cooldown entre relances
try {
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem('hm-ads-rewarded-last');
    const ts = raw ? Number(raw) : 0;
    if (!Number.isNaN(ts) && ts > 0) {
      lastRewardedAdShown = ts;
    }
  }
} catch {}
const MIN_AD_INTERVAL = 120000; // 2 minutes entre chaque pub interstitielle
const MIN_REWARDED_AD_INTERVAL = 300000; // 5 minutes entre chaque pub récompensée

/**
 * Vérifier si on est sur une plateforme native
 */
function isNativePlatform(): boolean {
  // Capacitor v6+: isNativePlatform() peut être une fonction ou absent selon le bundle.
  if (typeof window === 'undefined') return false;
  const cap = (window as any).Capacitor;
  let result = false;
  try {
    const fn = cap?.isNativePlatform;
    if (typeof fn === 'function') {
      result = !!fn();
    } else if (cap?.platform && cap.platform !== 'web') {
      // Fallback heuristique: platform différent de 'web'
      result = true;
    }
  } catch {}
  console.log('[Ads] isNativePlatform:', result);
  console.log('[Ads] Capacitor available:', !!cap);
  console.log('[Ads] Capacitor.platform:', cap?.platform);
  return result;
}

/**
 * Obtenir le plugin AdMob via Capacitor
 */
function getAdMobPlugin(): AdMobPlugin | null {
  if (typeof window === 'undefined') return null;
  
  const Capacitor = (window as any).Capacitor;
  console.log('[Ads] Capacitor:', Capacitor);
  console.log('[Ads] Capacitor.Plugins:', Capacitor?.Plugins);
  console.log('[Ads] Capacitor.Plugins.AdMob:', Capacitor?.Plugins?.AdMob);
  
  if (!Capacitor?.Plugins) return null;
  
  return Capacitor.Plugins.AdMob as AdMobPlugin;
}

/**
 * Initialiser AdMob (à appeler au démarrage de l'app)
 */
export async function initializeAds(): Promise<void> {
  if (isInitialized) return;
  const native = isNativePlatform();
  if (!native) {
    console.log('[Ads] Skip initialization (web/PWA)');
    return;
  }

  // Vérifier le consentement RGPD
  if (typeof window !== 'undefined') {
    try {
      let consent = localStorage.getItem('hm-ad-consent');
      // Si pas encore décidé côté Web, tenter le consentement natif via UMP
      if (!consent) {
        const AdMobMaybe = getAdMobPlugin();
        if (AdMobMaybe && typeof AdMobMaybe.requestConsent === 'function') {
          try {
            const res = await AdMobMaybe.requestConsent();
            // res.npa === true => Non-personalized Ads
            if (res && typeof res.npa === 'boolean') {
              const value = res.npa ? 'npa' : 'accepted';
              try {
                localStorage.setItem('hm-ad-consent', value);
                localStorage.setItem('hm-ad-consent-date', new Date().toISOString());
              } catch {}
              consent = value;
            }
          } catch (e) {
            console.warn('[Ads] Native requestConsent failed:', e);
          }
        }
      }

      // Autoriser l'init si consent = 'accepted' (personnalisé) OU 'npa' (non personnalisé)
      if (consent !== 'accepted' && consent !== 'npa') {
        console.log('[Ads] User has not accepted ad consent, skipping initialization');
        return;
      }
    } catch {}
  }

  try {
    const AdMob = getAdMobPlugin();
    if (!AdMob) {
      console.log('[Ads] AdMob plugin not available');
      return;
    }
    
    await AdMob.initialize();
    isInitialized = true;

    // Brancher des listeners utiles pour le debugging et la télémétrie légère
    try {
      AdMob.addListener?.('adShowed', () => console.log('[Ads] Event: adShowed'));
      AdMob.addListener?.('adDismissed', () => console.log('[Ads] Event: adDismissed'));
      AdMob.addListener?.('rewardedAdShowed', () => console.log('[Ads] Event: rewardedAdShowed'));
      AdMob.addListener?.('rewardedAdDismissed', () => console.log('[Ads] Event: rewardedAdDismissed'));
      AdMob.addListener?.('rewardEarned', (r) => console.log('[Ads] Event: rewardEarned', r));
    } catch (e) {
      console.warn('[Ads] Failed to attach listeners:', e);
    }
    
    // Précharger les annonces
    await loadInterstitialAd();
    await loadRewardedAd();
    
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
 * Charger une annonce récompensée
 */
async function loadRewardedAd(): Promise<void> {
  if (!isNativePlatform()) return;
  
  const AdMob = getAdMobPlugin();
  if (!AdMob || !isInitialized) return;

  try {
    await AdMob.loadRewardedAd();
    console.log('[Ads] Rewarded ad loaded');
  } catch (error) {
    console.error('[Ads] Failed to load rewarded ad:', error);
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
 * Afficher une annonce récompensée et recevoir une récompense
 * @param onReward Callback appelé quand l'utilisateur gagne la récompense
 * @returns true si l'annonce a été affichée, false sinon
 */
type RewardedAdOptions = {
  onReward?: (amount: number, type: string) => void;
  ignoreCooldown?: boolean;
};

export async function showRewardedAdForReward(
  onRewardOrOptions?: ((amount: number, type: string) => void) | RewardedAdOptions,
): Promise<boolean> {
  if (!isNativePlatform()) {
    console.log('[Ads] Not on native platform');
    return false;
  }
  
  const AdMob = getAdMobPlugin();
  if (!AdMob || !isInitialized) {
    console.log('[Ads] AdMob not initialized');
    return false;
  }

  const options: RewardedAdOptions =
    typeof onRewardOrOptions === 'function'
      ? { onReward: onRewardOrOptions }
      : (onRewardOrOptions ?? {});
  const ignoreCooldown = options.ignoreCooldown ?? false;

  // Vérifier l'intervalle minimum entre les pubs récompensées
  const now = Date.now();
  if (!ignoreCooldown) {
    if (now - lastRewardedAdShown < MIN_REWARDED_AD_INTERVAL) {
      const remainingTime = Math.ceil((MIN_REWARDED_AD_INTERVAL - (now - lastRewardedAdShown)) / 60000);
      console.log(`[Ads] Too soon to show another rewarded ad. Wait ${remainingTime} more minutes`);
      return false;
    }
  }

  try {
    // Vérifier si une annonce est prête
    const { ready } = await AdMob.isRewardedAdReady();
    if (!ready) {
      console.log('[Ads] No rewarded ad ready to show, loading new one...');
      // Essayer de charger une nouvelle annonce pour la prochaine fois
      loadRewardedAd();
      return false;
    }

    // Afficher l'annonce et attendre la récompense
  const reward = await AdMob.showRewardedAd();
  if (!ignoreCooldown) {
    lastRewardedAdShown = now;
    try { if (typeof window !== 'undefined') localStorage.setItem('hm-ads-rewarded-last', String(now)); } catch {}
  }
    
    // Appeler le callback avec la récompense
    if (options.onReward) {
      options.onReward(reward.amount, reward.type);
    }
    
    // Précharger la prochaine annonce
    loadRewardedAd();
    
    console.log(`[Ads] Rewarded ad shown successfully. Reward: ${reward.amount} ${reward.type}`);
    return true;
  } catch (error) {
    console.error('[Ads] Failed to show rewarded ad:', error);
    return false;
  }
}

/**
 * Vérifier si une annonce récompensée est disponible
 */
export async function isRewardedAdReady(options?: { ignoreCooldown?: boolean }): Promise<boolean> {
  if (!isNativePlatform()) {
    return false;
  }
  
  const AdMob = getAdMobPlugin();
  if (!AdMob || !isInitialized) {
    return false;
  }

  // Vérifier aussi le cooldown
  const now = Date.now();
  if (!options?.ignoreCooldown) {
    if (now - lastRewardedAdShown < MIN_REWARDED_AD_INTERVAL) {
      return false;
    }
  }

  try {
    const { ready } = await AdMob.isRewardedAdReady();
    return ready;
  } catch (error) {
    return false;
  }
}

/**
 * Obtenir le temps restant avant de pouvoir afficher une nouvelle pub récompensée (en secondes)
 */
export function getRewardedAdCooldown(): number {
  const now = Date.now();
  const elapsed = now - lastRewardedAdShown;
  if (elapsed >= MIN_REWARDED_AD_INTERVAL) {
    return 0;
  }
  return Math.ceil((MIN_REWARDED_AD_INTERVAL - elapsed) / 1000);
}

/**
 * Exposer si les publicités sont supportées (plateforme native)
 */
export function isAdsSupported(): boolean {
  return isNativePlatform();
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



