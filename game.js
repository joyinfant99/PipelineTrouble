// Game — core loop, spawning, collisions, win/loss
class Game {
  constructor(canvas, playersConfig, callbacks, options) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.callbacks = callbacks || {};
    options = options || {};
    this.mode = options.mode === 'single' ? 'single' : 'multi';
    this.difficulty = CONFIG.DIFFICULTY_PRESETS[options.difficulty] ? options.difficulty : 'normal';
    this.difficultyPreset = CONFIG.DIFFICULTY_PRESETS[this.difficulty];
    this.speedMultiplier =
      (CONFIG.BUBBLE_SPEED_PRESETS[options.bubbleSpeed] || 1) * this.difficultyPreset.blockerSpeedMult;

    const groundY = CONFIG.CANVAS_H - 24;
    const activeConfigs = this.mode === 'single' ? [playersConfig[0]] : playersConfig;
    const startXs =
      this.mode === 'single'
        ? [CONFIG.CANVAS_W / 2 - CONFIG.PLAYER_W / 2]
        : [CONFIG.CANVAS_W * 0.33 - CONFIG.PLAYER_W / 2, CONFIG.CANVAS_W * 0.67 - CONFIG.PLAYER_W / 2];

    this.players = activeConfigs.map(
      (cfg, i) => new Player(i, cfg.name, cfg.controls, startXs[i], groundY, cfg.character)
    );
    InputManager.setControls(this.players.map((p) => p.controls));

    this.projectiles = [];
    this.blockers = [];
    this.particles = [];
    this.bonusBubble = null;
    this.dealBlockerCount = new Map();
    this._nextDealId = 1;
    this._nextBonusBubbleAt = 0;

    this.score = new ScoreManager(this.difficultyPreset.targetScore);
    this.maxLives = this.difficultyPreset.livesMax;
    this.players.forEach((p) => {
      p.maxLives = this.maxLives;
      p.lives = this.maxLives;
    });
    this.timeRemaining = this.difficultyPreset.roundDuration;
    this.running = false;
    this.ended = false;
    this.paused = false;
    this._endReason = null; // 'WON' | 'TIME' | 'LIVES'
    this._lastTs = null;
    this._sinceLastSpawn = 0;
    this._rafId = null;

    this.groundY = groundY;

