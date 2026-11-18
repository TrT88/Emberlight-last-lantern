// Keyboard + mouse input, read once per frame. Actions are edge-triggered
// (a key press counts once), movement is level-triggered (held keys count).
//
// v4 — device-adaptive controls (the user's iPhone complaint: move and fire
// shared one side, unplayable). Two layouts, one API:
// - Desktop: WASD/arrows move, mouse aim, hold click to shoot, Space dash,
//   Q fires the ult. The mouse still wins the aim while it moves; when it
//   has been idle for 1.5 s the gun auto-aims (see mouseIdleFor).
// - Touch: LEFT half of the canvas is a virtual joystick (appears where the
//   thumb lands), RIGHT side has DOM buttons — big FIRE, DASH, ULTI, and a
//   small pause button. Move and fire never share a side. Auto-aim is
//   always on, so the player only moves + fires.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_RESTART = 8;
export const ACTION_UPGRADE_1 = 16;
export const ACTION_UPGRADE_2 = 32;
export const ACTION_UPGRADE_3 = 64;
export const ACTION_ULT = 128;
export const ACTION_DASH = 256;

const MOUSE_IDLE_MS = 1500;

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let mouseClicked = false;
  let lastMouseMove = 0;
  let touchMode = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  let fireHeld = false;
  let ultTap = false;
  let dashTap = false;
  let pauseTap = false;
  // Virtual joystick state (touch only), drawn by the renderer.
  const joystick = { active: false, id: null, ax: 0, ay: 0, dx: 0, dy: 0 };
  let fireTouchId = null;

  function toCanvas(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function setTouchMode() {
    if (touchMode) return;
    touchMode = true;
    document.body.classList.add('touch');
  }

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.key)) {
      event.preventDefault();
    }
    if (!event.repeat) pressed.add(event.key.toLowerCase());
    keys.add(event.key.toLowerCase());
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.key.toLowerCase());
  });
  canvas.addEventListener('mousemove', (event) => {
    const p = toCanvas(event.clientX, event.clientY);
    mouseX = p.x;
    mouseY = p.y;
    lastMouseMove = performance.now();
  });
  canvas.addEventListener('mousedown', (event) => {
    const p = toCanvas(event.clientX, event.clientY);
    mouseX = p.x;
    mouseY = p.y;
    lastMouseMove = performance.now();
    mouseDown = true;
    mouseClicked = true;
  });
  window.addEventListener('mouseup', () => {
    mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  // --- Touch: left half = joystick, right half = fire (hold). ---
  canvas.addEventListener('touchstart', (event) => {
    event.preventDefault();
    setTouchMode();
    // Left 45% of the *canvas* is the joystick zone (v4: the canvas is
    // letterboxed on portrait phones, so the window's left 45% would
    // include the black bars). Right half of the canvas = hold to fire.
    const rect = canvas.getBoundingClientRect();
    for (const t of event.changedTouches) {
      const p = toCanvas(t.clientX, t.clientY);
      if (t.clientX < rect.left + rect.width * 0.45 && joystick.id === null) {
        joystick.active = true;
        joystick.id = t.identifier;
        joystick.ax = p.x;
        joystick.ay = p.y;
        joystick.dx = 0;
        joystick.dy = 0;
      } else if (fireTouchId === null) {
        fireTouchId = t.identifier;
        mouseX = p.x;
        mouseY = p.y;
        mouseClicked = true;
      }
    }
  }, { passive: false });
  canvas.addEventListener('touchmove', (event) => {
    event.preventDefault();
    for (const t of event.changedTouches) {
      const p = toCanvas(t.clientX, t.clientY);
      if (t.identifier === joystick.id) {
        let dx = (p.x - joystick.ax) / 55;
        let dy = (p.y - joystick.ay) / 55;
        const len = Math.hypot(dx, dy);
        if (len > 1) { dx /= len; dy /= len; }
        joystick.dx = dx;
        joystick.dy = dy;
      } else if (t.identifier === fireTouchId) {
        mouseX = p.x;
        mouseY = p.y;
      }
    }
  }, { passive: false });
  function endTouch(event) {
    for (const t of event.changedTouches) {
      if (t.identifier === joystick.id) {
        joystick.active = false;
        joystick.id = null;
        joystick.dx = 0;
        joystick.dy = 0;
      }
      if (t.identifier === fireTouchId) fireTouchId = null;
    }
  }
  canvas.addEventListener('touchend', endTouch);
  canvas.addEventListener('touchcancel', endTouch);

  // --- DOM touch buttons (right side only). ---
  function bindButton(id, down, up) {
    const el = document.getElementById(id);
    if (!el) return;
    const start = (event) => {
      event.preventDefault();
      event.stopPropagation();
      setTouchMode();
      down();
    };
    const end = (event) => {
      event.preventDefault();
      if (up) up();
    };
    el.addEventListener('touchstart', start, { passive: false });
    el.addEventListener('touchend', end, { passive: false });
    el.addEventListener('touchcancel', end, { passive: false });
    el.addEventListener('mousedown', start);
    el.addEventListener('mouseup', end);
  }
  bindButton('btn-fire', () => { fireHeld = true; }, () => { fireHeld = false; });
  bindButton('btn-dash', () => { dashTap = true; });
  bindButton('btn-ulti', () => { ultTap = true; });
  bindButton('btn-pause', () => { pauseTap = true; });

  // The page starts in desktop mode; a touch device gets the touch UI
  // (buttons + joystick) as soon as it is detected.
  if (touchMode) document.body.classList.add('touch');

  return {
    get isTouch() {
      return touchMode;
    },
    get joystick() {
      return joystick;
    },
    // Milliseconds since the mouse last moved (desktop auto-aim gate).
    mouseIdleFor() {
      return performance.now() - lastMouseMove;
    },
    // Held movement direction, normalised, in canvas pixels.
    moveVector() {
      if (joystick.active && (joystick.dx !== 0 || joystick.dy !== 0)) {
        return { x: joystick.dx, y: joystick.dy };
      }
      let x = 0;
      let y = 0;
      if (keys.has('a') || keys.has('arrowleft')) x -= 1;
      if (keys.has('d') || keys.has('arrowright')) x += 1;
      if (keys.has('w') || keys.has('arrowup')) y -= 1;
      if (keys.has('s') || keys.has('arrowdown')) y += 1;
      if (x !== 0 && y !== 0) {
        const inv = 1 / Math.hypot(x, y);
        x *= inv;
        y *= inv;
      }
      return { x, y };
    },
    dashHeld() {
      return keys.has(' ') || keys.has('shift');
    },
    aim() {
      return { x: mouseX, y: mouseY };
    },
    get mouseDown() {
      return mouseDown;
    },
    // Hold-to-fire from any source: mouse, FIRE button, right-half touch.
    get firing() {
      return mouseDown || fireHeld || fireTouchId !== null;
    },
    // The ULTI button flashes when the meter is full (called each frame).
    setUltReady(ready) {
      const el = document.getElementById('btn-ulti');
      if (el) el.classList.toggle('ready', ready);
    },
    // One-shot actions since the last call; also consumes the click.
    takeActions() {
      let actions = 0;
      if (pressed.has(' ') || pressed.has('enter') || mouseClicked) actions |= ACTION_CONFIRM;
      if (pressed.has('p') || pressed.has('escape') || pauseTap) actions |= ACTION_PAUSE;
      if (pressed.has('m')) actions |= ACTION_MUTE;
      if (pressed.has('r')) actions |= ACTION_RESTART;
      if (pressed.has('1')) actions |= ACTION_UPGRADE_1;
      if (pressed.has('2')) actions |= ACTION_UPGRADE_2;
      if (pressed.has('3')) actions |= ACTION_UPGRADE_3;
      if (pressed.has('q') || ultTap) actions |= ACTION_ULT;
      if (dashTap) actions |= ACTION_DASH;
      pressed.clear();
      ultTap = false;
      dashTap = false;
      pauseTap = false;
      const click = mouseClicked ? { x: mouseX, y: mouseY } : null;
      mouseClicked = false;
      return { actions, click };
    },
  };
}
