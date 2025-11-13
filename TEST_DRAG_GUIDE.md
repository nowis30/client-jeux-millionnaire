# 🏁 Guide de Test - Mini-Jeu Drag Racing

## 📋 Résumé des Changements

Le mini-jeu Drag fonctionne maintenant **sans nécessiter de compte utilisateur** grâce à un fallback invité automatique.

### Modifications Clés

1. **Client (`public/drag/main.js`)**
   - Fonction `ensureSession()` modifiée avec fallback invité
   - Si `POST /api/games/:id/join` échoue (401 non authentifié), le client crée automatiquement un joueur invité via `POST /api/games`
   - Stocke `playerId` en localStorage et envoie `X-Player-ID` dans les headers pour toutes les requêtes Drag

2. **Serveur (déjà en place)**
   - Routes Drag utilisent `requireUserOrGuest` middleware
   - `resolvePlayerForRequest` accepte `X-Player-ID` header
   - Fonctionne avec cookies invité ET header (contourne cookies tiers bloqués sur iOS/Safari)

## 🧪 Tests Automatisés

### Test HTML Autonome
Un fichier `test-drag-session.html` a été créé pour valider le flux complet:

```bash
# Ouvrir dans le navigateur
Start-Process "test-drag-session.html"
```

**Tests disponibles:**
1. ✅ CSRF Token
2. ✅ Liste des parties
3. ✅ Création joueur invité
4. ✅ Session Drag
5. ✅ Résultat de course
6. ✅ **Flux complet automatique** (tous les endpoints en séquence)

### Test PowerShell (validation production)
```powershell
# Test minimal complet
$base = "https://server-jeux-millionnaire.onrender.com"
$ws = New-Object Microsoft.PowerShell.Commands.WebRequestSession

# 1. CSRF
$csrf = Invoke-RestMethod -Uri "$base/api/auth/csrf" -Method GET -WebSession $ws
$token = $csrf.csrf

# 2. Game ID
$games = Invoke-RestMethod -Uri "$base/api/games" -Method GET -WebSession $ws
$gameId = $games.games[0].id

# 3. Créer invité
$nick = "Test-" + (Get-Random -Maximum 99999)
$body = @{ hostNickname = $nick } | ConvertTo-Json
$player = Invoke-RestMethod -Uri "$base/api/games" -Method POST -Headers @{"x-csrf-token"=$token; "Content-Type"="application/json"} -Body $body -WebSession $ws
$playerId = $player.playerId

# 4. Session Drag
$session = Invoke-RestMethod -Uri "$base/api/games/$gameId/drag/session" -Headers @{"X-Player-ID"=$playerId} -WebSession $ws
Write-Host "Cash:" $session.player.cash "Stage:" $session.drag.stage

# 5. Course victoire
$result = Invoke-RestMethod -Uri "$base/api/games/$gameId/drag/result" -Method POST -Headers @{"x-csrf-token"=$token; "X-Player-ID"=$playerId; "Content-Type"="application/json"} -Body (@{stage=1;elapsedMs=7500;win=$true;perfectShifts=4;reward=50000;device=@{platform="cli";build="test"}}|ConvertTo-Json) -WebSession $ws
Write-Host "Récompense:" $result.grantedReward "Nouveau cash:" $result.player.cash
```

## 🎮 Test Manuel dans l'Application

### 1. Test Invité (sans compte)

**URL:** https://client-jeux-millionnaire.vercel.app/drag/standalone

**Étapes:**
1. Ouvrir la page en navigation privée (pour simuler nouvel utilisateur)
2. Ouvrir la console (F12)
3. Vérifier le localStorage:
   ```javascript
   localStorage.getItem('hm-session')
   // Devrait afficher: {"gameId":"xxx","playerId":"xxx","nickname":"Invité-xxxxx"}
   ```
4. Cliquer sur "Lancer la course"
5. Terminer la course
6. Vérifier l'HUD:
   - Cash initial: 1 000 000 $
   - Après victoire: 1 050 000 $ (+50 000 $)
   - Stage: passe de 1 à 2

### 2. Test Utilisateur Connecté

**URL:** https://client-jeux-millionnaire.vercel.app/drag/standalone

**Étapes:**
1. Se connecter via la barre d'authentification
2. Email/mot de passe
3. Jouer une course
4. Vérifier que le pseudo affiché = email
5. Progression sauvegardée liée au compte

