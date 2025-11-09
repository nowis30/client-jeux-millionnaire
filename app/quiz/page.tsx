"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Onboarding from "../../components/Onboarding";
import { formatMoney } from "../../lib/format";
// Ads récompense désactivées temporairement: imports retirés

// API_BASE local supprimé: utiliser chemins relatifs (proxy /api/*)
const API_BASE = "";

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

export default function QuizPage() {
  const router = useRouter();
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
    }
  }, [question?.id]);

  // Timer 30s
  useEffect(() => {
    if (!session || !question || revealCorrect || showTimeoutReveal) return;
    if (timeLeft <= 0) {
      // Déclencher timeout côté serveur
      (async () => {
        try {
          const headers: Record<string,string> = { 'Content-Type':'application/json', 'X-CSRF':'1' };
          if (playerId) headers['X-Player-ID'] = playerId;
          const res = await fetch(`/api/games/${gameId}/quiz/timeout`, {
            method:'POST', credentials:'include', headers, body: JSON.stringify({ sessionId: session.id, questionId: question.id })
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

  useEffect(() => {
    // Chercher la session dans localStorage (clé: hm-session)
    try {
      const sessionStr = localStorage.getItem("hm-session");
      console.log("[Quiz] Session from localStorage:", sessionStr);
      
      if (!sessionStr) {
        console.warn("[Quiz] No session found, redirecting to home");
        router.push("/");
        return;
      }
      
      const sessionData = JSON.parse(sessionStr);
      console.log("[Quiz] Parsed session:", sessionData);
      
      if (!sessionData.gameId) {
        console.warn("[Quiz] No game ID in session, redirecting to home");
        router.push("/");
        return;
      }
      
      setGameId(sessionData.gameId);
      setPlayerId(sessionData.playerId); // Stocker le playerId aussi
      // Afficher le tutoriel une seule fois
      try {
        const seen = localStorage.getItem("hm-tutorial-quiz");
        if (!seen) setShowTutorial(true);
      } catch {}
    } catch (err) {
      console.error("[Quiz] Error loading session:", err);
      router.push("/");
    }
  }, [router]);

  useEffect(() => {
    if (gameId) {
      loadStatus();
      loadStats();
      // Charger puis rafraîchir le nombre en ligne
      const loadOnline = async () => {
        try {
    const res = await fetch(`/api/games/${gameId}/online`);
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
  const res = await fetch(`/api/quiz/public-stats`);
      if (!res.ok) return;
      const data = await res.json();
      const dynamicCats: Array<{ category: string; remaining: number; total?: number; used?: number }> | undefined = Array.isArray(data.categories)
        ? data.categories.map((c: any) => ({ category: String(c.category ?? 'autre'), remaining: Number(c.remaining ?? 0), total: Number(c.total ?? 0), used: Number(c.used ?? 0) }))
        : undefined;
      setStats({ remaining: Number(data.remaining ?? 0), remainingByCategory: data.remainingByCategory, categories: dynamicCats });
    } catch {}
  }

  async function loadStatus() {
    try {
      setLoading(true);
      console.log("[Quiz] Loading status for game:", gameId);
      
      const headers: Record<string, string> = { "X-CSRF": "1" };
      if (playerId) {
        headers["X-Player-ID"] = playerId; // Ajout du playerId pour iOS/Safari
      }
      
  const res = await fetch(`/api/games/${gameId}/quiz/status`, {
        credentials: "include",
        headers,
      });

      console.log("[Quiz] Status response:", res.status, res.statusText);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("[Quiz] Status error:", errorData);
        throw new Error(errorData.error || "Erreur chargement status");
      }

      const data = await res.json();
      console.log("[Quiz] Status data:", data);
      setStatus(data);

      if (data.hasActiveSession) {
        setSession(data.session);
        // Charger la question actuelle
        await startSession(data.session.id, true);
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

  async function startSession(existingSessionId?: string, isResume = false) {
    try {
      setLoading(true);
      setFeedback(null);

      if (isResume && existingSessionId) {
        // Reprendre la session: appeler l'endpoint resume pour récupérer la question courante
        const headers: Record<string, string> = { "X-CSRF": "1" };
        if (playerId) headers["X-Player-ID"] = playerId;

  const res = await fetch(`/api/games/${gameId}/quiz/resume`, {
          method: "GET",
          credentials: "include",
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
        "X-CSRF": "1" 
      };
      if (playerId) {
        headers["X-Player-ID"] = playerId;
      }

  const res = await fetch(`/api/games/${gameId}/quiz/start`, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({}),
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
    } catch (err: any) {
      console.error(err);
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  }

  async function submitAnswer() {
    if (!selectedAnswer || !question || !session) return;

    try {
      setIsAnswering(true);
      setFeedback(null);

      const headers: Record<string, string> = { 
        "Content-Type": "application/json", 
        "X-CSRF": "1" 
      };
      if (playerId) {
        headers["X-Player-ID"] = playerId;
      }

  const res = await fetch(`/api/games/${gameId}/quiz/answer`, {
        method: "POST",
        credentials: "include",
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

      const headers: Record<string, string> = { "Content-Type": "application/json", "X-CSRF": "1" };
      if (playerId) {
        headers["X-Player-ID"] = playerId;
      }

  const res = await fetch(`/api/games/${gameId}/quiz/cash-out`, {
        method: "POST",
        credentials: "include",
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
      
      // Afficher une annonce après avoir encaissé (seulement sur mobile)
      try {
        const { showInterstitialAd } = await import('../../lib/ads');
        await showInterstitialAd();
      } catch (adErr) {
        // Ignorer les erreurs pub (pas critique)
        console.log('[Quiz] Ad not shown:', adErr);
      }
      
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
        "X-CSRF": "1"
      };
      if (playerId) headers["X-Player-ID"] = playerId;

  const res = await fetch(`/api/games/${gameId}/quiz/skip`, {
        method: 'POST',
        credentials: 'include',
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
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="text-xl mb-4">Chargement...</div>
          {feedback && (
            <div className="mt-4 p-4 bg-red-600 rounded-lg max-w-md mx-auto">
              <div className="font-bold mb-2">❌ Erreur</div>
              <div className="text-sm">{feedback.message}</div>
              <button 
                onClick={() => router.push("/")}
                className="mt-4 px-4 py-2 bg-white/20 hover:bg-white/30 rounded"
              >
                ← Retour à l'accueil
              </button>
            </div>
          )}
          {/* Fallback si session existe mais question pas encore chargée (reprise) */}
          {session && !question && (
            <div className="mt-6">
              <div className="text-sm text-gray-300 mb-2">Reprise de la session en cours...</div>
              <button
                onClick={() => startSession(session.id, true)}
                className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-bold rounded"
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
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white p-4 overflow-x-hidden">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
          >
            ← Retour
          </button>
          <h1 className="text-3xl font-bold text-center">💰 Quitte ou Double</h1>
          <div className="text-sm text-gray-300 min-w-[120px] text-right">
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowTutorial(true)}
                className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded"
                title="Voir le tutoriel"
              >
                ❓ Tutoriel
              </button>
              {online != null ? (
                <span title="Joueurs connectés à la partie">👥 {online} en ligne</span>
              ) : (
                <span className="text-gray-500"> </span>
              )}
            </div>
          </div>
        </div>

        {/* Statistiques des questions en banque */}
        {stats && (
          <div className="mb-6 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              {typeof stats.remaining === 'number' && (
                <span className="px-2 py-1 rounded bg-emerald-800/40 border border-emerald-700 text-emerald-200">
                  Questions totales: {stats.remaining}
                </span>
              )}
              {status?.tokens === 20 && (
                <span className="px-2 py-1 rounded bg-yellow-600/30 border border-yellow-500 text-yellow-300 font-semibold" title="Vous avez atteint le maximum de tokens">
                  ✅ Max tokens (20)
                </span>
              )}
              {stats.categories && stats.categories.length > 0 ? (
                <>
                  <div className="flex items-center gap-1 flex-wrap">
                    {stats.categories.slice(0, 5).map((c) => (
                      <span
                        key={c.category}
                        className="px-2 py-1 rounded bg-white/10 border border-white/20 text-gray-200"
                        title={`Restantes: ${c.remaining} / Total: ${c.total ?? '?'} (Utilisées: ${c.used ?? '?'})`}
                      >
                        {c.category} {c.remaining}
                      </span>
                    ))}
                    {stats.categories.length > 5 && (
                      <span className="px-2 py-1 rounded bg-white/10 border border-white/20 text-gray-200">
                        +{stats.categories.length - 5} autres
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setShowCategoryDetails(v => !v)}
                    className="ml-2 px-2 py-1 rounded bg-blue-600/40 hover:bg-blue-600/60 border border-blue-500 text-blue-100"
                  >
                    {showCategoryDetails ? 'Fermer détails' : 'Détails catégories'}
                  </button>
                </>
              ) : (
                stats.remainingByCategory && (
                  <span className="px-2 py-1 rounded bg-white/10 border border-white/20 text-gray-200">
                    Finance {stats.remainingByCategory.finance} · Économie {stats.remainingByCategory.economy} · Immo {stats.remainingByCategory.realEstate}
                  </span>
                )
              )}
            </div>
            {showCategoryDetails && stats.categories && stats.categories.length > 0 && (
              <div className="mt-4 bg-white/5 rounded-lg p-4">
                <h4 className="text-center font-bold mb-3 text-white/90">📂 Banque par catégorie</h4>
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
                        <div key={cat.category} className={`p-2 rounded border ${isKids ? 'border-green-500/60 bg-green-500/10' : isTargetedMedium ? 'border-indigo-400/60 bg-indigo-400/10' : 'border-white/10 bg-white/5'}`}>
                          <div className="flex justify-between items-center mb-1">
                            <div className="font-semibold flex items-center gap-2">
                              <span>{cat.category}</span>
                              {isKids && <span className="text-xs px-1 py-0.5 rounded bg-green-600/40 border border-green-500">Enfants (Q1-2)</span>}
                              {isTargetedMedium && <span className="text-xs px-1 py-0.5 rounded bg-indigo-600/40 border border-indigo-500">Ciblée (Q3-5)</span>}
                            </div>
                            <div className="text-xs text-gray-300">Restantes {cat.remaining} / Total {total} · Utilisées {used}</div>
                          </div>
                          <div className="h-2 rounded overflow-hidden bg-black/30">
                            <div
                              className={`h-full transition-all ${percent < 25 ? 'bg-red-500' : percent < 50 ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <div className="mt-1 text-[10px] text-gray-400">{percent}% restantes</div>
                        </div>
                      );
                    })}
                </div>
                <p className="mt-3 text-[10px] text-gray-400 text-center">Les catégories ciblées (Définitions, Québec, Religions) sont prioritaires pour les questions 3 à 5.</p>
              </div>
            )}
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <div className={`mb-6 p-4 rounded-lg ${feedback.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
            {feedback.message}
          </div>
        )}

        {/* Status - Pas de session active */}
        {!session && status && !status.hasActiveSession && (
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 text-center">
            {/* Affichage des tokens */}
            <div className="mb-8 p-6 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-xl border-2 border-yellow-500/50">
              <h3 className="text-2xl font-bold mb-2">🎟️ Vos Tokens Quiz</h3>
              <div className="text-6xl font-bold text-yellow-400 mb-2">{status.tokens || 0}</div>
              <p className="text-sm text-gray-300">
                {status.tokens > 0 ? 
                  `Vous avez ${status.tokens} token${status.tokens > 1 ? 's' : ''} disponible${status.tokens > 1 ? 's' : ''}` :
                  "Aucun token disponible"
                }
              </p>
              {status.secondsUntilNextToken && (
                <p className="text-xs text-gray-400 mt-2">
                  ⏱️ Prochain token dans {Math.floor(status.secondsUntilNextToken / 60)} min {status.secondsUntilNextToken % 60} sec
                </p>
              )}
            </div>

            {status.canPlay ? (
              <>
                <h2 className="text-2xl font-bold mb-4">Prêt à jouer ?</h2>
                <p className="mb-6 text-lg">
                  Répondez aux questions et accumulez des gains !<br />
                  Vous pouvez encaisser à tout moment ou continuer pour doubler vos gains.
                </p>
                <div className="mb-6 text-left max-w-md mx-auto bg-white/5 p-4 rounded-lg">
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
                <button
                  onClick={() => startSession()}
                  className="px-8 py-4 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 rounded-xl font-bold text-xl transition shadow-lg"
                >
                  🎮 Démarrer le Quiz (Coûte 1 token)
                </button>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold mb-4">⏰ Pas de token disponible</h2>
                <p className="mb-4 text-lg">
                  Prochain token dans <span className="font-bold text-yellow-400">{Math.floor((status.secondsUntilNextToken || 0) / 60)} minutes</span>
                </p>
                <p className="text-sm text-gray-300 mb-4">
                  Vous gagnez automatiquement 1 token toutes les heures
                </p>
                <p className="text-xs text-gray-400">
                  💡 Les tokens s'accumulent si vous ne jouez pas
                </p>
                <div className="mt-4 text-sm text-gray-400">
                  Recharge désactivée temporairement.
                </div>
              </>
            )}
          </div>
        )}

        {/* Session active */}
        {session && question && (
          <div className="space-y-6">
            {/* Progression */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-6">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-sm text-gray-300">Question</div>
                  <div className="text-2xl font-bold">{session.currentQuestion} / 10</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-300">Gains actuels</div>
                  <div className="text-2xl font-bold text-green-400">{formatMoney(session.currentEarnings)}</div>
                </div>
              </div>
              {/* Timer */}
              <div className="mb-2 flex items-center justify-center">
                <div className={`text-lg font-mono px-4 py-1 rounded-full border ${timeLeft <= 5 ? 'bg-red-600 border-red-500 animate-pulse' : 'bg-black/30 border-white/20'}`}>⏱️ {timeLeft}s</div>
              </div>
              <div className="text-center text-sm text-gray-300">Sauts restants : <span className="font-bold">{session.skipsLeft ?? 0} / 3</span></div>
              <div className="text-center text-sm text-purple-300 mt-1">
                ✨ Passes de vie : <span className="font-bold">{lifePasses}</span>
              </div>
              {session.skipsLeft === 0 && (
                <div className="mt-2 flex justify-center text-xs text-gray-400">
                  Recharge de saut momentanément indisponible.
                </div>
              )}
              <div className="text-center">
                <div className="text-sm text-gray-300 mb-1">Prochain gain</div>
                <div className="text-3xl font-bold text-yellow-400">{formatMoney(session.nextPrize)}</div>
                {PRIZE_LADDER[session.currentQuestion - 1]?.milestone && (
                  <div className="mt-2 text-xs text-green-400">🛡️ Palier de sécurité</div>
                )}
              </div>
              {session.securedAmount > 0 && (
                <div className="mt-4 text-center text-sm text-gray-300">
                  Montant sécurisé : <span className="font-bold text-green-400">{formatMoney(session.securedAmount)}</span>
                </div>
              )}
            </div>

            {/* Question */}
            <div key={question.id} className="bg-white/10 backdrop-blur-md rounded-xl p-8">
              {/* Affichage d'image désactivé temporairement pour les tests */}
              
              <h2 className="text-2xl font-bold mb-6 text-center">{question.text}</h2>
              {showTimeoutReveal && (
                <div className="mb-4 text-center text-red-300 text-sm">Temps écoulé — réponse correcte: <span className="font-bold">{revealCorrect}</span></div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {['A', 'B', 'C', 'D'].map((letter) => {
                  const isCorrect = revealCorrect === letter;
                  const isWrongSelected = revealCorrect && selectedAnswer === letter && revealCorrect !== selectedAnswer;
                  const disabled = isAnswering || !!revealCorrect;
                  const base = 'p-4 rounded-lg text-left transition transform hover:scale-105';
                  const stateClass = revealCorrect
                    ? (isCorrect ? 'bg-green-600 text-black font-bold' : (isWrongSelected ? 'bg-red-600 text-white font-bold' : 'bg-white/5'))
                    : (selectedAnswer === letter ? 'bg-yellow-500 text-black font-bold shadow-lg' : 'bg-white/5 hover:bg-white/10');
                  return (
                  <button
                    key={letter}
                    onClick={() => !revealCorrect && setSelectedAnswer(letter)}
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
                className="w-full md:w-auto px-4 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed rounded-xl font-bold text-sm transition shadow-lg"
                title="Regarder une publicité pour obtenir une passe de vie"
              >
                {isLoadingAd ? "⏳ ..." : "📺 Pub → +1 Passe"}
              </button>
              <button
                onClick={cashOut}
                disabled={isAnswering || session.currentEarnings === 0}
                className="w-full md:flex-1 px-6 py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-xl font-bold text-lg transition shadow-lg"
              >
                💰 Encaisser {formatMoney(session.currentEarnings)}
              </button>
              <button
                onClick={skipQuestion}
                disabled={isAnswering || !!revealCorrect || (session.skipsLeft ?? 0) <= 0}
                className="w-full md:w-auto px-4 py-4 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-xl font-bold text-lg transition shadow-lg"
                title="Passer cette question"
              >
                ⏭️ Passer ({session.skipsLeft ?? 0}/3)
              </button>
              <button
                onClick={submitAnswer}
                disabled={!selectedAnswer || isAnswering || !!revealCorrect}
                className="w-full md:flex-1 px-6 py-4 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed rounded-xl font-bold text-lg transition shadow-lg"
              >
                {isAnswering ? "⏳ ..." : "✓ Valider ma réponse"}
              </button>
            </div>
          </div>
        )}

        {/* Échelle des gains */}
        <div className="mt-8 bg-white/5 backdrop-blur-md rounded-xl p-6">
          <h3 className="text-lg font-bold mb-4 text-center">📊 Échelle des gains</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
            {PRIZE_LADDER.map((prize) => (
              <div
                key={prize.question}
                className={`p-2 rounded text-center ${
                  session && session.currentQuestion === prize.question
                    ? 'bg-yellow-500 text-black font-bold'
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
      
      {/* Modal: Utiliser une passe après une mauvaise réponse */}
      {showPassOffer && lifePasses > 0 && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-purple-900 to-pink-900 rounded-2xl p-8 max-w-md w-full shadow-2xl border-2 border-purple-500">
            <div className="text-center">
              <div className="text-6xl mb-4">✨</div>
              <h3 className="text-2xl font-bold mb-4">Mauvaise réponse !</h3>
              <p className="text-gray-200 mb-6">
                Vous avez <span className="font-bold text-yellow-400">{lifePasses}</span> passe{lifePasses > 1 ? 's' : ''} de vie.
                <br />
                Voulez-vous en utiliser une pour continuer ?
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={useLifePass}
                  className="w-full px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 rounded-xl font-bold text-lg transition shadow-lg"
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
                  className="w-full px-6 py-4 bg-gray-600 hover:bg-gray-500 rounded-xl font-bold transition"
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
