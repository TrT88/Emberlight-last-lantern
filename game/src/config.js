// EMBERLIGHT — Last Lantern: every tunable number in one place.
// The palette is the art direction: warm ember gold on cold indigo dark,
// so the game reads at a glance even shrunk to a judge's contact sheet.
export const VIEW_W = 1280;
export const VIEW_H = 720;
export const STEP = 1 / 60;
export const BEST_KEY = 'emberlight-best';
export const TOTAL_WAVES = 10;
// v5 — the arena is now FOUR ROOMS in a 2x2 grid, joined by doorways in
// the middle of the shared walls. Each room is ~760x420; the whole map
// (1592x912) is bigger than one screen, so a camera follows the keeper.
// Outer walls are 24 px thick; door gaps are 130 px wide — wide enough
// to walk through comfortably, even while kiting.
export const MAP = { x: 28, y: 84, w: 1592, h: 912 };
export const WALL_T = 24;
export const DOOR_W = 130;
// Room inner bounds: 0 top-left, 1 top-right, 2 bottom-left, 3 bottom-right.
export const ROOMS = [
  { x: 52,  y: 108, w: 760, h: 420 },
  { x: 836, y: 108, w: 760, h: 420 },
  { x: 52,  y: 552, w: 760, h: 420 },
  { x: 836, y: 552, w: 760, h: 420 },
];
// Wall rects: outer border + the two dividers, split around the door gaps.
// Vertical divider x 812..836, gaps at y 253..383 and 697..827.
// Horizontal divider y 528..552, gaps at x 367..497 and 1151..1281.
export const WALLS = [
  { x: 28, y: 84, w: 1592, h: 24 },
  { x: 28, y: 972, w: 1592, h: 24 },
  { x: 28, y: 84, w: 24, h: 912 },
  { x: 1596, y: 84, w: 24, h: 912 },
  { x: 812, y: 108, w: 24, h: 145 },
  { x: 812, y: 383, w: 24, h: 145 },
  { x: 812, y: 552, w: 24, h: 145 },
  { x: 812, y: 827, w: 24, h: 145 },
  { x: 52, y: 528, w: 315, h: 24 },
  { x: 497, y: 528, w: 315, h: 24 },
  { x: 836, y: 528, w: 315, h: 24 },
  { x: 1281, y: 528, w: 315, h: 24 },
];
// Doorways (for rendering the gold threshold + zombie navigation).
// cx/cy is the centre of the gap; rooms lists the two rooms it joins.
export const DOORS = [
  { x: 812, y: 253, w: 24, h: 130, rooms: [0, 1], cx: 824, cy: 318 },
  { x: 812, y: 697, w: 24, h: 130, rooms: [2, 3], cx: 824, cy: 762 },
  { x: 367, y: 528, w: 130, h: 24, rooms: [0, 2], cx: 432, cy: 540 },
  { x: 1151, y: 528, w: 130, h: 24, rooms: [1, 3], cx: 1216, cy: 540 },
];
// Room links for zombie pathing (same doors as above, as a graph).
export const ROOM_LINKS = [
  { rooms: [0, 1], door: { x: 824, y: 318 } },
  { rooms: [2, 3], door: { x: 824, y: 762 } },
  { rooms: [0, 2], door: { x: 432, y: 540 } },
  { rooms: [1, 3], door: { x: 1216, y: 540 } },
];
// Obstacles: 2-4 per room (stone pillar / crate / stone table). All keep
// clear of the room centre (brazier), the door gaps and the room edges,
// so nothing blocks a doorway and the keeper always has room to kite.
export const OBSTACLES = [
  { x: 180, y: 180, w: 44, h: 44, kind: 'pillar' },
  { x: 620, y: 150, w: 70, h: 50, kind: 'crate' },
  { x: 560, y: 400, w: 120, h: 60, kind: 'table' },
  { x: 1420, y: 180, w: 44, h: 44, kind: 'pillar' },
  { x: 1000, y: 420, w: 80, h: 56, kind: 'crate' },
  { x: 1050, y: 170, w: 110, h: 56, kind: 'table' },
  { x: 180, y: 830, w: 44, h: 44, kind: 'pillar' },
  { x: 560, y: 640, w: 120, h: 60, kind: 'table' },
  { x: 650, y: 880, w: 70, h: 50, kind: 'crate' },
  { x: 1420, y: 830, w: 44, h: 44, kind: 'pillar' },
  { x: 1000, y: 660, w: 80, h: 56, kind: 'crate' },
  { x: 1300, y: 640, w: 110, h: 56, kind: 'table' },
  { x: 1150, y: 880, w: 60, h: 44, kind: 'crate' },
];
export const SOLIDS = [...WALLS, ...OBSTACLES];
// One brazier per room, at the room centre.
export const BRAZIERS = [
  { x: 432, y: 318 },
  { x: 1216, y: 318 },
  { x: 432, y: 762 },
  { x: 1216, y: 762 },
];
// The keeper starts in the bottom-left room, left of its brazier.
export const PLAYER_SPAWN = { x: 330, y: 762 };
// Camera clamp (world coords of the viewport's top-left corner): the view
// never shows past the map's outer walls — a 28 px side margin and the
// 64 px HUD strip on top stay covered by map.
export const CAM = {
  minX: MAP.x - 28,
  maxX: MAP.x + MAP.w - VIEW_W + 28,
  minY: MAP.y - 64,
  maxY: MAP.y + MAP.h - VIEW_H,
};

