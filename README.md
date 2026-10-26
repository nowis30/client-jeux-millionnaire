# client-jeux-millionnaire

Interface Next.js statique d’Héritier Millionnaire.

## Déploiement

- Client : Vercel
- Auth, API, base de données, présence et tâches planifiées : Supabase

Le client communique directement avec l’Edge Function `heritier-api` à l’aide d’un jeton Supabase Auth. Les tables de jeu sont conservées dans le schéma privé `heritier` et ne sont pas exposées à la Data API.

## Configuration

Les valeurs par défaut pointent vers le projet NOWIS. Elles peuvent être remplacées au build :

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Tous les appels applicatifs doivent passer par `apiFetch()` dans `lib/api.ts` afin de renouveler la session et de joindre l’identité du joueur.

## Tutoriel

Une page d’aide est disponible dans l’application à `/tutoriel`.

## Vérifications

Node.js 24 : `npm ci`, `npm test`, `npm run typecheck`, puis `npm run build`. La CI utilise le fichier de verrouillage. Les tests vérifient les destinations autorisées pour les jetons, les formats d’en-têtes et le cycle des reçus publicitaires.

Les requêtes authentifiées sont limitées à l’Edge Function configurée. Pour une publicité récompensée, le client attend un reçu vérifié côté serveur et conserve une intention en attente afin de la récupérer sans montrer une seconde publicité. Le chronomètre Quiz est suspendu pendant cette validation.

Cette version nécessite la [correction serveur et sa configuration AdMob](https://github.com/nowis30/server-jeux-millionnaire/blob/main/docs/REWARD_VERIFICATION.md), ainsi que la mise à jour du plugin Android. Coordonner les trois PR avant publication; un ancien APK est invité à se mettre à jour.

Le résultat de compilation est `out/` (export statique). `npm start` sert cet export sur le port 3000, sans appeler `next start` qui exige un serveur Next. Les copies historiques `dist/` ne sont pas automatiquement certifiées à jour par ces tests.
