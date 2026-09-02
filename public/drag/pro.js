/* Mobile/pro polish loaded after main.js. Keeps the existing game/server contract intact. */
(function () {
  'use strict';

  // The previous implementation changed the feedback wording to
  // "Très bonne poussée !" but still checked for the old "Parfait !" string.
  // That made perfectShifts stay at zero forever. Replacing the handler here
  // fixes the gameplay without changing the server payload or race physics.
  try {
    handleShift = function handleShiftPro() {
      if (game.state !== 'running') return;

      const transConfig = getTransmissionConfig(upgrades.transmissionLevel);
      const maxGear = transConfig.gears;
      if (player.gear >= maxGear) {
        setShiftFeedback('Dernière vitesse', '#d6ddff', false);
        return;
      }

      const rpmBefore = player.rpm;
      let momentumDelta = 0;
      let feedback = 'Zone rouge';
      let tint = '#ff6b6b';
      let isPerfectShift = false;

      if (rpmBefore < RPM_SHIFT_MIN) {
        feedback = 'Trop tôt';
        momentumDelta = 0.04;
        tint = '#ffe66d';
      } else if (rpmBefore < RPM_SHIFT_MAX) {
        feedback = 'Bon shift';
        momentumDelta = 0.18;
        tint = '#ffd166';
      } else if (rpmBefore <= RPM_GREEN_END) {
        feedback = 'SHIFT PARFAIT !';
        momentumDelta = 0.45;
        tint = '#7cffb0';
        isPerfectShift = true;
      }

      player.shiftMomentum = clamp(player.shiftMomentum + momentumDelta, -0.4, 0.45);
      player.shiftsTaken = Math.min(player.shiftsTaken + 1, maxGear - 1);
      if (isPerfectShift) {
        player.perfectShifts = Math.min(player.perfectShifts + 1, maxGear);
        try {
          if (navigator.vibrate) navigator.vibrate([18, 20, 28]);
        } catch (_) {}
      }
      setShiftFeedback(feedback, tint, true);

      const nextGear = player.gear + 1;
      const currentProfile = gearProfile[player.gear];
      const nextProfile = gearProfile[nextGear];
      if (!currentProfile || !nextProfile) return;
      const ratio = currentProfile.topSpeed / nextProfile.topSpeed;
      player.rpm = clamp(rpmBefore * ratio * 0.98, RPM_IDLE + 300, RPM_MAX - 800);
      player.speed = Math.min(player.speed, nextProfile.topSpeed * 0.96);
      player.gear = nextGear;
      updateGearDisplay();
    };
  } catch (error) {
    console.warn('[drag][pro] perfect shift patch unavailable', error);
  }

  // More expressive cartoon cars while retaining the very light canvas engine.
  // No external images and no extra downloads are required on Android.
  try {
    drawCar = function drawCarPro(x, y, bodyColor, accentColor) {
      trackCtx.save();
      const w = 136;
      const h = 48;
      const playerCar = String(bodyColor).toLowerCase() === '#ff5f7a';

      // Speed streaks make the lane feel alive without expensive particles.
      const moving = game.state === 'running';
      if (moving) {
        trackCtx.globalAlpha = 0.28;
        trackCtx.strokeStyle = lightenColor(bodyColor, 0.55);
        trackCtx.lineWidth = 3;
        trackCtx.lineCap = 'round';
        for (let i = 0; i < 3; i += 1) {
          trackCtx.beginPath();
          trackCtx.moveTo(x - 12 - i * 13, y + 18 + i * 8);
          trackCtx.lineTo(x - 42 - i * 18, y + 18 + i * 8);
          trackCtx.stroke();
        }
        trackCtx.globalAlpha = 1;
      }

      // Nitro flame for the player.
      if (playerCar && player.nitroActive) {
        const flame = trackCtx.createLinearGradient(x - 34, y + 25, x + 5, y + 25);
        flame.addColorStop(0, 'rgba(88,209,255,0)');
        flame.addColorStop(0.35, '#64d9ff');
        flame.addColorStop(0.72, '#fff3a6');
        flame.addColorStop(1, '#ff8b5d');
        trackCtx.fillStyle = flame;
        trackCtx.beginPath();
        trackCtx.moveTo(x + 8, y + 29);
        trackCtx.quadraticCurveTo(x - 24, y + 14, x - 43, y + 28);
        trackCtx.quadraticCurveTo(x - 20, y + 43, x + 10, y + 36);
        trackCtx.closePath();
        trackCtx.fill();
      }

      // Ground shadow.
      trackCtx.fillStyle = 'rgba(0,0,0,.32)';
      trackCtx.beginPath();
      trackCtx.ellipse(x + w * 0.5, y + h + 12, w * 0.47, 11, 0, 0, Math.PI * 2);
      trackCtx.fill();

      const bodyGradient = trackCtx.createLinearGradient(x, y, x, y + h);
      bodyGradient.addColorStop(0, lightenColor(bodyColor, 0.48));
      bodyGradient.addColorStop(0.42, bodyColor);
      bodyGradient.addColorStop(1, darkenColor(bodyColor, 0.36));

      // Main aerodynamic body.
      trackCtx.fillStyle = bodyGradient;
      trackCtx.beginPath();
      trackCtx.moveTo(x + 4, y + 32);
      trackCtx.quadraticCurveTo(x + 9, y + 17, x + 30, y + 15);
      trackCtx.lineTo(x + 48, y + 5);
      trackCtx.quadraticCurveTo(x + 57, y, x + 76, y + 2);
      trackCtx.lineTo(x + 100, y + 14);
      trackCtx.quadraticCurveTo(x + 126, y + 17, x + 134, y + 29);
      trackCtx.lineTo(x + 132, y + 41);
      trackCtx.quadraticCurveTo(x + 126, y + 47, x + 113, y + 47);
      trackCtx.lineTo(x + 19, y + 47);
      trackCtx.quadraticCurveTo(x + 4, y + 46, x + 2, y + 38);
      trackCtx.closePath();
      trackCtx.fill();

      // Thick cartoon outline.
      trackCtx.strokeStyle = darkenColor(bodyColor, 0.58);
      trackCtx.lineWidth = 3;
      trackCtx.stroke();

      // Cabin / windshield.
      const glass = trackCtx.createLinearGradient(x + 45, y + 4, x + 91, y + 22);
      glass.addColorStop(0, '#d8f6ff');
      glass.addColorStop(0.28, '#75c8e8');
      glass.addColorStop(1, '#193c58');
      trackCtx.fillStyle = glass;
      trackCtx.beginPath();
      trackCtx.moveTo(x + 50, y + 7);
      trackCtx.quadraticCurveTo(x + 62, y + 2, x + 75, y + 5);
      trackCtx.lineTo(x + 95, y + 16);
      trackCtx.lineTo(x + 43, y + 16);
      trackCtx.closePath();
      trackCtx.fill();
      trackCtx.strokeStyle = 'rgba(5,20,32,.62)';
      trackCtx.lineWidth = 2;
      trackCtx.stroke();
      trackCtx.strokeStyle = 'rgba(232,251,255,.58)';
      trackCtx.beginPath();
      trackCtx.moveTo(x + 69, y + 5);
      trackCtx.lineTo(x + 68, y + 16);
      trackCtx.stroke();

      // Racing stripe, side skirt, front light.
      trackCtx.fillStyle = accentColor;
      trackCtx.fillRect(x + 55, y + 22, 45, 5);
      trackCtx.fillRect(x + 35, y + 40, 69, 4);
      trackCtx.fillStyle = '#fff3a8';
      trackCtx.beginPath();
      trackCtx.ellipse(x + 126, y + 28, 8, 4, -0.12, 0, Math.PI * 2);
      trackCtx.fill();

      // Rear spoiler.
      trackCtx.strokeStyle = darkenColor(bodyColor, 0.55);
      trackCtx.lineWidth = 4;
      trackCtx.beginPath();
      trackCtx.moveTo(x + 16, y + 20);
      trackCtx.lineTo(x + 12, y + 9);
      trackCtx.lineTo(x + 30, y + 9);
      trackCtx.stroke();

      function proWheel(cx, cy) {
        trackCtx.fillStyle = '#05070a';
        trackCtx.beginPath();
        trackCtx.arc(cx, cy, 14, 0, Math.PI * 2);
        trackCtx.fill();
        trackCtx.strokeStyle = '#1c2530';
        trackCtx.lineWidth = 3;
        trackCtx.stroke();
        trackCtx.fillStyle = '#aeb9c6';
        trackCtx.beginPath();
        trackCtx.arc(cx, cy, 8, 0, Math.PI * 2);
        trackCtx.fill();
        trackCtx.fillStyle = '#3c4653';
        trackCtx.beginPath();
        trackCtx.arc(cx, cy, 3.3, 0, Math.PI * 2);
        trackCtx.fill();
        trackCtx.strokeStyle = '#566271';
        trackCtx.lineWidth = 1.5;
        for (let i = 0; i < 6; i += 1) {
          const a = i * Math.PI / 3;
          trackCtx.beginPath();
          trackCtx.moveTo(cx + Math.cos(a) * 3, cy + Math.sin(a) * 3);
          trackCtx.lineTo(cx + Math.cos(a) * 7, cy + Math.sin(a) * 7);
          trackCtx.stroke();
        }
      }

      proWheel(x + 31, y + 45);
      proWheel(x + 108, y + 45);

      // Player marker: readable at phone scale without adding a HUD card.
      if (playerCar) {
        trackCtx.fillStyle = '#ffffff';
        trackCtx.font = '900 11px Rajdhani, sans-serif';
        trackCtx.textAlign = 'center';
        trackCtx.fillText('TOI', x + 77, y + 36);
      }

      trackCtx.restore();
    };
  } catch (error) {
    console.warn('[drag][pro] car renderer patch unavailable', error);
  }

  // Shorter labels are easier to parse at race speed on a phone.
  try {
    if (gasButton) gasButton.textContent = 'GAZ';
    if (shiftButton) shiftButton.textContent = 'SHIFT';
  } catch (_) {}
})();
