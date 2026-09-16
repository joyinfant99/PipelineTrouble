// Entities: Player, Projectile, Blocker, Particle, BonusBubble

function drawRoundedRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

class Player {
  constructor(index, name, controls, x, groundY, character) {
    this.index = index;
    this.name = name || `PLAYER ${index + 1}`;
    this.character = typeof character === 'number' ? character : index % CONFIG.CHARACTERS.length;
    this.controls = controls;
    this.w = CONFIG.PLAYER_W;
    this.h = CONFIG.PLAYER_H;
    this.x = x;
    this.y = groundY - this.h;
    this.groundY = groundY;
    this.facing = 1; // sprites are drawn facing right
    this.color = index === 0 ? CONFIG.COLORS.cyan : CONFIG.COLORS.pink;

    this.alive = true;
    this.invulnUntil = 0;
    this.lastShotAt = -9999;
    this.recoilUntil = 0;
    this.walkPhase = 0;
    this.moving = false;
    this.rapidFireUntil = 0;
    this.shieldUntil = 0;

    // each player carries their own pool — the round only ends once everyone is out
    this.lives = CONFIG.STARTING_LIVES;
    this.maxLives = CONFIG.MAX_LIVES;

    // stats
    this.shotsFired = 0;
    this.blockersHit = 0;
    this.contribution = 0;
    this.timesHit = 0;
  }

  get isInvuln() {
    return performance.now() < this.invulnUntil;
  }

  get isRapidFiring() {
    return performance.now() < this.rapidFireUntil;
  }

  get isShielded() {
    return performance.now() < this.shieldUntil;
  }

  get isOut() {
    return this.lives <= 0;
  }

  update(dt, inputState, spawnProjectileFn) {
    if (this.isOut) return;

    let vx = 0;
    if (inputState.left) vx -= CONFIG.PLAYER_SPEED;
    if (inputState.right) vx += CONFIG.PLAYER_SPEED;
    this.x += vx * dt;
    this.x = Math.max(0, Math.min(CONFIG.CANVAS_W - this.w, this.x));

    this.moving = vx !== 0;
    if (vx !== 0) this.facing = vx > 0 ? 1 : -1;
    if (this.moving) this.walkPhase += dt * 12;

    this.shootHeld = !!inputState.shoot;
    if (inputState.shoot) {
      const now = performance.now();
      const cooldown = this.isRapidFiring ? CONFIG.PROJECTILE_COOLDOWN_MS / 2 : CONFIG.PROJECTILE_COOLDOWN_MS;
      if (now - this.lastShotAt >= cooldown) {
        this.lastShotAt = now;
        this.recoilUntil = now + 180;
        spawnProjectileFn(this);
        this.shotsFired++;
      }
    }
  }

  // "up" while shooting (and briefly after, for the recoil), "straight" while walking
  get pose() {
    return this.shootHeld || performance.now() < this.recoilUntil ? 'up' : 'straight';
  }

  // Bullets leave the rifle barrel, which sits off to the character's leading side
  // and near the top of the sprite in the shooting pose.
  get muzzleX() {
    const cx = this.x + this.w / 2;
    const spriteW = Assets.characterWidth(this.character, 'up', CONFIG.PLAYER_SPRITE_H);
    return cx + this.facing * spriteW * CONFIG.MUZZLE_X_RATIO;
  }

  get muzzleY() {
    return this.groundY - CONFIG.PLAYER_SPRITE_H * CONFIG.MUZZLE_Y_RATIO;
  }

  hitByBlocker() {
    if (this.isInvuln || this.isShielded || this.isOut) return false;
    this.invulnUntil = performance.now() + CONFIG.PLAYER_INVULN_MS;
    this.lives = Math.max(0, this.lives - 1);
    this.timesHit++;
    return true;
  }

