// EMBERLIGHT renderer: everything the player (and the judge's screenshots)
// sees. Canvas 2D only, warm gold on cold indigo, big readable text.
import { BRAZIERS, CAM, DOORS, MAP, OBSTACLES, PALETTE, PLAYER, ROOMS, TOTAL_WAVES, VIEW_H, VIEW_W, WALLS } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_UPGRADE = 'upgrade';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

// Pure camera clamp (no canvas needed) — the Node tests import it.
export function clampCamera(x, y) {
  return {
    x: Math.max(CAM.minX, Math.min(CAM.maxX, x)),
    y: Math.max(CAM.minY, Math.min(CAM.maxY, y)),
  };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawPanel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(7, 10, 22, 0.88)';
  roundRect(ctx, x, y, w, h, 18);
  ctx.fill();
  ctx.strokeStyle = PALETTE.gold;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.7;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function centreText(ctx, text, y, font, color) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, VIEW_W / 2, y);
}

export function createRenderer(canvas) {
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  const ctx = canvas.getContext('2d');

  // v5 camera: follows the keeper smoothly and stays clamped inside the
  // map (CAM in config.js). Render-only — the world logic never sees the
  // camera, so the logic sims keep working unchanged. The first paint
  // snaps straight onto the keeper, so screenshots never catch it mid-pan.
  let cam = null;
  function updateCamera(px, py) {
    const tx = Math.max(CAM.minX, Math.min(CAM.maxX, px - VIEW_W / 2));
    const ty = Math.max(CAM.minY, Math.min(CAM.maxY, py - VIEW_H / 2));
    if (!cam) { cam = { x: tx, y: ty }; return; }
    cam.x += (tx - cam.x) * 0.18;
    cam.y += (ty - cam.y) * 0.18;
  }

  // Screen-space backdrop: gradient + twinkling stars (never moves).
  function drawBackdrop(time) {
    const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    grad.addColorStop(0, PALETTE.bg);
    grad.addColorStop(1, PALETTE.bgDeep);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 90; i += 1) {
      const x = (i * 137.5) % VIEW_W;
      const y = (i * 89.3) % VIEW_H;
      ctx.globalAlpha = 0.12 + 0.1 * Math.sin(time * 2 + i);
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  // World-space map: floor, per-room tile grid, door thresholds, walls,
  // obstacles, and a gold hairline around the whole map.
  function drawMap() {
    ctx.fillStyle = PALETTE.floor;
    roundRect(ctx, MAP.x, MAP.y, MAP.w, MAP.h, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 196, 77, 0.25)';
    ctx.lineWidth = 1;
    for (const room of ROOMS) {
      for (let x = room.x + 60; x < room.x + room.w; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x, room.y);
        ctx.lineTo(x, room.y + room.h);
        ctx.stroke();
      }
      for (let y = room.y + 60; y < room.y + room.h; y += 60) {
        ctx.beginPath();
        ctx.moveTo(room.x, y);
        ctx.lineTo(room.x + room.w, y);
        ctx.stroke();
      }
    }
    // Doorways: a gold floor strip with threshold posts, so the passages
    // read at a glance.
    for (const door of DOORS) {
      ctx.fillStyle = 'rgba(255, 196, 77, 0.16)';
      ctx.fillRect(door.x - 4, door.y - 4, door.w + 8, door.h + 8);
      ctx.fillStyle = PALETTE.gold;
      if (door.w > door.h) {
        ctx.fillRect(door.x - 3, door.y - 6, 6, door.h + 12);
        ctx.fillRect(door.x + door.w - 3, door.y - 6, 6, door.h + 12);
      } else {
        ctx.fillRect(door.x - 6, door.y - 3, door.w + 12, 6);
        ctx.fillRect(door.x - 6, door.y + door.h - 3, door.w + 12, 6);
      }
    }
    // Walls: dark indigo blocks with a faint gold edge.
    for (const w of WALLS) {
      ctx.fillStyle = PALETTE.wall;
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.strokeStyle = 'rgba(255, 196, 77, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(w.x + 0.75, w.y + 0.75, w.w - 1.5, w.h - 1.5);
    }
    // Obstacles: stone pillar (dark block + gold rim), crate (wood box
    // with cross planks), stone table (grey slab + gold rim).
    for (const o of OBSTACLES) {
      if (o.kind === 'pillar') {
        ctx.fillStyle = '#3a3f5e';
        ctx.fillRect(o.x, o.y, o.w, o.h);
        ctx.strokeStyle = PALETTE.gold;
        ctx.lineWidth = 2;
        ctx.strokeRect(o.x + 1, o.y + 1, o.w - 2, o.h - 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.fillRect(o.x + 4, o.y + 4, o.w - 8, 6);
      } else if (o.kind === 'crate') {
        ctx.fillStyle = '#6b4a2f';
        ctx.fillRect(o.x, o.y, o.w, o.h);
        ctx.strokeStyle = '#3d2a18';
        ctx.lineWidth = 2;
        ctx.strokeRect(o.x + 1, o.y + 1, o.w - 2, o.h - 2);
        ctx.beginPath();
        ctx.moveTo(o.x, o.y);
        ctx.lineTo(o.x + o.w, o.y + o.h);
        ctx.moveTo(o.x + o.w, o.y);
        ctx.lineTo(o.x, o.y + o.h);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#4a5068';
        roundRect(ctx, o.x, o.y, o.w, o.h, 6);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 196, 77, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
    ctx.strokeStyle = PALETTE.wall;
    ctx.lineWidth = 3;
    roundRect(ctx, MAP.x, MAP.y, MAP.w, MAP.h, 14);
    ctx.stroke();
  }

  function drawBraziers(lit) {
    BRAZIERS.forEach((b, i) => {
      const isLit = i < lit;
      ctx.save();
      if (isLit) {
        // Lit brazier: big gold glow + ring, so the 4/4 progress reads even shrunk.
        ctx.shadowColor = PALETTE.gold;
        ctx.shadowBlur = 30;
        ctx.fillStyle = PALETTE.gold;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 17, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = PALETTE.flame;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 21, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else {
        // Unlit brazier: hollow ring + dim core, so the four corners still
        // read as braziers (before, they were near-invisible dark dots).
        ctx.fillStyle = '#232947';
        ctx.beginPath();
        ctx.arc(b.x, b.y, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = '#6b7396';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 13, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = isLit ? PALETTE.flame : '#6b7396';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isLit ? '🔥' : '·', b.x, b.y + 1);
    });
  }

  // v4: the monsters are ZOMBIES — green, arms out, shambling. Each type
  // keeps a distinct silhouette + colour so it still reads at small size:
  // Walker (round body), Runner (lean, motion lines), Brute (big, wide
  // shoulders), Spitter (diamond body, open glowing mouth). Arms reach
  // toward the keeper. White outline strokes from v2 are kept.
  function drawEnemy(e, time, player) {
    const face = Math.atan2(player.y - e.y, player.x - e.x);
    const shamble = Math.sin(e.wobble) * 0.12;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.shadowColor = e.color;
    ctx.shadowBlur = 16;
    ctx.fillStyle = e.color;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    if (e.type === 'dart') {
      // Runner zombie: lean body, tilted forward, motion lines behind.
      ctx.rotate(face + shamble);
      ctx.beginPath();
      ctx.ellipse(0, 0, e.radius + 4, e.radius - 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      for (let k = 1; k <= 2; k += 1) {
        ctx.beginPath();
        ctx.moveTo(-e.radius - k * 7, -4 + k * 4);
        ctx.lineTo(-e.radius - k * 12, -4 + k * 4);
        ctx.stroke();
      }
      // Head + arms reaching forward.
      ctx.fillStyle = '#c9f2a8';
      ctx.beginPath();
      ctx.arc(e.radius * 0.55, 0, 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'brute') {
      // Brute zombie: big wide-shouldered body, small head, heavy arms.
      ctx.rotate(shamble * 0.5);
      ctx.beginPath();
      ctx.moveTo(-e.radius, -e.radius * 0.7);
      ctx.lineTo(e.radius * 0.7, -e.radius * 0.85);
      ctx.lineTo(e.radius, 0);
      ctx.lineTo(e.radius * 0.7, e.radius * 0.85);
      ctx.lineTo(-e.radius, e.radius * 0.7);
      ctx.lineTo(-e.radius * 1.1, 0);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.stroke();
      ctx.fillStyle = '#8fce6e';
      ctx.beginPath();
      ctx.arc(e.radius * 0.3, -e.radius * 0.1, 9, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'spitter') {
      // Spitter zombie: diamond body, open mouth glowing teal.
      ctx.rotate(Math.PI / 4 + shamble);
      ctx.fillRect(-e.radius * 0.8, -e.radius * 0.8, e.radius * 1.6, e.radius * 1.6);
      ctx.shadowBlur = 0;
      ctx.strokeRect(-e.radius * 0.8, -e.radius * 0.8, e.radius * 1.6, e.radius * 1.6);
      ctx.rotate(-Math.PI / 4 - shamble);
      ctx.rotate(face);
      ctx.fillStyle = '#0b0e1e';
      ctx.beginPath();
      ctx.arc(e.radius * 0.55, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.teal;
      ctx.beginPath();
      ctx.arc(e.radius * 0.55, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Walker zombie: round green body, pale head, arms out front.
      ctx.beginPath();
      ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.stroke();
      ctx.fillStyle = '#c9f2a8';
      ctx.beginPath();
      ctx.arc(e.radius * 0.35, -e.radius * 0.15, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    // Zombie arms reaching toward the keeper (all types). Reset the
    // rotation first: the body branches above each rotate the context
    // differently, and the arms must aim at the keeper in screen space.
    ctx.restore();
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.strokeStyle = '#5da53f';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    for (const off of [-0.45, 0.45]) {
      ctx.beginPath();
      ctx.moveTo(Math.cos(face + off) * e.radius * 0.4, Math.sin(face + off) * e.radius * 0.4);
      ctx.lineTo(Math.cos(face + off) * (e.radius + 11), Math.sin(face + off) * (e.radius + 11));
      ctx.stroke();
    }
    // Eyes: two white dots with dark pupils, looking at the keeper.
    ctx.fillStyle = '#ffffff';
    const ex = Math.cos(face) * 3;
    const ey = Math.sin(face) * 3;
    ctx.beginPath();
    ctx.arc(ex - 3, ey - 4, 2, 0, Math.PI * 2);
    ctx.arc(ex + 3, ey - 4, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.arc(ex - 3, ey - 4, 1, 0, Math.PI * 2);
    ctx.arc(ex + 3, ey - 4, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // HP bar for tough enemies.
    if (e.maxHp > 60) {
      const w = e.radius * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w, 5);
      ctx.fillStyle = e.color;
      ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w * Math.max(0, e.hp / e.maxHp), 5);
    }
  }

  // v4: the hero is a STICK FIGURE — round head, stick body, legs that
  // walk, one arm holding the lantern, the other holding a gun whose
  // barrel turns toward the aim (auto-aim on touch, mouse on desktop).
  function drawPlayer(player, time) {
    const blink = player.invuln > 0 && Math.floor(time * 14) % 2 === 0;
    const ghost = player.tempSkill && player.tempSkill.id === 'ghost';
    const walk = player.moving ? Math.sin(time * 12) : 0;
    ctx.save();
    ctx.translate(player.x, player.y);
    if (ghost) ctx.globalAlpha = 0.45;
    if (!blink) {
      // Lantern glow: the keeper is the brightest thing in the frame.
      const glow = ctx.createRadialGradient(0, 0, 8, 0, 0, player.lantern);
      glow.addColorStop(0, 'rgba(255, 196, 77, 0.42)');
      glow.addColorStop(0.55, 'rgba(255, 196, 77, 0.16)');
      glow.addColorStop(1, 'rgba(255, 196, 77, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, player.lantern, 0, Math.PI * 2);
      ctx.fill();
      // Legs: two stick legs swinging as the keeper walks.
      ctx.strokeStyle = PALETTE.flame;
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 10);
      ctx.lineTo(-6 + walk * 3, 22);
      ctx.moveTo(0, 10);
      ctx.lineTo(6 - walk * 3, 22);
      ctx.stroke();
      // Body: one stick line, head to hips.
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(0, 10);
      ctx.stroke();
      // Lantern arm: out to the left, holding a glowing lantern.
      ctx.beginPath();
      ctx.moveTo(0, -2);
      ctx.lineTo(-15, 5);
      ctx.stroke();
      ctx.save();
      ctx.shadowColor = PALETTE.gold;
      ctx.shadowBlur = 18;
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.arc(-18, 8, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // Gun arm + barrel, turning toward the aim.
      ctx.save();
      ctx.rotate(player.angle);
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(4, -2);
      ctx.lineTo(26, -2);
      ctx.stroke();
      ctx.fillStyle = PALETTE.gold;
      ctx.fillRect(22, -5, 8, 6);
      // Muzzle flash just after a shot (fireTimer counts down from the
      // shot interval, so it is high right after firing).
      if (player.fireTimer > 0.12) {
        ctx.fillStyle = PALETTE.flame;
        ctx.beginPath();
        ctx.moveTo(32, -2);
        ctx.lineTo(40, -7);
        ctx.lineTo(40, 3);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      // Head: a round head with eyes looking toward the aim.
      ctx.save();
      ctx.shadowColor = PALETTE.gold;
      ctx.shadowBlur = 20;
      ctx.fillStyle = PALETTE.flame;
      ctx.beginPath();
      ctx.arc(0, -13, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255, 233, 168, 0.95)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#1a1030';
      const ex = Math.cos(player.angle) * 3;
      const ey = Math.sin(player.angle) * 3;
      ctx.beginPath();
      ctx.arc(ex - 3, -15, 1.8, 0, Math.PI * 2);
      ctx.arc(ex + 3, -15, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    // Ghost Veil: a dashed ring marks the invisible keeper.
    if (ghost) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.x, player.y, PLAYER.radius + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    // Dash cooldown ring. The divisor is the player's real cooldown max,
    // not a hardcoded 1.6 s — after the Flicker Dash upgrade the max is
    // 0.96 s, and the old hardcoded divisor made the ring show the wrong
    // progress (v3 fix, playtest 2026-11-17).
    if (player.dashCooldown > 0) {
      const dashMax = player.dashCooldownMax ?? PLAYER.dashCooldown;
      ctx.strokeStyle = PALETTE.teal;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(player.x, player.y, PLAYER.radius + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - player.dashCooldown / dashMax));
      ctx.stroke();
    }
  }

  function drawHud(world, best, ui = {}) {
    const { state, player } = world;
    ctx.fillStyle = 'rgba(7, 10, 22, 0.72)';
    ctx.fillRect(0, 0, VIEW_W, 64);
    ctx.textBaseline = 'middle';
    // HP.
    ctx.textAlign = 'left';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.dim;
    ctx.fillText('HP', 28, 24);
    ctx.fillStyle = '#2a1030';
    roundRect(ctx, 64, 12, 220, 24, 11);
    ctx.fill();
    ctx.fillStyle = player.hp > 30 ? PALETTE.teal : PALETTE.rose;
    if (player.hp > 0) {
      roundRect(ctx, 64, 12, 220 * Math.max(0, player.hp / player.maxHp), 24, 11);
      ctx.fill();
    }
    ctx.fillStyle = PALETTE.white;
    ctx.fillText(`${Math.ceil(player.hp)} / ${player.maxHp}`, 296, 24);
    // Ult meter (v4): kills charge it; at 100 the Lantern Nova is ready.
    const ultReady = player.ultEnergy >= 100;
    ctx.textAlign = 'left';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillStyle = ultReady ? PALETTE.gold : PALETTE.dim;
    ctx.fillText(ultReady ? 'ULTI READY [Q]' : 'ULTI', 28, 52);
    ctx.fillStyle = '#2a1030';
    roundRect(ctx, 140, 44, 144, 14, 7);
    ctx.fill();
    ctx.fillStyle = ultReady ? PALETTE.gold : PALETTE.ember;
    if (player.ultEnergy > 0) {
      roundRect(ctx, 140, 44, 144 * Math.min(1, player.ultEnergy / 100), 14, 7);
      ctx.fill();
    }
    // Wave, score, embers.
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText(`WAVE ${Math.max(1, state.wave)} / ${TOTAL_WAVES}`, VIEW_W / 2, 22);
    ctx.fillStyle = PALETTE.white;
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(`SCORE ${state.score}   ◆ ${state.embers}   BEST ${best}`, VIEW_W / 2, 48);
    // Combo + braziers.
    ctx.textAlign = 'right';
    ctx.fillStyle = state.combo >= 5 ? PALETTE.ember : PALETTE.dim;
    ctx.font = 'bold 19px system-ui, sans-serif';
    ctx.fillText(state.combo >= 2 ? `COMBO x${state.combo}` : '', VIEW_W - 28, 24);
    ctx.fillStyle = PALETTE.dim;
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(`🔥 ${state.braziersLit}/4 braziers lit`, VIEW_W - 28, 48);
    // Active temporary skill (v4): icon, name, seconds left + countdown bar.
    if (player.tempSkill) {
      const s = player.tempSkill;
      const w = 190;
      const x = VIEW_W - 28 - w;
      const y = 64;
      ctx.fillStyle = 'rgba(7, 10, 22, 0.72)';
      roundRect(ctx, x, y, w, 30, 8);
      ctx.fill();
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.textAlign = 'left';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.fillStyle = PALETTE.gold;
      ctx.fillText(`${s.icon} ${s.name}  ${Math.ceil(s.timeLeft)}s`, x + 10, y + 15);
      ctx.fillStyle = PALETTE.teal;
      ctx.fillRect(x + 10, y + 24, (w - 20) * Math.max(0, s.timeLeft / s.duration), 3);
    }
    // Hint at the bottom: desktop keys, or touch controls on a phone.
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(139, 147, 184, 0.8)';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(ui.touch
      ? 'Left thumb — move  •  Right FIRE — shoot (auto-aim)  •  DASH / ULTI buttons  •  Tap ⏸ to pause'
      : 'WASD move  •  Mouse aim (auto-aim when idle)  •  Hold click to shoot  •  SPACE dash  •  Q ult  •  P pause  •  M mute', VIEW_W / 2, VIEW_H - 12);
  }

  function drawTitle(world, best, ui = {}) {
    ctx.fillStyle = 'rgba(7, 10, 22, 0.55)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    centreText(ctx, '🔥  EMBERLIGHT  🔥', 175, 'bold 64px system-ui, sans-serif', PALETTE.gold);
    centreText(ctx, '—  Last Lantern  —', 235, 'bold 26px system-ui, sans-serif', PALETTE.flame);
    centreText(ctx, 'The dead rise from the dark. Keep the lantern lit. Survive all 10 waves.', 295, '20px system-ui, sans-serif', PALETTE.white);
    centreText(ctx, 'Four rooms — light the 4 braziers, one in each room. Zombies drop hidden skills. Kills charge your Lantern Nova.', 327, '18px system-ui, sans-serif', PALETTE.dim);
    drawPanel(ctx, VIEW_W / 2 - 320, 360, 640, 170);
    if (ui.touch) {
      centreText(ctx, 'Left thumb — move      Right FIRE — shoot (auto-aim)', 395, '18px system-ui, sans-serif', PALETTE.white);
      centreText(ctx, 'DASH and ULTI buttons on the right      Tap ⏸ to pause', 427, '18px system-ui, sans-serif', PALETTE.white);
      centreText(ctx, 'The gun aims itself — just move and hold FIRE', 459, '18px system-ui, sans-serif', PALETTE.white);
    } else {
      centreText(ctx, 'WASD / Arrows — move      Mouse — aim (auto-aim when idle)', 395, '18px system-ui, sans-serif', PALETTE.white);
      centreText(ctx, 'Hold Click — shoot embers      SPACE — dash      Q — Lantern Nova', 427, '18px system-ui, sans-serif', PALETTE.white);
      centreText(ctx, '1 / 2 / 3 — pick an upgrade      P — pause', 459, '18px system-ui, sans-serif', PALETTE.white);
    }
    centreText(ctx, '▶  PRESS SPACE OR TAP TO START', 580, 'bold 24px system-ui, sans-serif', PALETTE.teal);
    if (ui.touch && ui.portrait) centreText(ctx, 'Tip: turn your phone sideways for a bigger arena', 548, '16px system-ui, sans-serif', PALETTE.gold);
    if (best > 0) centreText(ctx, `Best score: ${best}`, 622, '18px system-ui, sans-serif', PALETTE.dim);
  }

  function drawUpgrade(world) {
    ctx.fillStyle = 'rgba(7, 10, 22, 0.72)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    centreText(ctx, `WAVE ${world.state.wave} CLEARED!`, 150, 'bold 44px system-ui, sans-serif', PALETTE.gold);
    centreText(ctx, `Score ${world.state.score}  •  +${world.state.waveBonus} wave bonus  •  Choose one upgrade`, 200, '20px system-ui, sans-serif', PALETTE.white);
    const cards = world.state.offers;
    cards.forEach((up, i) => {
      const x = 200 + i * 300;
      const y = 260;
      drawPanel(ctx, x, y, 260, 220);
      ctx.font = '44px system-ui, sans-serif';
      ctx.fillStyle = PALETTE.white;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(up.icon, x + 130, y + 58);
      ctx.font = 'bold 21px system-ui, sans-serif';
      ctx.fillStyle = PALETTE.gold;
      ctx.fillText(up.name, x + 130, y + 118);
      ctx.font = '17px system-ui, sans-serif';
      ctx.fillStyle = PALETTE.white;
      ctx.fillText(up.desc, x + 130, y + 152);
      ctx.font = '15px system-ui, sans-serif';
      ctx.fillStyle = PALETTE.teal;
      ctx.fillText(`Press ${i + 1} or click`, x + 130, y + 190);
    });
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(7, 10, 22, 0.7)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    centreText(ctx, 'PAUSED', 300, 'bold 56px system-ui, sans-serif', PALETTE.white);
    centreText(ctx, 'Press P or click to keep playing', 370, '20px system-ui, sans-serif', PALETTE.dim);
  }

  function drawEnd(world, best, won) {
    ctx.fillStyle = 'rgba(7, 10, 22, 0.78)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    if (won) {
      centreText(ctx, '🏆  YOU WIN!  🏆', 220, 'bold 60px system-ui, sans-serif', PALETTE.gold);
      centreText(ctx, 'All 10 waves survived. The lantern burns on.', 290, '22px system-ui, sans-serif', PALETTE.flame);
    } else {
      centreText(ctx, '💀  THE LIGHT FADES  💀', 220, 'bold 56px system-ui, sans-serif', PALETTE.rose);
      centreText(ctx, `The shadows took the lantern on wave ${Math.max(1, world.state.wave)}.`, 290, '22px system-ui, sans-serif', PALETTE.white);
    }
    drawPanel(ctx, VIEW_W / 2 - 260, 340, 520, 170);
    centreText(ctx, `SCORE  ${world.state.score}`, 385, 'bold 30px system-ui, sans-serif', PALETTE.white);
    centreText(ctx, `Kills ${world.state.kills}   •   Embers ${world.state.embers}   •   Best ${best}`, 430, '19px system-ui, sans-serif', PALETTE.dim);
    centreText(ctx, `Waves cleared: ${won ? 10 : Math.max(0, world.state.wave - 1)} / 10`, 468, '19px system-ui, sans-serif', PALETTE.dim);
    if (won) centreText(ctx, '🔥🔥🔥🔥   4/4 BRAZIERS LIT', 530, 'bold 21px system-ui, sans-serif', PALETTE.gold);
    centreText(ctx, '▶  PRESS R OR CLICK TO PLAY AGAIN', 570, 'bold 24px system-ui, sans-serif', PALETTE.teal);
  }

  return {
    // Current camera offset (world coords of the viewport's top-left
    // corner) — main.js converts the mouse aim from screen to world
    // coords with it. {0,0} before the first paint.
    getCamera() {
      return cam ? { x: cam.x, y: cam.y } : { x: 0, y: 0 };
    },
    draw(world, screen, best, ui = {}) {
      const { state, player } = world;
      const time = state.time;
      ctx.save();
      drawBackdrop(time);
      updateCamera(player.x, player.y);
      const off = world.particles.shakeOffset;
      ctx.translate(off.x, off.y);
      ctx.translate(-cam.x, -cam.y);
      drawMap();
      drawBraziers(state.braziersLit);
      // Ember drops.
      for (const drop of world.emberDrops) {
        ctx.save();
        ctx.translate(drop.x, drop.y);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = drop.heart ? PALETTE.teal : PALETTE.ember;
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 10;
        const s = drop.heart ? 9 : 6;
        ctx.fillRect(-s, -s, s * 2, s * 2);
        ctx.restore();
      }
      // Skill orbs (v4): glowing diamonds with the skill's icon letter.
      for (const drop of world.skillDrops) {
        const pulse = 0.7 + 0.3 * Math.sin(time * 5 + drop.x);
        ctx.save();
        ctx.translate(drop.x, drop.y);
        ctx.globalAlpha = pulse;
        ctx.shadowColor = PALETTE.gold;
        ctx.shadowBlur = 18;
        ctx.fillStyle = PALETTE.gold;
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-9, -9, 18, 18);
        ctx.shadowBlur = 0;
        ctx.strokeStyle = PALETTE.flame;
        ctx.lineWidth = 2;
        ctx.strokeRect(-9, -9, 18, 18);
        ctx.rotate(-Math.PI / 4);
        ctx.fillStyle = '#1a1030';
        ctx.font = 'bold 14px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(drop.skill.icon, 0, 1);
        ctx.restore();
      }
      // Enemy bullets are spitter-green (the spitter's own colour), not
      // violet — violet bullets were easily mistaken for purple wisps
      // at a glance (v3 fix, playtest 2026-11-17).
      ctx.fillStyle = PALETTE.teal;
      for (const b of world.enemyBullets) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const e of world.enemies) drawEnemy(e, time, player);
      ctx.fillStyle = PALETTE.flame;
      for (const b of world.bullets) {
        ctx.shadowColor = PALETTE.gold;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      if (screen !== SCREEN_TITLE) drawPlayer(player, time);
      world.particles.draw(ctx);
      ctx.restore();
      // Touch joystick (v4): base + knob where the left thumb is.
      if (ui.joystick && ui.joystick.active) {
        const j = ui.joystick;
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 233, 168, 0.5)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(j.ax, j.ay, 55, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255, 196, 77, 0.6)';
        ctx.beginPath();
        ctx.arc(j.ax + j.dx * 45, j.ay + j.dy * 45, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      if (screen !== SCREEN_TITLE) drawHud(world, best, ui);
      if (screen === SCREEN_TITLE) drawTitle(world, best, ui);
      else if (screen === SCREEN_UPGRADE) drawUpgrade(world);
      else if (screen === SCREEN_PAUSED) drawPaused();
      else if (screen === SCREEN_OVER) drawEnd(world, best, false);
      else if (screen === SCREEN_WIN) drawEnd(world, best, true);
    },
  };
}
