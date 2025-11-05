"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3001";

const BASE_STAKE = 5000;
const PRIZE_LADDER = Array.from({ length: 10 }).map((_, i) => ({
  question: i + 1,
  amount: BASE_STAKE * Math.pow(2, i),
  difficulty: i + 1 <= 3 ? 'Facile' : i + 1 <= 7 ? 'Moyen' : 'Difficile',
  milestone: false,
}));

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
          const res = await fetch(`${API_BASE}/api/games/${gameId}/online`);
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
      const res = await fetch(`${API_BASE}/api/quiz/public-stats`);
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
      
      const res = await fetch(`${API_BASE}/api/games/${gameId}/quiz/status`, {
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

        const res = await fetch(`${API_BASE}/api/games/${gameId}/quiz/resume`, {
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

      const res = await fetch(`${API_BASE}/api/games/${gameId}/quiz/start`, {
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

      const res = await fetch(`${API_BASE}/api/games/${gameId}/quiz/answer`, {
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
          });
          setQuestion(data.question);
          setSelectedAnswer(null);
          setFeedback({ type: 'success', message: '✓ Bonne réponse !' });
          // Une question a été consommée: mettre à jour les stats
          loadStats();
        }
      } else {
        // Mauvaise réponse
        setFeedback({ type: 'error', message: data.message });
        setSession(null);
        setQuestion(null);
        setTimeout(() => { loadStatus(); loadStats(); }, 3000);
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

    if (!confirm(`Voulez-vous encaisser $${session.currentEarnings.toLocaleString()} ?`)) {
      return;
    }

    try {
      setLoading(true);
      setFeedback(null);

      const headers: Record<string, string> = { "Content-Type": "application/json", "X-CSRF": "1" };
      if (playerId) {
        headers["X-Player-ID"] = playerId;
      }

      const res = await fetch(`${API_BASE}/api/games/${gameId}/quiz/cash-out`, {
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
  setTimeout(() => { loadStatus(); loadStats(); }, 2000);
    } catch (err: any) {
      console.error(err);
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
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
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white p-4">
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
            {online != null ? <span title="Joueurs connectés à la partie">👥 {online} en ligne</span> : <span className="text-gray-500"> </span>}
          </div>
        </div>

        {/* Statistiques des questions en banque */}
        {stats && (
          <div className="mb-6 flex flex-wrap items-center gap-2 text-xs">
            {typeof stats.remaining === 'number' && (
              <span className="px-2 py-1 rounded bg-emerald-800/40 border border-emerald-700 text-emerald-200">
                Questions en banque: {stats.remaining}
              </span>
            )}
            {/* Affichage dynamique des catégories si dispo, sinon fallback aux 3 catégories historiques */}
            {stats.categories && stats.categories.length > 0 ? (
              <div className="flex items-center gap-1 flex-wrap">
                {stats.categories.slice(0, 6).map((c) => (
                  <span key={c.category} className="px-2 py-1 rounded bg-white/10 border border-white/20 text-gray-200">
                    {c.category} {c.remaining}
                  </span>
                ))}
                {stats.categories.length > 6 && (
                  <span className="px-2 py-1 rounded bg-white/10 border border-white/20 text-gray-200">
                    +{stats.categories.length - 6} autres
                  </span>
                )}
              </div>
            ) : (
              stats.remainingByCategory && (
                <span className="px-2 py-1 rounded bg-white/10 border border-white/20 text-gray-200">
                  Finance {stats.remainingByCategory.finance} · Économie {stats.remainingByCategory.economy} · Immo {stats.remainingByCategory.realEstate}
                </span>
              )
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
                    <li>Règle Quitte ou Double: on commence à 5 000 $</li>
                    <li>Chaque bonne réponse double vos gains (5k → 10k → 20k → 40k ...)</li>
                    <li>Vous pouvez encaisser à tout moment pour sécuriser vos gains</li>
                    <li>Mauvaise réponse = vous perdez tout</li>
                    <li>Maximum 10 questions par session</li>
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
                  <div className="text-2xl font-bold text-green-400">${session.currentEarnings.toLocaleString()}</div>
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-300 mb-1">Prochain gain</div>
                <div className="text-3xl font-bold text-yellow-400">${session.nextPrize.toLocaleString()}</div>
                {PRIZE_LADDER[session.currentQuestion - 1]?.milestone && (
                  <div className="mt-2 text-xs text-green-400">🛡️ Palier de sécurité</div>
                )}
              </div>
              {session.securedAmount > 0 && (
                <div className="mt-4 text-center text-sm text-gray-300">
                  Montant sécurisé : <span className="font-bold text-green-400">${session.securedAmount.toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Question */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-8">
              {/* Image de la question (si présente) */}
              {question.imageUrl && (
                <div className="mb-6 flex justify-center">
                  <div className="relative max-w-xl w-full">
                    <img 
                      src={question.imageUrl} 
                      alt="Illustration de la question"
                      className="w-full h-auto max-h-80 rounded-lg shadow-2xl object-cover border-2 border-white/20"
                      onError={(e) => {
                        // Fallback si l'image ne charge pas
                        console.warn('[Quiz] Failed to load image:', question.imageUrl);
                        e.currentTarget.style.display = 'none';
                      }}
                      loading="lazy"
                    />
                  </div>
                </div>
              )}
              
              <h2 className="text-2xl font-bold mb-6 text-center">{question.text}</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {['A', 'B', 'C', 'D'].map((letter) => (
                  <button
                    key={letter}
                    onClick={() => setSelectedAnswer(letter)}
                    disabled={isAnswering}
                    className={`p-4 rounded-lg text-left transition transform hover:scale-105 ${
                      selectedAnswer === letter
                        ? 'bg-yellow-500 text-black font-bold shadow-lg'
                        : 'bg-white/5 hover:bg-white/10'
                    } ${isAnswering ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span className="font-bold mr-2">{letter}.</span>
                    {question[`option${letter}`]}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              <button
                onClick={cashOut}
                disabled={isAnswering || session.currentEarnings === 0}
                className="flex-1 px-6 py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-xl font-bold text-lg transition shadow-lg"
              >
                💰 Encaisser ${session.currentEarnings.toLocaleString()}
              </button>
              <button
                onClick={submitAnswer}
                disabled={!selectedAnswer || isAnswering}
                className="flex-1 px-6 py-4 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed rounded-xl font-bold text-lg transition shadow-lg"
              >
                {isAnswering ? "⏳ Validation..." : "✓ Valider ma réponse"}
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
                <div className="font-bold">${(prize.amount / 1000).toFixed(0)}k</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
