// StorageManager — wraps localStorage with safe fallbacks
const StorageManager = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  },

  getPlayers() {
    const players = StorageManager.get(CONFIG.STORAGE_KEYS.players, [
      { name: 'PLAYER 1', character: 0, controls: { ...CONFIG.DEFAULT_CONTROLS[0] } },
      { name: 'PLAYER 2', character: 1, controls: { ...CONFIG.DEFAULT_CONTROLS[1] } },
    ]);
    // profiles saved before characters existed have no character picked yet
    players.forEach((p, i) => {
      if (typeof p.character !== 'number') p.character = i % CONFIG.CHARACTERS.length;
    });
    return players;
  },

  savePlayers(players) {
    StorageManager.set(CONFIG.STORAGE_KEYS.players, players);
  },

  getSound() {
    return StorageManager.get(CONFIG.STORAGE_KEYS.sound, true);
  },

  saveSound(enabled) {
    StorageManager.set(CONFIG.STORAGE_KEYS.sound, enabled);
  },

  getMode() {
    return StorageManager.get(CONFIG.STORAGE_KEYS.mode, 'single');
  },

  saveMode(mode) {
    StorageManager.set(CONFIG.STORAGE_KEYS.mode, mode);
  },

  getBubbleSpeed() {
    return StorageManager.get(CONFIG.STORAGE_KEYS.bubbleSpeed, 'normal');
  },

  saveBubbleSpeed(speed) {
    StorageManager.set(CONFIG.STORAGE_KEYS.bubbleSpeed, speed);
  },

  getDifficulty() {
    return StorageManager.get(CONFIG.STORAGE_KEYS.difficulty, 'normal');
  },

  saveDifficulty(difficulty) {
    StorageManager.set(CONFIG.STORAGE_KEYS.difficulty, difficulty);
  },

  getFullscreen() {
    return StorageManager.get(CONFIG.STORAGE_KEYS.fullscreen, true);
  },

  saveFullscreen(enabled) {
    StorageManager.set(CONFIG.STORAGE_KEYS.fullscreen, enabled);
  },

  getHighscores() {
    return StorageManager.get(CONFIG.STORAGE_KEYS.highscores, []);
  },

  saveHighscore(entry) {
    const list = StorageManager.getHighscores();
    list.push(entry);
    list.sort((a, b) => b.mrr - a.mrr);
    const trimmed = list.slice(0, CONFIG.MAX_HIGHSCORES);
    StorageManager.set(CONFIG.STORAGE_KEYS.highscores, trimmed);
    return trimmed;
  },
};
