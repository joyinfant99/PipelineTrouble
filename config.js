// PIPELINE TROUBLE — central config
const CONFIG = {
  CANVAS_W: 960,
  CANVAS_H: 600,

  ROUND_DURATION: 60, // seconds
  TARGET_MRR: 100000, // euros

  PLAYER_SPEED: 320, // px/sec
  // Hitbox is deliberately smaller than the drawn sprite — the head and the raised
  // gun can graze a blocker without costing a life, which is how arcade shooters feel fair.
  PLAYER_W: 34,
  PLAYER_H: 66,
  PLAYER_SPRITE_H: 108, // drawn sprite height on canvas
  PLAYER_HIT_PENALTY: 2500, // euros pipeline lost
  PLAYER_RESPAWN_MS: 1500,
  PLAYER_INVULN_MS: 1500, // matches respawn, flashes during this

  PROJECTILE_SPEED: 1100, // px/sec upward — a fast, punchy round
  PROJECTILE_COOLDOWN_MS: 220, // minimum gap between shots — one powerful round at a time
  PROJECTILE_W: 8,
  PROJECTILE_H: 16,
  PROJECTILE_TRAIL_LEN: 7, // afterimage segments behind the bullet
  MAX_PROJECTILES_PER_PLAYER: 1, // one shot in flight at a time, classic Bubble Trouble rule

  // Difficulty presets — selected on the start screen, drives lives/pace/stakes
  DIFFICULTY_PRESETS: {
    easy: {
      label: 'EASY',
      livesMax: 4,
      spawnIntervalMs: 8500,
      roundDuration: 75,
      blockerSpeedMult: 0.8,
      hitPenalty: 1500,
      targetMrr: 75000,
    },
    normal: {
      label: 'NORMAL',
      livesMax: 3,
      spawnIntervalMs: 7000,
      roundDuration: 60,
      blockerSpeedMult: 1,
      hitPenalty: 2500,
      targetMrr: 100000,
    },
    pro: {
      label: 'PRO',
      livesMax: 2,
      spawnIntervalMs: 4800,
      roundDuration: 55,
      blockerSpeedMult: 1.4,
      hitPenalty: 4000,
      targetMrr: 140000,
    },
  },

  GRAVITY: 620, // px/sec^2 for blocker bounce
  BLOCKER_FLOOR_MARGIN: 20, // px the lowest point of a blocker may dip below the player's head line

  BUBBLE_SPEED_PRESETS: { slow: 0.72, normal: 1, fast: 1.4 },

  // Blocker tiers: size 0 = STALLED DEAL (largest), 1 = mid split, 2 = smallest
  BLOCKER_TIERS: [
    { radius: 46, speed: 120, mrr: 0, label: 'STALLED DEAL' },
    { radius: 30, speed: 170, mrr: 0, label: 'SPLIT' },
    { radius: 18, speed: 230, mrr: 0, label: 'BLOCKER' },
  ],

  DEAL_MRR_VALUE: 12500, // MRR awarded per fully-cleared deal

  MID_LABELS: ['LEGAL', 'PROCUREMENT'],
  SMALL_LABELS: ['SECURITY REVIEW', 'BAD DATA', 'NO CHAMPION', 'GHOSTED'],

  SPAWN_INTERVAL_MS: 7000, // new deal spawns if under max concurrent deals
  MAX_CONCURRENT_DEALS: 3,

  // Playable characters. Each has a walking pose ("straight") and a shooting pose ("up").
  // Filenames are referenced exactly as they sit on disk (casing and spaces included) —
  // Vercel serves from a case-sensitive filesystem, so they must not be "tidied" here.
  CHARACTERS: [
    {
      id: 'closer',
      name: 'CLOSER',
      color: '#F5F1E8',
      straight: 'assets/Players/Player1 Straight.png',
      up: 'assets/Players/Player1Up.png',
    },
    {
      id: 'hunter',
      name: 'HUNTER',
      color: '#FF3B9D',
      straight: 'assets/Players/Player2Straight.png',
      up: 'assets/Players/Player2Up.png',
    },
    {
      id: 'champion',
      name: 'CHAMPION',
      color: '#FFD23F',
      straight: 'assets/Players/Player3Straight.png',
      up: 'assets/Players/Player3Up.png',
    },
    {
      id: 'operator',
      name: 'OPERATOR',
      color: '#8B6DFF',
      straight: 'assets/Players/Player4straight.png',
      up: 'assets/Players/Player4Up.png',
    },
  ],

  // Where the character's body sits inside each frame, as a fraction of image width.
  // The two poses are framed differently (the walking pose's rifle juts out to the right),
  // so anchoring on the body instead of the frame stops the sprite hopping sideways
  // when it switches pose.
  SPRITE_BODY_CENTER: { straight: 0.37, up: 0.5 },
  // Muzzle position in the "up" pose: offset from body center (in image widths) and
  // height above the feet (as a fraction of drawn sprite height).
  MUZZLE_X_RATIO: 0.27,
  MUZZLE_Y_RATIO: 0.95,

  BACKGROUND_SRC: 'assets/images/Background.png',

  // Attract-mode intro: title art -> narration over the art -> intro video -> menu.
  // Browsers block audio until the player interacts, so the art doubles as a
  // "PRESS START" gate whose click unlocks every sound in the game.
  INTRO: {
    image: 'assets/images/Introductionimage.png',
    narration: 'assets/audio/intro-narration.mp3',
    music: 'assets/audio/intro-music.mp3',
    video: 'assets/video/intro.mp4',
    musicVolume: 0.45, // level on the menus
    musicVolumeDucked: 0.12, // pulled right down while the narrator is speaking
  },

  // Lives — shared team pool
  STARTING_LIVES: 3,
  MAX_LIVES: 3,

  // Bonus bubble — Personio-logo bubble, captures for +1 life or bonus MRR at max lives
  BONUS_BUBBLE_MIN_MS: 9000,
  BONUS_BUBBLE_MAX_MS: 16000,
  BONUS_BUBBLE_RADIUS: 24,
  BONUS_BUBBLE_LIFETIME_MS: 6500,
  BONUS_BUBBLE_SPEED: 150,
  BONUS_MRR_AT_MAX_LIVES: 5000,

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
  },

  DEFAULT_CONTROLS: [
    { left: 'a', right: 'd', shoot: ' ', shootAlt: 'w' },
    { left: 'arrowleft', right: 'arrowright', shoot: 'enter', shootAlt: 'arrowup' },
  ],

  STORAGE_KEYS: {
    players: 'pt_players_v1',
    sound: 'pt_sound_v1',
    highscores: 'pt_highscores_v1',
    mode: 'pt_mode_v2', // v2: default flipped to single player
    bubbleSpeed: 'pt_bubble_speed_v1',
    difficulty: 'pt_difficulty_v1',
    fullscreen: 'pt_fullscreen_v1',
  },

  MAX_HIGHSCORES: 10,
};

// derived: lowest point a blocker's center may reach so it never sinks into the player's body —
// it can only graze the top of a player's head, keeping it reachable from below at all times.
CONFIG.PLAYER_TOP_Y = CONFIG.CANVAS_H - 24 - CONFIG.PLAYER_H;
CONFIG.BLOCKER_FLOOR_Y = CONFIG.PLAYER_TOP_Y + CONFIG.BLOCKER_FLOOR_MARGIN;