    // screen shake — punchy feedback on powerful hits
    this._shakeUntil = 0;
    this._shakeMag = 0;
  }

  start() {
    this.running = true;
    this.ended = false;
    this.paused = false;
    this._lastTs = performance.now();
    this._spawnDeal();
    this._sinceLastSpawn = 0;
    this._nextBonusBubbleAt = this._lastTs + this._randomBonusDelay();
    this._loop(this._lastTs);
  }

  stop() {
    this.running = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
  }

  togglePause() {
    this.paused = !this.paused;
    if (this.paused) AudioManager.pauseMusic();
    else AudioManager.resumeMusic();
    return this.paused;
  }

  _randomBonusDelay() {
    return CONFIG.BONUS_BUBBLE_MIN_MS + Math.random() * (CONFIG.BONUS_BUBBLE_MAX_MS - CONFIG.BONUS_BUBBLE_MIN_MS);
  }

  _spawnDeal() {
    const activeDeals = this.dealBlockerCount.size;
    if (activeDeals >= CONFIG.MAX_CONCURRENT_DEALS) return;
    const id = this._nextDealId++;
    const radius = CONFIG.BLOCKER_TIERS[0].radius;
    const x = radius + Math.random() * (CONFIG.CANVAS_W - radius * 2);
    const vx = (Math.random() < 0.5 ? -1 : 1) * CONFIG.BLOCKER_TIERS[0].speed * this.speedMultiplier;
    const b = new Blocker(0, x, radius + 4, vx, 'STALLED DEAL', id, this.speedMultiplier);
    this.blockers.push(b);
    this.dealBlockerCount.set(id, 1);
  }

  _spawnBonusBubble() {
    if (this.bonusBubble) return;
    const radius = CONFIG.BONUS_BUBBLE_RADIUS;
    const x = radius + Math.random() * (CONFIG.CANVAS_W - radius * 2);
    const vx = (Math.random() < 0.5 ? -1 : 1) * CONFIG.BONUS_BUBBLE_SPEED * this.speedMultiplier;
    this.bonusBubble = new BonusBubble(x, radius + 4, vx, this.speedMultiplier, this._pickBonusKind());
  }

  _pickBonusKind() {
    const kinds = CONFIG.BONUS_KINDS;
    const totalWeight = kinds.reduce((sum, k) => sum + k.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const kind of kinds) {
      roll -= kind.weight;
      if (roll <= 0) return kind;
    }
    return kinds[0];
  }

  _spawnProjectile(player) {
    const x = player.muzzleX - CONFIG.PROJECTILE_W / 2;
    const y = player.muzzleY;
    const activeForPlayer = this.projectiles.filter((p) => p.ownerIndex === player.index && p.alive).length;
    if (activeForPlayer >= CONFIG.MAX_PROJECTILES_PER_PLAYER) return;
    this.projectiles.push(new Projectile(x, y, player.index));
    this._muzzleFlash(player.muzzleX, y, player.color);
    this._shake(90, 3);
    AudioManager.shoot();
  }

  _muzzleFlash(x, y, color) {
    for (let i = 0; i < 6; i++) {
      const p = new Particle(x, y, i % 2 === 0 ? CONFIG.COLORS.white : color);
      p.vx = (Math.random() - 0.5) * 180;
      p.vy = -160 - Math.random() * 140;
      p.life = 140 + Math.random() * 60;
      p.maxLife = p.life;
      p.size = 2 + Math.random() * 2;
      this.particles.push(p);
    }
  }

  _shake(durationMs, magnitude) {
    const now = performance.now();
    this._shakeUntil = Math.max(this._shakeUntil, now + durationMs);
    this._shakeMag = Math.max(this._shakeMag, magnitude);
  }

  _loop(ts) {
    if (!this.running) return;
    const dt = Math.min(0.05, (ts - this._lastTs) / 1000);
    this._lastTs = ts;

    if (!this.paused) {
      this._update(dt, ts);
    }
    this._render();

    if (!this.ended) {
      this._rafId = requestAnimationFrame((t) => this._loop(t));
    }
  }

  _update(dt, ts) {
    if (this.ended) return;

    this.timeRemaining -= dt;
    this._sinceLastSpawn += dt * 1000;
    if (this._sinceLastSpawn >= this.difficultyPreset.spawnIntervalMs) {
      this._sinceLastSpawn = 0;
      this._spawnDeal();
    }

    if (!this.bonusBubble && ts >= this._nextBonusBubbleAt) {
      this._spawnBonusBubble();
    }

    for (const p of this.players) {
      const state = InputManager.getPlayerState(p.index);
      p.update(dt, state, (pl) => this._spawnProjectile(pl));
    }

    for (const proj of this.projectiles) proj.update(dt);
    this.projectiles = this.projectiles.filter((p) => p.alive);

    for (const b of this.blockers) b.update(dt);

    if (this.bonusBubble) {
      this.bonusBubble.update(dt);
      if (!this.bonusBubble.alive) {
        this.bonusBubble = null;
        this._nextBonusBubbleAt = ts + this._randomBonusDelay();
      }
    }

    for (const fx of this.particles) fx.update(dt);
    this.particles = this.particles.filter((fx) => fx.alive);

    this._handleCollisions(ts);

    if (this.callbacks.onTick) {
      this.callbacks.onTick(this._getHudState());
    }

    if (this.score.isTargetReached) {
      this._endRound('WON');
      return;
    }
    // each player has their own pool, so the round only ends once nobody is left standing
    if (this.players.every((p) => p.isOut)) {
      this._endRound('LIVES');
      return;
    }
    if (this.timeRemaining <= 0) {
      this.timeRemaining = 0;
      this._endRound('TIME');
      return;
    }
  }

  _handleCollisions(ts) {
    // projectile vs blocker
    for (const proj of this.projectiles) {
      if (!proj.alive) continue;
      for (const b of this.blockers) {
        if (!b.alive) continue;
        if (this._circleRectOverlap(b, proj.bounds)) {
          proj.alive = false;
          this._onBlockerHit(b, proj.ownerIndex);
          break;
        }
      }
    }
    this.blockers = this.blockers.filter((b) => b.alive);

    // projectile vs bonus bubble
    if (this.bonusBubble) {
      for (const proj of this.projectiles) {
        if (!proj.alive) continue;
        if (this._circleRectOverlap(this.bonusBubble, proj.bounds)) {
          proj.alive = false;
          this._onBonusCaptured(proj.ownerIndex, ts);
          break;
        }
      }
      if (this.projectiles.some((p) => !p.alive)) {
        this.projectiles = this.projectiles.filter((p) => p.alive);
      }
    }

    // blocker vs player
    for (const p of this.players) {
      if (p.isOut) continue;
      for (const b of this.blockers) {
        if (!b.alive) continue;
        if (this._circleRectOverlap(b, { x: p.x, y: p.y, w: p.w, h: p.h })) {
          const wasHit = p.hitByBlocker();
          if (wasHit) {
            // charged to the player who took the hit, so their contribution stays honest
            this.score.applyPenalty(this.difficultyPreset.hitPenalty, p.index, this.players);
            AudioManager.playerHit();
            this._shake(220, 10);
            if (this.callbacks.onPlayerHit) this.callbacks.onPlayerHit(p);
            if (this.callbacks.onLivesChanged) this.callbacks.onLivesChanged(this.players);
          }
        }
      }
    }
  }

  _circleRectOverlap(circle, rect) {
    const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.w));
    const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.h));
    const dx = circle.x - closestX;
    const dy = circle.y - closestY;
    return dx * dx + dy * dy < circle.radius * circle.radius;
  }

  _onBlockerHit(b, ownerIndex) {
    b.alive = false;
    AudioManager.hit();
    // tier 0 (biggest blocker) gets the fattest burst
    spawnBurst(this.particles, b.x, b.y, b.color, b.tier === 0 ? CONFIG.PARTICLE_COUNT + 10 : undefined);
    this._shake(140, b.tier === 0 ? 7 : 4);
    this.score.addBlockerRemoved(b.tier, ownerIndex, this.players);

    const dealId = b.dealId;
    let remaining = this.dealBlockerCount.get(dealId) || 1;
    remaining -= 1;

    if (b.tier < 2) {
      // split into two children of next tier
      const childTier = b.tier + 1;
      const labels = childTier === 1 ? CONFIG.MID_LABELS : this._pickTwoRandom(CONFIG.SMALL_LABELS);
      const speed = CONFIG.BLOCKER_TIERS[childTier].speed;
      const mSpeed = speed * this.speedMultiplier;
      const child1 = new Blocker(childTier, b.x - 10, b.y - 6, -mSpeed, labels[0], dealId, this.speedMultiplier);
      const child2 = new Blocker(childTier, b.x + 10, b.y - 6, mSpeed, labels[1], dealId, this.speedMultiplier);
      child1.vy = -320 * this.speedMultiplier;
      child2.vy = -320 * this.speedMultiplier;
      this.blockers.push(child1, child2);
      remaining += 2;
      AudioManager.split();
    } else {
      // nothing left to split off — this one burst for good
      AudioManager.coinBurst();
    }

    if (remaining <= 0) {
      this.dealBlockerCount.delete(dealId);
      this.score.addDealReaccelerated(ownerIndex, this.players);
      AudioManager.mrrGained();
      if (this.callbacks.onDealReaccelerated) this.callbacks.onDealReaccelerated();
      this._spawnDeal();
    } else {
      this.dealBlockerCount.set(dealId, remaining);
    }
  }

  _onBonusCaptured(ownerIndex, ts) {
    const bubble = this.bonusBubble;
    this.bonusBubble = null;
    this._nextBonusBubbleAt = ts + this._randomBonusDelay();
    spawnBurst(this.particles, bubble.x, bubble.y, bubble.color, CONFIG.PARTICLE_COUNT + 6);

    const player = this.players[ownerIndex];
    const weights = CONFIG.SCORE_WEIGHTS;
    const banner = (text) => this.callbacks.onBonusCaptured && this.callbacks.onBonusCaptured(text);

    switch (bubble.kind.key) {
      case 'life':
        // the life goes to whoever popped it, since each player has their own pool
        if (player && player.lives < player.maxLives) {
          player.lives += 1;
          AudioManager.lifeGained();
          if (this.callbacks.onLivesChanged) this.callbacks.onLivesChanged(this.players);
          banner(`${player.name} LIFE +1`);
        } else {
          this.score.addBonus(weights.lifeBonusAtMax, ownerIndex, this.players);
          AudioManager.bonusMrr();
          banner(`+${weights.lifeBonusAtMax.toLocaleString()} PTS`);
        }
        break;
      case 'cash':
        this.score.addBonus(weights.cashBonus, ownerIndex, this.players);
        AudioManager.bonusMrr();
        banner(`+${weights.cashBonus.toLocaleString()} PTS`);
        break;
      case 'rapid':
        if (player) player.rapidFireUntil = performance.now() + CONFIG.RAPID_FIRE_DURATION_MS;
        AudioManager.bonusMrr();
        banner('RAPID FIRE!');
        break;
      case 'shield':
        if (player) player.shieldUntil = performance.now() + CONFIG.SHIELD_DURATION_MS;
        AudioManager.bonusMrr();
        banner('SHIELD ACTIVE!');
        break;
    }
  }

  _pickTwoRandom(arr) {
    const copy = [...arr];
    const out = [];
    for (let i = 0; i < 2 && copy.length; i++) {
      const idx = Math.floor(Math.random() * copy.length);
      out.push(copy.splice(idx, 1)[0]);
    }
    while (out.length < 2) out.push(arr[0]);
    return out;
  }

  _endRound(reason) {
    this.ended = true;
    this.running = false;
    this._endReason = reason;
    AudioManager.stopMusic();
    if (reason === 'WON') AudioManager.win();
    else AudioManager.lose();
    if (this.callbacks.onEnd) {
      this.callbacks.onEnd({ won: reason === 'WON', reason, result: this._buildResult(reason) });
    }
  }

  // TOTAL SCORE is built so the scorecard adds up in front of the player:
  //   sum(player contributions) + time + lives + win === total
  // Player contributions already net off their own hit penalties, so there is no
  // hidden term — the summary at the top and the cards underneath agree exactly.
  _buildResult(reason) {
    const won = reason === 'WON';
    const weights = CONFIG.SCORE_WEIGHTS;
    const timeRemaining = Math.max(0, this.timeRemaining);
    const livesRemaining = this.players.reduce((sum, p) => sum + p.lives, 0);

    const playedScore = this.players.reduce((sum, p) => sum + p.contribution, 0);
    const timeBonus = won ? Math.round(timeRemaining * weights.timePerSec) : 0;
    const livesBonus = livesRemaining * weights.perLifeLeft;
    const winBonus = won ? weights.win : 0;
    const total = Math.max(0, playedScore + timeBonus + livesBonus + winBonus);

    return {
      won,
      reason,
      score: total,
      playedScore,
      blockerPoints: this.score.blockerPoints,
      dealPoints: this.score.dealPoints,
      bonusPoints: this.score.bonusPoints,
      penalty: this.score.penalty,
      timeBonus,
      livesBonus,
      winBonus,
      blockersRemoved: this.score.blockersRemoved,
      dealsReaccelerated: this.score.dealsReaccelerated,
      timeRemaining,
      livesRemaining,
      maxLives: this.maxLives,
      difficulty: this.difficultyPreset.label,
      players: this.players.map((p) => ({
        name: p.name,
        character: p.character,
        shotsFired: p.shotsFired,
        blockersHit: p.blockersHit,
        contribution: p.contribution,
        livesLeft: p.lives,
        timesHit: p.timesHit,
        accuracy: p.shotsFired > 0 ? Math.round((p.blockersHit / p.shotsFired) * 100) : 0,
      })),
    };
  }

  _getHudState() {
    return {
      score: Math.round(this.score.netScore),
      targetScore: this.difficultyPreset.targetScore,
      blockersRemoved: this.score.blockersRemoved,
      timeRemaining: Math.max(0, this.timeRemaining),
      maxLives: this.maxLives,
      players: this.players,
    };
  }

  _render() {
    const ctx = this.ctx;
    ctx.save();

    const now = performance.now();
    if (now < this._shakeUntil) {
      const falloff = (this._shakeUntil - now) / 220;
      const mag = this._shakeMag * Math.max(0, Math.min(1, falloff));
      ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
    } else {
      this._shakeMag = 0;
    }

    ctx.fillStyle = CONFIG.COLORS.bg;
    ctx.fillRect(-20, -20, CONFIG.CANVAS_W + 40, CONFIG.CANVAS_H + 40);

    if (Assets.drawBackground(ctx, CONFIG.CANVAS_W, CONFIG.CANVAS_H)) {
      // knock the city art back so the neon blockers and labels stay readable on top of it
      ctx.fillStyle = 'rgba(18, 10, 42, 0.45)';
      ctx.fillRect(-20, -20, CONFIG.CANVAS_W + 40, CONFIG.CANVAS_H + 40);
    }

    // floor line — sits right at the players' feet (this.groundY), previously this
    // added player height a second time and drew 18px below the visible canvas.
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = CONFIG.COLORS.cyan;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, this.groundY + 2);
    ctx.lineTo(CONFIG.CANVAS_W, this.groundY + 2);
    ctx.stroke();
    ctx.restore();

    for (const b of this.blockers) b.draw(ctx);
    if (this.bonusBubble) this.bonusBubble.draw(ctx);
    for (const fx of this.particles) fx.draw(ctx);
    for (const proj of this.projectiles) proj.draw(ctx);
    for (const p of this.players) p.draw(ctx);

    // labels drawn last, outside/below each ball, so they stay crisp and readable
    // above every other layer no matter how small the ball has shrunk.
    for (const b of this.blockers) this._drawLabel(ctx, b.x, b.y + b.radius, b.label, b.color);
    if (this.bonusBubble) this._drawLabel(ctx, this.bonusBubble.x, this.bonusBubble.y + this.bonusBubble.radius, this.bonusBubble.label, CONFIG.COLORS.white);

    ctx.restore();
  }

  _drawLabel(ctx, x, y, text, color) {
    ctx.save();
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const labelY = Math.min(y + 8, CONFIG.CANVAS_H - 14);
    const padX = 5;
    const w = ctx.measureText(text).width + padX * 2;
    const h = 13;
    const cx = Math.min(CONFIG.CANVAS_W - w / 2 - 2, Math.max(w / 2 + 2, x));
    ctx.globalAlpha = 0.88;
    ctx.fillStyle = CONFIG.COLORS.bg;
    drawRoundedRect(ctx, cx - w / 2, labelY, w, h, 3);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, cx - w / 2, labelY, w, h, 3);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.fillText(text, cx, labelY + 2);
    ctx.restore();
  }
}
