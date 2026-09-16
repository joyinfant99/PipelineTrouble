// PIPELINE TROUBLE — central config
const CONFIG = {
  CANVAS_W: 960,
  CANVAS_H: 600,

  ROUND_DURATION: 60, // seconds
  TARGET_MRR: 100000, // euros

  PLAYER_SPEED: 320, // px/sec
  PLAYER_W: 36,
  PLAYER_H: 40,
  PLAYER_HIT_PENALTY: 2500, // euros pipeline lost
  PLAYER_INVULN_MS: 1500, // brief grace window after a hit — player stays fully controllable, just faded

  PROJECTILE_SPEED: 1250, // px/sec upward — a fast harpoon, like the real thing
  PROJECTILE_COOLDOWN_MS: 120, // minimum gap once the harpoon retracts/lands
  PROJECTILE_W: 4,
  PROJECTILE_H: 14,
  MAX_PROJECTILES_PER_PLAYER: 1, // one harpoon in flight at a time, classic Bubble Trouble rule

  GRAVITY: 620, // px/sec^2 for blocker bounce
  BLOCKER_FLOOR_MARGIN: 20, // px the lowest point of a blocker may dip below the player's head line

  BUBBLE_SPEED_PRESETS: { slow: 0.72, normal: 1, fast: 1.4 },

  // Blocker tiers: size 0 = STALLED DEAL (largest), 1 = mid split, 2 = smallest.
  // bounceHeight — like the original: each size always bounces back up to the
  // same apex height (bigger bubbles bounce higher, smaller ones stay lower).
  BLOCKER_TIERS: [
    { radius: 46, speed: 120, mrr: 0, label: 'STALLED DEAL', bounceHeight: 440 },
    { radius: 30, speed: 170, mrr: 0, label: 'SPLIT', bounceHeight: 300 },
    { radius: 18, speed: 230, mrr: 0, label: 'BLOCKER', bounceHeight: 170 },
  ],

  DEAL_MRR_VALUE: 12500, // MRR awarded per fully-cleared deal

  MID_LABELS: ['LEGAL', 'PROCUREMENT'],
  SMALL_LABELS: ['SECURITY REVIEW', 'BAD DATA', 'NO CHAMPION', 'GHOSTED'],

  SPAWN_INTERVAL_MS: 13000, // new deal spawns if under max concurrent deals
  MAX_CONCURRENT_DEALS: 2,

  AVATARS: ['🚀', '📈', '💼', '🎯', '⚡', '🛡️'],

  // Lives — shared team pool
  STARTING_LIVES: 3,
  MAX_LIVES: 3,

  // Bonus bubbles — white/logo bubbles that spawn periodically. Every kind
  // either grants MRR directly, or helps you earn more of it (extra life to
  // stay in the round, rapid fire / shield to clear deals faster and safer).
  BONUS_BUBBLE_MIN_MS: 7000,
  BONUS_BUBBLE_MAX_MS: 13000,
  BONUS_BUBBLE_RADIUS: 24,
  BONUS_BUBBLE_LIFETIME_MS: 6500,
  BONUS_BUBBLE_SPEED: 150,
  BONUS_MRR_AT_MAX_LIVES: 5000, // 'life' kind converts to this MRR once lives are already full
  CASH_BONUS_MRR: 4000, // 'cash' kind — flat MRR, always
  RAPID_FIRE_DURATION_MS: 8000,
  SHIELD_DURATION_MS: 6000,

  BONUS_KINDS: [
    { key: 'life', label: 'BONUS', color: 'white', weight: 3 },
    { key: 'cash', label: '+MRR', color: 'yellow', weight: 4 },
    { key: 'rapid', label: 'RAPID FIRE', color: 'orange', weight: 3 },
    { key: 'shield', label: 'SHIELD', color: 'green', weight: 3 },
  ],

  // End-of-round performance bonuses — folded straight into TOTAL MRR so MRR
  // stays the single source-of-truth metric everywhere (HUD, scorecard,
  // highscores) instead of a separate "score".
  TIME_BONUS_PER_SEC: 200, // rewarded only on a WIN — MRR per second left on the clock
  LIVES_BONUS_PER_LIFE: 3000, // rewarded for each life still in the pool at the end
  WIN_BONUS_MRR: 10000, // flat bonus for hitting the target before time/lives ran out

  // Particle burst on blocker destruction
  PARTICLE_COUNT: 16,
  PARTICLE_SPEED_MIN: 80,
  PARTICLE_SPEED_MAX: 260,
  PARTICLE_LIFE_MS: 550,
  PARTICLE_GRAVITY: 500,

  LOGO_SRC: 'assets/images/personio-logo.png',

  COLORS: {
    bg: '#120A2A',
    cyan: '#20D6D2',
    yellow: '#FFD23F',
    pink: '#FF3B9D',
    white: '#F5F1E8',
    orange: '#FF8C42',
    green: '#3DDC84',
  },

  DEFAULT_CONTROLS: [
    { left: 'arrowleft', right: 'arrowright', shoot: 'arrowup' },
    { left: 'a', right: 'd', shoot: 'w' },
  ],

  SUPABASE_URL: 'https://fllujguqlnwwrgcbkoej.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_wwBAgok47zqVmuc7igveeQ_s9jO90HA',

  STORAGE_KEYS: {
    players: 'pt_players_v1',
    sound: 'pt_sound_v1',
    highscores: 'pt_highscores_v1',
    mode: 'pt_mode_v1',
    bubbleSpeed: 'pt_bubble_speed_v1',
  },

  MAX_HIGHSCORES: 10,
};

// derived: lowest point a blocker's center may reach so it never sinks into the player's body —
// it can only graze the top of a player's head, keeping it reachable from below at all times.
CONFIG.PLAYER_TOP_Y = CONFIG.CANVAS_H - 24 - CONFIG.PLAYER_H;
CONFIG.BLOCKER_FLOOR_Y = CONFIG.PLAYER_TOP_Y + CONFIG.BLOCKER_FLOOR_MARGIN;

