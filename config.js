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
  PLAYER_INVULN_MS: 1500, // brief grace window after a hit — player stays fully controllable, just faded

  PROJECTILE_SPEED: 1100, // px/sec upward — a fast, punchy round
  PROJECTILE_COOLDOWN_MS: 220, // minimum gap between shots — one powerful round at a time
  PROJECTILE_W: 8,
  PROJECTILE_H: 16,
  PROJECTILE_TRAIL_LEN: 7, // afterimage segments behind the bullet
  MAX_PROJECTILES_PER_PLAYER: 1, // one shot in flight at a time, classic Bubble Trouble rule

  // Difficulty presets — selected on the start screen. Every difficulty gives each
  // player the same 5 lives; the challenge comes from pace, speed, target and penalty.
  DIFFICULTY_PRESETS: {
    easy: {
      label: 'EASY',
      livesMax: 5,
      spawnIntervalMs: 15000,
      roundDuration: 75,
      blockerSpeedMult: 0.8,
      hitPenalty: 1500,
      targetScore: 75000,
    },
    normal: {
      label: 'NORMAL',
      livesMax: 5,
      spawnIntervalMs: 13000,
      roundDuration: 60,
      blockerSpeedMult: 1,
      hitPenalty: 2500,
      targetScore: 100000,
    },
    pro: {
      label: 'PRO',
      livesMax: 5,
      spawnIntervalMs: 9000,
      roundDuration: 55,
      blockerSpeedMult: 1.4,
      hitPenalty: 4000,
      targetScore: 140000,
    },
  },

  GRAVITY: 620, // px/sec^2 for blocker bounce
  // How far a blocker's lowest point reaches past the player's head line. This has to
  // stay positive: the overlap test is a strict "<", so a blocker that merely grazes the
  // top of the hitbox never registers a hit and the player becomes invincible.
  // Bubbles read high because of the bounce apex below, not because of this line.
  BLOCKER_FLOOR_MARGIN: 30,

  BUBBLE_SPEED_PRESETS: { slow: 0.72, normal: 1, fast: 1.4 },

  // Blocker tiers: size 0 = STALLED DEAL (largest), 1 = mid split, 2 = smallest.
  BLOCKER_TIERS: [
    { radius: 46, speed: 120, mrr: 0, label: 'STALLED DEAL' },
    { radius: 30, speed: 170, mrr: 0, label: 'SPLIT' },
    { radius: 18, speed: 230, mrr: 0, label: 'BLOCKER' },
  ],

  // Every blocker, whatever its size, rebounds until its centre reaches this line —
  // one predictable ceiling to the bounce instead of small ones peaking far lower
  // than big ones. Kept clear of the player sprite (head top is y=468) so there is
  // always a lane to shoot up through, but not so near the top of the field that
  // blockers pick up a punishing amount of speed on the way back down.
  // Fixed-timestep integration lands the apex a few pixels under this figure; what
  // matters is that every size lands on the same line as every other.
  BLOCKER_APEX_Y: 170,

  DEAL_MRR_VALUE: 12500, // points awarded per fully-cleared deal

  MID_LABELS: ['LEGAL', 'PROCUREMENT'],
  SMALL_LABELS: ['SECURITY REVIEW', 'BAD DATA', 'NO CHAMPION', 'GHOSTED'],

  SPAWN_INTERVAL_MS: 13000, // new deal spawns if under max concurrent deals
  MAX_CONCURRENT_DEALS: 2,

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

  // Lives — each player carries their own pool; the round ends when everyone is out
  STARTING_LIVES: 5,
  MAX_LIVES: 5,

  // Everything the players do carries a weight, so a round spent only popping
  // blockers still puts points on the board. Player-attributed weights are credited
  // to whoever earned them, which is what makes TOTAL SCORE reconcile exactly with
  // the per-player contributions shown underneath it on the scorecard.
  SCORE_WEIGHTS: {
    blockerByTier: [150, 250, 400], // smaller blockers are harder to hit, so worth more
    dealCleared: 12500, // popping the last piece of a deal
    cashBonus: 4000, // '+MRR' pickup
    lifeBonusAtMax: 5000, // 'BONUS' pickup when already at full lives
    // team-level, awarded at the close and shown as their own scorecard rows
    timePerSec: 200, // win only — per second left on the clock
    perLifeLeft: 3000, // per life still held across all players
    win: 10000, // flat bonus for hitting the target
  },

  // Bonus bubbles — periodic pickups. Every kind either scores directly or helps
  // you score more (extra life to stay in, rapid fire / shield to clear deals faster).
  BONUS_BUBBLE_MIN_MS: 7000,
  BONUS_BUBBLE_MAX_MS: 13000,
  BONUS_BUBBLE_RADIUS: 24,
  BONUS_BUBBLE_LIFETIME_MS: 6500,
  BONUS_BUBBLE_SPEED: 150,
  RAPID_FIRE_DURATION_MS: 8000,
  SHIELD_DURATION_MS: 6000,

  BONUS_KINDS: [
    { key: 'life', label: 'BONUS', color: 'white', weight: 3 },
    { key: 'cash', label: '+POINTS', color: 'yellow', weight: 4 },
    { key: 'rapid', label: 'RAPID FIRE', color: 'orange', weight: 3 },
    { key: 'shield', label: 'SHIELD', color: 'green', weight: 3 },
  ],

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
    players: 'pt_players_v2', // v2: arrows/WASD defaults, character instead of emoji avatar
    sound: 'pt_sound_v1',
    highscores: 'pt_highscores_v2', // v2: weighted score replaced raw MRR, old entries aren't comparable
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

