export const dynamic = 'force-static';

export default function DragStandalonePage() {
  return (
    <html lang="fr">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Drag Shift Duel</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600;700&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="/drag/style.css" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var loc = window.location;
                  var host = loc && loc.hostname ? loc.hostname : '';
                  var path = loc && loc.pathname ? loc.pathname : '';
                  var isLocalHost = /^(localhost|127\\.0\\.0\\.1|0\\.0\\.0\\.0)$/.test(host) || host.startsWith('192.168.');
                  if (!window.DRAG_DEV_PROXY && isLocalHost && path && path.startsWith('/drag/')) {
                      window.DRAG_DEV_PROXY = 'https://server-jeux-millionnaire.onrender.com';
                  }
                  if (!window.DRAG_API_BASE && window.DRAG_DEV_PROXY) {
                      window.DRAG_API_BASE = window.DRAG_DEV_PROXY;
                  }
                } catch (err) { }
              })();
            `,
          }}
        />
      </head>
      <body>
        <div className="auth-bar">
          <div className="auth-left">
            <input id="authEmail" type="email" placeholder="Email" aria-label="Email" />
            <input id="authPassword" type="password" placeholder="Mot de passe" aria-label="Mot de passe" />
            <button id="authLogin" className="secondary-button" type="button">Connexion</button>
            <button id="authRegister" className="secondary-button" type="button">Créer un compte</button>
            <button id="authForgot" className="secondary-button" type="button">Mot de passe oublié</button>
          </div>
          <div className="auth-right">
            <span id="authStatus" className="auth-status">Invité</span>
            <button id="authLogout" className="secondary-button" type="button" hidden>Déconnexion</button>
          </div>
        </div>
        <main className="wrapper">
          <section className="hud">
            <div className="hud-card">
              <span className="label">Course</span>
              <span className="value" id="hudStage">1</span>
            </div>
            <div className="hud-card">
              <span className="label">Argent</span>
              <span className="value" id="hudCash">0 $</span>
            </div>
            <div className="hud-card">
              <span className="label">Temps</span>
              <span className="value" id="hudTime">0.00 s</span>
            </div>
            <div className="hud-card">
              <span className="label">Dernier shift</span>
              <span className="value" id="hudShift">—</span>
            </div>
            <div className="hud-card">
              <span className="label">Vitesse max</span>
              <span className="value" id="hudTopSpeed">0 km/h</span>
            </div>
            <div className="hud-card">
              <span className="label">RPM max</span>
              <span className="value" id="hudTopRpm">0</span>
            </div>
          </section>

          <section className="game-shell">
            <div className="playfield">
              <canvas id="trackCanvas" width={960} height={540}></canvas>
              <div className="overlay">
                <div className="status-banner" id="statusBanner">
                  Maintiens la pédale (flèche haut ou bouton), utilise Nitro (N/X ou bouton) et change de vitesse dans la zone verte.
                </div>
              </div>
            </div>

            {/* Page d'accueil: connexion (barre en haut), modes, garage/réglages et actions */}
            <section className="home-screen" id="homeScreen">
              <h2 className="home-title">Drag Shift Duel</h2>
              <p className="home-sub">Choisis ton mode, vérifie tes réglages et lance la course.</p>

              {/* Sélection du mode de course */}
              <div className="mode-select" id="modeSelect">
                <h3>Choisis ton mode</h3>
                <div className="mode-buttons">
                  <button id="modeWorld" className="secondary-button" type="button" data-mode="world" title="Contre le meilleur fantôme mondial">Record mondial • +1 000 000 $</button>
                  <button id="modePvP" className="secondary-button" type="button" data-mode="pvp" title="Contre le meilleur fantôme d'un autre joueur">PvP • +500 000 $</button>
                  <button id="modeGhost" className="secondary-button" type="button" data-mode="ghost" title="Contre ton fantôme IA (10e meilleur)">Fantôme IA • +50 000 $</button>
                </div>
              </div>

              {/* Raccourcis et options de vue */}
              <div className="home-actions">
                <button id="garageButton" className="secondary-button" type="button">Garage &amp; Réglages</button>
                <div className="spacer"></div>
                <button id="exitButton" className="secondary-button" type="button" title="Revenir au Jeu du Millionnaire">Sortir</button>
              </div>

              {/* Lancer la course en bas */}
              <div className="home-start">
                <button id="startButton" className="primary-button" type="button">Lancer la course</button>
              </div>
            </section>
            
            {/* Barre de contrôles sous la piste: à gauche Gaz + Nitro, au centre le cadran, à droite le Shifter */}
            <div className="race-controls" id="raceControls">
              <div className="race-left">
                <button id="gasButton" className="pedal-button" type="button" aria-label="Pédale d'accélérateur">Accélérer</button>
                <button id="nitroButton" className="nitro-button" type="button" aria-label="Activer le nitro">Nitro</button>
              </div>
              
              <div className="race-center">
                <div className="gauge-panel">
                  <canvas id="rpmCanvas" width={280} height={280}></canvas>
                  <div className="gear-display">
                    <span className="gear-label">Rapport</span>
                    <span className="gear-value" id="gearValue">N</span>
                  </div>
                </div>
              </div>
              
              <div className="race-right">
                <button id="shiftButton" className="pedal-button shift-mode" type="button" aria-label="Changer de vitesse">SHIFT</button>
              </div>
            </div>
          </section>
        </main>

        <div id="garageOverlay" className="garage-overlay" hidden>
          <div className="garage-panel" role="dialog" aria-modal="true" aria-labelledby="garageTitle">
            <header className="garage-header">
              <h2 id="garageTitle">Garage</h2>
              <button id="closeGarageButton" className="icon-button" type="button" aria-label="Fermer le garage">&times;</button>
            </header>
            
            <div className="garage-tabs">
              <button id="tabUpgrades" className="garage-tab active" type="button" data-tab="upgrades">Améliorations</button>
              <button id="tabSettings" className="garage-tab" type="button" data-tab="settings">Réglages</button>
            </div>
            
            <div className="garage-content">
              {/* Onglet Améliorations (Upgrades) */}
              <section id="upgradesPanel" className="garage-section tab-panel active">
                <div className="upgrade-card">
                  <h3>Moteur</h3>
                  <p className="upgrade-description">
                    Niveau <span id="engineLevelDisplay">1</span>/20<br />
                    <span id="enginePowerDisplay">130 HP</span> (Corolla)
                  </p>
                  <div className="upgrade-actions">
                    <button id="buyEngineButton" className="primary-button" type="button">
                      Améliorer - 1 000 000 $ + <span className="reward-icon">📺</span>
                    </button>
                  </div>
                </div>
                
                <div className="upgrade-card">
                  <h3>Transmission</h3>
                  <p className="upgrade-description">
                    Niveau <span id="transmissionLevelDisplay">1</span>/5<br />
                    <span id="transmissionDesc">5 vitesses Corolla (fixe)</span>
                  </p>
                  <div className="upgrade-actions">
                    <button id="buyTransmissionButton" className="primary-button" type="button">
                      Améliorer - 1 000 000 $ + <span className="reward-icon">📺</span>
                    </button>
                  </div>
                </div>
              </section>
              
              {/* Onglet Réglages (Settings) */}
              <section id="settingsPanel" className="garage-section tab-panel">
                <h3>Étagement des vitesses</h3>
                <p className="section-hint">Ajuste les ratios pour espacer ou rapprocher les rapports. 1.00 = valeur d'origine.</p>
                <div className="slider-list" id="gearSliderList"></div>
                
                <h3>Moteur</h3>
                <div className="slider-group">
                  <label htmlFor="engineSlider">Force moteur</label>
                  <input id="engineSlider" type="range" min="0.9" max="1.7" step="0.05" defaultValue="1.0" />
                  <span id="engineValue" className="slider-value">1.00×</span>
                </div>
                
                <h3>Nitro</h3>
                <div className="slider-group">
                  <label htmlFor="nitroPowerSlider">Puissance</label>
                  <input id="nitroPowerSlider" type="range" min="1" max="1.9" step="0.05" defaultValue="1.4" />
                  <span id="nitroPowerValue" className="slider-value">1.40×</span>
                </div>
                <div className="slider-group">
                  <label htmlFor="nitroDurationSlider">Durée (s)</label>
                  <input id="nitroDurationSlider" type="range" min="0.6" max="3" step="0.1" defaultValue="1.5" />
                  <span id="nitroDurationValue" className="slider-value">1.5 s</span>
                </div>
                <div className="slider-group">
                  <label htmlFor="nitroChargesSlider">Charges</label>
                  <input id="nitroChargesSlider" type="range" min="1" max="3" step="1" defaultValue="1" />
                  <span id="nitroChargesValue" className="slider-value">1</span>
                </div>
              </section>
            </div>
            
            <footer className="garage-footer">
              <button id="resetGarageButton" className="secondary-button" type="button">Réinitialiser</button>
              <button id="applyGarageButton" className="primary-button" type="button">Appliquer</button>
            </footer>
          </div>
        </div>

        {/* Overlay PvP: choisir un adversaire */}
        <div id="opponentsOverlay" className="garage-overlay" hidden>
          <div className="garage-panel" role="dialog" aria-modal="true" aria-labelledby="opponentsTitle">
            <header className="garage-header">
              <h2 id="opponentsTitle">Choisir un adversaire (PvP)</h2>
              <button id="closeOpponentsButton" className="icon-button" type="button" aria-label="Fermer">&times;</button>
            </header>
            <div className="garage-content">
              <div id="opponentsList" className="opponents-list"></div>
            </div>
            <footer className="garage-footer">
              <button id="cancelOpponentsButton" className="secondary-button" type="button">Annuler</button>
            </footer>
          </div>
        </div>

        <footer className="footer">
          <p>
            Drag Shift Duel — maintiens le moteur dans la zone verte, enchaîne les shifts parfaits et laisse
            l'adversaire dans ton rétro.
          </p>
        </footer>

        <script src="/drag/main.js" defer></script>
      </body>
    </html>
  );
}
