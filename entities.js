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
  constructor(index, name, avatar, controls, x, groundY) {
    this.index = index;
    this.name = name || `PLAYER ${index + 1}`;
    this.avatar = avatar || CONFIG.AVATARS[index % CONFIG.AVATARS.length];
    this.controls = controls;
    this.w = CONFIG.PLAYER_W;
    this.h = CONFIG.PLAYER_H;
    this.x = x;
    this.y = groundY - this.h;
    this.groundY = groundY;
    this.color = index === 0 ? CONFIG.COLORS.cyan : CONFIG.COLORS.pink;

    this.alive = true;
    this.invulnUntil = 0;
    this.lastShotAt = -9999;
    this.recoilUntil = 0;
    this.walkPhase = 0;
    this.moving = false;
    this.rapidFireUntil = 0;
    this.shieldUntil = 0;

    // stats
    this.shotsFired = 0;
    this.blockersHit = 0;
    this.mrrContribution = 0;
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

  update(dt, inputState, spawnProjectileFn) {
    let vx = 0;
    if (inputState.left) vx -= CONFIG.PLAYER_SPEED;
    if (inputState.right) vx += CONFIG.PLAYER_SPEED;
    this.x += vx * dt;
    this.x = Math.max(0, Math.min(CONFIG.CANVAS_W - this.w, this.x));

    this.moving = vx !== 0;
    if (this.moving) this.walkPhase += dt * 12;

    if (inputState.shoot) {
      const now = performance.now();
      const cooldown = this.isRapidFiring ? CONFIG.PROJECTILE_COOLDOWN_MS / 2 : CONFIG.PROJECTILE_COOLDOWN_MS;
      if (now - this.lastShotAt >= cooldown) {
        this.lastShotAt = now;
        this.recoilUntil = now + 130;
        spawnProjectileFn(this);
        this.shotsFired++;
      }
    }
  }

  hitByBlocker() {
    if (this.isInvuln || this.isShielded) return false;
    const now = performance.now();
    this.invulnUntil = now + CONFIG.PLAYER_INVULN_MS;
    this.timesHit++;
    return true;
  }

  draw(ctx) {
    const now = performance.now();
    ctx.save();
    // faded (not blinking/hidden) while briefly invulnerable after a hit —
    // the player keeps moving and shooting the whole time, no lockout.
    if (this.isInvuln) {
      ctx.globalAlpha = 0.4;
    }

    const cx = this.x + this.w / 2;

    if (this.isShielded) {
      ctx.save();
      ctx.strokeStyle = CONFIG.COLORS.green;
      ctx.lineWidth = 2.5;
      ctx.globalAlpha = 0.7 + 0.25 * Math.sin(now / 90);
      ctx.beginPath();
      ctx.arc(cx, this.y + this.h * 0.5, this.w * 0.72, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    const legBob = this.moving ? Math.sin(this.walkPhase) * 3 : 0;
    const legBob2 = this.moving ? Math.sin(this.walkPhase + Math.PI) * 3 : 0;

    // legs
    ctx.fillStyle = this.color;
    ctx.fillRect(cx - this.w * 0.28, this.y + this.h * 0.62 + Math.max(0, legBob), this.w * 0.2, this.h * 0.38 - Math.max(0, legBob));
    ctx.fillRect(cx + this.w * 0.08, this.y + this.h * 0.62 + Math.max(0, legBob2), this.w * 0.2, this.h * 0.38 - Math.max(0, legBob2));

    // torso
    drawRoundedRect(ctx, cx - this.w * 0.38, this.y + this.h * 0.28, this.w * 0.76, this.h * 0.42, 6);
    ctx.fill();

    // chest stripe
    ctx.fillStyle = CONFIG.COLORS.bg;
    ctx.fillRect(cx - this.w * 0.3, this.y + this.h * 0.44, this.w * 0.6, this.h * 0.08);

    // head
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(cx, this.y + this.h * 0.16, this.w * 0.3, 0, Math.PI * 2);
    ctx.fill();
    // visor
    ctx.fillStyle = CONFIG.COLORS.bg;
    ctx.fillRect(cx - this.w * 0.22, this.y + this.h * 0.1, this.w * 0.44, this.h * 0.11);
    ctx.fillStyle = this.color;
    ctx.fillRect(cx - this.w * 0.18, this.y + this.h * 0.115, this.w * 0.36, this.h * 0.08);

    // blaster barrel — recoils briefly after each shot
    const recoiling = now < this.recoilUntil;
    const recoilAmt = recoiling ? (this.recoilUntil - now) / 130 : 0;
    const barrelLen = this.h * 0.28 - recoilAmt * 5;
    ctx.fillStyle = this.isRapidFiring ? CONFIG.COLORS.orange : CONFIG.COLORS.white;
    ctx.fillRect(cx - 3, this.y - barrelLen, 6, barrelLen);
    ctx.fillStyle = this.color;
    ctx.fillRect(cx - 5, this.y - barrelLen, 10, 5);

    ctx.restore();

    // avatar + name above, always outside the sprite
    ctx.save();
    ctx.font = '16px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = CONFIG.COLORS.white;
    ctx.fillText(this.avatar, cx, this.y - 22);
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = this.color;
    ctx.fillText(this.name.toUpperCase(), cx, this.y - 34);
    ctx.restore();
  }
}

// Harpoon-style shot — like the real game: a rope shoots from the cannon straight up,
// growing until it hits something or reaches the very top of the play field.
class Projectile {
  constructor(x, y, ownerIndex) {
    this.x = x;
    this.startY = y; // fixed: where the rope is anchored to the cannon
    this.tipY = y; // moves upward each frame
    this.w = CONFIG.PROJECTILE_W;
    this.h = CONFIG.PROJECTILE_H;
    this.ownerIndex = ownerIndex;
    this.alive = true;
    this.color = ownerIndex === 0 ? CONFIG.COLORS.cyan : CONFIG.COLORS.pink;
  }

  update(dt) {
    this.tipY -= CONFIG.PROJECTILE_SPEED * dt;
    if (this.tipY <= 0) {
      this.tipY = 0;
      this.alive = false; // reached the very top of the field
    }
  }

  draw(ctx) {
    const cx = this.x + this.w / 2;
    ctx.save();
    // the rope: a thin bright line all the way from the cannon to the current tip
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.w;
    ctx.beginPath();
    ctx.moveTo(cx, this.startY);
    ctx.lineTo(cx, this.tipY);
    ctx.stroke();
    // bright core for a little glow feel (flat color, no gradient)
    ctx.strokeStyle = CONFIG.COLORS.white;
    ctx.lineWidth = Math.max(1, this.w * 0.4);
    ctx.beginPath();
    ctx.moveTo(cx, this.startY);
    ctx.lineTo(cx, this.tipY);
    ctx.stroke();
    // arrowhead tip
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.moveTo(cx, this.tipY - 6);
    ctx.lineTo(cx - 4, this.tipY + 4);
    ctx.lineTo(cx + 4, this.tipY + 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  get bounds() {
    // only the tip is the "business end" that can hit something
    return { x: this.x, y: this.tipY - 4, w: this.w, h: 8 };
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
    // fixed bounce apex for this tier — always rebounds to the same height, scaled by round speed
    this.bounceVy = -Math.sqrt(2 * CONFIG.GRAVITY * tierCfg.bounceHeight) * this.speedMultiplier;
    this.alive = true;
    this.color = tier === 0 ? CONFIG.COLORS.pink : tier === 1 ? CONFIG.COLORS.yellow : CONFIG.COLORS.cyan;
    this.spin = (Math.random() - 0.5) * 1.4;
    this.angle = Math.random() * Math.PI * 2;
  }

  update(dt) {
    this.vy += CONFIG.GRAVITY * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.angle += this.spin * dt;

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

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    const iconColor = this.tier === 0 ? CONFIG.COLORS.pink : this.tier === 1 ? CONFIG.COLORS.yellow : CONFIG.COLORS.cyan;
    if (Assets.ready) {
      const key = this.tier === 0 ? 'pink' : this.tier === 1 ? 'yellow' : 'cyan';
      Assets.draw(ctx, key, 0, 0, this.radius * 1.15);
    } else {
      BLOCKER_FALLBACK_ICON(ctx, 0, 0, this.radius, iconColor);
    }
    ctx.restore();

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
    this.angle = 0;
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
    this.angle += dt * 2;

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
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(Math.sin(this.angle) * 0.3);
    const glyph = BONUS_KIND_GLYPHS[this.kind.key];
    if (glyph) {
      ctx.rotate(-Math.sin(this.angle) * 0.3); // keep the glyph upright and legible
      ctx.fillStyle = this.color;
      ctx.font = `bold ${Math.round(this.radius * 1.15)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(glyph, 0, 1);
    } else if (Assets.ready) {
      Assets.draw(ctx, this.kind.color, 0, 0, this.radius * 1.2 * pulse);
    } else {
      BLOCKER_FALLBACK_ICON(ctx, 0, 0, this.radius, this.color);
    }
    ctx.restore();
    ctx.restore();
  }

  get bounds() {
    return { x: this.x - this.radius, y: this.y - this.radius, w: this.radius * 2, h: this.radius * 2 };
  }
}
