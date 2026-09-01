# Test du mini-jeu Drag Racing

Le mini-jeu utilise désormais **Supabase Auth** et l’Edge Function
`heritier-api`. Il ne dépend plus de cookies invités, de jetons CSRF ni du
serveur Render.

## Test normal dans l’application

1. Ouvrir <https://client-jeux-millionnaire.vercel.app/login>.
2. Se connecter avec un compte confirmé.
3. Ouvrir `/drag/standalone` depuis l’application.
4. Lancer une course et vérifier que le résultat, le gain et l’étape suivante
   sont conservés après un rechargement de page.

Le navigateur conserve la session dans `HM_TOKEN` et `HM_REFRESH_TOKEN`. Les
requêtes de jeu envoient le jeton d’accès dans `Authorization: Bearer …` et le
joueur courant dans `X-Player-ID`.

## Page de diagnostic autonome

Le fichier `test-drag-session.html` valide le chemin suivant :

1. santé de l’Edge Function ;
2. liste des parties ;
3. association du compte à la partie globale ;
4. lecture de la session Drag ;
5. enregistrement d’un résultat.

Pour l’utiliser, copiez temporairement la valeur de `HM_TOKEN` depuis le
stockage local de l’application, collez-la dans la page de diagnostic, puis
cliquez sur **Exécuter le flux complet**. Ne partagez jamais ce jeton.

## Endpoints validés

| Endpoint | Méthode | Authentification | Rôle |
|---|---:|---|---|
| `/health` | GET | publique | Santé de l’API |
| `/api/games` | GET | Supabase Auth | Partie globale |
| `/api/games/:id/join` | POST | Supabase Auth | Créer/retrouver le joueur |
| `/api/games/:id/drag/session` | GET | Supabase Auth | Progression Drag |
| `/api/games/:id/drag/result` | POST | Supabase Auth | Résultat et récompense |
| `/api/games/:id/drag/history` | GET | Supabase Auth | Historique des courses |
| `/api/games/:id/drag/opponents` | GET | Supabase Auth | Adversaires |
| `/api/games/:id/drag/upgrade/:type` | POST | Supabase Auth | Améliorations |

## Résolution rapide

- **401 Connexion requise** : reconnectez-vous afin de renouveler la session.
- **404 Joueur introuvable** : revenez à l’accueil ; l’association à la partie
  globale sera recréée automatiquement.
- **429 Courses trop rapprochées** : attendez une seconde avant un nouvel essai.
- **Gain à 0** : le délai de récompense est de cinq secondes entre deux victoires.
- **Temps improbable** : jouez la course normalement ; les résultats trop courts
  sont rejetés côté serveur.

## Checklist de production

- [ ] Connexion et rafraîchissement de session fonctionnels
- [ ] Course, gain et étape persistés après rechargement
- [ ] Historique et adversaires chargés
- [ ] Aucun appel vers `onrender.com`
- [ ] Aucune erreur 401, 403 ou 500 dans la console
- [ ] Affichage mobile sans débordement horizontal

Dernière mise à jour : 1er septembre 2026.
