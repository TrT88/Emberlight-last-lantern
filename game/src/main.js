// EMBERLIGHT boot and the one loop: input every frame, the world advances in
// fixed 1/60 s steps, the renderer paints what is there. Screens: title,
// play, upgrade (between waves), paused, game over, win.
// ?seed=N fixes the waves. ?shot=start|play|upgrade|win|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_OVER, EVENT_ULT, EVENT_WAVE_CLEAR, EVENT_WIN } from './world.js';
import {
  ACTION_CONFIRM, ACTION_DASH, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART,
  ACTION_ULT, ACTION_UPGRADE_1, ACTION_UPGRADE_2, ACTION_UPGRADE_3, createInput,
} from './input.js';
import { createAudio } from './audio.js';
import {
  SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE, SCREEN_WIN,
  createRenderer,
} from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();
const world = createWorld(createRandom(seed), audio);
const renderer = createRenderer(canvas);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off: the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let dashQueued = false;
  let ultQueued = false;

  // Debug hook for the playtest scripts (no gameplay effect): lets a
  // test page read the world state (room, enemies, HP) instead of
  // guessing from pixels.
  window.__emberlight = {
    get world() { return world; },
    get screen() { return screen; },
  };

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    world.startWave(1);
    screen = SCREEN_PLAY;
    audio.unlock();
    audio.startMusic();
    announce('Playing. Survive wave 1.');
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    audio.stopMusic();
    if (won) audio.win();
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(won
      ? `You win! Score ${world.state.score}. Best ${best}.`
      : `Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function pickUpgrade(index) {
    const offers = world.state.offers;
    if (!offers || !offers[index]) return;
    world.applyUpgrade(offers[index].id);
    world.state.offers = [];
    world.startWave(world.state.wave + 1);
    screen = SCREEN_PLAY;
    announce(`Wave ${world.state.wave}. Upgrade: ${offers[index].name}.`);
  }

  // Click on an upgrade card (cards are 260x220 at x=200+i*300, y=260).
  function clickUpgrade(click) {
    if (!click || screen !== SCREEN_UPGRADE) return false;
    for (let i = 0; i < 3; i += 1) {
      const x = 200 + i * 300;
      if (click.x >= x && click.x <= x + 260 && click.y >= 260 && click.y <= 480) {
        pickUpgrade(i);
        return true;
      }
    }
    return false;
  }

  function handleActions() {
    const { actions, click } = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_DASH) dashQueued = true;
    if (actions & ACTION_ULT) ultQueued = true;
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startGame();
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      }
    } else if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    } else if (screen === SCREEN_UPGRADE) {
      if (actions & ACTION_UPGRADE_1) pickUpgrade(0);
      else if (actions & ACTION_UPGRADE_2) pickUpgrade(1);
      else if (actions & ACTION_UPGRADE_3) pickUpgrade(2);
      else clickUpgrade(click);
    } else if (screen === SCREEN_OVER || screen === SCREEN_WIN) {
      if (actions & (ACTION_RESTART | ACTION_CONFIRM)) startGame();
    }
    if (actions & ACTION_CONFIRM) audio.unlock();
  }

  function stepGame() {
    const move = input.moveVector();
    if (input.dashHeld()) dashQueued = true;
    // Auto-aim (v4): always on for touch (the player only moves + fires);
    // on desktop the mouse still aims while it moves, and the gun takes
    // over only after 1.5 s without mouse movement.
    // v5: the mouse aim is in screen coords — the camera offset turns it
    // into world coords before the world steps.
    const autoAim = input.isTouch || input.mouseIdleFor() > 1500;
    const cam = renderer.getCamera();
    const rawAim = input.aim();
    const aim = { x: rawAim.x + cam.x, y: rawAim.y + cam.y };
    const events = world.step(STEP, move, aim, input.firing, dashQueued, { autoAim, ult: ultQueued });
    dashQueued = false;
    ultQueued = false;
    if (events & EVENT_ULT) announce('Ember Nova!');
    if (events & EVENT_OVER) endGame(false);
    else if (events & EVENT_WIN) endGame(true);
    else if (events & EVENT_WAVE_CLEAR) {
      screen = SCREEN_UPGRADE;
      announce(`Wave ${world.state.wave} cleared. Choose an upgrade.`);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        stepGame();
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_TITLE) {
      // Idle drift behind the title: embers shimmer, nothing attacks.
      world.particles.step(STEP);
      accumulator = 0;
    } else {
      accumulator = 0;
    }
    // Reduced motion: no screen shake (particles still draw, shake stays 0).
    if (reducedMotion) world.particles.addShake(0);
    // The HUD's BEST is live: max(stored best, current score). Before,
    // it showed the stored best only, so a player beating their best
    // mid-run still saw "BEST 0" (v3 fix, playtest 2026-11-17). The stored
    // best itself is still only saved when the run ends (endGame).
    // The ULTI button flashes when the meter is full (touch only).
    input.setUltReady(world.player.ultEnergy >= 100);
    renderer.draw(world, screen, Math.max(best, world.state.score), { touch: input.isTouch, joystick: input.joystick, portrait: window.innerHeight > window.innerWidth });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Emberlight, Last Lantern. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
