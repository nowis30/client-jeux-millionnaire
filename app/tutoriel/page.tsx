"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { API_BASE } from "../../lib/api";

type QuizStatus = {
  canPlay: boolean;
  hasActiveSession: boolean;
  tokens: number;
  secondsUntilNextToken?: number;
};

export default function TutorielPage() {
  const [gameId, setGameId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [status, setStatus] = useState<QuizStatus | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Récupérer la session stockée par le client
    try {
      const s = localStorage.getItem("hm-session");
      if (!s) return;
      const parsed = JSON.parse(s);
      if (parsed?.gameId) setGameId(parsed.gameId);
      if (parsed?.playerId) setPlayerId(parsed.playerId);
    } catch {}
  }, []);

  useEffect(() => {
    if (!gameId) return;
    (async () => {
      try {
        setLoading(true);
        const headers: Record<string, string> = { "X-CSRF": "1" };
        if (playerId) headers["X-Player-ID"] = playerId;
        const res = await fetch(`${API_BASE}/api/games/${gameId}/quiz/status`, { credentials: "include", headers });
        if (!res.ok) return;
        const data = (await res.json()) as QuizStatus;
        setStatus(data);
      } catch {
      } finally {
        setLoading(false);
      }
    })();
  }, [gameId, playerId]);

  const nextTokenText = useMemo(() => {
    const s = status?.secondsUntilNextToken ?? 0;
    if (!s || s <= 0) return null;
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m} min ${sec} sec`;
  }, [status?.secondsUntilNextToken]);

  return (
    <main className="prose prose-invert max-w-none">
      <h2>Tutoriel Complet — Héritier Millionnaire</h2>

      {/* Sommaire cliquable */}
      <nav aria-label="Sommaire" className="not-prose mb-6 p-4 rounded bg-neutral-900 border border-neutral-800">
        <div className="text-sm font-semibold mb-2">Sommaire</div>
        <ul className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
          <li><a className="underline underline-offset-2" href="#objectif">Objectif</a></li>
          <li><a className="underline underline-offset-2" href="#immobilier">Immobilier</a></li>
          <li><a className="underline underline-offset-2" href="#bourse">Bourse</a></li>
          <li><a className="underline underline-offset-2" href="#quiz">Quiz</a></li>
          <li><a className="underline underline-offset-2" href="#strategies">Stratégies</a></li>
          <li><a className="underline underline-offset-2" href="#depannage">Dépannage</a></li>
        </ul>
      </nav>

      {/* Encart live tokens */}
      <div className="not-prose mb-6 p-4 rounded-lg bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border border-yellow-600/50">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-sm text-yellow-200/90">Vos Tokens Quiz</div>
            <div className="text-3xl font-extrabold text-yellow-300">{loading ? '…' : status?.tokens ?? 0}</div>
            {typeof status?.secondsUntilNextToken === 'number' && status.secondsUntilNextToken > 0 && (
              <div className="text-xs text-yellow-200/80">Prochain token dans {nextTokenText}</div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/quiz"
              className={`px-4 py-2 rounded font-semibold ${status?.tokens && status.tokens > 0 ? 'bg-yellow-500 hover:bg-yellow-400 text-black' : 'bg-neutral-700 text-neutral-300 cursor-not-allowed'}`}
              aria-disabled={!status?.tokens || status.tokens <= 0}
            >
              🎮 Démarrer le Quiz
            </Link>
            <Link href="/quiz" className="px-3 py-2 rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-sm">Voir les règles</Link>
          </div>
        </div>
      </div>

      <p>
        Ce guide résume les mécaniques principales du jeu et les nouveautés récentes (nov. 2025) :
        difficulté progressive du Quiz (1–2 facile, 3–5 moyen, 6–10 difficile), nouvelle catégorie <strong>anatomy</strong>
        (biologie du corps humain), désactivation temporaire des publicités récompensées, et outils de
        remplissage (refill) pour la banque d&apos;immeubles.
      </p>

      <h3 id="objectif">Objectif</h3>
      <p>
        Accumuler le patrimoine le plus élevé en combinant Immobilier, Bourse, Annonces P2P, Quiz et Pari.
      </p>

      <h3 id="immobilier">Immobilier — nouveautés</h3>
      <ul>
        <li>Refill 6‑plex → 10: assure 10 six‑plex disponibles.</li>
        <li>Refill tours 50 → 10: assure 10 tours de 50 logements.</li>
        <li className="opacity-80">À venir: refill tours100 (→5), refill incrémental (+10), indicateurs de stock par type.</li>
      </ul>

      <h3 id="bourse">Bourse — aperçu</h3>
      <p>
        5 actifs principaux (SP500, QQQ, TSX, GLD, TLT). Derniers prix avec cache court, rendements par fenêtre, dividendes trimestriels.
        Ouvrez la page Bourse pour trader et diversifier votre portefeuille.
      </p>

      <h3 id="quiz">Quiz — nouveautés</h3>
      <ul>
        <li>
          Difficulté: 1–2 <em>facile (enfants)</em>, 3–5 <em>moyen</em>, 6–10 <em>difficile (général)</em>.
        </li>
        <li>
          Catégorie <strong>anatomy</strong> ajoutée (biologie du corps humain: organes, physiologie, forces/faiblesses).
        </li>
        <li>
          Sélection difficile <em>générale</em>: plus de préférence dédiée logique/QI; toutes les catégories peuvent sortir.
        </li>
        <li>
          Tokens: vérifiez votre solde; un token est consommé au démarrage d&apos;une session.
        </li>
      </ul>

      <h3 id="strategies">Stratégies rapides</h3>
      <ul>
        <li>Début: privilégier 6‑plex pour accélérer la rente; lancer 1–2 Quiz pour cash rapide.</li>
        <li>Milieu: diversifier en Bourse; viser tour 50.</li>
        <li>Fin: viser gratte‑ciel/village; utiliser Quiz (Q6–10) avec prudence, sécuriser les paliers.</li>
      </ul>

      <h3 id="depannage">Dépannage</h3>
      <p>
        En cas de souci avec le Quiz (tokens, absence de questions, CORS), voir le guide « Quiz - Guide de dépannage »
        inclus dans le dépôt (fichier TROUBLESHOOTING_QUIZ.md) ou demandez à un admin. Les étapes clés:
      </p>
      <ul>
        <li>Vérifier que le serveur et le client tournent (ou URLs prod correctes)</li>
        <li>Contrôler les tokens disponibles dans l’état Quiz</li>
        <li>Regarder la console navigateur et les logs serveur</li>
      </ul>
      <p>
        Besoin d'aide supplémentaire ou vous voulez proposer une amélioration ?
        {" "}
        <a
          href="mailto:smorin_23@hotmail.com?subject=Support%20H%C3%A9ritier%20Millionnaire&body=Bonjour%20%0A%0A(D%C3%A9crivez%20votre%20probl%C3%A8me%20ou%20suggestion%20ici)%0A%0AID%20joueur:%20"
          className="text-rose-300 hover:text-rose-200 underline underline-offset-2"
        >
          Contactez le support par courriel
        </a>.
      </p>

      <p className="text-sm text-neutral-400">Dernière mise à jour: 8 novembre 2025</p>
    </main>
  );
}
