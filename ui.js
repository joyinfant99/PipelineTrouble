// UI — screen management and DOM wiring
const UI = {
  screens: {},
  currentGame: null,
  playersConfig: null,

  init() {
    this.screens = {
      intro: document.getElementById('screen-intro'),
      video: document.getElementById('screen-video'),
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
    this._wireIntro();

    this.showScreen('intro');
  },

  showScreen(name) {
    Object.values(this.screens).forEach((s) => s.classList.remove('active'));
    this.screens[name].classList.add('active');
    this._syncMenuMusic(name);
  },

  // ---------- Menu music ----------
  // One looping track behind every menu. It is ducked while the intro narrator speaks
  // and paused for the video and the round, both of which bring their own audio.
  _syncMenuMusic(screenName) {
    if (!this.menuMusic) return; // nothing to sync until the player has pressed start
    const silentScreen = screenName === 'video' || screenName === 'game';
    if (silentScreen || !AudioManager.enabled) {
      this.menuMusic.pause();
      return;
    }
    this.menuMusic.play().catch(() => {});
    this._fadeMusicTo(CONFIG.INTRO.musicVolume, 600);
  },

  _fadeMusicTo(target, ms) {
    const music = this.menuMusic;
    if (!music) return;
    clearInterval(this._musicFade);
    const stepMs = 40;
    const delta = (target - music.volume) / Math.max(1, ms / stepMs);
    this._musicFade = setInterval(() => {
      const next = music.volume + delta;
      const arrived = delta >= 0 ? next >= target : next <= target;
      music.volume = Math.min(1, Math.max(0, arrived ? target : next));
      if (arrived) clearInterval(this._musicFade);
    }, stepMs);
  },

  // ---------- Attract-mode intro ----------
  // art (press start) -> narration over the art -> main menu, with the intro music
  // carrying on underneath. The intro video plays later, as a briefing on START GAME.
  _wireIntro() {
    this.introStage = 'attract';
    this.introMedia = {};

    const art = document.getElementById('intro-art');
    const begin = () => this._beginIntro();
    art.addEventListener('click', begin);
    art.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        begin();
      }
    });
    this._introKeyHandler = (e) => {
      if (this.introStage === 'attract' && this.screens.intro.classList.contains('active')) {
        e.preventDefault();
        begin();
      }
    };
    window.addEventListener('keydown', this._introKeyHandler);

    document.getElementById('btn-intro-skip').addEventListener('click', () => this._finishIntro());
    document.getElementById('btn-video-skip').addEventListener('click', () => this._endBriefing());

    const video = document.getElementById('intro-video');
    video.addEventListener('ended', () => this._endBriefing());
    video.addEventListener('error', () => this._endBriefing());
  },

  _beginIntro() {
    if (this.introStage !== 'attract') return;
    this.introStage = 'narration';

    // this click is the browser's required gesture — unlock the game's synth audio too
    AudioManager.ensureCtx();
    if (StorageManager.getFullscreen()) this.requestFullscreen();

    document.getElementById('intro-press-glow').hidden = true;
    document.getElementById('btn-intro-skip').hidden = false;

    if (!AudioManager.enabled) {
      this._finishIntro();
      return;
    }

    // starts ducked — the narrator is talking over it; _finishIntro brings it back up
    this.menuMusic = new Audio(encodeURI(CONFIG.INTRO.music));
    this.menuMusic.loop = true;
    this.menuMusic.volume = CONFIG.INTRO.musicVolumeDucked;
    this.menuMusic.play().catch(() => {});

    const narration = new Audio(encodeURI(CONFIG.INTRO.narration));
    narration.addEventListener('ended', () => this._finishIntro());
    narration.addEventListener('error', () => this._finishIntro());
    narration.play().catch(() => this._finishIntro());
    this.narration = narration;
  },

  // narration over — showScreen fades the music back up to full menu level
  _finishIntro() {
    if (this.introStage === 'menu') return;
    this.introStage = 'menu';

    if (this.narration) {
      this.narration.pause();
      this.narration = null;
    }

    window.removeEventListener('keydown', this._introKeyHandler);
    this.showScreen('start');
  },

  // ---------- Mission briefing ----------
  // The intro video plays between START GAME and the first round. PLAY AGAIN skips it,
  // so repeat runs go straight back into the action.
  _playBriefing(onDone) {
    this._briefingDone = onDone;

    const video = document.getElementById('intro-video');
    if (!video.getAttribute('src')) video.src = encodeURI(CONFIG.INTRO.video);
    video.muted = !AudioManager.enabled;
    video.currentTime = 0;
    this.showScreen('video');
    video.play().catch(() => this._endBriefing());
  },

  _endBriefing() {
    const done = this._briefingDone;
    this._briefingDone = null;
    if (!done) return; // stray 'ended' after the player already skipped

    document.getElementById('intro-video').pause();
    done();
  },

  _wireStart() {
    document.getElementById('btn-start-game').addEventListener('click', () => {
      AudioManager.ensureCtx();
      this._playBriefing(() => this.startGame());
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
      if (this.narration && !on) {
        this.narration.pause();
        this.narration = null;
      }
      this._syncMenuMusic('start');
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

    // difficulty toggle
    const difficulty = StorageManager.getDifficulty();
    const difficultyToggle = document.getElementById('difficulty-toggle');
    difficultyToggle.querySelectorAll('.btn-toggle').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.difficulty === difficulty);
      btn.addEventListener('click', () => {
        StorageManager.saveDifficulty(btn.dataset.difficulty);
        difficultyToggle.querySelectorAll('.btn-toggle').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // fullscreen toggle — on by default, requested automatically when a game starts
    const fsBtn = document.getElementById('btn-fullscreen');
    const fsOn = StorageManager.getFullscreen();
    fsBtn.textContent = `FULLSCREEN: ${fsOn ? 'ON' : 'OFF'}`;
    fsBtn.addEventListener('click', () => {
      const on = !StorageManager.getFullscreen();
      StorageManager.saveFullscreen(on);
      fsBtn.textContent = `FULLSCREEN: ${on ? 'ON' : 'OFF'}`;
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
        const char = CONFIG.CHARACTERS[p.character] || CONFIG.CHARACTERS[0];
        return `
        <div class="how-controls-card">
          <strong><img class="how-avatar" src="${encodeURI(char.up)}" alt="" /> ${p.name || `PLAYER ${i + 1}`}</strong>
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
      AudioManager.stopMusic();
      overlay.hidden = true;
      this.exitFullscreen();
      this.showScreen('start');
    });

    window.addEventListener('keydown', (e) => {
      if (this.screens.game.classList.contains('active') && (e.key === 'Escape' || e.key.toLowerCase() === 'p')) {
        doPause();
      }
    });

    document.getElementById('btn-fullscreen-toggle').addEventListener('click', () => {
      if (document.fullscreenElement) this.exitFullscreen();
      else this.requestFullscreen();
    });
  },

  requestFullscreen() {
    const el = document.getElementById('app');
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  },

  exitFullscreen() {
    if (!document.fullscreenElement) return;
    if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
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

      const charGrid = el.querySelector('.character-grid');
      charGrid.innerHTML = '';
      CONFIG.CHARACTERS.forEach((char, charIdx) => {
        const btn = document.createElement('button');
        btn.className = 'character-btn' + (charIdx === cfg.character ? ' selected' : '');
        btn.innerHTML = `
          <img src="${encodeURI(char.up)}" alt="${char.name}" />
          <span style="color:${char.color}">${char.name}</span>
        `;
        btn.addEventListener('click', () => {
          cfg.character = charIdx;
          charGrid.querySelectorAll('.character-btn').forEach((b) => b.classList.remove('selected'));
          btn.classList.add('selected');
        });
        charGrid.appendChild(btn);
      });

      el.querySelectorAll('.remap-btn').forEach((remapBtn) => {
        const action = remapBtn.dataset.action;
        remapBtn.textContent = this._keyLabel(cfg.controls[action]);
        remapBtn.onclick = () => {
          const prevKey = cfg.controls[action];
          remapBtn.textContent = 'PRESS A KEY...';
          InputManager.captureNextKey((key) => {
            if (this._isKeyTaken(key, idx, action)) {
              remapBtn.textContent = 'ALREADY USED';
              setTimeout(() => {
                remapBtn.textContent = this._keyLabel(prevKey);
              }, 1000);
              return;
            }
            cfg.controls[action] = key;
            remapBtn.textContent = this._keyLabel(key);
          });
        };
      });
    });
  },

  // true if `key` is already bound to some other control (any action, either
  // player) besides the one being remapped, keeping both players on disjoint keys
  _isKeyTaken(key, playerIdx, action) {
    return this.playersConfig.some((cfg, idx) =>
      Object.entries(cfg.controls).some(([a, k]) => k === key && !(idx === playerIdx && a === action))
    );
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
        onLivesChanged: (players) => this._renderLives(players),
        onBonusCaptured: (text) => this._showBanner(text, CONFIG.COLORS.cyan),
        onEnd: (payload) => this._onGameEnd(payload),
      },
      {
        mode: StorageManager.getMode(),
        bubbleSpeed: StorageManager.getBubbleSpeed(),
        difficulty: StorageManager.getDifficulty(),
      }
    );

    document.getElementById('hud-mrr-target').textContent = this.currentGame.difficultyPreset.targetScore.toLocaleString();

    this._buildHudPlayers();
    this._renderLives(this.currentGame.players);
    this.currentGame.start();

    if (StorageManager.getFullscreen()) this.requestFullscreen();
    AudioManager.startMusic();
  },

  // lives live inside each player's HUD chip now that the pool is per-player
  _renderLives(players) {
    (players || []).forEach((p) => {
      const row = document.getElementById(`hud-lives-${p.index}`);
      if (!row) return;
      row.innerHTML = '';
      for (let i = 0; i < p.maxLives; i++) {
        const pip = document.createElement('span');
        pip.className = 'hud-life-pip' + (i < p.lives ? ' on' : '');
        row.appendChild(pip);
      }
      const chip = document.getElementById(`hud-player-${p.index}`);
      if (chip) chip.classList.toggle('hud-player-out', p.isOut);
    });
  },

  _buildHudPlayers() {
    const container = document.getElementById('hud-players');
    container.innerHTML = '';
    this.currentGame.players.forEach((p) => {
      const div = document.createElement('div');
      div.className = 'hud-player';
      div.id = `hud-player-${p.index}`;
      div.style.color = p.color;
      const char = CONFIG.CHARACTERS[p.character];

      const img = document.createElement('img');
      img.className = 'hud-avatar';
      img.src = encodeURI(char.up);
      img.alt = '';

      const meta = document.createElement('div');
      meta.className = 'hud-player-meta';
      const name = document.createElement('span');
      name.className = 'hud-name';
      name.textContent = p.name; // player-supplied, so never via innerHTML
      const lives = document.createElement('span');
      lives.className = 'hud-lives';
      lives.id = `hud-lives-${p.index}`;
      meta.append(name, lives);

      div.append(img, meta);
      container.appendChild(div);
    });
  },

  _updateHud(state) {
    document.getElementById('hud-mrr').textContent = state.score.toLocaleString();
    const pct = Math.min(100, (state.score / state.targetScore) * 100);
    document.getElementById('hud-mrr-fill').style.width = `${pct}%`;
    document.getElementById('hud-blockers').textContent = state.blockersRemoved;
    this._renderLives(state.players);

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
        players: result.players.map((p) => ({ name: p.name, character: p.character })),
        score: result.score,
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

    // The breakdown is laid out so it visibly adds up to TOTAL SCORE:
    // every player's contribution, then the team bonuses. Nothing is hidden,
    // which is what the top figure and the cards below disagreeing came down to.
    const signed = (n) => `${n < 0 ? '−' : '+'}${Math.abs(n).toLocaleString()}`;
    const contributionRows = result.players
      .map((p) => `<div class="sc-stat"><span class="sc-label">${this._escape(p.name)}</span><span class="sc-value">${signed(p.contribution)}</span></div>`)
      .join('');
    const bonusRows = [
      result.timeBonus ? `<div class="sc-stat"><span class="sc-label">TIME BONUS</span><span class="sc-value">${signed(result.timeBonus)}</span></div>` : '',
      result.livesBonus ? `<div class="sc-stat"><span class="sc-label">LIVES BONUS</span><span class="sc-value">${signed(result.livesBonus)}</span></div>` : '',
      result.winBonus ? `<div class="sc-stat"><span class="sc-label">WIN BONUS</span><span class="sc-value">${signed(result.winBonus)}</span></div>` : '',
    ].join('');

    const summary = document.getElementById('scorecard-summary');
    summary.innerHTML = `
      <div class="sc-stat sc-stat-total"><span class="sc-label">TOTAL SCORE</span><span class="sc-value">${result.score.toLocaleString()}</span></div>
      ${contributionRows}
      ${bonusRows}
      <div class="sc-stat"><span class="sc-label">BLOCKERS REMOVED</span><span class="sc-value">${result.blockersRemoved}</span></div>
      <div class="sc-stat"><span class="sc-label">DEALS REACCELERATED</span><span class="sc-value">${result.dealsReaccelerated}</span></div>
      <div class="sc-stat"><span class="sc-label">TIME REMAINING</span><span class="sc-value">${Math.round(result.timeRemaining)}s</span></div>
      <div class="sc-stat"><span class="sc-label">DIFFICULTY</span><span class="sc-value">${result.difficulty}</span></div>
    `;

    const playersEl = document.getElementById('scorecard-players');
    playersEl.innerHTML = '';
    result.players.forEach((p) => {
      const div = document.createElement('div');
      div.className = 'sc-player-card';
      const char = CONFIG.CHARACTERS[p.character] || CONFIG.CHARACTERS[0];
      div.innerHTML = `
        <div class="sc-player-head"><img class="sc-avatar" src="${encodeURI(char.up)}" alt="" /><span>${this._escape(p.name)}</span></div>
        <div class="sc-player-row">SHOTS FIRED: ${p.shotsFired}</div>
        <div class="sc-player-row">ACCURACY: ${p.accuracy}%</div>
        <div class="sc-player-row">SCORE CONTRIBUTION: ${signed(p.contribution)}</div>
        <div class="sc-player-row">LIVES LEFT: ${p.livesLeft} / ${result.maxLives}</div>
        <div class="sc-player-row">TIMES HIT: ${p.timesHit}</div>
      `;
      playersEl.appendChild(div);
    });
  },

  // player names are user input and land inside innerHTML templates above
  _escape(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
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

    // TOTAL SCORE already folds in every end-of-round bonus, so the board just
    // ranks by it — the same number the scorecard showed.
    const ranked = [...list].sort((a, b) => b.score - a.score).slice(0, CONFIG.MAX_HIGHSCORES);
    el.innerHTML = '';
    ranked.forEach((entry, i) => {
      const row = document.createElement('div');
      row.className = 'hs-row';

      const rank = document.createElement('span');
      rank.className = 'hs-rank';
      rank.textContent = `#${i + 1}`;

      const names = document.createElement('span');
      names.className = 'hs-names';
      (entry.players || []).forEach((p, idx) => {
        const char = CONFIG.CHARACTERS[p.character];
        if (char) {
          const icon = document.createElement('img');
          icon.className = 'hs-avatar';
          icon.src = encodeURI(char.up);
          icon.alt = '';
          names.appendChild(icon);
        }
        // names come from players, so they go in as text, never as markup
        names.appendChild(document.createTextNode(` ${p.name}${idx < entry.players.length - 1 ? ' & ' : ''}`));
      });

      const score = document.createElement('span');
      score.className = 'hs-mrr';
      score.textContent = Number(entry.score || 0).toLocaleString();

      const blockers = document.createElement('span');
      blockers.className = 'hs-detail';
      blockers.textContent = `${entry.blockersRemoved} blockers`;

      const time = document.createElement('span');
      time.className = 'hs-detail';
      time.textContent = `${entry.timeRemaining}s left`;

      row.append(rank, names, score, blockers, time);
      el.appendChild(row);
    });
  },
};