  draw(ctx) {
    const now = performance.now();
    if (this.isOut) return; // knocked out of the round, nothing left to draw

    ctx.save();
    // faded rather than blinking while briefly invulnerable — the player keeps
    // moving and shooting throughout, there is no lockout
    if (this.isInvuln) ctx.globalAlpha = 0.4;

    const cx = this.x + this.w / 2;
    const pose = this.pose;
    // single walking frame, so a small bob sells the stride
    const bob = this.moving ? Math.abs(Math.sin(this.walkPhase)) * 2.5 : 0;
    const feetY = this.groundY - bob;
    const spriteH = CONFIG.PLAYER_SPRITE_H;

    if (this.isShielded) {
      ctx.save();
      ctx.strokeStyle = CONFIG.COLORS.green;
      ctx.lineWidth = 2.5;
      ctx.globalAlpha = 0.7 + 0.25 * Math.sin(now / 90);
      ctx.beginPath();
      ctx.ellipse(cx, feetY - spriteH * 0.45, spriteH * 0.34, spriteH * 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    const drew = Assets.drawCharacter(ctx, this.character, pose, cx, feetY, spriteH, this.facing < 0);
    if (!drew) this._drawFallbackBody(ctx, cx);

    // recoil flash at the barrel right after firing — orange while rapid fire is up
    if (now < this.recoilUntil) {
      ctx.globalAlpha = (this.recoilUntil - now) / 180;
      ctx.fillStyle = this.isRapidFiring ? CONFIG.COLORS.orange : CONFIG.COLORS.yellow;
      ctx.beginPath();
      ctx.arc(this.muzzleX, this.muzzleY, this.isRapidFiring ? 7 : 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    // name tag above the sprite, never on top of it
    ctx.save();
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = this.color;
    ctx.fillText(this.name.toUpperCase(), cx, this.groundY - spriteH - 8);
    ctx.restore();
  }

  // Used only until the sprite images finish loading (or if they fail to load)
  _drawFallbackBody(ctx, cx) {
    ctx.fillStyle = this.color;
    ctx.fillRect(cx - this.w * 0.38, this.y + this.h * 0.28, this.w * 0.76, this.h * 0.72);
    ctx.beginPath();
    ctx.arc(cx, this.y + this.h * 0.16, this.w * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Contra-style plasma round — a single chunky bullet punches straight up the screen
// leaving a fading afterimage trail behind it, instead of a static rope/line.
class Projectile {
  constructor(x, y, ownerIndex) {
    this.x = x;
    this.y = y; // leading (top) edge of the bullet, moves upward each frame
    this.w = CONFIG.PROJECTILE_W;
    this.h = CONFIG.PROJECTILE_H;
    this.ownerIndex = ownerIndex;
    this.alive = true;
    this.color = ownerIndex === 0 ? CONFIG.COLORS.cyan : CONFIG.COLORS.pink;
    this.trail = []; // recent y-positions for the afterimage streak
  }

  update(dt) {
    this.trail.unshift(this.y);
    if (this.trail.length > CONFIG.PROJECTILE_TRAIL_LEN) this.trail.pop();
    this.y -= CONFIG.PROJECTILE_SPEED * dt;
    if (this.y <= 0) {
      this.y = 0;
      this.alive = false; // reached the very top of the field
    }
  }

  draw(ctx) {
    const cx = this.x + this.w / 2;
    ctx.save();

    // afterimage trail — fading, narrowing chunks behind the bullet, not a solid line
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const t = (i + 1) / (this.trail.length + 1);
      ctx.globalAlpha = 0.35 * (1 - t);
      ctx.fillStyle = this.color;
      const segW = this.w * (1 - t * 0.5);
      ctx.fillRect(cx - segW / 2, this.trail[i], segW, this.h * 0.6);
    }
    ctx.globalAlpha = 1;

    // outer glow
    ctx.fillStyle = this.color;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(cx, this.y + this.h * 0.4, this.w * 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // the bullet body — a chunky pixel-block capsule, not a thin line
    ctx.fillStyle = this.color;
    drawRoundedRect(ctx, this.x, this.y, this.w, this.h, 2);
    ctx.fill();

    // bright hot core
    ctx.fillStyle = CONFIG.COLORS.white;
    drawRoundedRect(ctx, this.x + this.w * 0.2, this.y + this.h * 0.1, this.w * 0.6, this.h * 0.55, 2);
    ctx.fill();

    ctx.restore();
  }

  get bounds() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }
}

let _blockerIdCounter = 1;

const BLOCKER_FALLBACK_ICON = (ctx, x, y, r, color) => {
  // simple vector "warning" glyph used before the logo asset finishes loading
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, r * 0.14);
  ctx.beginPath();
  ctx.moveTo(x, y - r * 0.5);
  ctx.lineTo(x, y + r * 0.12);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y + r * 0.38, Math.max(1.5, r * 0.08), 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
};

class Blocker {
  constructor(tier, x, y, vx, label, dealId, speedMultiplier) {
    this.id = _blockerIdCounter++;
    this.tier = tier; // 0,1,2
    this.dealId = dealId; // groups blockers belonging to the same original deal
    const tierCfg = CONFIG.BLOCKER_TIERS[tier];
    this.radius = tierCfg.radius;
    this.speed = tierCfg.speed;
    this.label = label;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = 0;
    this.speedMultiplier = speedMultiplier || 1;
    // Rise needed to lift this ball's centre from its floor contact point up to the
    // shared apex line. Deliberately not scaled by speedMultiplier: the round speed
    // changes how fast blockers travel sideways, never how high they bounce, so the
    // apex stays the same on every speed and difficulty setting.
    const floorCentreY = CONFIG.BLOCKER_FLOOR_Y - this.radius;
    const rise = Math.max(0, floorCentreY - CONFIG.BLOCKER_APEX_Y);
    this.bounceVy = -Math.sqrt(2 * CONFIG.GRAVITY * rise);
    this.alive = true;
    this.color = tier === 0 ? CONFIG.COLORS.pink : tier === 1 ? CONFIG.COLORS.yellow : CONFIG.COLORS.cyan;
  }

  update(dt) {
    this.vy += CONFIG.GRAVITY * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // wall bounce
    if (this.x - this.radius < 0) {
      this.x = this.radius;
      this.vx *= -1;
    } else if (this.x + this.radius > CONFIG.CANVAS_W) {
      this.x = CONFIG.CANVAS_W - this.radius;
      this.vx *= -1;
    }

    // floor bounce — capped well above the player row so the shooter can always see
    // and hit it; it only ever grazes the top of a player's head, never sinks into them.
    const floorY = CONFIG.BLOCKER_FLOOR_Y - this.radius;
    if (this.y > floorY) {
      this.y = floorY;
      this.vy = this.bounceVy;
    }

    // ceiling bounce
    if (this.y - this.radius < 0) {
      this.y = this.radius;
      this.vy = Math.abs(this.vy);
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = CONFIG.COLORS.bg;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * 0.72, 0, Math.PI * 2);
    ctx.fill();

    // logo stays upright — it reads as the brand mark, not a spinning game token
    if (Assets.ready) {
      const key = this.tier === 0 ? 'pink' : this.tier === 1 ? 'yellow' : 'cyan';
      Assets.draw(ctx, key, this.x, this.y, this.radius * 1.15);
    } else {
      BLOCKER_FALLBACK_ICON(ctx, this.x, this.y, this.radius, this.color);
    }

    ctx.restore();
  }

  get bounds() {
    return { x: this.x - this.radius, y: this.y - this.radius, w: this.radius * 2, h: this.radius * 2 };
  }
}

class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    const angle = Math.random() * Math.PI * 2;
    const speed = CONFIG.PARTICLE_SPEED_MIN + Math.random() * (CONFIG.PARTICLE_SPEED_MAX - CONFIG.PARTICLE_SPEED_MIN);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed - 60;
    this.color = color;
    this.size = 2 + Math.random() * 3;
    this.life = CONFIG.PARTICLE_LIFE_MS;
    this.maxLife = this.life;
    this.alive = true;
  }

  update(dt) {
    this.life -= dt * 1000;
    if (this.life <= 0) {
      this.alive = false;
      return;
    }
    this.vy += CONFIG.PARTICLE_GRAVITY * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  draw(ctx) {
    const alpha = Math.max(0, this.life / this.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
    ctx.restore();
  }
}

function spawnBurst(list, x, y, color, count) {
  const n = count || CONFIG.PARTICLE_COUNT;
  for (let i = 0; i < n; i++) list.push(new Particle(x, y, color));
  // a quick expanding ring for extra "realistic blast" punch
  list.push(new ShockRing(x, y, color));
}

class ShockRing {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.radius = 4;
    this.life = 260;
    this.maxLife = this.life;
    this.alive = true;
  }
  update(dt) {
    this.life -= dt * 1000;
    this.radius += dt * 260;
    if (this.life <= 0) this.alive = false;
  }
  draw(ctx) {
    const alpha = Math.max(0, this.life / this.maxLife) * 0.8;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

const BONUS_KIND_GLYPHS = { cash: '€', rapid: '⚡', shield: '🛡' };

class BonusBubble {
  constructor(x, y, vx, speedMultiplier, kind) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.speedMultiplier = speedMultiplier || 1;
    this.vy = -200 * this.speedMultiplier;
    this.radius = CONFIG.BONUS_BUBBLE_RADIUS;
    this.kind = kind || CONFIG.BONUS_KINDS[0];
    this.label = this.kind.label;
    this.color = CONFIG.COLORS[this.kind.color];
    this.alive = true;
    this.life = CONFIG.BONUS_BUBBLE_LIFETIME_MS;
  }

  update(dt) {
    this.life -= dt * 1000;
    if (this.life <= 0) {
      this.alive = false;
      return;
    }
    this.vy += CONFIG.GRAVITY * 0.6 * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (this.x - this.radius < 0) {
      this.x = this.radius;
      this.vx *= -1;
    } else if (this.x + this.radius > CONFIG.CANVAS_W) {
      this.x = CONFIG.CANVAS_W - this.radius;
      this.vx *= -1;
    }
    const floorY = CONFIG.BLOCKER_FLOOR_Y - this.radius;
    if (this.y > floorY) {
      this.y = floorY;
      this.vy = -Math.abs(this.vy) * 0.9;
    }
    if (this.y - this.radius < 0) {
      this.y = this.radius;
      this.vy = Math.abs(this.vy);
    }
  }

  draw(ctx) {
    const pulse = 1 + Math.sin(performance.now() / 140) * 0.08;
    const flicker = this.life < 1500 && Math.floor(this.life / 120) % 2 === 0;
    if (flicker) return;
    ctx.save();
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = CONFIG.COLORS.bg;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * pulse * 0.72, 0, Math.PI * 2);
    ctx.fill();

    const glyph = BONUS_KIND_GLYPHS[this.kind.key];
    if (glyph) {
      ctx.fillStyle = this.color;
      ctx.font = `bold ${Math.round(this.radius * 1.15)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(glyph, this.x, this.y + 1);
    } else if (Assets.ready) {
      Assets.draw(ctx, this.kind.color, this.x, this.y, this.radius * 1.2 * pulse);
    } else {
      BLOCKER_FALLBACK_ICON(ctx, this.x, this.y, this.radius, this.color);
    }
    ctx.restore();
  }

  get bounds() {
    return { x: this.x - this.radius, y: this.y - this.radius, w: this.radius * 2, h: this.radius * 2 };
  }
}
