"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3001";

const PRIZE_LADDER = [
  { question: 1, amount: 1000, difficulty: 'Facile' },
  { question: 2, amount: 2000, difficulty: 'Facile' },
  { question: 3, amount: 3000, difficulty: 'Facile' },
  { question: 4, amount: 4000, difficulty: 'Facile' },
  { question: 5, amount: 5000, difficulty: 'Facile', milestone: true },
  { question: 6, amount: 10000, difficulty: 'Moyen' },
  { question: 7, amount: 20000, difficulty: 'Moyen' },
  { question: 8, amount: 30000, difficulty: 'Moyen' },
  { question: 9, amount: 40000, difficulty: 'Moyen' },
  { question: 10, amount: 50000, difficulty: 'Moyen', milestone: true },
  { question: 11, amount: 75000, difficulty: 'Difficile' },
  { question: 12, amount: 100000, difficulty: 'Difficile' },
  { question: 13, amount: 150000, difficulty: 'Difficile' },
  { question: 14, amount: 250000, difficulty: 'Difficile' },
  { question: 15, amount: 500000, difficulty: 'Difficile', milestone: true },
];

export default function QuizPage() {
  const router = useRouter();
  const [gameId, setGameId] = useState<string | null>(null);
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [question, setQuestion] = useState<any>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isAnswering, setIsAnswering] = useState(false);

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
    } catch (err) {
      console.error("[Quiz] Error loading session:", err);
      router.push("/");
    }
  }, [router]);

  useEffect(() => {
    if (gameId) {
      loadStatus();
    }
  }, [gameId]);

  async function loadStatus() {
    try {
      setLoading(true);
      console.log("[Quiz] Loading status for game:", gameId);
      
      const res = await fetch(`${API_BASE}/api/games/${gameId}/quiz/status`, {
        credentials: "include",
        headers: { "X-CSRF": "1" },
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
        // Pour une session existante, on doit charger la question actuelle
        // Note: L'API ne fournit pas directement la question, on doit modifier l'endpoint
        // Pour l'instant, on démarre une nouvelle session
        return;
      }

      const res = await fetch(`${API_BASE}/api/games/${gameId}/quiz/start`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF": "1" },
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

      const res = await fetch(`${API_BASE}/api/games/${gameId}/quiz/answer`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF": "1" },
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
          setTimeout(() => loadStatus(), 2000);
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
        }
      } else {
        // Mauvaise réponse
        setFeedback({ type: 'error', message: data.message });
        setSession(null);
        setQuestion(null);
        setTimeout(() => loadStatus(), 3000);
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

      const res = await fetch(`${API_BASE}/api/games/${gameId}/quiz/cash-out`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF": "1" },
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
      setTimeout(() => loadStatus(), 2000);
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
          <div className="w-24"></div>
        </div>

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
                    <li>5 questions faciles ($1k → $5k)</li>
                    <li>5 questions moyennes ($10k → $50k)</li>
                    <li>Questions difficiles ($75k → $500k+)</li>
                    <li>Paliers de sécurité : $5k, $50k, $500k</li>
                    <li>Mauvaise réponse = retour au dernier palier</li>
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
                  <div className="text-2xl font-bold">{session.currentQuestion} / 15+</div>
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
                    : prize.milestone
                    ? 'bg-green-600/30 border border-green-400'
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
