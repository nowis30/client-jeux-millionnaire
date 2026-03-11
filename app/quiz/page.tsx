"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Onboarding from "../../components/Onboarding";
import CategorySelector from "../../components/CategorySelector";
import { formatMoney } from "../../lib/format";
import { QuizCategory } from "../../lib/quizCategories";

// API_BASE local supprimé: utiliser chemins relatifs (proxy /api/*)
// Utiliser API_BASE défini dans lib/api (abs pour Capacitor)
import { apiFetch, apiFetchRaw, ApiError } from "../../lib/api";
import { initializeAds, showRewardedAdForReward, isRewardedAdReady, getRewardedAdCooldown, isAdsSupported } from "../../lib/ads";
import { SFX } from "../../lib/sfx";

const BASE_STAKE = 50000;
// Échelle des gains + difficulté (1-4 enfant/facile, 5-7 moyen, 8-10 difficile)
// Nouvelle répartition difficulté:
// Q1-2: Enfant
// Q3-5: Moyen (tous sujets confondus)
// Q6-10: Difficile (QI / logique / haute complexité)
const PRIZE_LADDER = Array.from({ length: 10 }).map((_, i) => {
  const qNum = i + 1;
  return {
    question: qNum,
    amount: BASE_STAKE * Math.pow(2, i),
    difficulty: qNum <= 2 ? 'Enfant' : qNum <= 5 ? 'Moyen' : 'Difficile (QI)',
    milestone: false,
  };
});

type RevealResponse = {
  revealed: boolean;
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  completed?: boolean;
  finalPrize?: number;
  currentQuestion?: number;
  currentEarnings?: number;
  securedAmount?: number;
  skipsLeft?: number;
  nextPrize?: number;
  question?: {
    id: string;
    text: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    imageUrl: string | null;
  };
  message?: string;
};

