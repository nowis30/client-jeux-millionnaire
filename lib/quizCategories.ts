/**
 * Catégories de questions du quiz pour le client Next.js
 * Copie locale afin de garantir que les déploiements (Vercel) aient accès
 * aux mêmes définitions que le monorepo partagé.
 */

export type QuizCategory =
  | 'finance'
  | 'economy'
  | 'real-estate'
  | 'business'
  | 'technology'
  | 'science'
  | 'history'
  | 'geography'
  | 'sports'
  | 'arts'
  | 'cinema'
  | 'music'
  | 'literature'
  | 'culture'
  | 'nature'
  | 'health'
  | 'food'
  | 'general'
  | 'animals'
  | 'translation'
  | 'kids'
  | 'enfants'
  | 'quebec'
  | 'definitions'
  | 'religions'
  | 'logic'
  | 'iq'
  | 'anatomy';

export interface CategoryInfo {
  id: QuizCategory;
  label: string;
  icon: string;
  description: string;
  color: string;
}

// Liste complète des catégories avec métadonnées d'affichage
export const QUIZ_CATEGORIES: CategoryInfo[] = [
  { id: 'finance', label: 'Finance', icon: '💰', description: 'Bourse, investissements, banque', color: 'from-green-600 to-emerald-600' },
  { id: 'economy', label: 'Économie', icon: '📈', description: 'Macro-économie, marchés', color: 'from-blue-600 to-cyan-600' },
  { id: 'real-estate', label: 'Immobilier', icon: '🏠', description: 'Propriétés, hypothèques, marché', color: 'from-orange-600 to-amber-600' },
  { id: 'business', label: 'Business', icon: '💼', description: 'Entreprise, management, stratégie', color: 'from-gray-600 to-slate-600' },
  { id: 'general', label: 'Culture Générale', icon: '🎓', description: 'Connaissances diverses', color: 'from-purple-600 to-violet-600' },
  { id: 'history', label: 'Histoire', icon: '📜', description: 'Événements historiques', color: 'from-amber-700 to-orange-700' },
  { id: 'geography', label: 'Géographie', icon: '🌍', description: 'Pays, villes, capitales', color: 'from-teal-600 to-cyan-600' },
  { id: 'quebec', label: 'Québec', icon: '🍁', description: 'Culture québécoise', color: 'from-blue-700 to-indigo-700' },
  { id: 'science', label: 'Sciences', icon: '🔬', description: 'Physique, chimie, biologie', color: 'from-indigo-600 to-purple-600' },
  { id: 'technology', label: 'Technologie', icon: '💻', description: 'Informatique, innovation', color: 'from-cyan-600 to-blue-600' },
  { id: 'anatomy', label: 'Anatomie', icon: '🫀', description: 'Corps humain, biologie', color: 'from-red-600 to-rose-600' },
  { id: 'health', label: 'Santé', icon: '⚕️', description: 'Médecine, bien-être', color: 'from-green-700 to-emerald-700' },
  { id: 'nature', label: 'Nature', icon: '🌿', description: 'Environnement, écologie', color: 'from-green-600 to-lime-600' },
  { id: 'animals', label: 'Animaux', icon: '🦁', description: 'Faune, zoologie', color: 'from-yellow-600 to-orange-600' },
  { id: 'culture', label: 'Culture', icon: '🎭', description: 'Arts, traditions', color: 'from-pink-600 to-rose-600' },
  { id: 'cinema', label: 'Cinéma', icon: '🎬', description: 'Films, acteurs, réalisateurs', color: 'from-red-600 to-pink-600' },
  { id: 'music', label: 'Musique', icon: '🎵', description: 'Artistes, genres, instruments', color: 'from-purple-600 to-pink-600' },
  { id: 'literature', label: 'Littérature', icon: '📚', description: 'Livres, auteurs, poésie', color: 'from-amber-600 to-yellow-600' },
  { id: 'arts', label: 'Arts', icon: '🎨', description: 'Peinture, sculpture, architecture', color: 'from-fuchsia-600 to-purple-600' },
  { id: 'sports', label: 'Sports', icon: '⚽', description: 'Compétitions, athlètes', color: 'from-blue-600 to-green-600' },
  { id: 'food', label: 'Gastronomie', icon: '🍽️', description: 'Cuisine, recettes, plats', color: 'from-red-700 to-orange-700' },
  { id: 'religions', label: 'Religions', icon: '🕌', description: 'Croyances, traditions', color: 'from-indigo-700 to-purple-700' },
  { id: 'definitions', label: 'Définitions', icon: '📖', description: 'Vocabulaire, expressions', color: 'from-gray-700 to-slate-700' },
  { id: 'translation', label: 'Traduction', icon: '🗣️', description: 'Langues étrangères', color: 'from-blue-700 to-purple-700' },
  { id: 'logic', label: 'Logique', icon: '🧩', description: 'Raisonnement, déduction', color: 'from-violet-600 to-purple-600' },
  { id: 'iq', label: 'QI', icon: '🧠', description: 'Tests de quotient intellectuel', color: 'from-pink-700 to-fuchsia-700' },
  { id: 'kids', label: 'Enfants', icon: '👶', description: 'Questions simples et éducatives', color: 'from-yellow-500 to-orange-500' },
  { id: 'enfants', label: 'Enfants (FR)', icon: '🧒', description: 'Questions pour les plus jeunes', color: 'from-pink-500 to-rose-500' },
];

export function getCategoryInfo(id: QuizCategory): CategoryInfo | undefined {
  return QUIZ_CATEGORIES.find(cat => cat.id === id);
}

export function getCategoryLabel(id: QuizCategory): string {
  return getCategoryInfo(id)?.label || id;
}

export const DEFAULT_CATEGORIES: QuizCategory[] = ['finance', 'economy', 'real-estate'];

export const CATEGORY_GROUPS = {
  finance: ['finance', 'economy', 'real-estate', 'business'],
  culture: ['general', 'history', 'geography', 'quebec'],
  sciences: ['science', 'technology', 'anatomy', 'health', 'nature', 'animals'],
  arts: ['culture', 'cinema', 'music', 'literature', 'arts', 'sports'],
  autres: ['food', 'religions', 'definitions', 'translation', 'logic', 'iq', 'kids', 'enfants'],
} as const;

export const CATEGORY_GROUP_LABELS = {
  finance: { label: 'Finance & Business', icon: '💼' },
  culture: { label: 'Culture & Histoire', icon: '🎓' },
  sciences: { label: 'Sciences & Nature', icon: '🔬' },
  arts: { label: 'Arts & Divertissement', icon: '🎭' },
  autres: { label: 'Autres', icon: '🎯' },
} as const;
