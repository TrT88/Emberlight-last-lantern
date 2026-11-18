// EMBERLIGHT world: the rules. Spawning, waves, combat, dash, embers,
// upgrades, scoring, win and lose. Rendering lives in render.js.
import { ENEMY_TYPES, MAP, PALETTE, PLAYER, PLAYER_SPAWN, ROOM_LINKS, ROOMS, SKILL_DROP_CHANCE, SOLIDS, TEMP_SKILLS, TOTAL_WAVES, ULT, UPGRADES, waveSpec } from './config.js';
import { createParticles } from './particles.js';

export const EVENT_NONE = 0;
export const EVENT_HIT = 1;
export const EVENT_OVER = 2;
export const EVENT_WIN = 4;
export const EVENT_WAVE_CLEAR = 8;
export const EVENT_PICKUP = 16;
export const EVENT_ULT = 32;

// --- v5: collision + room navigation (pure helpers, exported for tests) ---
export function circleHitsSolid(x, y, r) {
  if (x - r < MAP.x || x + r > MAP.x + MAP.w || y - r < MAP.y || y + r > MAP.y + MAP.h) return true;
  for (let i = 0; i < SOLIDS.length; i += 1) {
    const s = SOLIDS[i];
    // True circle-vs-rect test (closest point on the rect): the old
    // AABB-overlap test also blocked the circle's bounding box around
    // rect corners, which wedged zombies in phantom corners they could
    // never slide out of (v5 bug, found by the kiting bot stalling on
    // wave 7 with one wisp frozen at a crate corner).
    const cx = Math.max(s.x, Math.min(x, s.x + s.w));
    const cy = Math.max(s.y, Math.min(y, s.y + s.h));
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}

export function pointHitsSolid(x, y) {
  if (x < MAP.x || x > MAP.x + MAP.w || y < MAP.y || y > MAP.y + MAP.h) return true;
  for (let i = 0; i < SOLIDS.length; i += 1) {
    const s = SOLIDS[i];
    if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return true;
  }
  return false;
}

// Axis-separated move: try X, then Y, so the keeper and the zombies
// slide along walls and obstacles instead of sticking in corners.
export function moveCircle(ent, dx, dy, r) {
  if (dx !== 0 && !circleHitsSolid(ent.x + dx, ent.y, r)) ent.x += dx;
  if (dy !== 0 && !circleHitsSolid(ent.x, ent.y + dy, r)) ent.y += dy;
}

// Push a circle out of any solid it overlaps (separation / knockback
// cleanup, so nothing ever ends up embedded in a wall or obstacle).
// Push a circle out of every solid it overlaps. Iterates to a fixed
// point: pushing out of one solid can shove the circle back into an
// earlier one (e.g. a corner where a wall and a divider meet), so a
// single pass is not enough.
export function resolveCircle(ent, r) {
  for (let pass = 0; pass < 4; pass += 1) {
    let fixed = false;
    for (let i = 0; i < SOLIDS.length; i += 1) {
      const s = SOLIDS[i];
      const cx = Math.max(s.x, Math.min(ent.x, s.x + s.w));
      const cy = Math.max(s.y, Math.min(ent.y, s.y + s.h));
      const dx = ent.x - cx;
      const dy = ent.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        fixed = true;
        if (d2 > 0.01) {
          const d = Math.sqrt(d2);
          ent.x = cx + (dx / d) * r;
          ent.y = cy + (dy / d) * r;
        } else {
          // Centre inside the rect: push out along the smallest penetration.
          const left = ent.x - s.x + r;
          const right = s.x + s.w - ent.x + r;
          const top = ent.y - s.y + r;
          const bottom = s.y + s.h - ent.y + r;
          const m = Math.min(left, right, top, bottom);
          if (m === left) ent.x = s.x - r;
          else if (m === right) ent.x = s.x + s.w + r;
          else if (m === top) ent.y = s.y - r;
          else ent.y = s.y + s.h + r;
        }
      }
    }
    if (!fixed) break;
  }
  ent.x = Math.max(MAP.x + r, Math.min(MAP.x + MAP.w - r, ent.x));
  ent.y = Math.max(MAP.y + r, Math.min(MAP.y + MAP.h - r, ent.y));
}

