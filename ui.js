// UI — screen management and DOM wiring
const UI = {
  screens: {},
  currentGame: null,
  playersConfig: null,

  init() {
    this.screens = {
      start: document.getElementById('screen-start'),
      setup: document.getElementById('screen-setup'),
      how: document.getElementById('screen-how'),
      game: document.getElementById('screen-game'),
      scorecard: document.getElementById('screen-scorecard'),
      highscores: document.getElementById('screen-highscores'),
    };

    this.playersConfig = StorageManager.getPlayers();

    this._wireStart();
    this._wireSetup();
    this._wireHow();
    this._wireGameControls();
    this._wireScorecard();
    this._wireHighscores();

    this.showScreen('start');
  },

  showScreen(name) {
    Object.values(this.screens).forEach((s) => s.classList.remove('active'));
    this.screens[name].classList.add('active');
  },

  _wireStart() {
    document.getElementById('btn-start-game').addEventListener('click', () => {
      AudioManager.ensureCtx();
      this.startGame();
    });
    document.getElementById('btn-customize').addEventListener('click', () => {
      this.openSetup();
    });
    document.getElementById('btn-highscores').addEventListener('click', () => {
      this.renderHighscores();
      this.showScreen('highscores');
    });
    document.getElementById('btn-howtoplay').addEventListener('click', () => {
      this._renderHowControls();
      this.showScreen('how');
    });
    const soundBtn = document.getElementById('btn-sound');
    soundBtn.textContent = `SOUND: ${AudioManager.enabled ? 'ON' : 'OFF'}`;
    soundBtn.addEventListener('click', () => {
      const on = AudioManager.toggle();
      soundBtn.textContent = `SOUND: ${on ? 'ON' : 'OFF'}`;
    });

    // mode toggle (1 player / 2 player)
    const mode = StorageManager.getMode();
    const modeToggle = document.getElementById('mode-toggle');
    modeToggle.querySelectorAll('.btn-toggle').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
      btn.addEventListener('click', () => {
        StorageManager.saveMode(btn.dataset.mode);
        modeToggle.querySelectorAll('.btn-toggle').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // bubble speed toggle
    const speed = StorageManager.getBubbleSpeed();
    const speedToggle = document.getElementById('speed-toggle');
    speedToggle.querySelectorAll('.btn-toggle').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.speed === speed);
      btn.addEventListener('click', () => {
        StorageManager.saveBubbleSpeed(btn.dataset.speed);
        speedToggle.querySelectorAll('.btn-toggle').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  },

  _wireHow() {
    document.getElementById('btn-how-back').addEventListener('click', () => this.showScreen('start'));
  },

  _renderHowControls() {
    const players = StorageManager.getPlayers();
    const mode = StorageManager.getMode();
    const active = mode === 'single' ? [players[0]] : players;
    const container = document.getElementById('how-controls');
    container.innerHTML = active
      .map((p, i) => {
        const c = p.controls;
        const shootKeys = [this._keyLabel(c.shoot), c.shootAlt ? this._keyLabel(c.shootAlt) : null].filter(Boolean).join(' or ');
        return `
        <div class="how-controls-card">
          <strong>${p.avatar} ${p.name || `PLAYER ${i + 1}`}</strong>
          <p>${this._keyLabel(c.left)} / ${this._keyLabel(c.right)} = MOVE</p>
          <p>${shootKeys} = SHOOT</p>
        </div>`;
      })
      .join('');
  },

  _wireGameControls() {
    const pauseBtn = document.getElementById('btn-pause');
    const overlay = document.getElementById('pause-overlay');

    const doPause = () => {
      if (!this.currentGame || this.currentGame.ended) return;
      const isPaused = this.currentGame.togglePause();
      overlay.hidden = !isPaused;
    };

    pauseBtn.addEventListener('click', doPause);

    document.getElementById('btn-resume').addEventListener('click', () => {
      if (this.currentGame && this.currentGame.paused) this.currentGame.togglePause();
      overlay.hidden = true;
    });

    document.getElementById('btn-pause-quit').addEventListener('click', () => {
      if (this.currentGame) this.currentGame.stop();
      overlay.hidden = true;
      this.showScreen('start');
    });

    window.addEventListener('keydown', (e) => {
      if (this.screens.game.classList.contains('active') && (e.key === 'Escape' || e.key.toLowerCase() === 'p')) {
        doPause();
      }
    });
  },

  openSetup() {
    this._renderSetupScreen();
    this.showScreen('setup');
  },

  _renderSetupScreen() {
    const players = this.playersConfig;
    const mode = StorageManager.getMode();
    document.querySelectorAll('.setup-player').forEach((el, idx) => {
      el.classList.toggle('setup-player-disabled', mode === 'single' && idx === 1);
      const cfg = players[idx];
      const nameInput = el.querySelector('.player-name-input');
      nameInput.value = cfg.name;
      nameInput.placeholder = `P${idx + 1} NAME`;

      const avatarGrid = el.querySelector('.avatar-grid');
      avatarGrid.innerHTML = '';
      CONFIG.AVATARS.forEach((av) => {
        const btn = document.createElement('button');
        btn.className = 'avatar-btn' + (av === cfg.avatar ? ' selected' : '');
        btn.textContent = av;
        btn.addEventListener('click', () => {
          cfg.avatar = av;
          avatarGrid.querySelectorAll('.avatar-btn').forEach((b) => b.classList.remove('selected'));
          btn.classList.add('selected');
        });
        avatarGrid.appendChild(btn);
      });

      el.querySelectorAll('.remap-btn').forEach((remapBtn) => {
        const action = remapBtn.dataset.action;
        remapBtn.textContent = this._keyLabel(cfg.controls[action]);
        remapBtn.onclick = () => {
          remapBtn.textContent = 'PRESS A KEY...';
          InputManager.captureNextKey((key) => {
            cfg.controls[action] = key;
            remapBtn.textContent = this._keyLabel(key);
          });
        };
      });
    });
  },

  _keyLabel(key) {
    if (!key) return '?';
    if (key === ' ') return 'SPACE';
    return key.toUpperCase();
  },

  _wireSetup() {
    document.querySelectorAll('.setup-player').forEach((el, idx) => {
      el.querySelector('.player-name-input').addEventListener('input', (e) => {
        this.playersConfig[idx].name = e.target.value.trim() || `PLAYER ${idx + 1}`;
      });
    });
    document.getElementById('btn-setup-save').addEventListener('click', () => {
      StorageManager.savePlayers(this.playersConfig);
      this.showScreen('start');
    });
    document.getElementById('btn-setup-back').addEventListener('click', () => {
      this.playersConfig = StorageManager.getPlayers();
      this.showScreen('start');
    });
  },

  startGame() {
    this.playersConfig = StorageManager.getPlayers();
    // ensure names aren't blank
    this.playersConfig.forEach((p, i) => {
      if (!p.name || !p.name.trim()) p.name = `PLAYER ${i + 1}`;
    });

    this.showScreen('game');
    document.getElementById('pause-overlay').hidden = true;
    const canvas = document.getElementById('game-canvas');

    this.currentGame = new Game(
      canvas,
      this.playersConfig,
      {
        onTick: (state) => this._updateHud(state),
        onPlayerHit: (player) => this._flashPlayerHud(player),
        onDealReaccelerated: () => this._showBanner('DEAL REACCELERATED', CONFIG.COLORS.yellow),
        onLivesChanged: (lives) => this._renderLives(lives),
        onBonusCaptured: (text) => this._showBanner(text, CONFIG.COLORS.cyan),
        onEnd: (payload) => this._onGameEnd(payload),
      },
      { mode: StorageManager.getMode(), bubbleSpeed: StorageManager.getBubbleSpeed() }
    );

    this._buildHudPlayers();
    this._renderLives(this.currentGame.lives);
    this.currentGame.start();
  },

  _renderLives(lives) {
    const canvas = document.getElementById('hud-lives-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const iconSize = 20;
    const gap = 6;
    for (let i = 0; i < CONFIG.MAX_LIVES; i++) {
      const cx = 12 + i * (iconSize + gap);
      const cy = canvas.height / 2;
      const active = i < lives;
      const color = active ? CONFIG.COLORS.yellow : 'rgba(245,241,232,0.18)';
      if (Assets.ready && active) {
        Assets.draw(ctx, 'yellow', cx, cy, iconSize);
      } else if (Assets.ready && !active) {
        ctx.save();
        ctx.globalAlpha = 0.25;
        Assets.draw(ctx, 'white', cx, cy, iconSize);
        ctx.restore();
      } else {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx, cy, iconSize / 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },

  _buildHudPlayers() {
    const container = document.getElementById('hud-players');
    container.innerHTML = '';
    this.currentGame.players.forEach((p) => {
      const div = document.createElement('div');
      div.className = 'hud-player';
      div.id = `hud-player-${p.index}`;
      div.style.color = p.color;
      div.innerHTML = `<span class="hud-avatar">${p.avatar}</span><span class="hud-name">${p.name}</span>`;
      container.appendChild(div);
    });
  },

  _updateHud(state) {
    document.getElementById('hud-mrr').textContent = `€${state.mrr.toLocaleString()}`;
    const pct = Math.min(100, (state.mrr / CONFIG.TARGET_MRR) * 100);
    document.getElementById('hud-mrr-fill').style.width = `${pct}%`;
    document.getElementById('hud-blockers').textContent = state.blockersRemoved;

    const t = Math.ceil(state.timeRemaining);
    const mm = String(Math.floor(t / 60)).padStart(2, '0');
    const ss = String(t % 60).padStart(2, '0');
    const timerEl = document.getElementById('hud-timer');
    timerEl.textContent = `QUARTER ${mm}:${ss}`;
    timerEl.classList.toggle('urgent', t <= 10);
  },

  _flashPlayerHud(player) {
    const el = document.getElementById(`hud-player-${player.index}`);
    if (!el) return;
    el.classList.add('hud-player-hit');
    setTimeout(() => el.classList.remove('hud-player-hit'), 400);
  },

  _showBanner(text, color) {
    const canvasWrap = document.querySelector('.canvas-wrap');
    let banner = canvasWrap.querySelector('.game-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.className = 'game-banner';
      canvasWrap.appendChild(banner);
    }
    banner.textContent = text;
    banner.style.color = color || CONFIG.COLORS.yellow;
    banner.classList.remove('show');
    // force reflow to restart animation
    void banner.offsetWidth;
    banner.classList.add('show');
  },

  _onGameEnd(payload) {
    const { won, result } = payload;
    setTimeout(() => {
      this._renderScorecard(won, result);
      this.showScreen('scorecard');

      StorageManager.saveSharedHighscore({
        players: result.players.map((p) => ({ name: p.name, avatar: p.avatar })),
        mrr: result.mrr,
        blockersRemoved: result.blockersRemoved,
        timeRemaining: Math.round(result.timeRemaining),
        won,
        date: new Date().toISOString(),
      });
    }, 700);
  },

  _renderScorecard(won, result) {
    const headlines = {
      WON: 'DEAL REACCELERATED — QUARTER WON!',
      LIVES: 'OUT OF LIVES — QUARTER LOST',
      TIME: 'QUARTER CLOSED — TARGET MISSED',
    };
    document.getElementById('scorecard-headline').textContent = headlines[result.reason] || headlines.TIME;
    document.getElementById('scorecard-headline').style.color = won ? CONFIG.COLORS.yellow : CONFIG.COLORS.pink;

    const summary = document.getElementById('scorecard-summary');
    summary.innerHTML = `
      <div class="sc-stat"><span class="sc-label">TOTAL MRR</span><span class="sc-value">€${result.mrr.toLocaleString()}</span></div>
      <div class="sc-stat"><span class="sc-label">BLOCKERS REMOVED</span><span class="sc-value">${result.blockersRemoved}</span></div>
      <div class="sc-stat"><span class="sc-label">DEALS REACCELERATED</span><span class="sc-value">${result.dealsReaccelerated}</span></div>
      <div class="sc-stat"><span class="sc-label">TIME REMAINING</span><span class="sc-value">${Math.round(result.timeRemaining)}s</span></div>
      <div class="sc-stat"><span class="sc-label">LIVES REMAINING</span><span class="sc-value">${result.livesRemaining} / ${CONFIG.MAX_LIVES}</span></div>
    `;

    const playersEl = document.getElementById('scorecard-players');
    playersEl.innerHTML = '';
    result.players.forEach((p) => {
      const div = document.createElement('div');
      div.className = 'sc-player-card';
      div.innerHTML = `
        <div class="sc-player-head"><span class="sc-avatar">${p.avatar}</span><span>${p.name}</span></div>
        <div class="sc-player-row">SHOTS FIRED: ${p.shotsFired}</div>
        <div class="sc-player-row">ACCURACY: ${p.accuracy}%</div>
        <div class="sc-player-row">MRR CONTRIBUTION: €${p.mrrContribution.toLocaleString()}</div>
        <div class="sc-player-row">TIMES HIT: ${p.timesHit}</div>
      `;
      playersEl.appendChild(div);
    });
  },

  _wireScorecard() {
    document.getElementById('btn-play-again').addEventListener('click', () => {
      this.startGame();
    });
    document.getElementById('btn-change-players').addEventListener('click', () => {
      this.playersConfig = StorageManager.getPlayers();
      this.openSetup();
    });
    document.getElementById('btn-sc-highscores').addEventListener('click', () => {
      this.renderHighscores();
      this.showScreen('highscores');
    });
    document.getElementById('btn-sc-home').addEventListener('click', () => {
      this.showScreen('start');
    });
  },

  _wireHighscores() {
    document.getElementById('btn-hs-back').addEventListener('click', () => this.showScreen('start'));
  },

  async renderHighscores() {
    const el = document.getElementById('highscores-list');
    el.innerHTML = '<p class="hs-empty">LOADING...</p>';
    const list = await StorageManager.fetchSharedHighscores();
    if (!list.length) {
      el.innerHTML = '<p class="hs-empty">NO HIGHSCORES YET — PLAY A QUARTER!</p>';
      return;
    }
    el.innerHTML = '';
    list.forEach((entry, i) => {
      const row = document.createElement('div');
      row.className = 'hs-row';

      const rank = document.createElement('span');
      rank.className = 'hs-rank';
      rank.textContent = `#${i + 1}`;

      const names = document.createElement('span');
      names.className = 'hs-names';
      names.textContent = entry.players.map((p) => `${p.avatar} ${p.name}`).join(' & ');

      const mrr = document.createElement('span');
      mrr.className = 'hs-mrr';
      mrr.textContent = `€${entry.mrr.toLocaleString()}`;

      const blockers = document.createElement('span');
      blockers.className = 'hs-detail';
      blockers.textContent = `${entry.blockersRemoved} blockers`;

      const time = document.createElement('span');
      time.className = 'hs-detail';
      time.textContent = `${entry.timeRemaining}s left`;

      row.append(rank, names, mrr, blockers, time);
      el.appendChild(row);
    });
  },
};
