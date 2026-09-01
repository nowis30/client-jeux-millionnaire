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
