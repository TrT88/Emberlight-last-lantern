// Deterministic screenshot staging: ?shot=start|play|upgrade|win|end&seed=N
// paints one fixed scene (no loop) and sets window.__shotReady, so the
// screenshots are real renders of this game's own code, reproducible.
import { TEMP_SKILLS } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE, SCREEN_WIN } from './render.js';

export function stageShot(name, world) {
  world.reset();
  if (name === 'start') {
    // Title over a calm arena: a few wisps drifting, braziers unlit.
    world.startWave(1);
    for (let i = 0; i < 150; i += 1) world.step(1 / 60, { x: 0, y: 0 }, { x: 640, y: 200 }, false, false);
    return { screen: SCREEN_TITLE, best: 1250 };
  }
  if (name === 'play') {
    // Mid-wave-7 chaos (v5, 2026-11-17): wave 7 now has 55 enemies
    // (27 wisps, 17 darts, 5 brutes, 6 spitters) across 4 rooms, and the
    // player kites inside room 0 (top-left), so the frozen frame shows
    // the room, its obstacles, the doorway gold, and the crowd pressing
    // in — the keeper orbits the room centre on a 180 px ring.
    world.startWave(7);
    // Orbit room 0's centre (v5): the old arena-centre orbit would drag
    // the keeper through the divider walls. Orbiting inside one room
    // keeps the keeper mid-room with zombies closing in from all sides,
    // so the frozen frame reads as a fight, not a corner.
    const CX = 432;
    const CY = 318;
    const kite = (i, firing) => {
      let nearest = null;
      let nearestD = Infinity;
      for (const enemy of world.enemies) {
        const d = (enemy.x - world.player.x) ** 2 + (enemy.y - world.player.y) ** 2;
        if (d < nearestD) { nearestD = d; nearest = enemy; }
      }
      const px = world.player.x - CX;
      const py = world.player.y - CY;
      const d = Math.hypot(px, py) || 1;
      // Tangent (orbit) + radial correction toward a 180 px ring.
      let mx = -py / d + ((180 - d) / 180) * (px / d);
      let my = px / d + ((180 - d) / 180) * (py / d);
      const len = Math.hypot(mx, my) || 1;
      const move = { x: mx / len, y: my / len };
      const aim = nearest ? { x: nearest.x, y: nearest.y } : { x: 900, y: 250 };
      world.step(1 / 60, move, aim, firing, false);
    };
    // Phase 1: spawn the whole wave fast (one per step) while kiting
    // without firing, so enemies accumulate instead of being shot down
    // one by one as they trickle in. 240 steps = 4 s.
    for (let i = 0; i < 240; i += 1) {
      world.state.spawnTimer = 0;
      kite(i, false);
    }
    // Phase 2: 30 steps of firing while kiting, so bolts, particles and
    // enemy bullets are in flight for the frozen frame. Kept short: a
    // longer volley lets the pack pile onto the keeper and buries the
    // stick figure under the zombies in the frozen frame.
    for (let i = 0; i < 30; i += 1) kite(240 + i, true);
    // Freeze mid-volley: three real bolts in flight toward the nearest
    // enemy, so the frozen frame reads as action, not a pause between shots.
    // Two staging details, found by looking at the first v3 capture:
    // - Clear the keeper's invulnerability blink, or the freeze can land
    //   on a blink frame and the player is invisible in the screenshot.
    // - Set braziersLit to 2: a player actually on wave 7 has cleared
    //   wave 6, which lights the second brazier (staging resets it to 0).
    world.player.invuln = 0;
    world.state.braziersLit = 2;
    // Zombies have no separation, so the pack converges onto the keeper
    // and hides the stick figure. Push any zombie inside 56 px of the
    // keeper back out to 56 px, so the hero reads in the frozen frame.
    for (const enemy of world.enemies) {
      const dx = enemy.x - world.player.x;
      const dy = enemy.y - world.player.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 56) {
        enemy.x = world.player.x + (dx / d) * 56;
        enemy.y = world.player.y + (dy / d) * 56;
      }
    }
    {
      const p = world.player;
      let aim = { x: 900, y: 250 };
      let nearest = Infinity;
      for (const enemy of world.enemies) {
        const d = (enemy.x - p.x) ** 2 + (enemy.y - p.y) ** 2;
        if (d < nearest) {
          nearest = d;
          aim = { x: enemy.x, y: enemy.y };
        }
      }
      const base = Math.atan2(aim.y - p.y, aim.x - p.x);
      for (const off of [-0.14, 0, 0.14]) {
        world.bullets.push({
          x: p.x + Math.cos(base + off) * 90,
          y: p.y + Math.sin(base + off) * 90,
          vx: Math.cos(base + off) * 640,
          vy: Math.sin(base + off) * 640,
          damage: p.damage, pierce: p.pierce, life: 1.0,
        });
      }
    }
    // HUD numbers are illustrative (as in v1/v2): the scene itself is real
    // game state, but a player reaching wave 7 would carry score from the
    // earlier waves, which this staging does not play through.
    world.state.score = 5200;
    world.state.embers = 41;
    world.state.combo = 6;
    world.state.kills = 98;
    // v4 systems, visible in the play shot: the ult meter nearly full,
    // a Ghost Veil skill active (the HUD chip + countdown), and a skill
    // orb lying on the ground near the keeper.
    world.player.ultEnergy = 82;
    const ghost = TEMP_SKILLS.find((s) => s.id === 'ghost');
    world.player.tempSkill = { ...ghost, timeLeft: 8 };
    const rapid = TEMP_SKILLS.find((s) => s.id === 'rapid');
    world.skillDrops.push(
      { x: world.player.x + 90, y: world.player.y - 70, vx: 0, vy: 0, skill: rapid },
      { x: world.player.x - 110, y: world.player.y + 60, vx: 0, vy: 0, skill: ghost },
    );
    return { screen: SCREEN_PLAY, best: 6100 };
  }
  if (name === 'upgrade') {
    world.startWave(2);
    for (let i = 0; i < 30; i += 1) {
      world.step(1 / 60, { x: 0, y: 0 }, { x: 640, y: 300 }, true, false);
    }
    world.state.score = 1250;
    world.state.embers = 18;
    world.state.wave = 2;
    world.state.waveBonus = 200;
    world.offerUpgrades();
    return { screen: SCREEN_UPGRADE, best: 1250 };
  }
  if (name === 'win') {
    world.state.wave = 10;
    world.state.score = 18420;
    world.state.embers = 212;
    world.state.kills = 318;
    world.state.braziersLit = 4;
    world.player.ultEnergy = 100;
    // Celebration embers scattered around the keeper's spawn room, so
    // the win screen is not an empty dark field behind the panel (static:
    // the shot painter never steps the world, so these never move).
    for (let i = 0; i < 14; i += 1) {
      const a = (i / 14) * Math.PI * 2;
      world.emberDrops.push({
        x: 330 + Math.cos(a) * (100 + (i % 3) * 70),
        y: 762 + Math.sin(a) * (60 + (i % 2) * 60),
        vx: 0, vy: 0, value: 1, heart: i % 5 === 0,
      });
    }
    return { screen: SCREEN_WIN, best: 18420 };
  }
  // end: game over on wave 6.
  world.player.hp = 0;
  world.state.wave = 6;
  world.state.score = 6420;
  world.state.embers = 86;
  world.state.kills = 127;
  world.state.braziersLit = 2;
  return { screen: SCREEN_OVER, best: 9100 };
}
