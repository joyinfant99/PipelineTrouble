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

  _supabase: null,

  getSupabaseClient() {
    if (StorageManager._supabase) return StorageManager._supabase;
    if (typeof supabase === 'undefined' || !CONFIG.SUPABASE_URL) return null;
    StorageManager._supabase = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    return StorageManager._supabase;
  },

  getHighscores() {
    return StorageManager.get(CONFIG.STORAGE_KEYS.highscores, []);
  },

  saveHighscore(entry) {
    const list = StorageManager.getHighscores();
    list.push(entry);
    list.sort((a, b) => b.score - a.score);
    const trimmed = list.slice(0, CONFIG.MAX_HIGHSCORES);
    StorageManager.set(CONFIG.STORAGE_KEYS.highscores, trimmed);
    return trimmed;
  },

  // Shared scoreboard, backed by Supabase, falling back to the local list above
  // (offline, or Supabase not configured) so the game always works. TOTAL SCORE
  // already folds in every end-of-round bonus, so ranking by it server-side
  // matches the leaderboard shown in the UI.
  async fetchSharedHighscores() {
    const client = StorageManager.getSupabaseClient();
    if (!client) return StorageManager.getHighscores();
    const { data, error } = await client
      .from('highscores')
      .select('players, mrr, blockers_removed, time_remaining, won, created_at')
      .order('mrr', { ascending: false })
      .limit(CONFIG.MAX_HIGHSCORES);
    if (error) {
      console.warn('Supabase fetchSharedHighscores failed, using local list', error);
      return StorageManager.getHighscores();
    }
    // the shared table's `mrr` column is the score total under its original name
    return data.map((row) => ({
      players: row.players,
      score: row.mrr,
      blockersRemoved: row.blockers_removed,
      timeRemaining: row.time_remaining,
      won: row.won,
      date: row.created_at,
    }));
  },

  async saveSharedHighscore(entry) {
    // keep the local copy as an instant fallback regardless of network state
    StorageManager.saveHighscore(entry);
    const client = StorageManager.getSupabaseClient();
    if (!client) return;
    const { error } = await client.from('highscores').insert({
      players: entry.players,
      mrr: entry.score,
      blockers_removed: entry.blockersRemoved,
      time_remaining: entry.timeRemaining,
      won: entry.won,
    });
    if (error) {
      console.warn('Supabase saveSharedHighscore failed', error);
    }
  },
};
