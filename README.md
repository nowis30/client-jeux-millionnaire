# client-jeux-millionnaire

## Liens de déploiement

- API (Render) : https://server-jeux-millionnaire.onrender.com
- Client (Vercel) : https://client-jeux-millionnaire.vercel.app/

## Configuration (proxy sans CORS)

Le client Next.js proxy désormais toutes les requêtes vers le backend via des réécritures, ce qui élimine les problèmes de CORS et de cookies SameSite.

- Réécritures configurées dans `next.config.js`:
	- `/api/*` → `${API_PROXY_DEST}/api/*`
	- `/socket.io/*` → `${API_PROXY_DEST}/socket.io/*` (WebSocket Socket.IO)
- Variables d’environnement côté client:
	- `API_PROXY_DEST` (recommandé): URL du backend (ex: `https://server-jeux-millionnaire.onrender.com`). Utilisée par les rewrites au build/runtime Vercel.
	- `NEXT_PUBLIC_API_BASE` (optionnelle): sert uniquement pour les appels SSR (côté serveur) via `lib/api.ts`. En navigateur, on utilise des chemins relatifs.

Implications:
- Dans le code client, utilisez toujours des chemins relatifs (`/api/...`) ou le helper `apiFetch()`.
- N’utilisez plus `process.env.NEXT_PUBLIC_API_BASE` dans les pages/components.

## Tutoriel utilisateur

- Une page d’aide est disponible dans l’app: `/tutoriel` (menu supérieur et navigation mobile)
- Le guide complet se trouve aussi à la racine du monorepo: `TUTORIEL_JEU.md`