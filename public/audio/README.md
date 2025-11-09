# Audio du jeu

Placez ici les fichiers:
- theme.mp3 (musique de fond en boucle)
- sfx-correct.mp3 (son bonne réponse quiz)
- sfx-wrong.mp3 (son mauvaise réponse quiz)
- sfx-reward.mp3 (son récompense / vie / bonus)

Le dépôt ignore les fichiers mp3/wav via .gitignore pour éviter de stocker de gros binaires.
Ils doivent être copiés manuellement sur votre poste de build et dans l'environnement mobile.

Taille conseillée:
- theme.mp3: < 500 KB (loop optimisé, fade in/out possible)
- sfx-*.mp3: < 50 KB

Format: 44.1 kHz ou 48 kHz, stéréo ou mono. Mono suffit pour les SFX (réduction taille).

Fallback: Si les fichiers sont absents, une tonalité discrète remplace la musique et un beep remplace les SFX (implémenté dans BackgroundMusic et sfx.ts).