export default function QuizPage() {
  const router = useRouter();
  const [isClassic, setIsClassic] = useState(false);
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      setIsClassic((sp.get("classic") ?? "") === "1");
    } catch {}
  }, []);
  const [gameId, setGameId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [online, setOnline] = useState<number | null>(null);
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [question, setQuestion] = useState<any>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isAnswering, setIsAnswering] = useState(false);
  const [stats, setStats] = useState<{
    remaining?: number;
    remainingByCategory?: { finance: number; economy: number; realEstate: number };
    categories?: Array<{ category: string; remaining: number; total?: number; used?: number }>;
  } | null>(null);
  // Toggle pour afficher le panneau détaillé des catégories
  const [showCategoryDetails, setShowCategoryDetails] = useState(false);
  const [revealCorrect, setRevealCorrect] = useState<'A'|'B'|'C'|'D'|null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [showTimeoutReveal, setShowTimeoutReveal] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  
  // Système de passes (gagné en regardant des pubs)
  const [lifePasses, setLifePasses] = useState<number>(0);
  const [showPassOffer, setShowPassOffer] = useState(false);
  const [isLoadingAd, setIsLoadingAd] = useState(false);
  const [tokenAdReady, setTokenAdReady] = useState(false);
  const [tokenAdCooldown, setTokenAdCooldown] = useState(0);
  const [tokenAdLoading, setTokenAdLoading] = useState(false);
  const [tokenAdMessage, setTokenAdMessage] = useState<string | null>(null);
  const [tokenAdError, setTokenAdError] = useState<string | null>(null);
  const [adsSupported, setAdsSupported] = useState<boolean>(false);
  const [revealLoading, setRevealLoading] = useState(false);
  const [revealError, setRevealError] = useState<string | null>(null);
  
  // État pour le sélecteur de catégories
  const [showCategorySelector, setShowCategorySelector] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<QuizCategory[]>([]);

  // À chaque nouvelle question, réinitialiser proprement l'état d'affichage
  useEffect(() => {
    if (question?.id) {
      // Remettre en haut de la page pour éviter un chevauchement visuel perçu
      try { window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }); } catch { try { window.scrollTo(0, 0); } catch {} }
      // Nettoyer les états visuels/interaction
      setSelectedAnswer(null);
      setRevealCorrect(null);
  setTimeLeft(60);
      setShowTimeoutReveal(false);
      setRevealError(null);
    }
  }, [question?.id]);

  useEffect(() => {
    void initializeAds();
    setAdsSupported(isAdsSupported());
  }, []);

  useEffect(() => {
    let cancelled = false;
    const update = async () => {
      try {
        const ready = await isRewardedAdReady();
        if (!cancelled) setTokenAdReady(ready);
        if (!cancelled) {
          const pluginCooldown = getRewardedAdCooldown();
          if (pluginCooldown > 0) {
            setTokenAdCooldown(prev => Math.max(prev, pluginCooldown));
          }
        }
      } catch {}
    };
    update();
    const interval = setInterval(update, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  useEffect(() => {
    if (tokenAdCooldown <= 0) return;
    const timer = setInterval(() => {
      setTokenAdCooldown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [tokenAdCooldown > 0]);

  // Timer 30s
  useEffect(() => {
    if (!session || !question || revealCorrect || showTimeoutReveal) return;
    if (timeLeft <= 0) {
      // Déclencher timeout côté serveur
      (async () => {
        try {
          const res = await apiFetchRaw(`/api/games/${gameId}/quiz/timeout`, {
            method:'POST',
            headers: { 'Content-Type':'application/json' },
            body: JSON.stringify({ sessionId: session.id, questionId: question.id })
          });
          if (!res.ok) {
            const err = await res.json().catch(()=>({}));
            throw new Error(err.error||'Timeout quiz erreur');
          }
          const data = await res.json();
          setRevealCorrect(data.correctAnswer as any);
          setShowTimeoutReveal(true);
          setFeedback({ type: 'error', message: data.message });
          // Après 5s retour à l'état initial
          setTimeout(() => {
            setRevealCorrect(null);
            setShowTimeoutReveal(false);
            setSession(null);
            setQuestion(null);
            loadStatus();
            loadStats();
          }, 5000);
        } catch (e:any) {
          setFeedback({ type:'error', message: e.message });
        }
      })();
      return;
    }
    const id = setTimeout(()=> setTimeLeft(t => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timeLeft, session, question, revealCorrect, showTimeoutReveal, playerId, gameId]);

  const ensureSession = useCallback(async () => {
    try {
      const sessionStr = localStorage.getItem("hm-session");
      console.log("[Quiz] Session from localStorage:", sessionStr);
      if (sessionStr) {
        const sessionData = JSON.parse(sessionStr);
        if (sessionData?.gameId) {
          setGameId(sessionData.gameId);
          setPlayerId(sessionData.playerId);
          return true;
        }
      }
      console.warn('[Quiz] No session found, fallback auto-join');
      const resList = await apiFetchRaw(`/api/games`);
      if (!resList.ok) throw new Error('Liste parties indisponible');
      const dataList = await resList.json();
      const g = dataList.games?.[0];
      if (!g) throw new Error('Aucune partie disponible');
      const resJoin = await apiFetchRaw(`/api/games/${g.id}/join`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({})
      });
      if (!resJoin.ok) throw new Error('Join échoué');
      const dataJoin = await resJoin.json();
      const sess = { gameId: g.id, playerId: dataJoin.playerId, nickname: '' };
      try { localStorage.setItem('hm-session', JSON.stringify(sess)); } catch {}
      setGameId(g.id);
      setPlayerId(dataJoin.playerId);
      return true;
    } catch (e:any) {
      console.error('[Quiz] ensureSession error:', e.message);
      return false;
    }
  }, []);

  useEffect(() => {
    (async () => {
      const ok = await ensureSession();
      if (!ok) {
        setTimeout(() => router.push('/'), 1500);
        return;
      }
      try {
        const seen = localStorage.getItem("hm-tutorial-quiz");
        if (!seen) setShowTutorial(true);
      } catch {}
      // Pause musique globale (événement) quand on arrive sur la page quiz
      try { window.dispatchEvent(new Event('hm-music/pause')); } catch {}
    })();
    // À la sortie de la page, reprendre la musique
    return () => { try { window.dispatchEvent(new Event('hm-music/resume')); } catch {} };
  }, [ensureSession, router]);

  useEffect(() => {
    if (gameId) {
      loadStatus();
      loadStats();
      // Charger puis rafraîchir le nombre en ligne
      const loadOnline = async () => {
        try {
  const res = await apiFetchRaw(`/api/games/${gameId}/online`);
          if (!res.ok) return;
          const data = await res.json();
          setOnline(Number(data.online ?? 0));
        } catch {}
      };
      loadOnline();
      const iv = setInterval(loadOnline, 15000);
      return () => clearInterval(iv);
    }
  }, [gameId]);

  async function loadStats() {
    try {
  const res = await apiFetchRaw(`/api/quiz/public-stats`);
      if (!res.ok) return;
      const data = await res.json();
      const dynamicCats: Array<{ category: string; remaining: number; total?: number; used?: number }> | undefined = Array.isArray(data.categories)
        ? data.categories.map((c: any) => ({ category: String(c.category ?? 'autre'), remaining: Number(c.remaining ?? 0), total: Number(c.total ?? 0), used: Number(c.used ?? 0) }))
        : undefined;
      setStats({ remaining: Number(data.remaining ?? 0), remainingByCategory: data.remainingByCategory, categories: dynamicCats });
    } catch {}
  }

  async function loadStatus(options?: { silent?: boolean }) {
    try {
      if (!options?.silent) {
        setLoading(true);
      }
      console.log("[Quiz] Loading status for game:", gameId);
      
      const res = await apiFetchRaw(`/api/games/${gameId}/quiz/status`);

      console.log("[Quiz] Status response:", res.status, res.statusText);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("[Quiz] Status error:", errorData);
        throw new Error(errorData.error || "Erreur chargement status");
      }

      const data = await res.json();
      console.log("[Quiz] Status data:", data);
      setStatus(data);
      if (typeof data?.adCooldownSeconds === 'number') {
        setTokenAdCooldown(prev => Math.max(prev, Number(data.adCooldownSeconds)));
      }

      if (data.hasActiveSession) {
        setSession(data.session);
        // Éviter de régénérer une nouvelle question à chaque simple rafraîchissement du statut.
        if (!question || session?.id !== data.session.id) {
          await startSession(data.session.id, true);
        }
      }
      // Rafraîchir les stats d'affichage
      loadStats();
    } catch (err: any) {
      console.error("[Quiz] Error in loadStatus:", err);
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleTokenAdRecharge() {
    if (!gameId || !playerId) {
      setTokenAdError("Session introuvable. Rejoignez d'abord une partie.");
      return;
    }
    if (tokenAdLoading) return;

    setTokenAdLoading(true);
    setTokenAdError(null);
    setTokenAdMessage(null);

    try {
      const ready = await isRewardedAdReady();
      if (!ready) {
        const pluginCooldown = getRewardedAdCooldown();
        if (pluginCooldown > 0) {
          setTokenAdCooldown(prev => Math.max(prev, pluginCooldown));
        }
        throw new Error("La publicité n'est pas encore prête. Réessayez bientôt.");
      }

      const displayed = await showRewardedAdForReward();
      if (!displayed) {
        throw new Error("Impossible d'afficher la publicité maintenant.");
      }

      const res = await apiFetch<{ tokens?: number; added?: number; cooldownSeconds?: number }>(
        `/api/games/${gameId}/tokens/ads`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Player-ID': playerId },
          body: JSON.stringify({ type: 'quiz' }),
        }
      );

      const added = Number(res?.added ?? 0);
      const updatedTokens = typeof res?.tokens === 'number' ? Number(res.tokens) : undefined;
      if (typeof updatedTokens === 'number') {
        setStatus((prev: any) => prev ? { ...prev, tokens: updatedTokens, canPlay: updatedTokens > 0 } : prev);
      }
      setTokenAdMessage(added > 0 ? `+${added} tokens ajoutés ✅` : 'Tokens déjà au maximum ✅');

      const serverCooldown = Number(res?.cooldownSeconds ?? 0);
      const pluginCooldown = getRewardedAdCooldown();
      const nextCooldown = Math.max(serverCooldown, pluginCooldown);
      if (nextCooldown > 0) {
        setTokenAdCooldown(prev => Math.max(prev, nextCooldown));
      }

      await loadStatus({ silent: true });
    } catch (err: any) {
      if (err instanceof ApiError) {
        setTokenAdError(err.message);
        if (err.status === 429) {
          const match = err.message.match(/(\d+)/);
          if (match) {
            const minutes = Number(match[1]);
            if (!Number.isNaN(minutes)) {
              setTokenAdCooldown(prev => Math.max(prev, minutes * 60));
            }
          }
        }
      } else if (err instanceof Error) {
        setTokenAdError(err.message);
      } else {
        setTokenAdError('Recharge indisponible pour le moment.');
      }
    } finally {
      setTokenAdLoading(false);
      setTimeout(() => {
        void isRewardedAdReady().then(ready => setTokenAdReady(ready));
      }, 500);
    }
  }

  async function revealAnswerViaAd() {
    if (!session || !question || !gameId) return;
    if (revealLoading || showTimeoutReveal) return;

    setRevealError(null);

    if (!adsSupported) {
      setRevealError('Révélation disponible uniquement sur l’application Android.');
      return;
    }

    setRevealLoading(true);

    try {
      const displayed = await showRewardedAdForReward({ ignoreCooldown: true });
      if (!displayed) {
        throw new Error("Publicité indisponible. Réessayez dans un instant.");
      }

      const data = await apiFetch<RevealResponse>(
        `/api/games/${gameId}/quiz/reveal`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: session.id, questionId: question.id }),
        }
      );

      const correct = data.correctAnswer as 'A' | 'B' | 'C' | 'D' | undefined;
      if (!correct) {
        throw new Error('Réponse invalide renvoyée.');
      }

      setRevealCorrect(correct);
      setSelectedAnswer(correct);
      setFeedback({ type: 'success', message: data.message ?? `Réponse ${correct} révélée ✅` });
      SFX.correct();

      if (data.completed) {
        setTimeout(() => {
          setRevealCorrect(null);
          setSession(null);
          setQuestion(null);
          setSelectedAnswer(null);
          loadStatus();
          loadStats();
        }, 2500);
        return;
      }

      if (data.question) {
        setTimeout(() => {
          setRevealCorrect(null);
          setSelectedAnswer(null);
          setSession((prev: any) => {
            if (!prev) return prev;
            const nextQuestionNumber = data.currentQuestion ?? (prev.currentQuestion + 1);
            const ladderIndex = Math.max(0, Math.min(PRIZE_LADDER.length - 1, nextQuestionNumber - 1));
            const fallbackNextPrize = PRIZE_LADDER[ladderIndex]?.amount ?? prev.nextPrize;
            return {
              id: prev.id,
              currentQuestion: nextQuestionNumber,
              currentEarnings: data.currentEarnings ?? prev.currentEarnings,
              securedAmount: data.securedAmount ?? (prev.securedAmount ?? 0),
              skipsLeft: typeof data.skipsLeft === 'number' ? data.skipsLeft : (prev.skipsLeft ?? 0),
              nextPrize: data.nextPrize ?? fallbackNextPrize,
            };
          });
          setQuestion(data.question);
          setTimeLeft(60);
          loadStats();
        }, 2500);
      }
    } catch (err: any) {
      if (err instanceof ApiError) {
        setRevealError(err.message);
      } else {
        setRevealError(err?.message ?? 'Révélation indisponible pour le moment.');
      }
    } finally {
      setRevealLoading(false);
      setTimeout(() => {
        void isRewardedAdReady({ ignoreCooldown: true }).then((ready) => setTokenAdReady(ready));
      }, 500);
    }
  }

  const formatAdCooldown = useCallback((seconds: number) => {
    if (seconds <= 0) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}m ${secs.toString().padStart(2, '0')}s`;
    }
    return `${secs}s`;
  }, []);

  async function startSession(existingSessionId?: string, isResume = false, categories?: QuizCategory[]) {
    try {
      setLoading(true);
      setFeedback(null);

      if (isResume && existingSessionId) {
        // Reprendre la session: appeler l'endpoint resume pour récupérer la question courante
  const headers: Record<string, string> = {}; // X-CSRF retiré
        if (playerId) headers["X-Player-ID"] = playerId;

  const res = await apiFetchRaw(`/api/games/${gameId}/quiz/resume`, {
          method: "GET",
          headers,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Erreur reprise de la session");
        }

        const data = await res.json();
        // Mettre à jour session (côté serveur, elle existe déjà)
        setSession({
          id: data.session.id,
          currentQuestion: data.session.currentQuestion,
          currentEarnings: data.session.currentEarnings,
          securedAmount: data.session.securedAmount,
          nextPrize: data.session.nextPrize,
          skipsLeft: data.session.skipsLeft ?? 0,
        });
        setQuestion(data.question);
        setSelectedAnswer(null);
        return;
      }

      const headers: Record<string, string> = { 
        "Content-Type": "application/json", 
  // X-CSRF retiré
      };
      if (playerId) {
        headers["X-Player-ID"] = playerId;
      }

  const res = await apiFetchRaw(`/api/games/${gameId}/quiz/start`, {
        method: "POST",
        headers,
        body: JSON.stringify({ 
          selectedCategories: categories && categories.length > 0 ? categories : undefined 
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur démarrage");
      }

      const data = await res.json();
      setSession({
        id: data.sessionId,
        currentQuestion: data.currentQuestion,
        currentEarnings: data.currentEarnings,
        securedAmount: data.securedAmount,
        nextPrize: data.nextPrize,
        skipsLeft: data.skipsLeft ?? 3,
      });
      setQuestion(data.question);
      setSelectedAnswer(null);
      setSelectedCategories(categories || []);
    } catch (err: any) {
      console.error(err);
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  }
  
  // Fonction pour ouvrir le sélecteur de catégories avant de démarrer
  function handleStartQuizClick() {
    setShowCategorySelector(true);
  }
  
  // Callback quand l'utilisateur valide sa sélection de catégories
  function handleCategoriesSelected(categories: QuizCategory[]) {
    setShowCategorySelector(false);
    startSession(undefined, false, categories);
  }
  
  // Callback quand l'utilisateur annule la sélection
  function handleCategoriesCancelled() {
    setShowCategorySelector(false);
  }

  async function submitAnswer() {
    if (!selectedAnswer || !question || !session) return;

    try {
      setIsAnswering(true);
      setFeedback(null);

      const headers: Record<string, string> = { 
        "Content-Type": "application/json", 
  // X-CSRF retiré
      };
      if (playerId) {
        headers["X-Player-ID"] = playerId;
      }

  const res = await apiFetchRaw(`/api/games/${gameId}/quiz/answer`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          sessionId: session.id,
          questionId: question.id,
          answer: selectedAnswer,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur réponse");
      }

      const data = await res.json();

      if (data.correct) {
        // Son de victoire
        SFX.correct();
        if (data.completed) {
          setFeedback({ type: 'success', message: data.message });
          setSession(null);
          setQuestion(null);
          setTimeout(() => { loadStatus(); loadStats(); }, 2000);
        } else {
          // Question suivante
          setSession({
            id: session.id,
            currentQuestion: data.currentQuestion,
            currentEarnings: data.currentEarnings,
            securedAmount: data.securedAmount,
            nextPrize: data.nextPrize,
            // Conserver/mettre à jour les sauts restants
            skipsLeft: typeof data.skipsLeft === 'number' ? data.skipsLeft : (session.skipsLeft ?? 0),
          });
          setQuestion(data.question);
          setSelectedAnswer(null);
          setFeedback({ type: 'success', message: '✓ Bonne réponse !' });
          // Une question a été consommée: mettre à jour les stats
          loadStats();
        }
      } else {
        // Mauvaise réponse: vérifier si le joueur a une passe de vie
        setFeedback({ type: 'error', message: data.message });
        setRevealCorrect(data.correctAnswer as 'A'|'B'|'C'|'D');
        // Son d'échec
        SFX.wrong();
        
        // Si le joueur a une passe, lui proposer de l'utiliser
        if (lifePasses > 0) {
          setShowPassOffer(true);
        } else {
          // Pas de passe: comportement normal, fin du quiz après 5s
          setTimeout(() => {
            setRevealCorrect(null);
            setSession(null);
            setQuestion(null);
            setSelectedAnswer(null);
            loadStatus();
            loadStats();
          }, 5000);
        }
      }
    } catch (err: any) {
      console.error(err);
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setIsAnswering(false);
    }
  }

  async function cashOut() {
    if (!session) return;

    if (!confirm(`Voulez-vous encaisser ${formatMoney(session.currentEarnings)} ?`)) {
      return;
    }

    try {
      setLoading(true);
      setFeedback(null);

  const headers: Record<string, string> = { "Content-Type": "application/json" }; // X-CSRF retiré
      if (playerId) {
        headers["X-Player-ID"] = playerId;
      }

  const res = await apiFetchRaw(`/api/games/${gameId}/quiz/cash-out`, {
        method: "POST",
        headers,
        body: JSON.stringify({ sessionId: session.id }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur encaissement");
      }

      const data = await res.json();
      setFeedback({ type: 'success', message: data.message });
      setSession(null);
      setQuestion(null);
  // Son de victoire à l'encaissement
  SFX.correct();
      
      // Afficher une annonce après avoir encaissé (seulement sur mobile)
      // Attendre un peu pour s'assurer que l'init AdMob est terminée
      setTimeout(async () => {
        try {
          const { showInterstitialAd } = await import('../../lib/ads');
          const shown = await showInterstitialAd();
          if (!shown) {
            console.log('[Quiz] Ad not ready or cooldown active');
          }
        } catch (adErr) {
          // Ignorer les erreurs pub (pas critique)
          console.log('[Quiz] Ad error:', adErr);
        }
      }, 500);
      
  setTimeout(() => { loadStatus(); loadStats(); }, 2000);
    } catch (err: any) {
      console.error(err);
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  }

  // Regarder une pub pour obtenir une passe de vie
  async function watchAdForLifePass() {
    setIsLoadingAd(true);
    try {
      const { showInterstitialAd } = await import('../../lib/ads');
      const shown = await showInterstitialAd();
      
      if (shown) {
        // Pub visionnée avec succès, donner une passe
        setLifePasses(prev => prev + 1);
        setFeedback({ type: 'success', message: '🎁 +1 Passe de vie obtenue !' });
        // Son de récompense
        SFX.reward();
      } else {
        setFeedback({ type: 'error', message: 'Aucune publicité disponible pour le moment' });
      }
    } catch (err) {
      console.error('[Quiz] Error watching ad:', err);
      setFeedback({ type: 'error', message: 'Erreur lors du chargement de la publicité' });
    } finally {
      setIsLoadingAd(false);
    }
  }

  // Utiliser une passe pour continuer après une mauvaise réponse
  function useLifePass() {
    if (lifePasses > 0) {
      setLifePasses(prev => prev - 1);
      setShowPassOffer(false);
      setFeedback({ type: 'success', message: '✨ Passe utilisée ! Vous continuez le quiz.' });
      // Son de récompense lors de l'utilisation d'une passe
      SFX.reward();
      // Recharger le statut pour obtenir la prochaine question
      setTimeout(() => loadStatus(), 1000);
    }
  }

  async function skipQuestion() {
    if (!session || !question) return;
    if ((session.skipsLeft ?? 0) <= 0) {
      setFeedback({ type: 'error', message: "Vous n'avez plus de sauts disponibles." });
      return;
    }

    try {
      setIsAnswering(true);
      setFeedback(null);

      const headers: Record<string, string> = { 
        "Content-Type": "application/json",
  // X-CSRF retiré
      };
      if (playerId) headers["X-Player-ID"] = playerId;

  const res = await apiFetchRaw(`/api/games/${gameId}/quiz/skip`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ sessionId: session.id, questionId: question.id })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Impossible de passer la question');
      }
      const data = await res.json();
      // Révéler la bonne réponse 3s avant de charger la nouvelle question
      setRevealCorrect(data.correctAnswer as any);
      setFeedback({ type: 'success', message: `Réponse: ${data.correctAnswer} (question passée)` });
      setIsAnswering(true);
      setTimeout(() => {
        setRevealCorrect(null);
        setIsAnswering(false);
        setSession({
          id: data.session.id,
          currentQuestion: data.session.currentQuestion,
          currentEarnings: data.session.currentEarnings,
          securedAmount: data.session.securedAmount,
          nextPrize: data.session.nextPrize,
          skipsLeft: data.session.skipsLeft ?? Math.max(0, (session.skipsLeft ?? 0) - 1),
        });
        setQuestion(data.question);
        setSelectedAnswer(null);
  setTimeLeft(60);
        setFeedback({ type: 'success', message: `Question passée. Il vous reste ${data.session.skipsLeft} saut(s).` });
      }, 3000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      // Le reset de isAnswering se fait après le reveal quand skip réussi
      if (!revealCorrect) setIsAnswering(false);
    }
  }

  if (loading && !question) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 text-white flex items-center justify-center">
        <div className="text-surface-on text-center">
          <div className="text-xl mb-4">Chargement...</div>
          {feedback && (
            <div className="mt-4 p-4 border border-rose-700/60 bg-rose-900/30 rounded-card max-w-md mx-auto">
              <div className="font-bold mb-2">❌ Erreur</div>
              <div className="text-sm">{feedback.message}</div>
              <button 
                onClick={() => router.push("/")}
                className="mt-4 ui-btn ui-btn--neutral"
              >
                ← Retour à l'accueil
              </button>
            </div>
          )}
          {/* Fallback si session existe mais question pas encore chargée (reprise) */}
          {session && !question && (
            <div className="mt-6">
              <div className="text-sm text-surface-muted mb-2">Reprise de la session en cours...</div>
              <button
                onClick={() => startSession(session.id, true)}
                className="ui-btn ui-btn--warning font-bold"
              >
                🔄 Reprendre maintenant
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 text-white p-4 overflow-x-hidden">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <button
            onClick={() => router.push("/")}
            className="ui-btn ui-btn--neutral"
          >
            ← Retour
          </button>
          <h1 className="text-3xl font-bold text-center">💰 Quitte ou Double</h1>
          <div className="text-sm text-surface-muted min-w-[120px] text-right">
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowTutorial(true)}
                className="ui-btn ui-btn--neutral px-2 py-1"
                title="Voir le tutoriel"
              >
                ❓ Tutoriel
              </button>
              {online != null ? (
                <span title="Joueurs connectés à la partie">👥 {online} en ligne</span>
              ) : (
                <span className="text-surface-muted"> </span>
              )}
            </div>
          </div>
        </div>

        {/* Statistiques des questions en banque */}
        {stats && (
          <div className="mb-6 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              {typeof stats.remaining === 'number' && (
                <span className="ui-badge border-emerald-700 text-emerald-300 bg-emerald-900/30">
                  Questions totales: {stats.remaining}
                </span>
              )}
              {status?.tokens === 20 && (
                <span className="ui-badge border-amber-500 text-amber-300 bg-amber-900/20 font-semibold" title="Vous avez atteint le maximum de tokens">
                  ✅ Max tokens (20)
                </span>
              )}
              {stats.categories && stats.categories.length > 0 ? (
                <>
                  <div className="flex items-center gap-1 flex-wrap">
                    {stats.categories.slice(0, 5).map((c) => (
                      <span
                        key={c.category}
                        className="ui-badge"
                        title={`Restantes: ${c.remaining} / Total: ${c.total ?? '?'} (Utilisées: ${c.used ?? '?'})`}
                      >
                        {c.category} {c.remaining}
                      </span>
                    ))}
                    {stats.categories.length > 5 && (
                      <span className="ui-badge">
                        +{stats.categories.length - 5} autres
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setShowCategoryDetails(v => !v)}
                    className="ml-2 ui-btn ui-btn--info px-2 py-1"
                  >
                    {showCategoryDetails ? 'Fermer détails' : 'Détails catégories'}
                  </button>
                </>
              ) : (
                stats.remainingByCategory && (
                  <span className="ui-badge">
                    Finance {stats.remainingByCategory.finance} · Économie {stats.remainingByCategory.economy} · Immo {stats.remainingByCategory.realEstate}
                  </span>
                )
              )}
            </div>
            {showCategoryDetails && stats.categories && stats.categories.length > 0 && (
              <div className="mt-4 ui-card bg-white/10 backdrop-blur rounded-xl border border-white/10 p-4">
                <h4 className="text-center font-bold mb-3">📂 Banque par catégorie</h4>
                <div className="space-y-2">
                  {stats.categories
                    .slice()
                    .sort((a,b) => a.category.localeCompare(b.category))
                    .map(cat => {
                      const total = cat.total ?? (cat.remaining + (cat.used ?? 0));
                      const used = cat.used ?? (total - cat.remaining);
                      const percent = total > 0 ? Math.round((cat.remaining / total) * 100) : 0;
                      const isTargetedMedium = ['definitions','quebec','religions'].includes(cat.category.toLowerCase());
                      const isKids = ['enfant','kids','enfants'].includes(cat.category.toLowerCase());
                      return (
                        <div key={cat.category} className={`p-2 rounded border ${isKids ? 'border-emerald-500/60 bg-emerald-900/20' : isTargetedMedium ? 'border-purple-400/60 bg-purple-900/20' : 'border-surface-divider bg-surface-1'}`}>
                          <div className="flex justify-between items-center mb-1">
                            <div className="font-semibold flex items-center gap-2">
                              <span>{cat.category}</span>
                              {isKids && <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-800/40 border border-emerald-600">Enfants (Q1-2)</span>}
                              {isTargetedMedium && <span className="text-[10px] px-2 py-0.5 rounded bg-purple-800/40 border border-purple-600">Ciblée (Q3-5)</span>}
                            </div>
                            <div className="text-xs text-surface-muted">Restantes {cat.remaining} / Total {total} · Utilisées {used}</div>
                          </div>
                          <div className="h-2 rounded overflow-hidden bg-black/30">
                            <div
                              className={`h-full transition-all ${percent < 25 ? 'bg-red-500' : percent < 50 ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <div className="mt-1 text-[10px] text-surface-muted">{percent}% restantes</div>
                        </div>
                      );
                    })}
                </div>
                <p className="mt-3 text-[10px] text-surface-muted text-center">Les catégories ciblées (Définitions, Québec, Religions) sont prioritaires pour les questions 3 à 5.</p>
              </div>
            )}
          </div>
        )}

        {/* Feedback */}
          {feedback && (
          <div className={`mb-6 p-4 rounded-xl border backdrop-blur ${feedback.type === 'success' ? 'border-emerald-400/50 bg-emerald-500/10' : 'border-rose-400/60 bg-rose-500/10'}`}>
            {feedback.message}
          </div>
        )}

        {/* Status - Pas de session active */}
        {!session && status && !status.hasActiveSession && (
          <div className="p-8 text-center bg-white/10 backdrop-blur rounded-xl border border-white/10">
            {/* Affichage des tokens */}
            <div className="mb-8 p-6 rounded-card border-2 border-amber-500/60 bg-gradient-to-r from-amber-500/15 to-orange-500/15">
              <h3 className="text-2xl font-bold mb-2">🎟️ Vos Tokens Quiz</h3>
              <div className="text-6xl font-bold text-amber-300 mb-2">{status.tokens || 0}</div>
              <p className="text-sm text-surface-muted">
                {status.tokens > 0 ? 
                  `Vous avez ${status.tokens} token${status.tokens > 1 ? 's' : ''} disponible${status.tokens > 1 ? 's' : ''}` :
                  "Aucun token disponible"
                }
              </p>
              {status.secondsUntilNextToken && (
                <p className="text-xs text-surface-muted mt-2">
                  ⏱️ Prochain token dans {Math.floor(status.secondsUntilNextToken / 60)} min {status.secondsUntilNextToken % 60} sec
                </p>
              )}
            </div>

              {adsSupported ? (
                <div className="mb-6 ui-card bg-white/10 backdrop-blur rounded-xl border border-white/10 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">Recharge instantanée 🎁</div>
                      <p className="text-xs text-surface-muted">Regardez une pub pour regagner +20 tokens (cooldown 30 min).</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { try { localStorage.removeItem('hm-ad-consent'); } catch {}; setTokenAdMessage('Consentement réinitialisé.'); }}
                      className="text-[11px] ui-btn ui-btn--neutral px-2 py-1"
                      title="Effacer le consentement pubs (UMP se réaffichera sur Android)"
                    >
                      Réinitialiser consentement
                    </button>
                  </div>
                  <button
                    onClick={handleTokenAdRecharge}
                    disabled={tokenAdLoading || tokenAdCooldown > 0 || !tokenAdReady || (status?.tokens ?? 0) >= 20}
                    className={`ui-btn ui-btn--primary w-full ${tokenAdLoading || tokenAdCooldown > 0 || !tokenAdReady || (status?.tokens ?? 0) >= 20 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {tokenAdLoading
                      ? 'Lecture en cours…'
                      : tokenAdCooldown > 0
                        ? `Disponible dans ${formatAdCooldown(tokenAdCooldown)}`
                        : (status?.tokens ?? 0) >= 20
                          ? 'Tokens déjà au maximum'
                        : tokenAdReady
                          ? '📺 Regarder une pub (+20 tokens)'
                          : 'Préparation de la pub…'}
                  </button>
                  {tokenAdMessage && <div className="text-xs text-emerald-300">{tokenAdMessage}</div>}
                  {tokenAdError && <div className="text-xs text-rose-300">{tokenAdError}</div>}
                </div>
              ) : (
                <div className="mb-6 ui-card bg-white/10 backdrop-blur rounded-xl border border-white/10 p-4 space-y-2">
                  <div className="text-sm font-semibold">Recharge par publicité disponible sur mobile</div>
                  <p className="text-xs text-surface-muted">Cette option est accessible depuis l'application mobile.</p>
                </div>
              )}

            {status.canPlay ? (
              <>
                <h2 className="text-2xl font-bold mb-4">Prêt à jouer ?</h2>
                <p className="mb-6 text-lg">
                  Répondez aux questions et accumulez des gains !<br />
                  Vous pouvez encaisser à tout moment ou continuer pour doubler vos gains.
                </p>
                <div className="mb-6 text-left max-w-md mx-auto ui-card bg-white/10 backdrop-blur rounded-xl border border-white/10 p-4">
                  <h3 className="font-bold mb-2">📜 Règles :</h3>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>1 token = 1 session de quiz</li>
                    <li>Gagnez 1 token automatiquement toutes les heures</li>
                    <li>Règle Quitte ou Double: on commence à 50 000 $</li>
                    <li>Chaque bonne réponse double vos gains (50k → 100k → 200k → 400k ...)</li>
                    <li>Vous pouvez encaisser à tout moment pour sécuriser vos gains</li>
                    <li>Mauvaise réponse = vous perdez tout</li>
                    <li>Vous pouvez sauter jusqu'à <b>3 questions</b> par session</li>
                    <li>Maximum 10 questions par session</li>
                    <li>Difficulté: Q1-2 enfants, Q3-5 moyenne (tous sujets), Q6-10 difficile (tests de QI)</li>
                  </ul>
                </div>
                <button onClick={handleStartQuizClick} className="ui-btn ui-btn--warning text-xl px-8 py-4">
                  🎮 Démarrer le Quiz (Coûte 1 token)
                </button>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold mb-4">⏰ Pas de token disponible</h2>
                <p className="mb-4 text-lg">
                  Prochain token dans <span className="font-bold text-amber-300">{Math.floor((status.secondsUntilNextToken || 0) / 60)} minutes</span>
                </p>
                <p className="text-sm text-surface-muted mb-4">
                  Vous gagnez automatiquement 1 token toutes les heures
                </p>
                <p className="text-xs text-surface-muted">
                  💡 Les tokens s'accumulent si vous ne jouez pas
                </p>
                <div className="mt-4 text-sm text-gray-300">
                  Ou gagnez immédiatement +20 tokens en regardant une publicité ci-dessus.
                </div>
              </>
            )}
          </div>
        )}

        {/* Session active */}
        {session && question && (
          <div className="space-y-6">
            {/* Progression */}
            <div className="ui-card bg-white/10 backdrop-blur rounded-xl border border-white/10 p-6">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-sm text-surface-muted">Question</div>
                  <div className="text-2xl font-bold">{session.currentQuestion} / 10</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-surface-muted">Gains actuels</div>
                  <div className="text-2xl font-bold text-green-400">{formatMoney(session.currentEarnings)}</div>
                </div>
              </div>
              {/* Timer */}
              <div className="mb-2 flex items-center justify-center">
                <div className={`text-lg font-mono px-4 py-1 rounded-full border ${timeLeft <= 5 ? 'bg-rose-600 border-rose-500 animate-pulse' : 'bg-black/30 border-surface-divider'}`}>⏱️ {timeLeft}s</div>
              </div>
              <div className="text-center text-sm text-surface-muted">Sauts restants : <span className="font-bold">{session.skipsLeft ?? 0} / 3</span></div>
              <div className="text-center text-sm text-purple-300 mt-1">
                ✨ Passes de vie : <span className="font-bold">{lifePasses}</span>
              </div>
              {session.skipsLeft === 0 && (
                <div className="mt-2 flex justify-center text-xs text-surface-muted">
                  Recharge de saut momentanément indisponible.
                </div>
              )}
              <div className="text-center">
                <div className="text-sm text-surface-muted mb-1">Prochain gain</div>
                <div className="text-3xl font-bold text-yellow-400">{formatMoney(session.nextPrize)}</div>
                {PRIZE_LADDER[session.currentQuestion - 1]?.milestone && (
                  <div className="mt-2 text-xs text-green-400">🛡️ Palier de sécurité</div>
                )}
              </div>
              {session.securedAmount > 0 && (
                <div className="mt-4 text-center text-sm text-surface-muted">
                  Montant sécurisé : <span className="font-bold text-green-400">{formatMoney(session.securedAmount)}</span>
                </div>
              )}
            </div>

            {/* Question */}
            <div key={question.id} className="ui-card bg-white/10 backdrop-blur rounded-xl border border-white/10 p-8">
              {/* Illustration de la question (réactivée, plus claire) */}
              {question.imageUrl && !isClassic && (
                <div className="mb-6 relative rounded-card overflow-hidden border border-surface-divider">
                  <img
                    src={question.imageUrl}
                    alt="Illustration de la question"
                    className="w-full max-h-72 object-cover brightness-110"
                  />
                  {/* Overlay léger pour garder les couleurs douces sans trop assombrir */}
                  <div className="absolute inset-0 pointer-events-none bg-black/10" />
                </div>
              )}

              <h2 className="text-2xl font-bold mb-6 text-center">{question.text}</h2>
              {showTimeoutReveal && (
                <div className="mb-4 text-center text-rose-300 text-sm">Temps écoulé — réponse correcte: <span className="font-bold">{revealCorrect}</span></div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {['A', 'B', 'C', 'D'].map((letter) => {
                  const isCorrect = revealCorrect === letter;
                  const isWrongSelected = revealCorrect && selectedAnswer === letter && revealCorrect !== selectedAnswer;
                  const disabled = !!revealCorrect; // Ne bloquer que si la réponse est révélée
                  const base = 'p-4 rounded-card text-left transition transform hover:scale-105';
                  const stateClass = revealCorrect
                    ? (isCorrect ? 'bg-green-400 text-black font-bold' : (isWrongSelected ? 'bg-red-600 text-white font-bold' : 'bg-white/5'))
                    : (selectedAnswer === letter ? 'bg-amber-400 text-black font-bold shadow-elev-1' : 'bg-white/5 hover:bg-white/10 text-white');
                  return (
                  <button
                    key={letter}
                    onClick={() => !disabled && setSelectedAnswer(letter)}
                    disabled={disabled}
                    className={`${base} ${stateClass} ${disabled ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    <span className="font-bold mr-2">{letter}.</span>
                    {question[`option${letter}`]}
                  </button>
                );})}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col md:flex-row gap-4">
              <button
                onClick={watchAdForLifePass}
                disabled={isLoadingAd}
                className={`ui-btn ui-btn--info w-full md:w-auto font-bold text-sm ${isLoadingAd ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="Regarder une publicité pour obtenir une passe de vie"
              >
                {isLoadingAd ? "⏳ ..." : "📺 Pub → +1 Passe"}
              </button>
              <button
                onClick={cashOut}
                disabled={isAnswering || session.currentEarnings === 0}
                className={`ui-btn ui-btn--primary w-full md:flex-1 font-bold text-lg ${isAnswering || session.currentEarnings === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                💰 Encaisser {formatMoney(session.currentEarnings)}
              </button>
              <button
                onClick={skipQuestion}
                disabled={isAnswering || !!revealCorrect || (session.skipsLeft ?? 0) <= 0}
                className={`ui-btn ui-btn--neutral w-full md:w-auto font-bold text-lg ${isAnswering || !!revealCorrect || (session.skipsLeft ?? 0) <= 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="Passer cette question"
              >
                ⏭️ Passer ({session.skipsLeft ?? 0}/3)
              </button>
              {adsSupported ? (
                <button
                  onClick={revealAnswerViaAd}
                  disabled={revealLoading || !!revealCorrect || showTimeoutReveal}
                  className={`ui-btn ui-btn--warning w-full md:w-auto font-bold text-sm ${revealLoading || !!revealCorrect || showTimeoutReveal ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title="Regarder une publicité pour obtenir automatiquement la bonne réponse"
                >
                  {revealLoading ? '⏳ Révélation...' : '📺 Réponse auto (pub)'}
                </button>
              ) : (
                <button
                  disabled
                  className="ui-btn ui-btn--neutral w-full md:w-auto font-bold text-sm cursor-not-allowed opacity-60"
                  title="Disponible uniquement sur l’application Android"
                >
                  📱 Réponse auto: Android requis
                </button>
              )}
              <button
                onClick={submitAnswer}
                disabled={!selectedAnswer || isAnswering || !!revealCorrect}
                className={`ui-btn ui-btn--info w-full md:flex-1 font-bold text-lg ${!selectedAnswer || isAnswering || !!revealCorrect ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isAnswering ? "⏳ ..." : "✓ Valider ma réponse"}
              </button>
            </div>
            {revealError && (
              <div className="text-xs text-rose-300 mt-2">{revealError}</div>
            )}
          </div>
        )}

        {/* Échelle des gains */}
        <div className="mt-8 ui-card bg-white/10 backdrop-blur rounded-xl border border-white/10 p-6">
          <h3 className="text-lg font-bold mb-4 text-center">📊 Échelle des gains</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
            {PRIZE_LADDER.map((prize) => (
              <div
                key={prize.question}
                className={`p-2 rounded-card text-center ${
                  session && session.currentQuestion === prize.question
                    ? 'bg-amber-400 text-black font-bold'
                    : 'bg-white/5'
                }`}
              >
                <div className="text-xs">Q{prize.question}</div>
                <div className="font-bold">{formatMoney(Math.round(prize.amount))}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {showTutorial && (
        <Onboarding onClose={() => setShowTutorial(false)} />
      )}

      {/* Modal: Sélection des catégories */}
      {showCategorySelector && (
        <CategorySelector
          onStart={handleCategoriesSelected}
          onCancel={handleCategoriesCancelled}
          categoryCounts={stats?.categories?.reduce((acc, cat) => {
            acc[cat.category] = cat.total ?? 0;
            return acc;
          }, {} as Record<string, number>) || {}}
        />
      )}
      
      {/* Modal: Utiliser une passe après une mauvaise réponse */}
      {showPassOffer && lifePasses > 0 && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="ui-card bg-white/10 backdrop-blur rounded-xl border border-purple-400/60 p-8 max-w-md w-full">
            <div className="text-center">
              <div className="text-6xl mb-4">✨</div>
              <h3 className="text-2xl font-bold mb-4">Mauvaise réponse !</h3>
              <p className="text-surface-on/90 mb-6">
                Vous avez <span className="font-bold text-amber-300">{lifePasses}</span> passe{lifePasses > 1 ? 's' : ''} de vie.
                <br />
                Voulez-vous en utiliser une pour continuer ?
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={useLifePass}
                  className="ui-btn ui-btn--primary w-full font-bold text-lg"
                >
                  ✓ Utiliser une passe et continuer
                </button>
                <button
                  onClick={() => {
                    setShowPassOffer(false);
                    // Comportement normal: fin du quiz après 5s
                    setTimeout(() => {
                      setRevealCorrect(null);
                      setSession(null);
                      setQuestion(null);
                      setSelectedAnswer(null);
                      loadStatus();
                      loadStats();
                    }, 5000);
                  }}
                  className="ui-btn ui-btn--neutral w-full font-bold"
                >
                  ✗ Non, arrêter le quiz
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