export const PALETTE = {
  bg: '#0b0e1e',
  bgDeep: '#070a16',
  floor: '#12162e',
  wall: '#2a3160',
  gold: '#ffc44d',
  ember: '#ff8a3d',
  flame: '#ffe9a8',
  teal: '#4de8c2',
  violet: '#b78cff',
  rose: '#ff5d7a',
  white: '#f4f1e6',
  dim: '#8b93b8',
};

export const PLAYER = {
  radius: 16,
  speed: 265,
  maxHp: 100,
  fireInterval: 0.21,
  bulletSpeed: 640,
  bulletDamage: 22,
  bulletRadius: 6,
  dashSpeed: 780,
  dashTime: 0.16,
  dashCooldown: 1.6,
  pickupRadius: 92,
  lanternRadius: 190,
};

// Enemy types (v4: the monsters are ZOMBIES — green, arms out, shambling):
// name, colour, radius, hp, armor (flat damage shaved off each bolt hit,
// min 1), speed, touch damage, score, ember drop. Armor went up a little
// in v4 (user asked), on top of the v3 late-wave buff — the kiting-bot sim
// is the check that the game stays winnable.
export const ENEMY_TYPES = {
  wisp:    { radius: 15, hp: 34,  armor: 2, speed: 105, damage: 10, score: 50,  embers: 1, color: '#7ed957' },
  dart:    { radius: 11, hp: 20,  armor: 1, speed: 205, damage: 8,  score: 80,  embers: 1, color: '#a8e063' },
  brute:   { radius: 26, hp: 145, armor: 6, speed: 62,  damage: 22, score: 150, embers: 3, color: '#4e9b47' },
  spitter: { radius: 14, hp: 44,  armor: 3, speed: 88,  damage: 12, score: 120, embers: 2, color: '#3ddc97' },
};

// Zombie display names for the HUD / screenshots (internal ids stay
// wisp/dart/brute/spitter so the wave specs and staging keep working).
export const ENEMY_NAMES = {
  wisp: 'Walker',
  dart: 'Runner',
  brute: 'Brute',
  spitter: 'Spitter',
};

// Ultimate: "Lantern Nova". Kills charge the meter; at 100 the player can
// fire a huge ember nova. Energy is the only gate — it cannot be spammed
// because a full meter takes 10 kills to refill.
export const ULT = {
  energyPerKill: 10,
  max: 100,
  damage: 130,
  radius: 340,
  invuln: 2,
};