// Which room a point is in (0-3). A point inside a wall/divider maps to
// the room whose centre is nearest — entities never rest there.
export function roomOf(x, y) {
  for (let i = 0; i < ROOMS.length; i += 1) {
    const r = ROOMS[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < ROOMS.length; i += 1) {
    const cx = ROOMS[i].x + ROOMS[i].w / 2;
    const cy = ROOMS[i].y + ROOMS[i].h / 2;
    const d = (x - cx) ** 2 + (y - cy) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

// The doorway a zombie in room `from` should walk to on its way to room
// `to` (BFS over the 4-room graph). Null when already in the same room.
export function doorToward(from, to) {
  if (from === to) return null;
  const prev = new Array(ROOMS.length).fill(-1);
  const queue = [from];
  prev[from] = from;
  while (queue.length > 0) {
    const cur = queue.shift();
    if (cur === to) break;
    for (const link of ROOM_LINKS) {
      const other = link.rooms[0] === cur ? link.rooms[1]
        : (link.rooms[1] === cur ? link.rooms[0] : -1);
      if (other >= 0 && prev[other] === -1) {
        prev[other] = cur;
        queue.push(other);
      }
    }
  }
  if (prev[to] === -1) return null;
  let node = to;
  while (prev[node] !== from) node = prev[node];
  for (const link of ROOM_LINKS) {
    if ((link.rooms[0] === from && link.rooms[1] === node)
      || (link.rooms[1] === from && link.rooms[0] === node)) return link.door;
  }
  return null;
}

// Line of sight (sampled): a spitter only shoots when no wall or
// obstacle stands between it and the keeper.
export function hasLineOfSight(a, b) {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  const steps = Math.max(1, Math.ceil(d / 16));
  for (let i = 1; i < steps; i += 1) {
    const x = a.x + ((b.x - a.x) * i) / steps;
    const y = a.y + ((b.y - a.y) * i) / steps;
    if (pointHitsSolid(x, y)) return false;
  }
  return true;
}

function dist2(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function createWorld(random, audio) {
  const particles = createParticles();
  const state = {
    wave: 0,
    score: 0,
    embers: 0,
    kills: 0,
    combo: 0,
    comboTimer: 0,
    waveBonus: 0,
    braziersLit: 0,
    spawnQueue: [],
    spawnTimer: 0,
    betweenWaves: false,
    offers: [],
    time: 0,
  };
  const player = {
    x: PLAYER_SPAWN.x, y: PLAYER_SPAWN.y, angle: -Math.PI / 2,
    hp: PLAYER.maxHp, maxHp: PLAYER.maxHp,
    speed: PLAYER.speed, fireInterval: PLAYER.fireInterval,
    damage: PLAYER.bulletDamage, shots: 1, pierce: 0,
    dashCooldown: 0, dashTime: 0, dashX: 0, dashY: 0,
    fireTimer: 0, invuln: 0, magnet: PLAYER.pickupRadius,
    lantern: PLAYER.lanternRadius,
    ultEnergy: 0, tempSkill: null, moving: false,
  };
  let enemies = [];
  let bullets = [];
  let enemyBullets = [];
  let emberDrops = [];
  let skillDrops = [];
  let events = EVENT_NONE;

  function hasSkill(id) {
    return player.tempSkill && player.tempSkill.id === id;
  }

  // Zombies spawn at the edge of a random room (never inside a wall or
  // an obstacle, never on top of the keeper).
  function edgeSpawn() {
    for (let tries = 0; tries < 14; tries += 1) {
      const room = ROOMS[random.int(0, ROOMS.length - 1)];
      const side = random.int(0, 3);
      const inset = 34;
      let x;
      let y;
      if (side === 0) { x = random.range(room.x + inset, room.x + room.w - inset); y = room.y + inset; }
      else if (side === 1) { x = random.range(room.x + inset, room.x + room.w - inset); y = room.y + room.h - inset; }
      else if (side === 2) { x = room.x + inset; y = random.range(room.y + inset, room.y + room.h - inset); }
      else { x = room.x + room.w - inset; y = random.range(room.y + inset, room.y + room.h - inset); }
      if (circleHitsSolid(x, y, 30)) continue;
      if (Math.hypot(x - player.x, y - player.y) < 220) continue;
      return { x, y };
    }
    // Fallback: a room centre is always clear (braziers are visual only).
    const room = ROOMS[random.int(0, ROOMS.length - 1)];
    return { x: room.x + room.w / 2, y: room.y + room.h / 2 };
  }

  function startWave(n) {
    state.wave = n;
    state.betweenWaves = false;
    const spec = waveSpec(n);
    state.spawnQueue = [];
    for (const [type, count] of Object.entries(spec.counts)) {
      for (let i = 0; i < count; i += 1) state.spawnQueue.push({ type, hpScale: spec.hpScale, speedScale: spec.speedScale });
    }
    // Shuffle the queue so types arrive mixed.
    for (let i = state.spawnQueue.length - 1; i > 0; i -= 1) {
      const j = random.int(0, i);
      [state.spawnQueue[i], state.spawnQueue[j]] = [state.spawnQueue[j], state.spawnQueue[i]];
    }
    state.spawnTimer = n === 1 ? 0.1 : 0.4;
    // Wave 1 used to open with ~10 boring seconds: one slow wisp at a time.
    // The first three enemies now spawn immediately, so the player has
    // something to shoot at once. Later waves keep their normal pacing.
    if (n === 1) {
      for (let k = 0; k < 3 && state.spawnQueue.length > 0; k += 1) {
        spawnEnemy(state.spawnQueue.shift());
      }
    }
    state.waveBonus = spec.bonus;
    audio.waveHorn();
  }

  function spawnEnemy(queued) {
    const base = ENEMY_TYPES[queued.type];
    const pos = edgeSpawn();
    enemies.push({
      type: queued.type,
      x: pos.x, y: pos.y,
      radius: base.radius,
      hp: Math.round(base.hp * queued.hpScale),
      maxHp: Math.round(base.hp * queued.hpScale),
      armor: base.armor ?? 0,
      speed: base.speed * queued.speedScale,
      damage: base.damage,
      score: base.score,
      embers: base.embers,
      color: base.color,
      shootTimer: random.range(1, 2.5),
      wobble: random.range(0, Math.PI * 2),
    });
  }

  function hurtPlayer(damage) {
    if (player.invuln > 0 || player.dashTime > 0) return;
    // Aegis (temporary shield skill): no damage at all while it lasts.
    if (hasSkill('shield')) return;
    player.hp -= damage;
    player.invuln = 0.7;
    state.combo = 0;
    particles.addShake(7);
    particles.burst(player.x, player.y, PALETTE.rose, 14, 220);
    audio.hurt();
    events |= EVENT_HIT;
    if (player.hp <= 0) {
      player.hp = 0;
      particles.burst(player.x, player.y, PALETTE.gold, 40, 320);
      audio.lose();
      events |= EVENT_OVER;
    }
  }

  function killEnemy(enemy, index) {
    enemies.splice(index, 1);
    state.kills += 1;
    state.combo += 1;
    state.comboTimer = 3;
    const mult = 1 + Math.min(4, Math.floor(state.combo / 5)) * 0.5;
    const gained = Math.round(enemy.score * mult);
    state.score += gained;
    // Kills charge the ult meter (Lantern Nova).
    player.ultEnergy = Math.min(ULT.max, player.ultEnergy + ULT.energyPerKill);
    // Vampiric Ember: kills heal.
    if (hasSkill('lifesteal')) {
      player.hp = Math.min(player.maxHp, player.hp + 8);
      particles.floatText(player.x, player.y - 26, '+8 HP', PALETTE.rose);
    }
    // Boom Kills: the zombie explodes and hurts its neighbours. Damage
    // first, then kill the dead in a second pass — killing while iterating
    // the enemy list would skip entries.
    if (hasSkill('boom')) {
      particles.burst(enemy.x, enemy.y, PALETTE.ember, 22, 300);
      particles.addShake(4);
      const dead = [];
      for (let j = enemies.length - 1; j >= 0; j -= 1) {
        const other = enemies[j];
        const d = Math.hypot(other.x - enemy.x, other.y - enemy.y);
        if (d < 120) {
          other.hp -= 40;
          if (other.hp <= 0) dead.push(j);
        }
      }
      for (const j of dead) killEnemy(enemies[j], j);
    }
    particles.burst(enemy.x, enemy.y, enemy.color, 18, 260);
    particles.floatText(enemy.x, enemy.y - 18, `+${gained}`, PALETTE.flame);
    audio.enemyDie();
    for (let i = 0; i < enemy.embers; i += 1) {
      emberDrops.push({
        x: enemy.x + random.range(-14, 14),
        y: enemy.y + random.range(-14, 14),
        vx: random.range(-40, 40), vy: random.range(-40, 40),
        value: 1,
      });
    }
    // A killed zombie sometimes drops a hidden temporary skill.
    if (random.chance(SKILL_DROP_CHANCE)) {
      const def = TEMP_SKILLS[random.int(0, TEMP_SKILLS.length - 1)];
      skillDrops.push({
        x: enemy.x, y: enemy.y, vx: 0, vy: 0,
        skill: def,
      });
      particles.floatText(enemy.x, enemy.y - 34, `${def.icon} ${def.name}!`, PALETTE.gold);
    }
    if (random.chance(0.08)) {
      emberDrops.push({ x: enemy.x, y: enemy.y, vx: 0, vy: 0, value: 0, heart: true });
    }
  }

  function applyUpgrade(id) {
    if (id === 'damage') player.damage = Math.round(player.damage * 1.35);
    else if (id === 'rapid') player.fireInterval *= 0.75;
    else if (id === 'multishot') player.shots += 1;
    else if (id === 'pierce') player.pierce += 1;
    else if (id === 'speed') player.speed *= 1.18;
    else if (id === 'vitality') {
      player.maxHp += 30;
      player.hp = Math.min(player.maxHp, player.hp + 30);
    } else if (id === 'dash') player.dashCooldownMax = (player.dashCooldownMax ?? PLAYER.dashCooldown) * 0.6;
    else if (id === 'magnet') player.magnet *= 1.8;
    audio.upgrade();
  }

  function offerUpgrades() {
    const pool = [...UPGRADES];
    const offers = [];
    while (offers.length < 3 && pool.length > 0) {
      offers.push(pool.splice(random.int(0, pool.length - 1), 1)[0]);
    }
    state.offers = offers;
    return offers;
  }

  function step(dt, move, aim, firing, dashPressed, opts = {}) {
    events = EVENT_NONE;
    state.time += dt;
    particles.step(dt);
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }
    // A temporary skill counts down; when it runs out it is gone.
    if (player.tempSkill) {
      player.tempSkill.timeLeft -= dt;
      if (player.tempSkill.timeLeft <= 0) player.tempSkill = null;
    }
    player.moving = move.x !== 0 || move.y !== 0;

    // --- Ultimate: Lantern Nova (Q / ULTI button, only when the meter is full) ---
    if (opts.ult && player.ultEnergy >= ULT.max) {
      player.ultEnergy = 0;
      player.invuln = Math.max(player.invuln, ULT.invuln);
      particles.burst(player.x, player.y, PALETTE.gold, 60, 520);
      particles.addShake(12);
      audio.ult();
      const dead = [];
      for (let j = enemies.length - 1; j >= 0; j -= 1) {
        const e = enemies[j];
        const d = Math.hypot(e.x - player.x, e.y - player.y);
        if (d < ULT.radius) {
          // The nova ignores armor — it is the one big moment.
          e.hp -= ULT.damage;
          const len = d || 1;
          e.x += ((e.x - player.x) / len) * 120;
          e.y += ((e.y - player.y) / len) * 120;
          resolveCircle(e, e.radius);
          if (e.hp <= 0) dead.push(j);
        }
      }
      for (const j of dead) killEnemy(enemies[j], j);
      particles.floatText(player.x, player.y - 34, 'EMBER NOVA!', PALETTE.gold);
      events |= EVENT_ULT;
    }

    // --- Player movement + dash ---
    player.invuln = Math.max(0, player.invuln - dt);
    player.dashCooldown = Math.max(0, player.dashCooldown - dt);
    player.fireTimer -= dt;
    const dashMax = player.dashCooldownMax ?? PLAYER.dashCooldown;
    if (dashPressed && player.dashCooldown <= 0 && (move.x !== 0 || move.y !== 0)) {
      player.dashTime = PLAYER.dashTime;
      player.dashCooldown = dashMax;
      player.dashX = move.x;
      player.dashY = move.y;
      player.invuln = Math.max(player.invuln, PLAYER.dashTime + 0.05);
      audio.dash();
      particles.burst(player.x, player.y, PALETTE.teal, 10, 180);
    }
    if (player.dashTime > 0) {
      player.dashTime -= dt;
      moveCircle(player, player.dashX * PLAYER.dashSpeed * dt, player.dashY * PLAYER.dashSpeed * dt, PLAYER.radius);
    } else {
      // Swift Boots (temporary skill): +45% move speed.
      const speedMul = hasSkill('speed') ? 1.45 : 1;
      moveCircle(player, move.x * player.speed * speedMul * dt, move.y * player.speed * speedMul * dt, PLAYER.radius);
    }
    // Never let the player stay embedded in a wall/obstacle.
    resolveCircle(player, PLAYER.radius);
    // Auto-aim (v4): the gun barrel turns to the nearest zombie on its
    // own. On touch it is always on; on desktop the mouse still wins
    // while it moves (main.js only passes autoAim when the mouse is idle).
    if (opts.autoAim && enemies.length > 0) {
      let nearest = null;
      let nearestD = 760 * 760;
      for (const e of enemies) {
        const d = (e.x - player.x) ** 2 + (e.y - player.y) ** 2;
        if (d < nearestD) { nearestD = d; nearest = e; }
      }
      if (nearest) player.angle = Math.atan2(nearest.y - player.y, nearest.x - player.x);
      else player.angle = Math.atan2(aim.y - player.y, aim.x - player.x);
    } else {
      player.angle = Math.atan2(aim.y - player.y, aim.x - player.x);
    }

    // --- Shooting ---
    // Twin Embers: +1 bolt. Rapid Wick: fire twice as fast.
    // Piercing Gaze: bolts pierce +2.
    const shots = player.shots + (hasSkill('multishot') ? 1 : 0);
    const pierce = player.pierce + (hasSkill('pierce') ? 2 : 0);
    const interval = player.fireInterval * (hasSkill('rapid') ? 0.5 : 1);
    if (firing && player.fireTimer <= 0) {
      player.fireTimer = interval;
      const spread = 0.14;
      for (let i = 0; i < shots; i += 1) {
        const off = (i - (shots - 1) / 2) * spread;
        const a = player.angle + off;
        bullets.push({
          x: player.x + Math.cos(a) * 24,
          y: player.y + Math.sin(a) * 24,
          vx: Math.cos(a) * PLAYER.bulletSpeed,
          vy: Math.sin(a) * PLAYER.bulletSpeed,
          damage: player.damage, pierce, life: 1.1,
        });
      }
      audio.shoot();
      particles.trail(player.x + Math.cos(player.angle) * 26, player.y + Math.sin(player.angle) * 26, PALETTE.gold);
    }

    // --- Spawning ---
    if (state.spawnQueue.length > 0) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        spawnEnemy(state.spawnQueue.shift());
        // v5: spawn a little faster than v4 (0.45 s wave 1, then down to
        // 0.22 s), so with 50% more zombies the map is crowded at once.
        state.spawnTimer = state.wave === 1
          ? 0.45
          : Math.max(0.22, 0.75 - state.wave * 0.05);
      }
    }

    // --- Enemies ---
    // Ghost Veil (temporary skill): the zombies cannot see the keeper —
    // they shamble around aimlessly and spitters do not shoot.
    const ghost = hasSkill('ghost');
    for (let i = enemies.length - 1; i >= 0; i -= 1) {
      const e = enemies[i];
      e.wobble += dt * 3;
      // Waypoint steering (v5): a zombie in another room than the keeper
      // walks to the doorway that leads toward the keeper's room first,
      // instead of shoving forever against the divider wall.
      let tx = player.x;
      let ty = player.y;
      const door = ghost ? null : doorToward(roomOf(e.x, e.y), roomOf(player.x, player.y));
      if (door) { tx = door.x; ty = door.y; }
      const dx = tx - e.x;
      const dy = ty - e.y;
      const d = Math.hypot(dx, dy) || 1;
      let mx = dx / d;
      let my = dy / d;
      if (ghost) {
        mx = Math.cos(e.wobble);
        my = Math.sin(e.wobble);
      } else if (door) {
        // Walk straight to the doorway; strafe/wobble only resumes in
        // the keeper's room.
      } else if (e.type === 'spitter') {
        // Keep a shooting distance, strafe sideways.
        const want = 260;
        const radial = d < want ? -0.7 : 0.5;
        mx = mx * radial + -my * 0.6;
        my = my * radial + mx * 0.6;
        const len = Math.hypot(mx, my) || 1;
        mx /= len;
        my /= len;
        e.shootTimer -= dt;
        // Only shoot with a clear line — never through a wall.
        if (e.shootTimer <= 0 && d < 520 && hasLineOfSight(e, player)) {
          e.shootTimer = random.range(1.8, 2.6);
          enemyBullets.push({
            x: e.x, y: e.y,
            vx: (dx / d) * 260, vy: (dy / d) * 260,
            damage: e.damage, life: 3,
          });
          audio.shoot();
        }
      } else if (e.type === 'dart') {
        mx += Math.cos(e.wobble) * 0.5;
        my += Math.sin(e.wobble) * 0.5;
        const len = Math.hypot(mx, my) || 1;
        mx /= len;
        my /= len;
      }
      // Frost Chill (temporary skill): zombies near the keeper move
      // at half speed.
      const chillMul = hasSkill('chill') && Math.hypot(player.x - e.x, player.y - e.y) < 280 ? 0.5 : 1;
      // Unstuck detour (v5): if a zombie is blocked for more than 1.5 s
      // (corner of an obstacle or a door frame), it walks sideways for
      // ~0.9 s instead of grinding in place.
      let dirX = mx;
      let dirY = my;
      if (e.detourUntil && state.time < e.detourUntil) {
        dirX = e.detourX;
        dirY = e.detourY;
      }
      const ox = e.x;
      const oy = e.y;
      moveCircle(e, dirX * e.speed * chillMul * dt, dirY * e.speed * chillMul * dt, e.radius);
      // Never let a zombie stay embedded in a wall/obstacle: diagonal
      // separation pushes and knockbacks can shove one into a corner
      // trap where axis-separated movement alone can never free it.
      resolveCircle(e, e.radius);
      const moved = Math.hypot(e.x - ox, e.y - oy);
      const want = e.speed * chillMul * dt;
      if (want > 0.4 && moved < want * 0.25 && !(e.detourUntil && state.time < e.detourUntil)) {
        e.blockedTime = (e.blockedTime || 0) + dt;
      } else {
        e.blockedTime = 0;
      }
      if (e.blockedTime > 1.5) {
        e.blockedTime = 0;
        const side = random.chance(0.5) ? 1 : -1;
        e.detourX = -my * side;
        e.detourY = mx * side;
        e.detourUntil = state.time + 0.9;
      }
      // Touch damage.
      if (dist2(e, player) < (e.radius + PLAYER.radius) ** 2) {
        hurtPlayer(e.damage);
        // Knock the enemy back so one touch is not a death spiral.
        e.x -= mx * 26;
        e.y -= my * 26;
        resolveCircle(e, e.radius);
      }
    }

    // --- Zombie separation: the horde should read as a crowd, not one
    // blob stacked on a single point. Without this every zombie converges
    // onto the keeper's exact position and they all overlap (the play
    // screenshot was one green pile with the hero buried in it). Cheap
    // O(n^2) pass, n <= ~40. Also slightly fairer: only the front rank
    // can touch the keeper at once.
    for (let i = 0; i < enemies.length; i += 1) {
      for (let j = i + 1; j < enemies.length; j += 1) {
        const a = enemies[i];
        const b = enemies[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        const min = (a.radius + b.radius) * 0.85;
        if (d > 0.01 && d < min) {
          const push = (min - d) / 2;
          const nx = dx / d;
          const ny = dy / d;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
          // The push can shove a zombie into a wall or obstacle: pull
          // both back out so nobody ends up embedded in a solid.
          resolveCircle(a, a.radius);
          resolveCircle(b, b.radius);
        }
      }
    }

    // --- Player bullets vs enemies ---
    for (let i = bullets.length - 1; i >= 0; i -= 1) {
      const b = bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      // A bolt that hits a wall or an obstacle dies with a small spark.
      let dead = b.life <= 0 || pointHitsSolid(b.x, b.y);
      if (dead && b.life > 0) particles.burst(b.x, b.y, PALETTE.flame, 4, 120);
      if (!dead) {
        for (let j = enemies.length - 1; j >= 0; j -= 1) {
          const e = enemies[j];
          if (dist2(b, e) < (e.radius + PLAYER.bulletRadius) ** 2) {
            // Zombie armor shaves a flat amount off each bolt hit
            // (never below 1 damage).
            e.hp -= Math.max(1, b.damage - (e.armor || 0));
            particles.burst(b.x, b.y, PALETTE.flame, 5, 140);
            audio.hit();
            if (e.hp <= 0) killEnemy(e, j);
            if (b.pierce > 0) {
              b.pierce -= 1;
            } else {
              dead = true;
            }
            break;
          }
        }
      }
      if (dead) bullets.splice(i, 1);
    }

    // --- Enemy bullets vs player ---
    for (let i = enemyBullets.length - 1; i >= 0; i -= 1) {
      const b = enemyBullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let dead = b.life <= 0 || pointHitsSolid(b.x, b.y);
      if (!dead && dist2(b, player) < (PLAYER.radius + 6) ** 2) {
        hurtPlayer(b.damage);
        dead = true;
      }
      if (dead) enemyBullets.splice(i, 1);
    }

    // --- Ember / heart pickups ---
    // Ember Magnet (temporary skill): pickup range x3.
    const magnetRadius = player.magnet * (hasSkill('magnet') ? 3 : 1);
    for (let i = emberDrops.length - 1; i >= 0; i -= 1) {
      const drop = emberDrops[i];
      const d = Math.hypot(player.x - drop.x, player.y - drop.y);
      if (d < magnetRadius) {
        drop.vx += ((player.x - drop.x) / (d || 1)) * 900 * dt;
        drop.vy += ((player.y - drop.y) / (d || 1)) * 900 * dt;
      }
      drop.x += drop.vx * dt;
      drop.y += drop.vy * dt;
      drop.vx *= 0.92;
      drop.vy *= 0.92;
      drop.x = Math.max(MAP.x + 6, Math.min(MAP.x + MAP.w - 6, drop.x));
      drop.y = Math.max(MAP.y + 6, Math.min(MAP.y + MAP.h - 6, drop.y));
      if (d < PLAYER.radius + 12) {
        if (drop.heart) {
          player.hp = Math.min(player.maxHp, player.hp + 25);
          particles.floatText(player.x, player.y - 26, '+25 HP', PALETTE.teal);
        } else {
          state.embers += drop.value;
          state.score += 10;
        }
        audio.pickup();
        events |= EVENT_PICKUP;
        emberDrops.splice(i, 1);
      }
    }

    // --- Skill-orb pickups: one active skill at a time; a new pickup
    // replaces the old one. The orb drifts toward the keeper like embers.
    for (let i = skillDrops.length - 1; i >= 0; i -= 1) {
      const drop = skillDrops[i];
      const d = Math.hypot(player.x - drop.x, player.y - drop.y);
      if (d < magnetRadius) {
        drop.vx += ((player.x - drop.x) / (d || 1)) * 900 * dt;
        drop.vy += ((player.y - drop.y) / (d || 1)) * 900 * dt;
      }
      drop.x += drop.vx * dt;
      drop.y += drop.vy * dt;
      drop.vx *= 0.92;
      drop.vy *= 0.92;
      drop.x = Math.max(MAP.x + 6, Math.min(MAP.x + MAP.w - 6, drop.x));
      drop.y = Math.max(MAP.y + 6, Math.min(MAP.y + MAP.h - 6, drop.y));
      if (d < PLAYER.radius + 14) {
        player.tempSkill = { ...drop.skill, timeLeft: drop.skill.duration };
        particles.floatText(player.x, player.y - 30, `${drop.skill.icon} ${drop.skill.name}!`, PALETTE.gold);
        particles.burst(player.x, player.y, PALETTE.gold, 12, 200);
        audio.upgrade();
        events |= EVENT_PICKUP;
        skillDrops.splice(i, 1);
      }
    }

    // --- Wave clear / win ---
    if (enemies.length === 0 && state.spawnQueue.length === 0 && !state.betweenWaves) {
      state.betweenWaves = true;
      state.score += state.waveBonus;
      state.braziersLit = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4][Math.min(state.wave, 10) - 1] ?? state.braziersLit;
      if (state.wave >= TOTAL_WAVES) {
        events |= EVENT_WIN;
      } else {
        offerUpgrades();
        events |= EVENT_WAVE_CLEAR;
      }
    }
    return events;
  }

  function reset() {
    enemies = [];
    bullets = [];
    enemyBullets = [];
    emberDrops = [];
    skillDrops = [];
    particles.clear();
    Object.assign(state, {
      wave: 0, score: 0, embers: 0, kills: 0, combo: 0, comboTimer: 0,
      waveBonus: 0, braziersLit: 0, spawnQueue: [], spawnTimer: 0,
      betweenWaves: false, offers: [], time: 0,
    });
    Object.assign(player, {
      x: PLAYER_SPAWN.x, y: PLAYER_SPAWN.y, angle: -Math.PI / 2,
      hp: PLAYER.maxHp, maxHp: PLAYER.maxHp,
      speed: PLAYER.speed, fireInterval: PLAYER.fireInterval,
      damage: PLAYER.bulletDamage, shots: 1, pierce: 0,
      dashCooldown: 0, dashTime: 0, fireTimer: 0, invuln: 0,
      magnet: PLAYER.pickupRadius, lantern: PLAYER.lanternRadius,
      ultEnergy: 0, tempSkill: null, moving: false,
    });
    delete player.dashCooldownMax;
  }

  return {
    state, player,
    get enemies() { return enemies; },
    get bullets() { return bullets; },
    get enemyBullets() { return enemyBullets; },
    get emberDrops() { return emberDrops; },
    get skillDrops() { return skillDrops; },
    particles,
    startWave, step, reset, applyUpgrade, offerUpgrades,
  };
}