### 3. Rafraîchir le Cache Client

Si les changements ne sont pas visibles:

**Hard Refresh:**
- Windows: `Ctrl + F5`
- macOS: `Cmd + Shift + R`

**Nettoyer localStorage:**
```javascript
localStorage.removeItem('hm-session');
localStorage.removeItem('hm-token');
location.reload();
```

## 📊 Validation des Endpoints

### Endpoints Drag (tous fonctionnels)

| Endpoint | Méthode | Auth | Description |
|----------|---------|------|-------------|
| `/api/games/:id/drag/session` | GET | invité/user | État joueur + progression |
| `/api/games/:id/drag/result` | POST | invité/user | Soumettre résultat course |
| `/api/games/:id/drag/history` | GET | invité/user | Historique courses |
| `/api/games/:id/drag/upgrade/:type` | POST | invité/user | Améliorer moteur/transmission |
| `/api/games/:id/drag/opponents` | GET | invité/user | Classement adversaires |

### Réponses Attendues

**Session (`GET /drag/session`):**
```json
{
  "player": {
    "id": "xxx",
    "nickname": "Invité-xxxxx",
    "cash": 1000000,
    "netWorth": 1000000
  },
  "drag": {
    "stage": 1,
    "engineLevel": 1,
    "transmissionLevel": 1,
    "tuning": { "engineMax": 1.6, "nitroPowerMax": 1.8, "nitroChargesMax": 3 },
    "cooldowns": { "rewardCooldownSeconds": 0 }
  }
}
```

**Résultat (`POST /drag/result`):**
```json
{
  "ok": true,
  "grantedReward": 50000,
  "player": { "cash": 1050000, "netWorth": 1050000 },
  "drag": { "stage": 2 },
  "cooldowns": { "rewardCooldownSeconds": 5 }
}
```

## 🔧 Résolution de Problèmes

### Problème: "Player not found" (404)

**Cause:** Cookie invité non créé ou `X-Player-ID` manquant

**Solution:**
1. Vérifier que le navigateur accepte les cookies
2. Nettoyer localStorage et recharger
3. Vérifier la console pour erreurs réseau

### Problème: "CSRF token invalid" (403)

**Cause:** Token CSRF expiré ou manquant

**Solution:**
1. Nettoyer les cookies
2. Recharger la page
3. Le token est automatiquement récupéré via `ensureCsrf()`

### Problème: Récompense non accordée (grantedReward: 0)

**Cause:** Cooldown actif (5 secondes entre victoires)

**Solution:** Attendre 5 secondes avant la prochaine victoire

### Problème: Temps de course rejeté (400)

**Cause:** Temps < minimum plausible (5.5s pour stage 1)

**Solution:** Terminer la course normalement (pas de triche temps)

## 📱 Test Mobile

### iOS/Safari (cookies tiers bloqués)

Le header `X-Player-ID` contourne ce problème:
1. Ouvrir Safari sur iPhone
2. Aller sur `/drag/standalone`
3. Jouer une course
4. Vérifier localStorage dans Web Inspector
5. Progression sauvegardée malgré cookies bloqués

### Android

Test en natif (Capacitor) ou web:
1. WebView utilise automatiquement cookies
2. Fallback `X-Player-ID` si nécessaire

## ✅ Checklist Validation Complète

- [ ] Test HTML autonome: flux complet réussi
- [ ] PowerShell: tous les endpoints 200/OK
- [ ] Navigateur invité: course + récompense
- [ ] Navigateur connecté: course + progression liée au compte
- [ ] Mobile iOS: fonctionne malgré cookies bloqués
- [ ] Console: aucune erreur 401/403/500
- [ ] localStorage: session persistée correctement
- [ ] HUD: cash et stage mis à jour après victoire

## 🎯 Prochaines Étapes

1. **Monitoring:** Vérifier les logs Render pour détecter erreurs utilisateurs
2. **Analytics:** Tracker taux de conversion invité → compte
3. **UX:** Ajouter un bouton "Sauvegarder progression" pour inciter à créer compte
4. **Performance:** Optimiser requêtes DB si beaucoup de joueurs invités

---

**Dernière mise à jour:** 13 novembre 2025
**Version:** 1.0.0
**Status:** ✅ Production Ready