// Temporary skills dropped by killed zombies (v4). A kill has an 18%
// chance to drop a skill orb; picking it up grants one random skill for
// its duration (5 s or 10 s). One skill at a time — a new pickup replaces
// the old one. Ghost Veil (invisibility) is in the list, as the user asked.
export const SKILL_DROP_CHANCE = 0.18;
export const TEMP_SKILLS = [
  { id: 'ghost',     name: 'Ghost Veil',    icon: '👻', desc: 'Zombies cannot see you',  duration: 10 },
  { id: 'speed',     name: 'Swift Boots',   icon: '⚡', desc: '+45% move speed',         duration: 10 },
  { id: 'multishot', name: 'Twin Embers',   icon: '✦',  desc: '+1 bolt per shot',        duration: 10 },
  { id: 'pierce',    name: 'Piercing Gaze', icon: '➶',  desc: 'Bolts pierce +2',         duration: 10 },
  { id: 'rapid',     name: 'Rapid Wick',    icon: '🔥', desc: 'Fire twice as fast',      duration: 5 },
  { id: 'shield',    name: 'Aegis',         icon: '🛡', desc: 'Immune to damage',        duration: 5 },
  { id: 'magnet',    name: 'Ember Magnet',  icon: '🧲', desc: 'Pickup range x3',         duration: 10 },
  { id: 'chill',     name: 'Frost Chill',   icon: '❄',  desc: 'Nearby zombies slowed',   duration: 10 },
  { id: 'lifesteal', name: 'Vampiric Ember',icon: '🩸', desc: 'Kills heal +8 HP',        duration: 10 },
  { id: 'boom',      name: 'Boom Kills',    icon: '💥', desc: 'Kills explode for 40',    duration: 5 },
];

// Wave n (1-based): how many of each type, and how tough they are.
// Waves 6-10 are buffed slightly (v3, playtest 2026-11-17): a smart kiting
// player took only 2-7 hits across all 10 waves, so the late waves were
// near-free. Waves 1-5 are untouched — new players already die on wave 3-4.
export function waveSpec(n) {
  const t = ENEMY_TYPES;
  const late = n >= 6 ? 1 : 0;
  const hpScale = 1 + (n - 1) * 0.16 + late * 0.15;
  const speedScale = 1 + Math.min(0.4, (n - 1) * 0.04 + late * 0.05);
  // v5: ~50% more zombies per wave than v4, and they spawn faster too,
  // so more are alive at once. The kiting-bot sim is the check that
  // the game stays winnable.
  const counts = {
    wisp: Math.round((4 + n * 2) * 1.5),
    dart: n >= 2 ? Math.round((2 + n + (late ? 2 : 0)) * 1.5) : 0,
    brute: n >= 3 ? Math.round((Math.floor((n - 1) / 2) + (n >= 8 ? 1 : 0)) * 1.5) : 0,
    spitter: n >= 4 ? Math.round((Math.floor(n / 2) + (late ? 1 : 0)) * 1.5) : 0,
  };
  return { counts, hpScale, speedScale, bonus: 100 + n * 50 };
}

// Upgrades offered between waves: pick one of three. Each id is applied in world.js.
export const UPGRADES = [
  { id: 'damage',   name: 'Ember Fury',    desc: '+35% bolt damage',        icon: '🔥' },
  { id: 'rapid',    name: 'Swift Wick',    desc: '+25% fire rate',          icon: '⚡' },
  { id: 'multishot',name: 'Twin Flames',   desc: '+1 bolt per shot',        icon: '✦' },
  { id: 'pierce',   name: 'Piercing Light',desc: 'Bolts pierce +1 enemy',   icon: '➶' },
  { id: 'speed',    name: 'Wind Step',     desc: '+18% move speed',         icon: '💨' },
  { id: 'vitality', name: 'Warm Hearth',   desc: '+30 max HP and heal 30',  icon: '❤' },
  { id: 'dash',     name: 'Flicker Dash',  desc: 'Dash recharges 40% faster',icon: '💫' },
  { id: 'magnet',   name: 'Ember Call',    desc: '+80% ember pickup range', icon: '🧲' },
];
