// Dark Citadel — Turn-Based Roguelike RPG
// 10 floors, equipment-based speed system, Mother Bug boss on floor 10

import { renderPlant } from './plant-generator.js';
import { loadState, saveState } from './state.js';
import { potLevelFromExp, POT_LEVEL_THRESHOLDS } from './canvas-utils.js';

// ── Constants ──────────────────────────────────────────────────────
const W = 320;
const H = 320;
const CANVAS_SCALE = 2;
const CX = W / 2;
const CY = H / 2;

const RARITY_NAMES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];
const RARITY_WEIGHTS = [50, 30, 13, 6, 1];
const RARITY_COLORS = {
  Common: '#6b7b3a',
  Uncommon: '#2d8a4e',
  Rare: '#2d6fba',
  Epic: '#7b3fa0',
  Legendary: '#c49a1a',
};

// ── Equipment Data ─────────────────────────────────────────────────

const WEAPONS = [
  { name: 'Thorn Dagger',       dmg: 5,  speedMod: 5,  critBonus: 5,  rarity: 'Common' },
  { name: 'Vine Whip',          dmg: 8,  speedMod: 2,  critBonus: 3,  rarity: 'Common' },
  { name: 'Root Club',          dmg: 12, speedMod: -3, critBonus: 0,  rarity: 'Common' },
  { name: 'Petal Blade',        dmg: 10, speedMod: 3,  critBonus: 8,  rarity: 'Uncommon' },
  { name: 'Sap Rapier',         dmg: 8,  speedMod: 8,  critBonus: 12, rarity: 'Rare' },
  { name: 'Bramble Greatsword', dmg: 22, speedMod: -8, critBonus: 3,  rarity: 'Rare' },
  { name: 'Blossom Katana',     dmg: 15, speedMod: 6,  critBonus: 15, rarity: 'Epic' },
  { name: 'World Tree Branch',  dmg: 28, speedMod: -5, critBonus: 10, rarity: 'Legendary' },
];

const ARMORS = [
  { name: 'Leaf Wrappings',     def: 1,  speedMod: 3,  hpBonus: 0,  rarity: 'Common' },
  { name: 'Bark Vest',          def: 3,  speedMod: 0,  hpBonus: 5,  rarity: 'Common' },
  { name: 'Moss Mail',          def: 5,  speedMod: -3, hpBonus: 10, rarity: 'Uncommon' },
  { name: 'Root Plate',         def: 8,  speedMod: -6, hpBonus: 20, rarity: 'Rare' },
  { name: 'Windleaf Cloak',     def: 6,  speedMod: 8,  hpBonus: 15, rarity: 'Epic' },
  { name: 'Ironwood Armor',     def: 12, speedMod: -8, hpBonus: 30, rarity: 'Epic' },
  { name: 'Ancient Bark Plate', def: 15, speedMod: -5, hpBonus: 40, rarity: 'Legendary' },
];

// ── Enemy Data ─────────────────────────────────────────────────────

const ENEMY_TYPES = {
  aphid:      { name: 'Aphid',       hp: 8,   atk: 3,  armor: 0, floors: [1,4], abilities: [], color: '#5a8a30' },
  beetle:     { name: 'Beetle',      hp: 15,  atk: 5,  armor: 2, floors: [2,6], abilities: ['defend'], color: '#3a3a2a' },
  mosquito:   { name: 'Mosquito',    hp: 6,   atk: 4,  armor: 0, floors: [3,7], abilities: ['poison'], color: '#6a5a4a' },
  stag:       { name: 'Stag Beetle', hp: 25,  atk: 8,  armor: 4, floors: [4,8], abilities: ['charge'], color: '#2a2a1a' },
  centipede:  { name: 'Centipede',   hp: 20,  atk: 6,  armor: 0, floors: [5,9], abilities: ['multi'], color: '#8a4a2a' },
  mantis:     { name: 'Mantis',      hp: 18,  atk: 10, armor: 0, floors: [6,10], abilities: ['crit'], color: '#4a7a3a' },
  hornet:     { name: 'Hornet',      hp: 12,  atk: 7,  armor: 0, floors: [7,10], abilities: ['poison','slow'], color: '#8a8a20' },
  scarab:     { name: 'Scarab',      hp: 45,  atk: 12, armor: 6, floors: [5,5], abilities: ['summon','heal'], color: '#6a5a10', isBoss: true },
  motherbug:  { name: 'Mother Bug',  hp: 120, atk: 15, armor: 5, floors: [10,10], abilities: ['enrage'], color: '#3a0a2a', isBoss: true, actionsPerRound: 2 },
};

// ── Stat Upgrade Definitions ───────────────────────────────────────

const STAT_UPGRADES = [
  { key: 'bonusDamage',   name: 'Sharpened Edge',  desc: '+{v} bonus damage',
    values: { Common: 1, Uncommon: 2, Rare: 3, Epic: 5, Legendary: 8 } },
  { key: 'bonusSpeed',    name: 'Quick Steps',     desc: '+{v} speed',
    values: { Common: 2, Uncommon: 3, Rare: 5, Epic: 7, Legendary: 10 } },
  { key: 'bonusArmor',    name: 'Tough Bark',      desc: '+{v} armor',
    values: { Common: 1, Uncommon: 2, Rare: 3, Epic: 4, Legendary: 6 } },
  { key: 'bonusMaxHp',    name: 'Vital Roots',     desc: '+{v} max HP',
    values: { Common: 5, Uncommon: 10, Rare: 15, Epic: 25, Legendary: 40 } },
  { key: 'bonusCrit',     name: 'Keen Eye',         desc: '+{v}% crit chance',
    values: { Common: 3, Uncommon: 5, Rare: 8, Epic: 12, Legendary: 18 } },
  { key: 'bonusCritMult', name: 'Deadly Precision', desc: '+{v}% crit multiplier',
    values: { Common: 10, Uncommon: 15, Rare: 25, Epic: 35, Legendary: 50 } },
];

const ITEM_UPGRADES = [
  { key: 'healPotion', name: 'Healing Nectar',
    desc: { base: 'Heals 30% max HP', Legendary: 'Heals 50% max HP' },
    healPct: { base: 0.3, Legendary: 0.5 },
    uses: { Common: 1, Uncommon: 1, Rare: 2, Epic: 2, Legendary: 3 } },
  { key: 'bomb', name: 'Spore Bomb',
    desc: { base: 'Deals 20 dmg to all', Legendary: 'Deals 35 dmg to all' },
    bombDmg: { base: 20, Legendary: 35 },
    uses: { Common: 1, Uncommon: 1, Rare: 2, Epic: 2, Legendary: 3 } },
];

// ── Element Buffs ─────────────────────────────────────────────────
// Applied at run start based on selectedPlant.potElement
const ELEMENT_BUFFS = {
  fire:  { name: 'Flame Aura',   desc: '+5 DMG, +10% Crit',      bonusDamage: 5, bonusCrit: 10 },
  ice:   { name: 'Frost Shield', desc: '+10 DEF, +10 SPD',       bonusArmor: 10, bonusSpeed: 10 },
  earth: { name: 'Stone Root',   desc: '+25 Max HP, +10 DEF',    bonusMaxHp: 25, bonusArmor: 10 },
  wind:  { name: 'Gale Step',    desc: '+10 SPD, +10% Crit',     bonusSpeed: 10, bonusCrit: 10 },
};

// ── Module State ───────────────────────────────────────────────────
let canvas, ctx;
let rafId = null;
let running = false;
let onBackCallback = null;
let selectedPlant = null;
let plantSprite = null;

// Run state
let floor = 0;
let phase = 'plantPicker'; // plantPicker | pathSelect | combat | levelUp | reward | gameOver | victory | floorTransition | bossCinematic
let combatLog = [];
let combatLogScroll = 0;

// Player
let player = {
  maxHp: 50, hp: 50,
  baseSpeed: 15,
  bonusSpeed: 0, bonusDamage: 0, bonusArmor: 0, bonusMaxHp: 0,
  bonusCrit: 0, bonusCritMult: 0,
  weapon: null, armor: null,
  belt: [], // up to 4 items
  exp: 0, level: 1, expToNext: 10,
  defending: false,
  poison: 0, // poison stacks
  slowDebuff: 0,
};

// Enemies in current combat
let enemies = [];
let currentEnemyIndex = 0; // which enemy is acting
let enemyActionsLeft = 0;

// Combat state
let combatPhase = 'playerTurn'; // playerTurn | enemyTurn | won | lost
let playerActionsLeft = 0;
let playerMaxActions = 0;
let selectedAction = -1; // -1 = none, 0=attack, 1=defend, 2-5=belt items
let targetEnemy = 0;
let animating = false;
let animTimer = 0;
let animType = ''; // 'playerAttack', 'enemyAttack', 'heal', 'bomb', 'defend'
let animData = {};
let shakeTimer = 0;
let shakeTarget = ''; // 'player' or 'enemy'
let flashTimer = 0;
let flashTarget = '';

// Path selection
let paths = [];
let selectedPath = -1;
let pathHover = -1;
let completedPaths = []; // indices of completed paths on current floor
let fastMode = false;
let showStats = false;

// Level up
let upgradeCards = [];
let levelUpHover = -1;

// Loot cards (3 options to pick from)
let lootCards = [];
let lootHover = -1;
let lootMinRarity = 'Common';

// Turn queue display
let turnQueue = []; // array of { type: 'player'|'enemy', name: string }

// Floating damage numbers
let dmgPopups = []; // { x, y, text, color, size, timer, maxTimer }

// VFX particles
let vfxParticles = []; // { x, y, vx, vy, color, size, timer, maxTimer, type }
let slashEffect = null; // { x, y, timer, maxTimer, color, isCrit, angle }
let screenFlash = null; // { color, timer, maxTimer, alpha }
let shieldEffect = null; // { x, y, timer, maxTimer }

// Floor transition
let floorTransition = null; // { timer, maxTimer: 90, fromFloor, toFloor }

// Boss cinematic
let bossCinematic = null; // { timer, maxTimer: 270, phase }
let bossCinematicScale = 0;

function spawnDmgPopup(x, y, text, color, size) {
  const maxTimer = 50; // ~0.8s at 60fps
  dmgPopups.push({ x, y, text, color, size, timer: maxTimer, maxTimer });
}

function getEnemyScreenPos(index) {
  const enemyGap = Math.min(60, (W - 20) / Math.max(1, enemies.length));
  const startX = CX - (enemies.length - 1) * enemyGap / 2;
  return { x: startX + index * enemyGap, y: 55 };
}

// ── VFX System ────────────────────────────────────────────────────

function spawnVfx(x, y, vx, vy, color, size, duration, type) {
  vfxParticles.push({ x, y, vx, vy, color, size, timer: duration, maxTimer: duration, type: type || 'spark' });
}

function updateVfxParticles() {
  for (let i = vfxParticles.length - 1; i >= 0; i--) {
    const p = vfxParticles[i];
    p.timer--;
    p.x += p.vx;
    p.y += p.vy;
    if (p.type === 'spark') {
      p.vy += 0.06; // gravity
      p.vx *= 0.97;
    } else if (p.type === 'rise') {
      p.vx += (Math.random() - 0.5) * 0.1; // drift
    } else if (p.type === 'ember') {
      p.vx += (Math.random() - 0.5) * 0.08;
      p.vy -= 0.01;
    } else if (p.type === 'orbit') {
      // orbit handled in render
    }
    if (p.timer <= 0) vfxParticles.splice(i, 1);
  }

  if (slashEffect) {
    slashEffect.timer--;
    if (slashEffect.timer <= 0) slashEffect = null;
  }
  if (screenFlash) {
    screenFlash.timer--;
    if (screenFlash.timer <= 0) screenFlash = null;
  }
  if (shieldEffect) {
    shieldEffect.timer--;
    if (shieldEffect.timer <= 0) shieldEffect = null;
  }
}

function renderVfxParticles() {
  for (const p of vfxParticles) {
    if (p.type === 'orbit') continue; // drawn by shield renderer
    const life = p.timer / p.maxTimer;
    ctx.globalAlpha = Math.min(1, life * 1.5);
    ctx.fillStyle = p.color;
    const s = p.size * (0.5 + life * 0.5);
    ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), Math.ceil(s), Math.ceil(s));
  }
  ctx.globalAlpha = 1;
}

function renderScreenFlash() {
  if (!screenFlash) return;
  const life = screenFlash.timer / screenFlash.maxTimer;
  ctx.globalAlpha = screenFlash.alpha * life;
  ctx.fillStyle = screenFlash.color;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
}

function spawnSlashEffect(x, y, color, isCrit) {
  const maxTimer = isCrit ? 30 : 20;
  slashEffect = { x, y, timer: maxTimer, maxTimer, color: color || '#ffffaa', isCrit, angle: -0.5 };
  const sparkCount = isCrit ? 20 : 10;
  for (let i = 0; i < sparkCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.5 + Math.random() * (isCrit ? 2.5 : 1.5);
    spawnVfx(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed,
      isCrit ? '#ffff88' : color || '#ffffaa', isCrit ? 2 : 1.5, 20 + Math.random() * 15, 'spark');
  }
  if (isCrit) {
    screenFlash = { color: '#ffffff', timer: 6, maxTimer: 6, alpha: 0.3 };
  }
}

function renderSlashEffect() {
  if (!slashEffect) return;
  const s = slashEffect;
  const life = s.timer / s.maxTimer;
  const progress = 1 - life;
  ctx.save();
  ctx.translate(s.x, s.y);

  const radius = s.isCrit ? 20 : 14;
  const lw = s.isCrit ? 3 : 2;
  const sweep = Math.PI * 1.2;

  ctx.globalAlpha = life;
  ctx.strokeStyle = s.color;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.arc(0, 0, radius, s.angle + progress * sweep * 0.3, s.angle + progress * sweep);
  ctx.stroke();

  if (s.isCrit) {
    ctx.strokeStyle = '#ff8844';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.7, s.angle + Math.PI + progress * sweep * 0.3, s.angle + Math.PI + progress * sweep);
    ctx.stroke();

    // CRIT text
    if (progress < 0.7) {
      const scale = progress < 0.2 ? progress / 0.2 : 1;
      ctx.globalAlpha = Math.min(1, life * 2);
      ctx.fillStyle = '#ffdd00';
      ctx.font = `bold ${Math.round(8 * scale)}px "Press Start 2P"`;
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.strokeText('CRIT!', 0, -radius - 4);
      ctx.fillText('CRIT!', 0, -radius - 4);
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function spawnImpactEffect(x, y) {
  for (let i = 0; i < 12; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.5 + Math.random() * 2;
    const color = Math.random() > 0.5 ? '#ff4444' : '#ff8833';
    spawnVfx(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, 2, 15 + Math.random() * 10, 'spark');
  }
  screenFlash = { color: '#ff0000', timer: 4, maxTimer: 4, alpha: 0.15 };
}

function spawnShieldEffect(x, y) {
  shieldEffect = { x, y, timer: 25, maxTimer: 25 };
  for (let i = 0; i < 6; i++) {
    spawnVfx(x, y, 0, 0, '#66aaff', 2, 25, 'orbit');
  }
}

function renderShieldEffect() {
  if (!shieldEffect) return;
  const s = shieldEffect;
  const life = s.timer / s.maxTimer;
  const fadeAlpha = life < 0.3 ? life / 0.3 : (life > 0.7 ? (1 - life) / 0.3 : 1);

  ctx.save();
  ctx.globalAlpha = fadeAlpha * 0.35;
  ctx.fillStyle = '#4488cc';
  ctx.beginPath();
  ctx.ellipse(s.x, s.y, 22, 28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = fadeAlpha * 0.6;
  ctx.strokeStyle = '#66aaff';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Orbiting particles
  const orbitParticles = vfxParticles.filter(p => p.type === 'orbit');
  for (let i = 0; i < orbitParticles.length; i++) {
    const p = orbitParticles[i];
    const angle = (i / orbitParticles.length) * Math.PI * 2 + frameCount * 0.12;
    const ox = s.x + Math.cos(angle) * 20;
    const oy = s.y + Math.sin(angle) * 26;
    ctx.globalAlpha = fadeAlpha * 0.8;
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(ox - 1), Math.round(oy - 1), 2, 2);
  }

  ctx.restore();
  ctx.globalAlpha = 1;
}

// ── Dungeon Background System ─────────────────────────────────────

function getFloorTheme(f) {
  if (f >= 10) return { bg: '#100818', grid: '#18101a', wall: '#201822', accent: '#3a1a30', type: 'boss' };
  if (f >= 7) return { bg: '#120808', grid: '#1a0f0f', wall: '#221a18', accent: '#3a2220', type: 'volcanic' };
  if (f >= 4) return { bg: '#0a100a', grid: '#0f160f', wall: '#1a2218', accent: '#2a3a2a', type: 'moss' };
  return { bg: '#0a0a12', grid: '#0f0f1a', wall: '#1a1a22', accent: '#333344', type: 'stone' };
}

function renderDungeonBackground(theme) {
  // Base fill
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, W, H);

  // Checkerboard grid
  ctx.fillStyle = theme.grid;
  for (let x = 0; x < W; x += 16) {
    for (let y = 0; y < H; y += 16) {
      if ((x + y) % 32 === 0) ctx.fillRect(x, y, 16, 16);
    }
  }

  // Wall strips with brick mortar
  ctx.fillStyle = theme.wall;
  ctx.fillRect(0, 0, 4, H);
  ctx.fillRect(W - 4, 0, 4, H);
  ctx.fillStyle = theme.accent;
  for (let y = 0; y < H; y += 16) {
    ctx.fillRect(0, y, 4, 1);
    ctx.fillRect(W - 4, y, 4, 1);
  }

  if (theme.type === 'moss') {
    // Moss dots on walls + scattered green pixels
    ctx.fillStyle = '#2a5a2a';
    for (let y = 0; y < H; y += 12) {
      ctx.fillRect(1, y + (frameCount * 0.02 + y) % 3, 1, 1);
      ctx.fillRect(W - 2, y + 4 + (frameCount * 0.02 + y) % 3, 1, 1);
    }
    ctx.fillStyle = '#1a3a1a';
    // Moss patches on walls
    ctx.fillRect(0, 80, 3, 4);
    ctx.fillRect(0, 180, 4, 3);
    ctx.fillRect(W - 3, 120, 3, 5);
    ctx.fillRect(W - 4, 220, 4, 3);
  } else if (theme.type === 'volcanic') {
    // Red cracks on walls
    ctx.fillStyle = '#5a1a10';
    ctx.fillRect(1, 60, 1, 20);
    ctx.fillRect(2, 75, 1, 10);
    ctx.fillRect(W - 2, 100, 1, 25);
    ctx.fillRect(W - 3, 120, 1, 8);
    // Drifting ember particles (decorative, not vfx)
    ctx.fillStyle = '#ff6620';
    for (let i = 0; i < 5; i++) {
      const ex = 10 + (i * 67 + frameCount * 0.3) % (W - 20);
      const ey = H - ((i * 43 + frameCount * 0.5) % H);
      ctx.globalAlpha = 0.4 + 0.3 * Math.sin(frameCount * 0.1 + i);
      ctx.fillRect(Math.round(ex), Math.round(ey), 1, 1);
    }
    ctx.globalAlpha = 1;
  } else if (theme.type === 'boss') {
    // Pulsing purple/red glow from bottom
    const pulse = 0.5 + 0.5 * Math.sin(frameCount * 0.04);
    for (let band = 0; band < 5; band++) {
      const by = H - 20 - band * 15;
      ctx.globalAlpha = (0.06 + pulse * 0.06) * (1 - band * 0.18);
      ctx.fillStyle = band % 2 === 0 ? '#6a1a40' : '#3a0a30';
      ctx.fillRect(0, by, W, 15);
    }
    ctx.globalAlpha = 1;
    // Organic irregular walls
    ctx.fillStyle = '#2a0a20';
    for (let y = 0; y < H; y += 8) {
      const w = 3 + Math.sin(y * 0.2 + frameCount * 0.02) * 2;
      ctx.fillRect(0, y, Math.round(w), 8);
      ctx.fillRect(Math.round(W - w), y, Math.round(w), 8);
    }
  }
}

// ── Dungeon Map ───────────────────────────────────────────────────

function renderDungeonMap() {
  const mapX = 12;
  const mapY = 50;
  const nodeSpacing = 14;
  const nodeR = 3;

  // Vertical line
  ctx.strokeStyle = '#333344';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(mapX, mapY);
  ctx.lineTo(mapX, mapY + 9 * nodeSpacing);
  ctx.stroke();

  for (let f = 1; f <= 10; f++) {
    const ny = mapY + (f - 1) * nodeSpacing;
    const isCurrent = f === floor;
    const isCompleted = f < floor;
    const isBoss = f === 10;

    // Node
    const r = isBoss ? nodeR + 2 : nodeR;
    if (isCurrent) {
      // Pulsing border
      const pulse = 0.5 + 0.5 * Math.sin(frameCount * 0.1);
      ctx.fillStyle = '#ffdd44';
      ctx.fillRect(mapX - r - 1, ny - r - 1, (r + 1) * 2, (r + 1) * 2);
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = '#ffff88';
      ctx.lineWidth = 1;
      ctx.strokeRect(mapX - r - 2, ny - r - 2, (r + 2) * 2, (r + 2) * 2);
      ctx.globalAlpha = 1;
    } else if (isCompleted) {
      ctx.fillStyle = '#334433';
    } else if (isBoss) {
      ctx.fillStyle = '#5a1a30';
    } else {
      ctx.fillStyle = '#444455';
    }
    ctx.fillRect(mapX - r, ny - r, r * 2, r * 2);

    // Floor number
    ctx.fillStyle = isCurrent ? '#ffdd44' : (isCompleted ? '#556655' : (isBoss ? '#aa3366' : '#777788'));
    ctx.font = '3px "Press Start 2P"';
    ctx.textAlign = 'left';
    ctx.fillText(`${f}`, mapX + r + 3, ny + 1);
  }

  // Player indicator on current floor
  const py = mapY + (floor - 1) * nodeSpacing;
  ctx.fillStyle = '#88ff88';
  ctx.fillRect(mapX - 1, py - 1, 2, 2);
}

// Animation frame
let frameCount = 0;

// Sprite cache
const spriteCache = {};

// Seeded RNG for run
let rngState = 0;
function rngNext() {
  rngState = (rngState * 1103515245 + 12345) & 0x7fffffff;
  return (rngState >> 16) / 32768; // 0-1
}
function rngInt(min, max) {
  return min + Math.floor(rngNext() * (max - min + 1));
}
function rngPick(arr) {
  return arr[Math.floor(rngNext() * arr.length)];
}
function rngWeighted(weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rngNext() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

// ── Public API ─────────────────────────────────────────────────────

export function startCitadel(plants, onBack) {
  onBackCallback = onBack;
  canvas = document.getElementById('citadelCanvas');
  ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  canvas.width = W * CANVAS_SCALE;
  canvas.height = H * CANVAS_SCALE;

  frameCount = 0;
  rngState = Date.now() & 0x7fffffff;

  if (plants.length === 1) {
    selectAndStart(plants[0]);
  } else {
    showPlantPicker(plants);
  }
  addInputListeners();
}

export function stopCitadel() {
  running = false;
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  removeInputListeners();
}

// ── Plant Picker ───────────────────────────────────────────────────

function selectAndStart(plant) {
  selectedPlant = plant;
  plantSprite = renderPlant(plant, plant.growthStage || 1.0);
  showStartScreen();
}

function showPlantPicker(plants) {
  phase = 'plantPicker';
  const overlay = document.getElementById('citadelOverlay');
  const content = document.getElementById('citadelOverlayContent');
  overlay.classList.remove('hidden');
  document.getElementById('citadelHud').style.display = 'none';

  let html = '<div class="mg-title">Choose Your Champion</div><div class="mg-picker-grid" id="citadelPickerGrid"></div>';
  html += '<button class="btn mg-back-btn" id="citadelPickerBack">Back to Plant</button>';
  content.innerHTML = html;

  const grid = document.getElementById('citadelPickerGrid');
  for (const plant of plants) {
    const card = document.createElement('div');
    card.className = 'mg-picker-card';

    const preview = renderPlant(plant, plant.growthStage || 1.0);
    const previewCanvas = document.createElement('canvas');
    const scale = 3;
    previewCanvas.width = preview.width * scale;
    previewCanvas.height = preview.height * scale;
    previewCanvas.style.imageRendering = 'pixelated';
    const pCtx = previewCanvas.getContext('2d');
    pCtx.imageSmoothingEnabled = false;
    pCtx.drawImage(preview, 0, 0, previewCanvas.width, previewCanvas.height);

    const imgWrap = document.createElement('div');
    imgWrap.className = 'mg-picker-img';
    imgWrap.appendChild(previewCanvas);

    const name = document.createElement('div');
    name.className = 'mg-picker-name';
    name.textContent = plant.species;

    card.appendChild(imgWrap);
    card.appendChild(name);

    // Show element buff if plant has one
    if (plant.potElement && ELEMENT_BUFFS[plant.potElement]) {
      const b = ELEMENT_BUFFS[plant.potElement];
      const elemColors = { fire: '#ff6633', ice: '#66ccff', earth: '#88aa44', wind: '#aaddcc' };
      const elemLabel = document.createElement('div');
      elemLabel.style.cssText = `color:${elemColors[plant.potElement]};font-size:0.7em;margin-top:2px`;
      elemLabel.textContent = `✦ ${b.name}`;
      card.appendChild(elemLabel);
    }
    card.addEventListener('click', () => selectAndStart(plant));
    grid.appendChild(card);
  }

  document.getElementById('citadelPickerBack').addEventListener('click', handleBack);
}

function showStartScreen() {
  phase = 'start';
  const overlay = document.getElementById('citadelOverlay');
  const content = document.getElementById('citadelOverlayContent');
  overlay.classList.remove('hidden');
  document.getElementById('citadelHud').style.display = 'none';

  const state = loadState();
  const bestFloor = state.stats.citadelBestFloor || 0;
  const clears = state.stats.citadelClears || 0;

  const elem = selectedPlant?.potElement;
  const buff = elem ? ELEMENT_BUFFS[elem] : null;
  const elemColors = { fire: '#ff6633', ice: '#66ccff', earth: '#88aa44', wind: '#aaddcc' };
  const elemHtml = buff
    ? `<div style="color:${elemColors[elem]};font-size:0.85em;margin-top:4px">✦ ${buff.name}: ${buff.desc}</div>`
    : `<div style="color:#666;font-size:0.8em;margin-top:4px">No element — equip an elemental pot for a buff!</div>`;

  content.innerHTML = `
    <div class="mg-title">Dark Citadel</div>
    <div class="mg-preview" id="citadelPreview"></div>
    ${elemHtml}
    <div class="mg-instructions">
      <span>10 floors of turn-based combat</span>
      <span>Defeat the Mother Bug!</span>
      <span>Speed determines actions per turn</span>
    </div>
    ${bestFloor > 0 ? `<div class="mg-high-score">Best Floor: ${bestFloor} | Clears: ${clears}</div>` : ''}
    <button class="btn mg-play-btn" id="citadelStartBtn">Enter the Citadel</button>
    <button class="btn mg-back-btn" id="citadelBackBtn">Back to Plant</button>
  `;

  const previewWrap = document.getElementById('citadelPreview');
  if (plantSprite) {
    const previewCanvas = document.createElement('canvas');
    const s = 2;
    previewCanvas.width = plantSprite.width * s;
    previewCanvas.height = plantSprite.height * s;
    previewCanvas.style.imageRendering = 'pixelated';
    const pCtx = previewCanvas.getContext('2d');
    pCtx.imageSmoothingEnabled = false;
    pCtx.drawImage(plantSprite, 0, 0, previewCanvas.width, previewCanvas.height);
    previewWrap.appendChild(previewCanvas);
  }

  document.getElementById('citadelStartBtn').addEventListener('click', beginRun);
  document.getElementById('citadelBackBtn').addEventListener('click', handleBack);
}

// ── Game Init ──────────────────────────────────────────────────────

function beginRun() {
  floor = 0;
  combatLog = [];
  combatLogScroll = 0;

  player = {
    maxHp: 50, hp: 50,
    baseSpeed: 15,
    bonusSpeed: 0, bonusDamage: 0, bonusArmor: 0, bonusMaxHp: 0,
    bonusCrit: 0, bonusCritMult: 0,
    weapon: { ...WEAPONS[0] }, // Thorn Dagger
    armor: { ...ARMORS[0] },   // Leaf Wrappings
    belt: [],
    exp: 0, level: 1, expToNext: 10,
    defending: false,
    poison: 0,
    slowDebuff: 0,
  };

  // Apply element buff from plant
  const elem = selectedPlant?.potElement;
  const buff = elem ? ELEMENT_BUFFS[elem] : null;
  if (buff) {
    if (buff.bonusDamage) player.bonusDamage += buff.bonusDamage;
    if (buff.bonusArmor) player.bonusArmor += buff.bonusArmor;
    if (buff.bonusMaxHp) { player.bonusMaxHp += buff.bonusMaxHp; player.maxHp += buff.bonusMaxHp; player.hp += buff.bonusMaxHp; }
    if (buff.bonusSpeed) player.bonusSpeed += buff.bonusSpeed;
    if (buff.bonusCrit) player.bonusCrit += buff.bonusCrit;
    addLog(`Element: ${buff.name} — ${buff.desc}`);
  }

  enemies = [];
  lootCards = [];

  // Reset VFX
  vfxParticles = [];
  slashEffect = null;
  screenFlash = null;
  shieldEffect = null;
  floorTransition = null;
  bossCinematic = null;
  bossCinematicScale = 0;

  const overlay = document.getElementById('citadelOverlay');
  overlay.classList.add('hidden');
  document.getElementById('citadelHud').style.display = '';

  running = true;
  advanceFloor();
  rafId = requestAnimationFrame(gameLoop);
}

// ── Speed System ───────────────────────────────────────────────────

function getEffectiveSpeed() {
  const weaponSpd = player.weapon ? player.weapon.speedMod : 0;
  const armorSpd = player.armor ? player.armor.speedMod : 0;
  return player.baseSpeed + weaponSpd + armorSpd + player.bonusSpeed - player.slowDebuff;
}

function getActionsPerRound() {
  return Math.max(1, Math.min(5, Math.floor(getEffectiveSpeed() / 10)));
}

function getPlayerDamage() {
  const weaponDmg = player.weapon ? player.weapon.dmg : 1;
  return weaponDmg + player.bonusDamage;
}

function getPlayerArmor() {
  const armorDef = player.armor ? player.armor.def : 0;
  return armorDef + player.bonusArmor;
}

function getCritChance() {
  const weaponCrit = player.weapon ? player.weapon.critBonus : 0;
  return 5 + weaponCrit + player.bonusCrit;
}

function getCritMultiplier() {
  return 1.5 + player.bonusCritMult / 100;
}

function getMaxHp() {
  const armorHp = player.armor ? player.armor.hpBonus : 0;
  return 50 + armorHp + player.bonusMaxHp;
}

// ── Floor / Path Generation ────────────────────────────────────────

function advanceFloor() {
  const prevFloor = floor;
  floor++;
  player.defending = false;
  player.slowDebuff = 0;

  // Recalculate max HP (armor may have changed)
  const newMax = getMaxHp();
  if (newMax > player.maxHp) {
    player.hp += (newMax - player.maxHp);
  }
  player.maxHp = newMax;

  if (floor > 10) {
    victory();
    return;
  }

  // Floor 1: no transition (run just started)
  if (floor === 1) {
    generatePaths();
    phase = 'pathSelect';
    selectedPath = -1;
    pathHover = -1;
    completedPaths = [];
    return;
  }

  // Floors 2+: play floor transition animation
  startFloorTransition(prevFloor, floor);
}

function startFloorTransition(fromFloor, toFloor) {
  floorTransition = { timer: 0, maxTimer: 90, fromFloor, toFloor };
  phase = 'floorTransition';
}

function finishFloorTransition() {
  const toFloor = floorTransition.toFloor;
  floorTransition = null;

  if (toFloor === 10) {
    startBossCinematic();
    return;
  }

  generatePaths();
  phase = 'pathSelect';
  selectedPath = -1;
  pathHover = -1;
  completedPaths = [];
}

function renderFloorTransition() {
  if (!floorTransition) return;
  const t = floorTransition.timer;
  const max = floorTransition.maxTimer;
  const fromTheme = getFloorTheme(floorTransition.fromFloor);
  const toTheme = getFloorTheme(floorTransition.toFloor);

  if (t < 30) {
    // Phase 1: current floor fades to black, text fades out, walls scroll up
    const fade = t / 30;
    // Redraw from-floor bg with fading
    ctx.globalAlpha = 1 - fade;
    renderDungeonBackground(fromTheme);
    ctx.globalAlpha = 1;
    // Black overlay
    ctx.fillStyle = '#000';
    ctx.globalAlpha = fade;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    // Floor text fading out
    ctx.globalAlpha = 1 - fade;
    ctx.fillStyle = '#c0a0d0';
    ctx.font = '8px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.fillText(`Floor ${floorTransition.fromFloor}`, CX, CY);
    ctx.globalAlpha = 1;
    // Scrolling wall bricks
    const scrollY = t * 3;
    ctx.fillStyle = fromTheme.wall;
    for (let y = -scrollY % 16; y < H; y += 16) {
      ctx.fillRect(0, y, 4, 8);
      ctx.fillRect(W - 4, y, 4, 8);
    }
  } else if (t < 60) {
    // Phase 2: black screen, scrolling walls, flickering torchlight, "Descending..."
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    // Scrolling stone walls
    const scrollY = t * 3;
    ctx.fillStyle = '#1a1a22';
    for (let y = -scrollY % 16; y < H; y += 16) {
      ctx.fillRect(0, y, 4, 8);
      ctx.fillRect(W - 4, y, 4, 8);
    }
    ctx.fillStyle = '#333';
    for (let y = -scrollY % 16; y < H; y += 16) {
      ctx.fillRect(0, y, 4, 1);
      ctx.fillRect(W - 4, y, 4, 1);
    }
    // Flickering torch glow
    const flicker = 0.3 + 0.2 * Math.sin(t * 0.5);
    ctx.globalAlpha = flicker;
    ctx.fillStyle = '#ff8830';
    ctx.fillRect(1, CY - 5, 3, 5);
    ctx.fillRect(W - 4, CY - 5, 3, 5);
    ctx.globalAlpha = 1;
    // "Descending..." text
    const textFade = Math.min(1, (t - 30) / 10);
    ctx.globalAlpha = textFade * (0.7 + 0.3 * Math.sin(t * 0.15));
    ctx.fillStyle = '#8a7a9a';
    ctx.font = '6px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.fillText('Descending...', CX, CY);
    ctx.globalAlpha = 1;
  } else {
    // Phase 3: new floor bg fades in, floor text fades in
    const fade = (t - 60) / 30;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = fade;
    renderDungeonBackground(toTheme);
    ctx.globalAlpha = 1;
    // Floor text fading in
    ctx.globalAlpha = fade;
    ctx.fillStyle = '#c0a0d0';
    ctx.font = '8px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.fillText(`Floor ${floorTransition.toFloor}`, CX, CY);
    ctx.globalAlpha = 1;
  }
}

// ── Boss Cinematic ────────────────────────────────────────────────

function startBossCinematic() {
  bossCinematic = { timer: 0, maxTimer: 270, phase: 0 };
  bossCinematicScale = 0;
  phase = 'bossCinematic';
}

function finishBossCinematic() {
  bossCinematic = null;
  phase = 'combat';
  startCombat([createEnemy('motherbug')]);
  addLog(`--- Floor 10: The Mother Bug ---`);
}

function renderBossCinematic() {
  if (!bossCinematic) return;
  const t = bossCinematic.timer;
  const theme = getFloorTheme(10);

  // Always draw boss arena bg
  renderDungeonBackground(theme);

  if (t < 60) {
    // Phase 0: Screen darkens, "FLOOR 10" + "The Depths" text fades in
    const fade = Math.min(1, t / 30);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.globalAlpha = fade;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = fade;
    ctx.fillStyle = '#cc3355';
    ctx.font = '10px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.fillText('FLOOR 10', CX, CY - 20);
    ctx.fillStyle = '#8a4a6a';
    ctx.font = '6px "Press Start 2P"';
    ctx.fillText('The Depths', CX, CY + 5);
    ctx.globalAlpha = 1;
  } else if (t < 120) {
    // Phase 1: Screen shake intensifies, purple glow builds, particles rise
    const progress = (t - 60) / 60;
    const shakeAmp = progress * 4;
    ctx.save();
    ctx.translate(Math.sin(t * 1.5) * shakeAmp, Math.cos(t * 1.3) * shakeAmp * 0.5);

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(-5, -5, W + 10, H + 10);

    // Purple glow from bottom
    ctx.globalAlpha = progress * 0.4;
    ctx.fillStyle = '#6a1a40';
    ctx.fillRect(0, H - 60, W, 60);
    ctx.fillStyle = '#4a0a30';
    ctx.fillRect(0, H - 100, W, 40);
    ctx.globalAlpha = 1;

    // Rising purple particles
    if (t % 3 === 0) {
      spawnVfx(Math.random() * W, H, (Math.random() - 0.5) * 0.5, -1 - Math.random() * 1.5,
        Math.random() > 0.5 ? '#aa33aa' : '#cc44cc', 2, 40, 'rise');
    }

    ctx.restore();
  } else if (t < 180) {
    // Phase 2: Mother Bug scales from 0→1 at center
    const progress = (t - 120) / 60;
    // Ease-out cubic
    bossCinematicScale = 1 - Math.pow(1 - progress, 3);

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, 0, W, H);

    // Draw boss sprite scaled
    const bossEnemy = { type: 'motherbug', enraged: false, color: '#3a0a2a', isBoss: true };
    const key = 'motherbug';
    if (!spriteCache[key]) {
      spriteCache[key] = generateEnemySprite(bossEnemy);
    }
    const spr = spriteCache[key];
    const scale = bossCinematicScale * 3;
    const dw = spr.width * scale;
    const dh = spr.height * scale;

    ctx.save();
    ctx.globalAlpha = bossCinematicScale;
    ctx.drawImage(spr, CX - dw / 2, CY - 10 - dh / 2, dw, dh);
    ctx.restore();

    // Particle burst at full scale
    if (progress > 0.95 && t === 179) {
      for (let i = 0; i < 30; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 3;
        spawnVfx(CX, CY - 10, Math.cos(angle) * speed, Math.sin(angle) * speed,
          Math.random() > 0.5 ? '#aa33aa' : '#ff33ff', 2.5, 30, 'spark');
      }
    }
  } else if (t < 240) {
    // Phase 3: "MOTHER BUG" name fades in, HP bar fills
    const progress = (t - 180) / 60;

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, 0, W, H);

    // Boss sprite at full scale
    const key2 = 'motherbug';
    const spr2 = spriteCache[key2];
    if (spr2) {
      const scale2 = 3;
      const dw2 = spr2.width * scale2;
      const dh2 = spr2.height * scale2;
      ctx.drawImage(spr2, CX - dw2 / 2, CY - 10 - dh2 / 2, dw2, dh2);
    }

    // Name
    ctx.globalAlpha = Math.min(1, progress * 2);
    ctx.fillStyle = '#ff2233';
    ctx.font = '8px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeText('MOTHER BUG', CX, CY + 40);
    ctx.fillText('MOTHER BUG', CX, CY + 40);

    // HP bar filling
    const barW = 100;
    const barH = 6;
    const barX = CX - barW / 2;
    const barY = CY + 50;
    ctx.fillStyle = '#2a0a0a';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = '#aa2233';
    ctx.fillRect(barX, barY, Math.round(barW * Math.min(1, progress * 1.2)), barH);
    ctx.strokeStyle = '#661122';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);
    ctx.globalAlpha = 1;
  } else {
    // Phase 4: Hold, overlay fades lighter
    const progress = (t - 240) / 30;

    ctx.fillStyle = `rgba(0,0,0,${0.4 * (1 - progress * 0.5)})`;
    ctx.fillRect(0, 0, W, H);

    // Boss sprite
    const key3 = 'motherbug';
    const spr3 = spriteCache[key3];
    if (spr3) {
      const scale3 = 3;
      const dw3 = spr3.width * scale3;
      const dh3 = spr3.height * scale3;
      ctx.drawImage(spr3, CX - dw3 / 2, CY - 10 - dh3 / 2, dw3, dh3);
    }

    ctx.fillStyle = '#ff2233';
    ctx.font = '8px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeText('MOTHER BUG', CX, CY + 40);
    ctx.fillText('MOTHER BUG', CX, CY + 40);

    const barW2 = 100;
    const barH2 = 6;
    const barX2 = CX - barW2 / 2;
    const barY2 = CY + 50;
    ctx.fillStyle = '#2a0a0a';
    ctx.fillRect(barX2, barY2, barW2, barH2);
    ctx.fillStyle = '#aa2233';
    ctx.fillRect(barX2, barY2, barW2, barH2);
    ctx.strokeStyle = '#661122';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX2, barY2, barW2, barH2);
  }

  // VFX particles always render during cinematic
  renderVfxParticles();
}

function generatePaths() {
  paths = [];
  const isRestFloor = (floor === 3 || floor === 6 || floor === 9);

  // Always have safe and dangerous
  paths.push({
    type: 'safe',
    name: 'Safe Path',
    desc: '1 easy fight',
    fights: [generateFightGroup('easy')],
    lootRarity: 'Common',
    color: '#4a8a4a',
  });

  paths.push({
    type: 'dangerous',
    name: 'Dangerous Path',
    desc: '2 tough fights, rare loot',
    fights: [generateFightGroup('medium'), generateFightGroup('medium')],
    lootRarity: 'Rare',
    color: '#ba4a2a',
  });

  if (isRestFloor) {
    paths.push({
      type: 'rest',
      name: 'Rest Shrine',
      desc: 'Heal 40% HP',
      fights: [],
      lootRarity: null,
      color: '#4a6aba',
    });
  } else if (floor >= 3) {
    paths.push({
      type: 'treasure',
      name: 'Treasure Vault',
      desc: '1 mini-boss, epic+ loot',
      fights: [generateFightGroup('boss')],
      lootRarity: 'Epic',
      color: '#9a6a1a',
    });
  }
}

function generateFightGroup(difficulty) {
  const available = Object.entries(ENEMY_TYPES).filter(([key, e]) => {
    if (e.isBoss && difficulty !== 'boss') return false;
    if (key === 'motherbug') return false;
    return floor >= e.floors[0] && floor <= e.floors[1];
  });

  if (available.length === 0) {
    return [createEnemy('aphid')];
  }

  const group = [];
  if (difficulty === 'easy') {
    const count = rngInt(2, 3);
    for (let i = 0; i < count; i++) {
      const [key] = rngPick(available.filter(([k, e]) => !e.isBoss));
      group.push(createEnemy(key));
    }
  } else if (difficulty === 'medium') {
    const count = rngInt(2, 3);
    for (let i = 0; i < count; i++) {
      const [key] = rngPick(available.filter(([k, e]) => !e.isBoss));
      group.push(createEnemy(key));
    }
  } else if (difficulty === 'boss') {
    if (floor >= 5) {
      group.push(createEnemy('scarab'));
    } else {
      // Mini-boss: strong stag beetle
      const e = createEnemy('stag');
      e.hp = Math.round(e.hp * 1.5);
      e.maxHp = e.hp;
      e.atk = Math.round(e.atk * 1.3);
      e.name = 'Elite ' + e.name;
      group.push(e);
    }
  }
  return group;
}

function createEnemy(type) {
  const def = ENEMY_TYPES[type];
  const scale = 1 + (floor - 1) * 0.15;
  const e = {
    type,
    name: def.name,
    hp: Math.round(def.hp * scale),
    maxHp: Math.round(def.hp * scale),
    atk: Math.round(def.atk * scale * (def.isBoss ? 1 : 1.25)),
    armor: def.armor,
    abilities: [...def.abilities],
    color: def.color,
    isBoss: def.isBoss || false,
    actionsPerRound: def.actionsPerRound || 1,
    defending: false,
    enraged: false,
    alive: true,
    animX: 0, animY: 0,
    flashTimer: 0,
  };
  return e;
}

// ── Turn Queue ─────────────────────────────────────────────────────

function buildTurnQueue() {
  turnQueue = [];
  const maxEntries = 20; // generate enough to display 5+ rounds

  // Figure out where we are right now
  let pActsLeft = playerActionsLeft;
  let eIdx = currentEnemyIndex;
  let eActsLeft = enemyActionsLeft;
  let inPlayerTurn = (combatPhase === 'playerTurn');
  let inEnemyTurn = (combatPhase === 'enemyTurn');

  const aliveEnemies = () => enemies.filter(e => e.alive);

  // If currently in player turn, add remaining player actions then this round's enemies
  if (inPlayerTurn) {
    for (let i = 0; i < pActsLeft; i++) {
      turnQueue.push({ type: 'player', name: 'YOU' });
    }
    // Enemies still act after player this round
    for (let ei = 0; ei < enemies.length; ei++) {
      if (!enemies[ei].alive) continue;
      for (let a = 0; a < (enemies[ei].actionsPerRound || 1); a++) {
        turnQueue.push({ type: 'enemy', name: enemies[ei].name, enemyIndex: ei });
      }
    }
  }

  // If in enemy turn, add remaining enemy actions for current + subsequent enemies
  if (inEnemyTurn) {
    // Current enemy's remaining actions
    const curEnemy = enemies[eIdx];
    if (curEnemy && curEnemy.alive) {
      for (let i = 0; i < eActsLeft; i++) {
        turnQueue.push({ type: 'enemy', name: curEnemy.name, enemyIndex: eIdx });
      }
    }
    // Remaining enemies this round
    for (let i = eIdx + 1; i < enemies.length; i++) {
      if (enemies[i].alive) {
        for (let a = 0; a < (enemies[i].actionsPerRound || 1); a++) {
          turnQueue.push({ type: 'enemy', name: enemies[i].name, enemyIndex: i });
        }
      }
    }
  }

  // Now add full future rounds until we have enough
  while (turnQueue.length < maxEntries) {
    const alive = aliveEnemies();
    if (alive.length === 0) break;

    // Player actions
    const acts = getActionsPerRound();
    for (let i = 0; i < acts; i++) {
      turnQueue.push({ type: 'player', name: 'YOU' });
    }
    if (turnQueue.length >= maxEntries) break;

    // Enemy actions
    for (let ei = 0; ei < enemies.length; ei++) {
      if (!enemies[ei].alive) continue;
      for (let a = 0; a < (enemies[ei].actionsPerRound || 1); a++) {
        turnQueue.push({ type: 'enemy', name: enemies[ei].name, enemyIndex: ei });
      }
    }
  }
}

// ── Combat Engine ──────────────────────────────────────────────────

let currentFightIndex = 0;
let currentFights = [];

function startCombat(enemyGroup) {
  enemies = enemyGroup;
  combatPhase = 'playerTurn';
  player.defending = false;
  playerMaxActions = getActionsPerRound();
  playerActionsLeft = playerMaxActions;
  selectedAction = -1;
  targetEnemy = 0;
  animating = false;
  dmgPopups = [];
  // Select first alive enemy
  targetEnemy = enemies.findIndex(e => e.alive);
  if (targetEnemy < 0) targetEnemy = 0;
  buildTurnQueue();
  updateHud();
}

function executePlayerAttack() {
  const target = enemies[targetEnemy];
  if (!target || !target.alive) return;

  const attackedEnemyIndex = targetEnemy; // capture before retarget
  playerActionsLeft--;

  const rawDmg = getPlayerDamage();
  const crit = rngNext() * 100 < getCritChance();
  let dmg = crit ? Math.round(rawDmg * getCritMultiplier()) : rawDmg;
  const reduction = target.defending ? Math.floor(target.armor * 1.5 + dmg * 0.5) : target.armor;
  dmg = Math.max(1, dmg - reduction);

  target.hp -= dmg;
  target.flashTimer = 15;

  // Floating damage number on the enemy
  const ePos = getEnemyScreenPos(attackedEnemyIndex);
  if (crit) {
    spawnDmgPopup(ePos.x, ePos.y - 5, `${dmg}`, '#ffdd00', 8);
  } else {
    spawnDmgPopup(ePos.x, ePos.y - 5, `${dmg}`, '#ff4444', 6);
  }

  const critText = crit ? ' CRIT!' : '';
  addLog(`You hit ${target.name} for ${dmg}${critText}`);

  if (target.hp <= 0) {
    target.hp = 0;
    target.alive = false;
    addLog(`${target.name} defeated!`);

    // EXP
    const expGain = rngInt(2, 4) + floor;
    player.exp += expGain;
    addLog(`+${expGain} EXP`);

    // Auto-select leftmost alive enemy
    retargetLeftmost();
  }

  // Mother Bug enrage check
  if (target.type === 'motherbug' && target.alive && !target.enraged && target.hp <= target.maxHp * 0.5) {
    target.enraged = true;
    target.atk = Math.round(target.atk * 1.3);
    addLog(`Mother Bug ENRAGES! +30% ATK!`);
  }

  // Immediate victory visual if all enemies dead
  if (!enemies.some(e => e.alive)) {
    combatPhase = 'won';
    addLog('--- Combat Victory! ---');
  }

  buildTurnQueue(); // Immediate visual update

  animating = true;
  animType = 'playerAttack';
  animTimer = 60;
  animData = { target: attackedEnemyIndex, crit };
  shakeTimer = 10;
  shakeTarget = 'enemy';

  // Slash VFX
  const slashPos = getEnemyScreenPos(attackedEnemyIndex);
  const elemColors = { fire: '#ff6633', ice: '#66ccff', earth: '#88aa44', wind: '#aaddcc' };
  const slashColor = selectedPlant?.potElement ? (elemColors[selectedPlant.potElement] || '#ffffaa') : '#ffffaa';
  spawnSlashEffect(slashPos.x, slashPos.y, slashColor, crit);
}

function executePlayerDefend() {
  playerActionsLeft--;
  player.defending = true;
  addLog(`You brace for impact (50% dmg reduction)`);
  buildTurnQueue();
  animating = true;
  animType = 'defend';
  animTimer = 60;
  spawnShieldEffect(CX, H - 100);
}

function executePlayerItem(beltIndex) {
  const item = player.belt[beltIndex];
  if (!item) return;

  if (item.type === 'healPotion') {
    const pct = item.potency === 'legendary' ? 0.5 : 0.3;
    const healAmt = Math.round(player.maxHp * pct);
    player.hp = Math.min(player.maxHp, player.hp + healAmt);
    addLog(`Healed for ${healAmt} HP`);
    // Green sparkle VFX
    for (let i = 0; i < 15; i++) {
      spawnVfx(CX + (Math.random() - 0.5) * 30, H - 90, (Math.random() - 0.5) * 0.5,
        -0.8 - Math.random() * 0.7, '#44ee66', 2, 30 + Math.random() * 15, 'rise');
    }
    animating = true;
    animType = 'heal';
    animTimer = 20;
  } else if (item.type === 'bomb') {
    const dmg = item.potency === 'legendary' ? 35 : 20;
    for (let bi = 0; bi < enemies.length; bi++) {
      const e = enemies[bi];
      if (e.alive) {
        e.hp = Math.max(0, e.hp - dmg);
        e.flashTimer = 15;
        const bPos = getEnemyScreenPos(bi);
        spawnDmgPopup(bPos.x, bPos.y - 5, `${dmg}`, '#ff8844', 6);
        if (e.hp <= 0) {
          e.alive = false;
          addLog(`${e.name} destroyed by bomb!`);
          const expGain = rngInt(2, 4) + floor;
          player.exp += expGain;
        }
      }
    }
    addLog(`Bomb dealt ${dmg} to all enemies!`);
    retargetLeftmost();
    // Bomb explosion VFX on each alive enemy
    for (let bi2 = 0; bi2 < enemies.length; bi2++) {
      const ePos2 = getEnemyScreenPos(bi2);
      for (let j = 0; j < 10; j++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.8 + Math.random() * 2;
        const color = Math.random() > 0.5 ? '#ff8833' : '#ff4422';
        spawnVfx(ePos2.x, ePos2.y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, 2, 20 + Math.random() * 10, 'spark');
      }
    }
    screenFlash = { color: '#ff8800', timer: 6, maxTimer: 6, alpha: 0.2 };
    // Immediate victory visual if all enemies dead
    if (!enemies.some(e => e.alive)) {
      combatPhase = 'won';
      addLog('--- Combat Victory! ---');
    }
    animating = true;
    animType = 'bomb';
    animTimer = 60;
  }

  // Decrement uses, remove from belt when depleted
  item.uses--;
  if (item.uses <= 0) {
    player.belt.splice(beltIndex, 1);
  }

  buildTurnQueue(); // Immediate visual update
}

function retargetLeftmost() {
  const idx = enemies.findIndex(e => e.alive);
  targetEnemy = idx >= 0 ? idx : 0;
}

function advancePlayerAction() {
  // playerActionsLeft already decremented and queue rebuilt in execute*()

  // Check for mid-combat level up before continuing
  if (checkLevelUp()) return;

  if (playerActionsLeft <= 0 || !enemies.some(e => e.alive)) {
    if (!enemies.some(e => e.alive)) {
      combatWon();
    } else {
      startEnemyTurn();
    }
  }
}

function startEnemyTurn() {
  combatPhase = 'enemyTurn';
  player.defending = player.defending; // keep defend status for this round
  currentEnemyIndex = 0;
  processNextEnemy();
}

function processNextEnemy() {
  // Find next alive enemy
  while (currentEnemyIndex < enemies.length && !enemies[currentEnemyIndex].alive) {
    currentEnemyIndex++;
  }
  if (currentEnemyIndex >= enemies.length) {
    endEnemyTurn();
    return;
  }

  const enemy = enemies[currentEnemyIndex];
  enemyActionsLeft = enemy.actionsPerRound;
  executeEnemyAction(enemy);
}

function executeEnemyAction(enemy) {
  if (!enemy.alive || player.hp <= 0) {
    currentEnemyIndex++;
    processNextEnemy();
    return;
  }

  // Decide action
  let action = 'attack';
  if (enemy.abilities.includes('defend') && rngNext() < 0.25) {
    action = 'defend';
  } else if (enemy.abilities.includes('heal') && enemy.hp < enemy.maxHp * 0.5 && rngNext() < 0.3) {
    action = 'heal';
  } else if (enemy.abilities.includes('summon') && enemies.filter(e => e.alive).length < 5 && rngNext() < 0.2) {
    action = 'summon';
  }

  if (action === 'attack') {
    let rawDmg = enemy.atk;
    if (enemy.abilities.includes('charge') && rngNext() < 0.3) {
      rawDmg = Math.round(rawDmg * 1.5);
      addLog(`${enemy.name} charges!`);
    }
    if (enemy.abilities.includes('crit') && rngNext() < 0.2) {
      rawDmg = Math.round(rawDmg * 2);
      addLog(`${enemy.name} critical strike!`);
    }

    const reduction = player.defending ? Math.floor(getPlayerArmor() + rawDmg * 0.5) : getPlayerArmor();
    const dmg = Math.max(1, rawDmg - reduction);
    player.hp -= dmg;
    addLog(`${enemy.name} hits you for ${dmg}`);
    // Floating damage on player
    spawnDmgPopup(CX, H - 90, `${dmg}`, '#ff4444', 6);

    if (enemy.abilities.includes('poison') && rngNext() < 0.4) {
      player.poison += 2;
      addLog(`You are poisoned! (2 ticks)`);
    }
    if (enemy.abilities.includes('slow') && rngNext() < 0.3) {
      player.slowDebuff = Math.min(player.slowDebuff + 3, 10);
      addLog(`You are slowed! (-3 speed)`);
    }
    if (enemy.abilities.includes('multi')) {
      // Second hit
      const dmg2 = Math.max(1, Math.round(enemy.atk * 0.6) - (player.defending ? Math.floor(getPlayerArmor() + rawDmg * 0.3) : getPlayerArmor()));
      player.hp -= dmg2;
      addLog(`${enemy.name} multi-hit for ${dmg2}!`);
      spawnDmgPopup(CX + 10, H - 85, `${dmg2}`, '#ff4444', 5);
    }

    shakeTimer = 10;
    shakeTarget = 'player';
    flashTimer = 10;
    flashTarget = 'player';
    spawnImpactEffect(CX, H - 100);
  } else if (action === 'defend') {
    enemy.defending = true;
    addLog(`${enemy.name} defends!`);
  } else if (action === 'heal') {
    const healAmt = Math.round(enemy.maxHp * 0.15);
    enemy.hp = Math.min(enemy.maxHp, enemy.hp + healAmt);
    addLog(`${enemy.name} heals for ${healAmt}!`);
  } else if (action === 'summon') {
    const summon = createEnemy('aphid');
    summon.name = 'Summoned Aphid';
    enemies.push(summon);
    addLog(`${enemy.name} summons an Aphid!`);
  }

  enemyActionsLeft--;
  buildTurnQueue(); // Immediate visual update

  animating = true;
  animType = 'enemyAttack';
  animTimer = 60;
  animData = { enemyIndex: currentEnemyIndex };

  if (player.hp <= 0) {
    player.hp = 0;
    return; // Game over handled in animation end
  }
}

function finishEnemyAction() {
  if (player.hp <= 0) {
    gameOver();
    return;
  }

  // enemyActionsLeft already decremented and queue rebuilt in executeEnemyAction()

  if (enemyActionsLeft > 0) {
    const enemy = enemies[currentEnemyIndex];
    if (enemy && enemy.alive) {
      executeEnemyAction(enemy);
      return;
    }
  }
  currentEnemyIndex++;
  processNextEnemy();
}

function endEnemyTurn() {
  // Apply poison
  if (player.poison > 0) {
    const poisonDmg = 3;
    player.hp -= poisonDmg;
    player.poison--;
    addLog(`Poison deals ${poisonDmg} damage (${player.poison} ticks left)`);
    if (player.hp <= 0) {
      player.hp = 0;
      gameOver();
      return;
    }
  }

  // Reduce slow
  if (player.slowDebuff > 0) {
    player.slowDebuff = Math.max(0, player.slowDebuff - 1);
  }

  // Reset defend states
  player.defending = false;
  for (const e of enemies) {
    e.defending = false;
  }

  // Start new player turn
  combatPhase = 'playerTurn';
  playerMaxActions = getActionsPerRound();
  playerActionsLeft = playerMaxActions;
  selectedAction = -1;
  buildTurnQueue();
  updateHud();
}

function combatWon() {
  if (combatPhase !== 'won') {
    combatPhase = 'won';
    addLog('--- Combat Victory! ---');
  }

  // Check level up — if triggered, it sets phase='levelUp' and
  // proceedAfterCombat() will be called when the player picks an upgrade.
  if (checkLevelUp()) return;

  // No level up pending, proceed after a brief pause
  setTimeout(() => proceedAfterCombat(), 800);
}

function proceedAfterCombat() {
  // Floor 10 boss defeated — skip loot, go straight to victory
  if (floor === 10) {
    victory();
    return;
  }
  currentFightIndex++;
  if (currentFightIndex < currentFights.length) {
    addLog(`--- Next fight! ---`);
    startCombat(currentFights[currentFightIndex]);
  } else {
    showReward();
  }
}

function checkLevelUp() {
  if (player.exp >= player.expToNext) {
    player.exp -= player.expToNext;
    player.level++;
    player.expToNext = 10 + player.level * 8;
    addLog(`Level Up! Now level ${player.level}`);
    generateUpgradeCards();
    phase = 'levelUp';
    return true; // Will resume after pick
  }
  return false;
}

// ── Level Up System ────────────────────────────────────────────────

function generateUpgradeCards() {
  upgradeCards = [];
  let eligible = STAT_UPGRADES;
  // Remove speed upgrade if effective speed >= 50
  if (getEffectiveSpeed() >= 50) {
    eligible = eligible.filter(u => u.key !== 'bonusSpeed');
  }
  for (let i = 0; i < 3; i++) {
    const rarIdx = rngWeighted(RARITY_WEIGHTS);
    const rarity = RARITY_NAMES[rarIdx];
    const def = rngPick(eligible);
    const value = def.values[rarity];
    upgradeCards.push({
      type: 'stat',
      key: def.key,
      name: def.name,
      desc: def.desc.replace('{v}', value),
      value,
      rarity,
    });
  }
  levelUpHover = -1;
}

function applyUpgradeCard(index) {
  const card = upgradeCards[index];
  if (!card) return;

  player[card.key] = (player[card.key] || 0) + card.value;
  addLog(`Gained: ${card.name} (${card.desc})`);
  // Recalculate max HP
  const newMax = getMaxHp();
  if (newMax > player.maxHp) {
    player.hp += (newMax - player.maxHp);
    player.maxHp = newMax;
  }

  upgradeCards = [];
  phase = 'combat';

  // Check for more level ups before proceeding
  if (checkLevelUp()) return;

  // All level ups resolved — continue combat flow
  if (combatPhase === 'won') {
    proceedAfterCombat();
  } else if (combatPhase === 'playerTurn') {
    // Resume mid-combat: check if player still has actions or needs to transition
    if (playerActionsLeft <= 0 || !enemies.some(e => e.alive)) {
      if (!enemies.some(e => e.alive)) {
        combatWon();
      } else {
        startEnemyTurn();
      }
    }
    // else: player still has actions, just return to combat
  }
}

// ── Reward System ──────────────────────────────────────────────────

function generateLootCards(minRarityStr) {
  lootCards = [];
  const minIdx = RARITY_NAMES.indexOf(minRarityStr);

  for (let i = 0; i < 3; i++) {
    // Roll rarity, but clamp to at least minRarity
    let rarIdx = rngWeighted(RARITY_WEIGHTS);
    if (rarIdx < minIdx) rarIdx = minIdx;
    // Small chance to bump up
    if (rngNext() < 0.15 && rarIdx < RARITY_NAMES.length - 1) rarIdx++;
    const rarity = RARITY_NAMES[rarIdx];

    // 35% weapon, 35% armor, 30% consumable
    const roll = rngNext();
    if (roll < 0.35) {
      // Exclude weapon player already has equipped
      const eligible = WEAPONS.filter(w => w.rarity === rarity && !(player.weapon && player.weapon.name === w.name));
      if (eligible.length > 0) {
        const weapon = rngPick(eligible);
        lootCards.push({ type: 'weapon', item: { ...weapon }, rarity });
        continue;
      }
    }
    if (roll < 0.70) {
      // Exclude armor player already has equipped
      const eligible = ARMORS.filter(a => a.rarity === rarity && !(player.armor && player.armor.name === a.name));
      if (eligible.length > 0) {
        const armor = rngPick(eligible);
        lootCards.push({ type: 'armor', item: { ...armor }, rarity });
        continue;
      }
    }
    // Consumable — skip if player already has that item at max uses (5)
    let availItems = ITEM_UPGRADES.filter(def => {
      const potency = rarity === 'Legendary' ? 'legendary' : 'base';
      const existing = player.belt.find(b => b.type === def.key && b.potency === potency);
      return !(existing && existing.uses >= 5);
    });
    if (availItems.length === 0) availItems = ITEM_UPGRADES; // fallback
    const def = rngPick(availItems);
    const uses = def.uses[rarity];
    const isLeg = rarity === 'Legendary';
    const desc = isLeg ? def.desc.Legendary : def.desc.base;
    const potency = isLeg ? 'legendary' : 'base';
    lootCards.push({
      type: 'item',
      itemType: def.key,
      name: def.name,
      desc: `${desc}${uses > 1 ? ` (x${uses})` : ''}`,
      uses,
      potency,
      rarity,
    });
  }
  lootHover = -1;
}

function showReward() {
  generateLootCards(lootMinRarity);
  phase = 'reward';
}

function applyLootCard(index) {
  const card = lootCards[index];
  if (!card) return;

  if (card.type === 'weapon') {
    player.weapon = card.item;
    addLog(`Equipped: ${card.item.name}`);
  } else if (card.type === 'armor') {
    const oldMax = player.maxHp;
    player.armor = card.item;
    const newMax = getMaxHp();
    player.maxHp = newMax;
    if (newMax > oldMax) player.hp += (newMax - oldMax);
    else player.hp = Math.min(player.hp, player.maxHp);
    addLog(`Equipped: ${card.item.name}`);
  } else if (card.type === 'item') {
    // Stack with existing item of same type+potency
    const existing = player.belt.find(b => b.type === card.itemType && b.potency === card.potency);
    if (existing) {
      existing.uses = Math.min(existing.uses + card.uses, 5);
      addLog(`${card.name} +${card.uses} (now x${existing.uses})`);
    } else if (player.belt.length < 4) {
      player.belt.push({ type: card.itemType, uses: card.uses, potency: card.potency });
      addLog(`Added ${card.name} to belt (x${card.uses})`);
    } else {
      addLog(`Belt full! ${card.name} discarded`);
    }
  }

  lootCards = [];
  returnToPathSelect();
}

function returnToPathSelect() {
  // Mark the path we just completed
  if (selectedPath >= 0 && !completedPaths.includes(selectedPath)) {
    completedPaths.push(selectedPath);
  }
  phase = 'pathSelect';
  selectedPath = -1;
  pathHover = -1;
  combatPhase = 'playerTurn';
  animating = false;
}

// ── Path Selection ─────────────────────────────────────────────────

function selectPath(index) {
  const path = paths[index];
  if (!path) return;

  selectedPath = index;
  addLog(`--- Floor ${floor}: ${path.name} ---`);

  if (path.type === 'rest') {
    const healAmt = Math.round(player.maxHp * 0.4);
    player.hp = Math.min(player.maxHp, player.hp + healAmt);
    addLog(`Rested at shrine. Healed ${healAmt} HP.`);
    returnToPathSelect();
    return;
  }

  currentFights = path.fights;
  currentFightIndex = path.resumeFightIndex || 0;
  lootMinRarity = path.lootRarity || 'Common';

  phase = 'combat';
  // Restore saved enemies if fleeing and re-entering same fight
  if (path.savedEnemies) {
    const saved = path.savedEnemies;
    const savedActions = path.savedPlayerActionsLeft;
    const savedMax = path.savedPlayerMaxActions;
    delete path.savedEnemies;
    delete path.savedPlayerActionsLeft;
    delete path.savedPlayerMaxActions;
    startCombat(saved);
    playerActionsLeft = savedActions;
    playerMaxActions = savedMax;
    buildTurnQueue();
  } else {
    startCombat(currentFights[currentFightIndex]);
  }
}

function fleeCombat() {
  if (floor === 10) return; // Can't flee the Mother Bug
  addLog(`You fled from combat!`);
  // Save combat state so re-entering preserves enemy HP/status
  if (selectedPath >= 0 && paths[selectedPath]) {
    paths[selectedPath].resumeFightIndex = currentFightIndex;
    paths[selectedPath].savedEnemies = enemies.map(e => ({ ...e }));
    paths[selectedPath].savedPlayerActionsLeft = playerActionsLeft;
    paths[selectedPath].savedPlayerMaxActions = playerMaxActions;
  }
  enemies = [];
  combatPhase = 'playerTurn';
  animating = false;
  // Return to same floor's path selection
  phase = 'pathSelect';
  selectedPath = -1;
  pathHover = -1;
}

// ── Game Over / Victory ────────────────────────────────────────────

function gameOver() {
  running = false;
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }

  const state = loadState();
  state.stats.citadelTotalRuns = (state.stats.citadelTotalRuns || 0) + 1;
  if (floor > (state.stats.citadelBestFloor || 0)) {
    state.stats.citadelBestFloor = floor;
  }
  saveState(state);

  phase = 'gameOver';
  // Render one final frame
  render();
}

function victory() {
  running = false;
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }

  const state = loadState();
  state.stats.citadelClears = (state.stats.citadelClears || 0) + 1;
  state.stats.citadelTotalRuns = (state.stats.citadelTotalRuns || 0) + 1;
  if (floor > (state.stats.citadelBestFloor || 0)) {
    state.stats.citadelBestFloor = floor;
  }

  // Award pot EXP
  if (selectedPlant && selectedPlant.potElement) {
    const gardenPlant = state.garden.find(p => p.id === selectedPlant.id);
    if (gardenPlant) {
      const expAward = 50 + player.level * 10;
      gardenPlant.potExp = (gardenPlant.potExp || 0) + expAward;
      gardenPlant.potLevel = potLevelFromExp(gardenPlant.potExp);
    }
  }

  saveState(state);
  phase = 'victory';
  render();
}

// ── Combat Log ─────────────────────────────────────────────────────

function addLog(msg) {
  combatLog.push(msg);
  if (combatLog.length > 100) combatLog.shift();
  combatLogScroll = Math.max(0, combatLog.length - 5);
}

// ── Game Loop ──────────────────────────────────────────────────────

function gameLoop() {
  if (!running) return;
  update();
  render();
  rafId = requestAnimationFrame(gameLoop);
}

function update() {
  frameCount++;

  // Update animation timers
  if (animating) {
    if (fastMode) animTimer = Math.min(animTimer, 1);
    animTimer--;
    if (animTimer <= 0) {
      animating = false;
      // After player attack/defend animation (items don't consume turns)
      if (animType === 'playerAttack' || animType === 'defend') {
        advancePlayerAction();
      } else if (animType === 'enemyAttack') {
        finishEnemyAction();
      } else if (animType === 'bomb' || animType === 'heal') {
        // Items don't use a turn — but bomb may have won combat
        if (combatPhase === 'won') {
          combatWon();
        }
      }
    }
  }

  if (fastMode) {
    shakeTimer = 0;
    flashTimer = 0;
    for (const e of enemies) e.flashTimer = 0;
    vfxParticles = [];
    slashEffect = null;
    screenFlash = null;
    shieldEffect = null;
  }
  if (shakeTimer > 0) shakeTimer--;
  if (flashTimer > 0) flashTimer--;

  // Update enemy flash timers
  for (const e of enemies) {
    if (e.flashTimer > 0) e.flashTimer--;
  }

  // Update damage popups
  for (let i = dmgPopups.length - 1; i >= 0; i--) {
    dmgPopups[i].timer--;
    dmgPopups[i].y -= 0.4; // float upward
    if (dmgPopups[i].timer <= 0) dmgPopups.splice(i, 1);
  }

  // Update VFX
  updateVfxParticles();

  // Update floor transition
  if (phase === 'floorTransition' && floorTransition) {
    if (fastMode) {
      floorTransition.timer = floorTransition.maxTimer;
    }
    floorTransition.timer++;
    if (floorTransition.timer >= floorTransition.maxTimer) {
      finishFloorTransition();
    }
  }

  // Update boss cinematic
  if (phase === 'bossCinematic' && bossCinematic) {
    if (fastMode) {
      bossCinematic.timer = bossCinematic.maxTimer;
    }
    bossCinematic.timer++;
    if (bossCinematic.timer >= bossCinematic.maxTimer) {
      finishBossCinematic();
    }
  }
}

// ── HUD ────────────────────────────────────────────────────────────

function updateHud() {
  const hud = document.getElementById('citadelHud');
  if (!hud) return;

  const spd = getEffectiveSpeed();
  const acts = getActionsPerRound();

  const elem = selectedPlant?.potElement;
  const elemBadge = elem ? { fire: '🔥', ice: '❄', earth: '🌿', wind: '💨' }[elem] || '' : '';

  hud.innerHTML = `
    <span class="citadel-hud-floor">F${floor}/10</span>
    <span class="citadel-hud-hp">HP ${player.hp}/${player.maxHp}</span>
    <span class="citadel-hud-speed">SPD ${spd} (${acts}act)</span>
    <span class="citadel-hud-level">Lv.${player.level}${elemBadge ? ' ' + elemBadge : ''}</span>
  `;
}

// ── Rendering ──────────────────────────────────────────────────────

function render() {
  ctx.save();
  ctx.scale(CANVAS_SCALE, CANVAS_SCALE);

  // Themed dungeon background
  renderDungeonBackground(getFloorTheme(floor));

  if (phase === 'floorTransition') {
    renderFloorTransition();
  } else if (phase === 'bossCinematic') {
    renderBossCinematic();
  } else if (phase === 'pathSelect') {
    renderPathSelect();
  } else if (phase === 'combat') {
    renderCombat();
  } else if (phase === 'levelUp') {
    renderLevelUp();
  } else if (phase === 'reward') {
    renderReward();
  } else if (phase === 'gameOver') {
    renderGameOver();
  } else if (phase === 'victory') {
    renderVictory();
  }

  // Toggle buttons + stats overlay (visible on pathSelect and combat)
  if (phase === 'pathSelect' || phase === 'combat' || phase === 'floorTransition' || phase === 'bossCinematic') {
    renderToggleButtons();
    if (showStats) renderStatsOverlay();
  }

  ctx.restore();
}

function renderToggleButtons() {
  const bw = 28;
  const bh = 10;
  const bx = W - bw - 5;
  const bgap = 3;

  // QUIT button below floor indicator
  const quitY = 16;
  ctx.fillStyle = '#2a1a1a';
  ctx.fillRect(bx, quitY, bw, bh);
  ctx.strokeStyle = '#884444';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, quitY, bw, bh);
  ctx.fillStyle = '#cc6666';
  ctx.font = '4px "Press Start 2P"';
  ctx.textAlign = 'center';
  ctx.fillText('QUIT', bx + bw / 2, quitY + 7);

  // FAST button below QUIT
  const fastY = quitY + bh + bgap;
  ctx.fillStyle = fastMode ? '#2a4a2a' : '#2a2a2a';
  ctx.fillRect(bx, fastY, bw, bh);
  ctx.strokeStyle = fastMode ? '#4a8a4a' : '#555555';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, fastY, bw, bh);
  ctx.fillStyle = fastMode ? '#88ee88' : '#888888';
  ctx.font = '4px "Press Start 2P"';
  ctx.textAlign = 'center';
  ctx.fillText('FAST', bx + bw / 2, fastY + 7);

  // STATS button below FAST
  const statsY = fastY + bh + bgap;
  ctx.fillStyle = showStats ? '#2a2a4a' : '#2a2a2a';
  ctx.fillRect(bx, statsY, bw, bh);
  ctx.strokeStyle = showStats ? '#4a4a8a' : '#555555';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, statsY, bw, bh);
  ctx.fillStyle = showStats ? '#8888ee' : '#888888';
  ctx.font = '3px "Press Start 2P"';
  ctx.textAlign = 'center';
  ctx.fillText('STATS', bx + bw / 2, statsY + 7);
}

function renderStatsOverlay() {
  const sx = 5;
  const sy = 55;
  const lineH = 8;
  const pad = 3;

  const spd = getEffectiveSpeed();
  const acts = getActionsPerRound();
  const weaponDmg = player.weapon ? player.weapon.dmg : 0;
  const totalDmg = weaponDmg + player.bonusDamage;
  const totalArmor = (player.armor ? player.armor.def : 0) + player.bonusArmor;
  const critChance = 5 + (player.weapon ? player.weapon.critBonus : 0) + player.bonusCrit;
  const critMult = 150 + player.bonusCritMult;

  const stats = [
    { label: 'DMG', value: `${totalDmg}`, color: '#ee8866' },
    { label: 'DEF', value: `${totalArmor}`, color: '#6688cc' },
    { label: 'SPD', value: `${spd}`, color: '#66ccaa' },
    { label: 'ACT', value: `${acts}`, color: '#aabb66' },
    { label: 'CRT', value: `${critChance}%`, color: '#ccaa44' },
    { label: 'CRx', value: `${(critMult / 100).toFixed(1)}x`, color: '#cc8844' },
    { label: 'HP', value: `${player.hp}/${player.maxHp}`, color: '#66cc66' },
  ];

  ctx.font = '4px "Press Start 2P"';

  // Measure to find minimum width
  let maxLabelW = 0;
  let maxValW = 0;
  for (const s of stats) {
    maxLabelW = Math.max(maxLabelW, ctx.measureText(s.label).width);
    maxValW = Math.max(maxValW, ctx.measureText(s.value).width);
  }
  const colGap = 3;
  const sw = pad + maxLabelW + colGap + maxValW + pad;
  const rx = W - sw - 5; // right-aligned
  const valX = rx + pad + maxLabelW + colGap;

  // Background
  const sh = stats.length * lineH + 6;
  ctx.fillStyle = 'rgba(10, 10, 20, 0.85)';
  ctx.fillRect(rx, sy, sw, sh);
  ctx.strokeStyle = '#444466';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(rx, sy, sw, sh);

  ctx.font = '4px "Press Start 2P"';
  for (let i = 0; i < stats.length; i++) {
    const s = stats[i];
    const ly = sy + 7 + i * lineH;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#888899';
    ctx.fillText(s.label, rx + pad + maxLabelW, ly);
    ctx.textAlign = 'left';
    ctx.fillStyle = s.color;
    ctx.fillText(s.value, valX, ly);
  }
}

function renderPathSelect() {
  // Dungeon map on left side
  renderDungeonMap();

  // Title
  ctx.fillStyle = '#c0a0d0';
  ctx.font = '8px "Press Start 2P"';
  ctx.textAlign = 'center';
  ctx.fillText(`Floor ${floor}`, CX + 10, 20);

  ctx.fillStyle = '#8a7a9a';
  ctx.font = '5px "Press Start 2P"';
  ctx.fillText('Choose your path', CX, 32);

  // Draw path cards
  const cardW = 90;
  const cardH = 110;
  const gap = 8;
  const totalW = paths.length * cardW + (paths.length - 1) * gap;
  const startX = CX - totalW / 2;
  const cardY = 50;

  for (let i = 0; i < paths.length; i++) {
    const path = paths[i];
    const cx = startX + i * (cardW + gap);
    const isHover = (i === pathHover);
    const isDone = completedPaths.includes(i);

    // Dim completed paths
    if (isDone) ctx.globalAlpha = 0.4;

    // Card background
    ctx.fillStyle = isHover && !isDone ? '#2a2a3a' : '#1a1a2a';
    ctx.fillRect(cx, cardY, cardW, cardH);

    // Border
    ctx.strokeStyle = isDone ? '#555' : path.color;
    ctx.lineWidth = isHover && !isDone ? 2 : 1;
    ctx.strokeRect(cx, cardY, cardW, cardH);

    // Path name
    ctx.fillStyle = isDone ? '#555' : path.color;
    ctx.font = '5px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.fillText(path.name, cx + cardW / 2, cardY + 18);

    // Icon
    renderPathIcon(cx + cardW / 2, cardY + 42, path.type);

    // Description
    ctx.fillStyle = '#9a9aaa';
    ctx.font = '4px "Press Start 2P"';
    const words = path.desc.split(' ');
    let line = '';
    let lineY = cardY + 65;
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > cardW - 8) {
        ctx.fillText(line, cx + cardW / 2, lineY);
        line = word;
        lineY += 8;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, cx + cardW / 2, lineY);

    // Loot rarity tag
    if (path.lootRarity) {
      ctx.fillStyle = RARITY_COLORS[path.lootRarity] || '#666';
      ctx.font = '4px "Press Start 2P"';
      ctx.fillText(path.lootRarity + ' Loot', cx + cardW / 2, cardY + cardH - 8);
    }

    ctx.globalAlpha = 1;

    // Checkmark overlay on completed paths
    if (isDone) {
      ctx.fillStyle = '#4aaa4a';
      ctx.font = '14px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillText('✓', cx + cardW / 2, cardY + cardH / 2 + 5);
    }
  }

  // HP/EXP bars + player stats at bottom
  renderHpExpBars(168);
  renderPlayerStats(186);

  // Next Floor button (once at least 1 path completed)
  if (completedPaths.length > 0) {
    const nfW = 80;
    const nfH = 16;
    const nfX = CX - nfW / 2;
    const nfY = H - 28;
    ctx.fillStyle = '#2a4a2a';
    ctx.fillRect(nfX, nfY, nfW, nfH);
    ctx.strokeStyle = '#4a8a4a';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(nfX, nfY, nfW, nfH);
    ctx.fillStyle = '#88ee88';
    ctx.font = '5px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.fillText('NEXT FLOOR', CX, nfY + 11);
  }

}

function renderPathIcon(x, y, type) {
  ctx.save();
  if (type === 'safe') {
    // Shield icon
    ctx.fillStyle = '#4a8a4a';
    ctx.beginPath();
    ctx.moveTo(x, y - 10);
    ctx.lineTo(x + 8, y - 6);
    ctx.lineTo(x + 8, y + 2);
    ctx.lineTo(x, y + 8);
    ctx.lineTo(x - 8, y + 2);
    ctx.lineTo(x - 8, y - 6);
    ctx.closePath();
    ctx.fill();
  } else if (type === 'dangerous') {
    // Skull icon (simplified)
    ctx.fillStyle = '#ba4a2a';
    ctx.fillRect(x - 6, y - 7, 12, 10);
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(x - 4, y - 5, 3, 3);
    ctx.fillRect(x + 1, y - 5, 3, 3);
    ctx.fillStyle = '#ba4a2a';
    ctx.fillRect(x - 4, y + 3, 8, 4);
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(x - 2, y + 3, 1, 4);
    ctx.fillRect(x + 1, y + 3, 1, 4);
  } else if (type === 'treasure') {
    // Chest icon
    ctx.fillStyle = '#9a6a1a';
    ctx.fillRect(x - 8, y - 4, 16, 10);
    ctx.fillStyle = '#c49a1a';
    ctx.fillRect(x - 8, y - 7, 16, 5);
    ctx.fillStyle = '#dab030';
    ctx.fillRect(x - 2, y - 2, 4, 4);
  } else if (type === 'rest') {
    // Campfire icon
    ctx.fillStyle = '#8a5a2a';
    ctx.fillRect(x - 4, y + 2, 2, 6);
    ctx.fillRect(x + 2, y + 2, 2, 6);
    ctx.fillStyle = '#cc6620';
    ctx.fillRect(x - 3, y - 4, 6, 6);
    ctx.fillStyle = '#ffaa30';
    ctx.fillRect(x - 2, y - 6, 4, 4);
    ctx.fillStyle = '#ffdd60';
    ctx.fillRect(x - 1, y - 7, 2, 3);
  }
  ctx.restore();
}

function renderCombat() {
  // Enemies at top
  const aliveEnemies = enemies.filter(e => e.alive);
  const enemyGap = Math.min(60, (W - 20) / Math.max(1, enemies.length));
  const enemyStartX = CX - (enemies.length - 1) * enemyGap / 2;

  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (!e.alive) continue;

    let ex = enemyStartX + i * enemyGap;
    let ey = 55;

    // Shake effect
    if (shakeTarget === 'enemy' && shakeTimer > 0 && animData.target === i) {
      ex += Math.sin(shakeTimer * 2) * 3;
    }

    // Flash on damage
    if (e.flashTimer > 0 && e.flashTimer % 4 < 2) {
      ctx.globalAlpha = 0.5;
    }

    renderEnemySprite(ex, ey, e);
    ctx.globalAlpha = 1;

    // HP bar
    const barW = 40;
    const barH = 4;
    const barX = ex - barW / 2;
    const barY = ey + 18;
    ctx.fillStyle = '#2a0a0a';
    ctx.fillRect(barX, barY, barW, barH);
    const hpPct = e.hp / e.maxHp;
    ctx.fillStyle = hpPct > 0.5 ? '#4a8a2a' : hpPct > 0.25 ? '#ba8a20' : '#ba2a2a';
    ctx.fillRect(barX, barY, Math.round(barW * hpPct), barH);

    // Name
    ctx.fillStyle = '#ccccdd';
    ctx.font = '4px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.fillText(e.name, ex, barY + 10);

    // HP text
    ctx.fillStyle = '#999';
    ctx.fillText(`${e.hp}/${e.maxHp}`, ex, barY + 17);

    // Target indicator
    if (i === targetEnemy && combatPhase === 'playerTurn') {
      ctx.fillStyle = '#ffdd00';
      ctx.fillRect(ex - 2, ey - 18, 4, 4);
      ctx.fillRect(ex - 1, ey - 15, 2, 3);
    }

    // Enraged indicator
    if (e.enraged) {
      ctx.fillStyle = '#ff2020';
      ctx.font = '4px "Press Start 2P"';
      ctx.fillText('ENRAGED', ex, ey - 20);
    }
  }

  // Combat log (middle section)
  renderCombatLog();

  // Player at bottom
  let playerX = CX;
  let playerY = H - 100;
  if (shakeTarget === 'player' && shakeTimer > 0) {
    playerX += Math.sin(shakeTimer * 2) * 3;
  }
  if (flashTarget === 'player' && flashTimer > 0 && flashTimer % 4 < 2) {
    ctx.globalAlpha = 0.5;
  }
  renderPlayerSprite(playerX, playerY);
  ctx.globalAlpha = 1;

  // Player HP + EXP bars
  renderHpExpBars(H - 72);

  // Defend indicator
  if (player.defending) {
    ctx.fillStyle = '#4488cc';
    ctx.font = '4px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.fillText('DEFENDING', CX, H - 75);
  }

  // Poison indicator
  if (player.poison > 0) {
    ctx.fillStyle = '#80cc40';
    ctx.font = '4px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.fillText(`POISON ×${player.poison}`, CX + 60, H - 48);
  }

  // Action buttons (only on player turn, not animating)
  if (combatPhase === 'playerTurn' && !animating) {
    renderActionButtons();
  }

  // Actions remaining
  if (combatPhase === 'playerTurn') {
    ctx.fillStyle = '#aaaacc';
    ctx.font = '4px "Press Start 2P"';
    ctx.textAlign = 'right';
    ctx.fillText(`Actions: ${playerActionsLeft}/${playerMaxActions}`, W - 5, 12);
  }

  // Floor indicator
  ctx.fillStyle = '#8a7a9a';
  ctx.font = '5px "Press Start 2P"';
  ctx.textAlign = 'left';
  ctx.fillText(`F${floor}`, 5, 12);
  const f1Width = ctx.measureText(`F${floor}`).width;
  ctx.fillStyle = '#6a5a7a';
  ctx.font = '4px "Press Start 2P"';
  ctx.fillText(`${floor}/10`, 5 + f1Width + 3, 12);

  // Turn queue indicator
  renderTurnQueue();

  // VFX layers
  renderVfxParticles();
  renderSlashEffect();
  renderShieldEffect();

  // Floating damage numbers (on top of everything)
  renderDmgPopups();

  // Screen flash (very top)
  renderScreenFlash();
}

function renderTurnQueue() {
  const btnY = H - 22;
  const slotH = 12;
  const queueY = btnY - slotH - 6;
  const slotW = 50;
  const gap = 3;
  const maxSlots = 5;

  // Victory state — single gold bar
  if (combatPhase === 'won') {
    const victoryW = maxSlots * (slotW + gap) - gap;
    const vx = CX - victoryW / 2;
    ctx.fillStyle = '#4a3a0a';
    ctx.fillRect(vx, queueY, victoryW, slotH);
    ctx.strokeStyle = '#ffcc00';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(vx, queueY, victoryW, slotH);
    ctx.fillStyle = '#ffdd44';
    ctx.font = '5px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.fillText('VICTORY', CX, queueY + slotH / 2 + 2);
    return;
  }

  if (turnQueue.length === 0) return;

  const count = Math.min(turnQueue.length, maxSlots);
  const totalW = count * (slotW + gap) - gap;
  const startX = CX - totalW / 2;

  // Background bar
  ctx.fillStyle = 'rgba(10, 10, 20, 0.6)';
  ctx.fillRect(startX - 3, queueY - 1, totalW + 6, slotH + 2);

  for (let i = 0; i < count; i++) {
    const entry = turnQueue[i];
    const x = startX + i * (slotW + gap);
    const isPlayer = entry.type === 'player';
    const isActive = (i === 0);

    // Slot background
    ctx.fillStyle = isPlayer
      ? (isActive ? '#2a6a2a' : '#1a4a1a')
      : (isActive ? '#6a2a2a' : '#4a1a1a');
    ctx.fillRect(x, queueY, slotW, slotH);

    // Border
    ctx.strokeStyle = isPlayer ? '#4aaa4a' : '#aa4a4a';
    ctx.lineWidth = isActive ? 1.5 : 0.5;
    ctx.strokeRect(x, queueY, slotW, slotH);

    // Active glow
    if (isActive) {
      ctx.strokeStyle = isPlayer ? '#88ff88' : '#ff8888';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x - 0.5, queueY - 0.5, slotW + 1, slotH + 1);
    }

    // Name text
    ctx.fillStyle = isPlayer ? '#88ee88' : '#ee8888';
    ctx.font = '4px "Press Start 2P"';
    ctx.textAlign = 'center';
    let name = entry.name;
    if (ctx.measureText(name).width > slotW - 4) {
      while (name.length > 2 && ctx.measureText(name + '..').width > slotW - 4) {
        name = name.slice(0, -1);
      }
      name += '..';
    }
    ctx.fillText(name, x + slotW / 2, queueY + slotH / 2 + 2);
  }
}

function renderDmgPopups() {
  for (const p of dmgPopups) {
    const progress = 1 - p.timer / p.maxTimer;
    ctx.globalAlpha = Math.max(0, 1 - progress * 1.2); // fade out over last ~80%
    ctx.fillStyle = p.color;
    ctx.font = `bold ${p.size}px "Press Start 2P"`;
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeText(p.text, p.x, p.y);
    ctx.fillText(p.text, p.x, p.y);
  }
  ctx.globalAlpha = 1;
}

function renderCombatLog() {
  const logX = 10;
  const logY = 140;
  const logH = 55;
  const lineH = 8;

  ctx.fillStyle = 'rgba(10, 10, 20, 0.7)';
  ctx.fillRect(logX, logY, W - 20, logH);

  ctx.font = '4px "Press Start 2P"';

  const logCX = logX + (W - 20) / 2;
  const maxLines = Math.floor(logH / lineH);
  const startIdx = Math.max(0, combatLog.length - maxLines);
  for (let i = startIdx; i < combatLog.length; i++) {
    const lineIdx = i - startIdx;
    const msg = combatLog[i];

    // Color code
    if (msg.includes('CRIT') || msg.includes('Level Up')) {
      ctx.fillStyle = '#ffdd00';
    } else if (msg.includes('defeated') || msg.includes('Victory')) {
      ctx.fillStyle = '#4abb4a';
    } else if (msg.includes('hit you') || msg.includes('poison') || msg.includes('ENRAGE')) {
      ctx.fillStyle = '#cc4444';
    } else if (msg.includes('Healed') || msg.includes('Rested')) {
      ctx.fillStyle = '#44cc88';
    } else if (msg.includes('---')) {
      ctx.fillStyle = '#aaaacc';
    } else {
      ctx.fillStyle = '#8888aa';
    }

    ctx.textAlign = 'center';
    ctx.fillText(msg.substring(0, 45), logCX, logY + 8 + lineIdx * lineH);
  }
}

function renderActionButtons() {
  const btnW = 42;
  const btnH = 16;
  const btnY = H - 22;
  const gap = 3;
  const itemBtnW = 28;
  const itemGap = 2;

  // Calculate total width for centering
  const mainBtns = floor < 10 ? 3 : 2; // ATK, DEF, (FLEE)
  const totalW = mainBtns * btnW + (mainBtns - 1) * gap + gap + 4 * itemBtnW + 3 * itemGap;
  const startX = Math.round(CX - totalW / 2);

  // Attack button
  const atkX = startX;
  ctx.fillStyle = selectedAction === 0 ? '#6a2a2a' : '#3a1a1a';
  ctx.fillRect(atkX, btnY, btnW, btnH);
  ctx.strokeStyle = '#aa4444';
  ctx.lineWidth = 1;
  ctx.strokeRect(atkX, btnY, btnW, btnH);
  ctx.fillStyle = '#ee6644';
  ctx.font = '5px "Press Start 2P"';
  ctx.textAlign = 'center';
  ctx.fillText('ATK', atkX + btnW / 2, btnY + 11);

  // Defend button
  const defX = atkX + btnW + gap;
  ctx.fillStyle = selectedAction === 1 ? '#2a2a6a' : '#1a1a3a';
  ctx.fillRect(defX, btnY, btnW, btnH);
  ctx.strokeStyle = '#4488cc';
  ctx.strokeRect(defX, btnY, btnW, btnH);
  ctx.fillStyle = '#6699dd';
  ctx.fillText('DEF', defX + btnW / 2, btnY + 11);

  // Flee button (not on floor 10)
  let fleeEndX = defX + btnW;
  if (floor < 10) {
    const fleeX = defX + btnW + gap;
    ctx.fillStyle = '#2a2a1a';
    ctx.fillRect(fleeX, btnY, btnW, btnH);
    ctx.strokeStyle = '#886644';
    ctx.lineWidth = 1;
    ctx.strokeRect(fleeX, btnY, btnW, btnH);
    ctx.fillStyle = '#cc9966';
    ctx.fillText('FLEE', fleeX + btnW / 2, btnY + 11);
    fleeEndX = fleeX + btnW;
  }

  // Belt items
  const itemStartX = fleeEndX + gap;
  for (let i = 0; i < 4; i++) {
    const ix = itemStartX + i * (itemBtnW + itemGap);
    if (ix + itemBtnW > W) break;
    const item = player.belt[i];
    ctx.fillStyle = item ? '#1a2a1a' : '#1a1a1a';
    ctx.fillRect(ix, btnY, itemBtnW, btnH);
    ctx.strokeStyle = item ? '#44aa44' : '#333';
    ctx.strokeRect(ix, btnY, itemBtnW, btnH);

    if (item) {
      ctx.fillStyle = item.potency === 'legendary' ? '#ffcc44' : '#88cc88';
      ctx.font = '3px "Press Start 2P"';
      ctx.textAlign = 'center';
      const label = item.type === 'healPotion' ? 'HP' : 'BMB';
      ctx.fillText(label, ix + itemBtnW / 2, btnY + 8);
      // Show remaining uses
      ctx.fillStyle = '#aaa';
      ctx.font = '3px "Press Start 2P"';
      ctx.fillText(`x${item.uses}`, ix + itemBtnW / 2, btnY + 14);
    }
  }

}

function renderPlayerSprite(x, y) {
  if (plantSprite) {
    const sprW = Math.min(plantSprite.width, 40);
    const sprH = Math.min(plantSprite.height, 40);
    const scale = Math.min(40 / plantSprite.width, 40 / plantSprite.height);
    const dw = plantSprite.width * scale;
    const dh = plantSprite.height * scale;
    ctx.drawImage(plantSprite, x - dw / 2, y - dh / 2, dw, dh);
  } else {
    // Fallback green circle
    ctx.fillStyle = '#4a8a2a';
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.fill();
  }
}

function renderEnemySprite(x, y, enemy) {
  const key = enemy.type + (enemy.enraged ? '_rage' : '');
  if (!spriteCache[key]) {
    spriteCache[key] = generateEnemySprite(enemy);
  }
  const spr = spriteCache[key];
  ctx.drawImage(spr, x - spr.width / 2, y - spr.height / 2);
}

function generateEnemySprite(enemy) {
  const type = enemy.type;
  const size = enemy.isBoss ? 24 : 14;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const cx = c.getContext('2d');
  cx.imageSmoothingEnabled = false;

  const baseColor = enemy.enraged ? '#cc2020' : enemy.color;
  const lightColor = lightenColor(baseColor, 30);
  const darkColor = darkenColor(baseColor, 20);

  if (type === 'aphid') {
    // Small round bug
    cx.fillStyle = baseColor;
    cx.fillRect(3, 3, 8, 7);
    cx.fillStyle = lightColor;
    cx.fillRect(4, 3, 6, 2);
    cx.fillStyle = '#fff';
    cx.fillRect(4, 5, 2, 2);
    cx.fillRect(8, 5, 2, 2);
    cx.fillStyle = '#000';
    cx.fillRect(5, 6, 1, 1);
    cx.fillRect(9, 6, 1, 1);
    // Legs
    cx.fillStyle = darkColor;
    cx.fillRect(2, 8, 1, 3);
    cx.fillRect(11, 8, 1, 3);
    cx.fillRect(4, 10, 1, 2);
    cx.fillRect(9, 10, 1, 2);
  } else if (type === 'beetle') {
    cx.fillStyle = baseColor;
    cx.fillRect(2, 2, 10, 9);
    cx.fillStyle = lightColor;
    cx.fillRect(3, 2, 8, 3);
    // Shell line
    cx.fillStyle = darkColor;
    cx.fillRect(7, 4, 1, 6);
    // Eyes
    cx.fillStyle = '#cc0';
    cx.fillRect(3, 4, 2, 2);
    cx.fillRect(9, 4, 2, 2);
    // Legs
    cx.fillStyle = darkColor;
    cx.fillRect(1, 7, 1, 3);
    cx.fillRect(12, 7, 1, 3);
    cx.fillRect(2, 10, 1, 2);
    cx.fillRect(11, 10, 1, 2);
    // Horns
    cx.fillStyle = '#555';
    cx.fillRect(4, 0, 1, 3);
    cx.fillRect(9, 0, 1, 3);
  } else if (type === 'mosquito') {
    cx.fillStyle = baseColor;
    cx.fillRect(5, 4, 4, 6);
    cx.fillStyle = lightColor;
    cx.fillRect(5, 4, 4, 2);
    // Wings
    cx.fillStyle = 'rgba(150,150,200,0.5)';
    cx.fillRect(1, 2, 4, 5);
    cx.fillRect(9, 2, 4, 5);
    // Proboscis
    cx.fillStyle = '#aa4444';
    cx.fillRect(6, 10, 2, 3);
    // Eyes
    cx.fillStyle = '#f00';
    cx.fillRect(5, 5, 1, 1);
    cx.fillRect(8, 5, 1, 1);
  } else if (type === 'stag') {
    cx.fillStyle = baseColor;
    cx.fillRect(2, 3, 10, 8);
    cx.fillStyle = lightColor;
    cx.fillRect(3, 3, 8, 3);
    cx.fillStyle = darkColor;
    cx.fillRect(7, 5, 1, 6);
    // Big mandibles
    cx.fillStyle = '#665544';
    cx.fillRect(1, 0, 2, 5);
    cx.fillRect(11, 0, 2, 5);
    cx.fillRect(0, 0, 3, 2);
    cx.fillRect(11, 0, 3, 2);
    // Eyes
    cx.fillStyle = '#f80';
    cx.fillRect(3, 5, 2, 2);
    cx.fillRect(9, 5, 2, 2);
    // Legs
    cx.fillStyle = darkColor;
    cx.fillRect(1, 9, 1, 3);
    cx.fillRect(12, 9, 1, 3);
  } else if (type === 'centipede') {
    // Long segmented
    for (let i = 0; i < 6; i++) {
      cx.fillStyle = i % 2 === 0 ? baseColor : lightColor;
      cx.fillRect(3, 1 + i * 2, 8, 2);
      cx.fillStyle = darkColor;
      cx.fillRect(1, 1 + i * 2, 2, 1);
      cx.fillRect(11, 1 + i * 2, 2, 1);
    }
    cx.fillStyle = '#ff0';
    cx.fillRect(4, 1, 1, 1);
    cx.fillRect(9, 1, 1, 1);
  } else if (type === 'mantis') {
    cx.fillStyle = baseColor;
    cx.fillRect(4, 2, 6, 10);
    cx.fillStyle = lightColor;
    cx.fillRect(5, 2, 4, 3);
    // Arms (scythes)
    cx.fillStyle = '#6a9a3a';
    cx.fillRect(0, 3, 4, 2);
    cx.fillRect(10, 3, 4, 2);
    cx.fillRect(0, 2, 2, 1);
    cx.fillRect(12, 2, 2, 1);
    // Eyes
    cx.fillStyle = '#ff0';
    cx.fillRect(5, 3, 2, 2);
    cx.fillRect(7, 3, 2, 2);
  } else if (type === 'hornet') {
    cx.fillStyle = '#888820';
    cx.fillRect(4, 2, 6, 4);
    cx.fillStyle = '#222';
    cx.fillRect(4, 6, 6, 2);
    cx.fillStyle = '#888820';
    cx.fillRect(4, 8, 6, 2);
    // Stinger
    cx.fillStyle = '#cc4444';
    cx.fillRect(6, 10, 2, 3);
    // Wings
    cx.fillStyle = 'rgba(180,180,220,0.5)';
    cx.fillRect(1, 1, 3, 5);
    cx.fillRect(10, 1, 3, 5);
    // Eyes
    cx.fillStyle = '#f00';
    cx.fillRect(5, 3, 1, 1);
    cx.fillRect(8, 3, 1, 1);
  } else if (type === 'scarab') {
    // Larger golden bug
    const s = size;
    cx.fillStyle = '#6a5a10';
    cx.fillRect(4, 4, 16, 14);
    cx.fillStyle = '#8a7a20';
    cx.fillRect(5, 4, 14, 5);
    cx.fillStyle = '#aa9a30';
    cx.fillRect(8, 5, 8, 3);
    cx.fillStyle = '#4a3a08';
    cx.fillRect(12, 7, 1, 10);
    // Eyes
    cx.fillStyle = '#0ff';
    cx.fillRect(6, 7, 3, 3);
    cx.fillRect(15, 7, 3, 3);
    // Crown
    cx.fillStyle = '#c49a1a';
    cx.fillRect(8, 1, 8, 3);
    cx.fillRect(7, 2, 1, 2);
    cx.fillRect(16, 2, 1, 2);
    cx.fillRect(10, 0, 1, 2);
    cx.fillRect(13, 0, 1, 2);
    // Legs
    cx.fillStyle = '#3a2a08';
    cx.fillRect(2, 12, 2, 4);
    cx.fillRect(20, 12, 2, 4);
    cx.fillRect(4, 16, 2, 3);
    cx.fillRect(18, 16, 2, 3);
  } else if (type === 'motherbug') {
    // Big scary boss
    const s = size;
    // Body
    cx.fillStyle = enemy.enraged ? '#5a0a1a' : '#3a0a2a';
    cx.fillRect(3, 5, 18, 14);
    cx.fillStyle = enemy.enraged ? '#7a1a2a' : '#5a1a3a';
    cx.fillRect(4, 5, 16, 5);
    // Wings
    cx.fillStyle = enemy.enraged ? 'rgba(200,50,50,0.4)' : 'rgba(100,50,120,0.4)';
    cx.fillRect(0, 3, 5, 10);
    cx.fillRect(19, 3, 5, 10);
    // Eyes (multiple)
    cx.fillStyle = enemy.enraged ? '#ff0000' : '#ff00ff';
    cx.fillRect(6, 8, 3, 3);
    cx.fillRect(15, 8, 3, 3);
    cx.fillStyle = enemy.enraged ? '#ff4444' : '#ff44ff';
    cx.fillRect(9, 6, 2, 2);
    cx.fillRect(13, 6, 2, 2);
    // Mandibles
    cx.fillStyle = '#666';
    cx.fillRect(6, 18, 3, 4);
    cx.fillRect(15, 18, 3, 4);
    cx.fillRect(9, 19, 6, 3);
    // Crown / horns
    cx.fillStyle = enemy.enraged ? '#aa2a2a' : '#6a2a5a';
    cx.fillRect(5, 1, 3, 5);
    cx.fillRect(16, 1, 3, 5);
    cx.fillRect(9, 0, 2, 3);
    cx.fillRect(13, 0, 2, 3);
    // Legs
    cx.fillStyle = '#2a0a1a';
    cx.fillRect(2, 14, 2, 5);
    cx.fillRect(20, 14, 2, 5);
    cx.fillRect(4, 17, 2, 4);
    cx.fillRect(18, 17, 2, 4);
  } else {
    // Generic bug
    cx.fillStyle = baseColor;
    cx.fillRect(2, 2, 10, 10);
    cx.fillStyle = '#fff';
    cx.fillRect(4, 4, 2, 2);
    cx.fillRect(8, 4, 2, 2);
  }

  return c;
}

function renderLevelUp() {
  // Dim combat behind
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#ffdd00';
  ctx.font = '8px "Press Start 2P"';
  ctx.textAlign = 'center';
  ctx.fillText('LEVEL UP!', CX, 35);

  ctx.fillStyle = '#aaaacc';
  ctx.font = '5px "Press Start 2P"';
  ctx.fillText('Choose an upgrade:', CX, 48);

  renderHpExpBars(52);

  const cardW = 85;
  const cardH = 120;
  const gap = 8;
  const totalW = 3 * cardW + 2 * gap;
  const startX = CX - totalW / 2;
  const cardY = 72;

  for (let i = 0; i < upgradeCards.length; i++) {
    const card = upgradeCards[i];
    const cx = startX + i * (cardW + gap);
    const isHover = (i === levelUpHover);

    // Card bg
    ctx.fillStyle = isHover ? '#2a2a3a' : '#1a1a2a';
    ctx.fillRect(cx, cardY, cardW, cardH);

    // Rarity border
    ctx.strokeStyle = RARITY_COLORS[card.rarity] || '#666';
    ctx.lineWidth = isHover ? 2 : 1;
    ctx.strokeRect(cx, cardY, cardW, cardH);

    // Rarity label
    ctx.fillStyle = RARITY_COLORS[card.rarity] || '#666';
    ctx.font = '4px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.fillText(card.rarity, cx + cardW / 2, cardY + 12);

    // Type label
    ctx.fillText('Stat Buff', cx + cardW / 2, cardY + 24);

    // Name
    ctx.fillStyle = '#ddddee';
    ctx.font = '4px "Press Start 2P"';
    const nameWords = card.name.split(' ');
    let nameY = cardY + 42;
    for (const word of nameWords) {
      ctx.fillText(word, cx + cardW / 2, nameY);
      nameY += 8;
    }

    // Description
    ctx.fillStyle = '#9999aa';
    ctx.font = '3px "Press Start 2P"';
    let descY = cardY + 70;
    const descWords = card.desc.split(' ');
    let line = '';
    for (const word of descWords) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > cardW - 8) {
        ctx.fillText(line, cx + cardW / 2, descY);
        line = word;
        descY += 7;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, cx + cardW / 2, descY);
  }
}

function renderReward() {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#c49a1a';
  ctx.font = '8px "Press Start 2P"';
  ctx.textAlign = 'center';
  ctx.fillText('LOOT!', CX, 30);

  ctx.fillStyle = '#8a7a5a';
  ctx.font = '5px "Press Start 2P"';
  ctx.fillText('Choose a reward:', CX, 42);

  renderHpExpBars(48);

  const cardW = 85;
  const cardH = 130;
  const gap = 8;
  const totalW = 3 * cardW + 2 * gap;
  const startX = CX - totalW / 2;
  const cardY = 68;

  for (let i = 0; i < lootCards.length; i++) {
    const card = lootCards[i];
    const cx = startX + i * (cardW + gap);
    const isHover = (i === lootHover);

    // Card bg
    ctx.fillStyle = isHover ? '#2a2a3a' : '#1a1a2a';
    ctx.fillRect(cx, cardY, cardW, cardH);

    // Rarity border
    ctx.strokeStyle = RARITY_COLORS[card.rarity] || '#666';
    ctx.lineWidth = isHover ? 2 : 1;
    ctx.strokeRect(cx, cardY, cardW, cardH);

    // Icon
    if (card.type === 'weapon') drawSwordIcon(ctx, cx + cardW / 2 - 5, cardY + 16);
    else if (card.type === 'armor') drawShieldIcon(ctx, cx + cardW / 2 - 5, cardY + 16);
    else if (card.type === 'item') drawPouchIcon(ctx, cx + cardW / 2 - 5, cardY + 16);

    // Rarity label
    ctx.fillStyle = RARITY_COLORS[card.rarity] || '#666';
    ctx.font = '4px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.fillText(card.rarity, cx + cardW / 2, cardY + 22);

    // Type + Name
    if (card.type === 'weapon') {
      ctx.fillText('Weapon', cx + cardW / 2, cardY + 30);
      ctx.fillStyle = '#ddddee';
      ctx.font = '4px "Press Start 2P"';
      const nameWords = card.item.name.split(' ');
      let ny = cardY + 44;
      for (const word of nameWords) {
        ctx.fillText(word, cx + cardW / 2, ny);
        ny += 8;
      }
      // Stats with diffs
      const w = card.item;
      const cur = player.weapon;
      let dy = cardY + 70;
      drawStatWithDiff(cx + 4, dy, 'DMG: ', w.dmg, cur.dmg, { font: '3px "Press Start 2P"' });
      dy += 9;
      drawStatWithDiff(cx + 4, dy, 'SPD: ', w.speedMod, cur.speedMod, { font: '3px "Press Start 2P"' });
      dy += 9;
      drawStatWithDiff(cx + 4, dy, 'CRIT: ', w.critBonus, cur.critBonus, { suffix: '%', font: '3px "Press Start 2P"' });
      // Current label
      ctx.fillStyle = '#555';
      ctx.font = '3px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillText(`(${cur.name})`, cx + cardW / 2, cardY + cardH - 8);

    } else if (card.type === 'armor') {
      ctx.fillText('Armor', cx + cardW / 2, cardY + 30);
      ctx.fillStyle = '#ddddee';
      ctx.font = '4px "Press Start 2P"';
      const nameWords = card.item.name.split(' ');
      let ny = cardY + 44;
      for (const word of nameWords) {
        ctx.fillText(word, cx + cardW / 2, ny);
        ny += 8;
      }
      // Stats with diffs
      const a = card.item;
      const cur = player.armor;
      let dy = cardY + 70;
      drawStatWithDiff(cx + 4, dy, 'DEF: ', a.def, cur.def, { font: '3px "Press Start 2P"' });
      dy += 9;
      drawStatWithDiff(cx + 4, dy, 'SPD: ', a.speedMod, cur.speedMod, { font: '3px "Press Start 2P"' });
      dy += 9;
      drawStatWithDiff(cx + 4, dy, 'HP: +', a.hpBonus, cur.hpBonus, { font: '3px "Press Start 2P"' });
      ctx.fillStyle = '#555';
      ctx.font = '3px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillText(`(${cur.name})`, cx + cardW / 2, cardY + cardH - 8);

    } else if (card.type === 'item') {
      ctx.fillText('Consumable', cx + cardW / 2, cardY + 30);
      ctx.fillStyle = '#ddddee';
      ctx.font = '4px "Press Start 2P"';
      ctx.fillText(card.name, cx + cardW / 2, cardY + 48);
      ctx.fillStyle = '#9999aa';
      ctx.font = '3px "Press Start 2P"';
      // Word wrap description
      const descWords = card.desc.split(' ');
      let line = '';
      let dy = cardY + 66;
      for (const word of descWords) {
        const test = line ? line + ' ' + word : word;
        if (ctx.measureText(test).width > cardW - 8) {
          ctx.fillText(line, cx + cardW / 2, dy);
          line = word;
          dy += 7;
        } else {
          line = test;
        }
      }
      if (line) ctx.fillText(line, cx + cardW / 2, dy);
      // Belt status
      ctx.fillStyle = '#666';
      ctx.font = '3px "Press Start 2P"';
      ctx.fillText(`Belt: ${player.belt.length}/4`, cx + cardW / 2, cardY + cardH - 8);
    }
  }

  // Skip button
  const skipW = 60;
  const skipH = 14;
  const skipX = CX - skipW / 2;
  const skipY = cardY + cardH + 10;
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(skipX, skipY, skipW, skipH);
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 1;
  ctx.strokeRect(skipX, skipY, skipW, skipH);
  ctx.fillStyle = '#999';
  ctx.font = '4px "Press Start 2P"';
  ctx.textAlign = 'center';
  ctx.fillText('SKIP', CX, skipY + 10);
}

function renderHpExpBars(y) {
  const barW = 120;
  const barH = 6;
  const barX = CX - barW / 2;

  // HP bar
  ctx.fillStyle = '#2a0a0a';
  ctx.fillRect(barX, y, barW, barH);
  const hpPct = Math.max(0, player.hp / player.maxHp);
  ctx.fillStyle = hpPct > 0.5 ? '#4a8a2a' : hpPct > 0.25 ? '#ba8a20' : '#ba2a2a';
  ctx.fillRect(barX, y, Math.round(barW * hpPct), barH);
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(barX, y, barW, barH);

  ctx.fillStyle = '#ccccdd';
  ctx.font = '4px "Press Start 2P"';
  ctx.textAlign = 'left';
  ctx.fillText('HP', barX - 16, y + 5);
  ctx.textAlign = 'center';
  ctx.fillText(`${player.hp}/${player.maxHp}`, CX, y + 5);

  // EXP bar
  const expY = y + barH + 3;
  ctx.fillStyle = '#0a0a2a';
  ctx.fillRect(barX, expY, barW, barH);
  const expPct = Math.max(0, player.exp / player.expToNext);
  ctx.fillStyle = '#6a5acc';
  ctx.fillRect(barX, expY, Math.round(barW * expPct), barH);
  ctx.strokeStyle = '#444';
  ctx.strokeRect(barX, expY, barW, barH);

  ctx.fillStyle = '#aa99dd';
  ctx.textAlign = 'left';
  ctx.fillText('EXP', barX - 20, expY + 5);
  ctx.textAlign = 'center';
  ctx.fillText(`${player.exp}/${player.expToNext}  Lv.${player.level}`, CX, expY + 5);
}

// Draw "LABEL: value (diff)" with colored diff
// Returns the x position after drawing (for chaining stats on one line)
function drawSwordIcon(c, x, y) {
  // Blade
  c.fillStyle = '#ccddef';
  c.fillRect(x + 4, y - 12, 2, 1);   // tip
  c.fillRect(x + 4, y - 11, 2, 7);   // blade body
  c.fillStyle = '#aabbdd';
  c.fillRect(x + 4, y - 11, 1, 7);   // blade shadow edge
  c.fillStyle = '#eeeeff';
  c.fillRect(x + 5, y - 10, 1, 5);   // blade highlight
  // Crossguard
  c.fillStyle = '#ccaa44';
  c.fillRect(x + 1, y - 4, 8, 1);
  c.fillRect(x + 2, y - 3, 6, 1);
  c.fillStyle = '#eedd66';
  c.fillRect(x + 3, y - 4, 1, 1);    // gem on guard
  c.fillRect(x + 6, y - 4, 1, 1);
  // Grip
  c.fillStyle = '#664422';
  c.fillRect(x + 4, y - 2, 2, 3);
  c.fillStyle = '#553311';
  c.fillRect(x + 4, y - 1, 2, 1);    // grip wrap
  // Pommel
  c.fillStyle = '#ccaa44';
  c.fillRect(x + 4, y + 1, 2, 1);
}

function drawShieldIcon(c, x, y) {
  // Outer shape
  c.fillStyle = '#5577aa';
  c.fillRect(x + 2, y - 12, 6, 1);   // top
  c.fillRect(x + 1, y - 11, 8, 2);   // upper
  c.fillRect(x, y - 9, 10, 4);       // body
  c.fillRect(x + 1, y - 5, 8, 2);    // lower body
  c.fillRect(x + 2, y - 3, 6, 1);    // taper
  c.fillRect(x + 3, y - 2, 4, 1);
  c.fillRect(x + 4, y - 1, 2, 1);    // point
  // Inner highlight
  c.fillStyle = '#7799cc';
  c.fillRect(x + 2, y - 11, 6, 1);
  c.fillRect(x + 1, y - 9, 2, 3);    // left highlight
  // Emblem (cross/star)
  c.fillStyle = '#ccddff';
  c.fillRect(x + 4, y - 10, 2, 6);   // vertical bar
  c.fillRect(x + 2, y - 8, 6, 2);    // horizontal bar
  // Border accent
  c.fillStyle = '#3355778';
  c.fillRect(x + 1, y - 5, 1, 2);    // shadow left
  c.fillRect(x + 8, y - 5, 1, 2);    // shadow right
}

function drawPouchIcon(c, x, y) {
  // Drawstrings
  c.fillStyle = '#aa8855';
  c.fillRect(x + 3, y - 12, 1, 2);   // left string
  c.fillRect(x + 6, y - 12, 1, 2);   // right string
  c.fillRect(x + 4, y - 13, 2, 1);   // string loop
  // Cinch
  c.fillStyle = '#997744';
  c.fillRect(x + 2, y - 10, 6, 1);
  // Bag body
  c.fillStyle = '#886644';
  c.fillRect(x + 1, y - 9, 8, 2);    // upper body
  c.fillRect(x, y - 7, 10, 4);       // main body
  c.fillRect(x + 1, y - 3, 8, 1);    // lower
  c.fillRect(x + 2, y - 2, 6, 1);    // bottom
  // Body highlight
  c.fillStyle = '#aa8866';
  c.fillRect(x + 2, y - 9, 3, 1);    // top highlight
  c.fillRect(x + 1, y - 7, 2, 3);    // left highlight
  // Buckle/clasp
  c.fillStyle = '#ccaa44';
  c.fillRect(x + 4, y - 6, 2, 2);    // clasp
  c.fillStyle = '#eedd66';
  c.fillRect(x + 4, y - 6, 1, 1);    // clasp shine
  // Stitching
  c.fillStyle = '#775533';
  c.fillRect(x + 3, y - 4, 1, 1);
  c.fillRect(x + 6, y - 4, 1, 1);
}

function drawStatWithDiff(x, y, label, newVal, oldVal, opts = {}) {
  const { suffix = '', prefix = '', centerAlign = false, font = '4px "Press Start 2P"' } = opts;
  ctx.font = font;
  ctx.textAlign = centerAlign ? 'center' : 'left';

  // Draw label + value
  ctx.fillStyle = '#9999aa';
  const valStr = `${label}${prefix}${newVal}${suffix}`;
  ctx.fillText(valStr, x, y);
  const valWidth = ctx.measureText(valStr).width;

  // Draw diff
  const diff = newVal - oldVal;
  if (diff !== 0) {
    const diffStr = ` (${diff > 0 ? '+' : ''}${diff}${suffix})`;
    const diffX = centerAlign ? x + valWidth / 2 + 1 : x + valWidth + 1;
    ctx.textAlign = 'left';
    ctx.fillStyle = diff > 0 ? '#44cc44' : '#cc4444';
    ctx.fillText(diffStr, diffX, y);
    return valWidth + ctx.measureText(diffStr).width + 2;
  }
  return valWidth + 2;
}

function renderPlayerStats(y) {
  ctx.fillStyle = 'rgba(20,20,30,0.8)';
  ctx.fillRect(5, y, W - 10, 38);

  ctx.font = '4px "Press Start 2P"';
  ctx.textAlign = 'left';

  const col1 = 10;
  const col2 = CX + 10;
  let row = y + 10;

  ctx.fillStyle = '#aaaacc';
  ctx.fillText(`ATK: ${getPlayerDamage()} (${player.weapon?.name || 'none'})`, col1, row);
  ctx.fillText(`SPD: ${getEffectiveSpeed()} (${getActionsPerRound()} acts)`, col2, row);
  row += 10;
  ctx.fillText(`DEF: ${getPlayerArmor()} (${player.armor?.name || 'none'})`, col1, row);
  ctx.fillText(`CRIT: ${getCritChance()}% × ${getCritMultiplier().toFixed(1)}`, col2, row);
  row += 10;
  ctx.fillText(`Belt: ${player.belt.length}/4`, col1, row);

  // Belt items
  if (player.belt.length > 0) {
    const items = player.belt.map(b => {
      const name = b.type === 'healPotion' ? 'Heal' : 'Bomb';
      return `${name}x${b.uses}`;
    }).join(', ');
    ctx.fillText(items, col2, row);
  }
}

function renderGameOver() {
  ctx.fillStyle = 'rgba(10,0,0,0.85)';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#cc2222';
  ctx.font = '10px "Press Start 2P"';
  ctx.textAlign = 'center';
  ctx.fillText('DEFEATED', CX, 80);

  ctx.fillStyle = '#aa8888';
  ctx.font = '6px "Press Start 2P"';
  ctx.fillText(`Reached Floor ${floor}`, CX, 100);

  renderHpExpBars(108);

  ctx.fillStyle = '#888';
  ctx.font = '5px "Press Start 2P"';
  ctx.textAlign = 'center';
  ctx.fillText(`${player.weapon?.name || 'none'} + ${player.armor?.name || 'none'}`, CX, 140);

  const state = loadState();
  ctx.fillStyle = '#666';
  ctx.fillText(`Best Floor: ${state.stats.citadelBestFloor || floor}`, CX, 158);
  ctx.fillText(`Total Runs: ${state.stats.citadelTotalRuns || 1}`, CX, 172);

  // Retry button
  ctx.fillStyle = '#3a2a2a';
  ctx.fillRect(CX - 55, 200, 50, 20);
  ctx.strokeStyle = '#aa4444';
  ctx.lineWidth = 1;
  ctx.strokeRect(CX - 55, 200, 50, 20);
  ctx.fillStyle = '#ee6644';
  ctx.font = '5px "Press Start 2P"';
  ctx.fillText('RETRY', CX - 30, 214);

  // Back button
  ctx.fillStyle = '#2a2a3a';
  ctx.fillRect(CX + 5, 200, 50, 20);
  ctx.strokeStyle = '#6666aa';
  ctx.strokeRect(CX + 5, 200, 50, 20);
  ctx.fillStyle = '#8888cc';
  ctx.fillText('BACK', CX + 30, 214);
}

function renderVictory() {
  ctx.fillStyle = 'rgba(0,5,0,0.85)';
  ctx.fillRect(0, 0, W, H);

  // Pulsing glow
  const pulse = 0.7 + 0.3 * Math.sin(frameCount * 0.05);
  ctx.fillStyle = `rgba(200,180,50,${pulse * 0.15})`;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#ffdd00';
  ctx.font = '9px "Press Start 2P"';
  ctx.textAlign = 'center';
  ctx.fillText('VICTORY!', CX, 60);

  ctx.fillStyle = '#c49a1a';
  ctx.font = '5px "Press Start 2P"';
  ctx.fillText('The Mother Bug is defeated!', CX, 82);

  renderHpExpBars(90);

  ctx.fillStyle = '#aaaacc';
  ctx.font = '5px "Press Start 2P"';
  ctx.textAlign = 'center';
  ctx.fillText(`${player.weapon?.name} + ${player.armor?.name}`, CX, 118);

  const state = loadState();
  ctx.fillText(`Clears: ${state.stats.citadelClears || 1}`, CX, 135);

  if (selectedPlant && selectedPlant.potElement) {
    const expAward = 50 + player.level * 10;
    ctx.fillStyle = '#44cc88';
    ctx.fillText(`+${expAward} Pot EXP earned!`, CX, 170);
  }

  // Buttons
  ctx.fillStyle = '#2a3a2a';
  ctx.fillRect(CX - 55, 200, 50, 20);
  ctx.strokeStyle = '#44aa44';
  ctx.lineWidth = 1;
  ctx.strokeRect(CX - 55, 200, 50, 20);
  ctx.fillStyle = '#88cc88';
  ctx.font = '5px "Press Start 2P"';
  ctx.fillText('AGAIN', CX - 30, 214);

  ctx.fillStyle = '#2a2a3a';
  ctx.fillRect(CX + 5, 200, 50, 20);
  ctx.strokeStyle = '#6666aa';
  ctx.strokeRect(CX + 5, 200, 50, 20);
  ctx.fillStyle = '#8888cc';
  ctx.fillText('BACK', CX + 30, 214);
}

// ── Color Utilities ────────────────────────────────────────────────

function lightenColor(hex, amt) {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amt);
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amt);
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amt);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

function darkenColor(hex, amt) {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amt);
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amt);
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amt);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

// ── Input Handling ─────────────────────────────────────────────────

function onClick(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = W / rect.width;
  const scaleY = H / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;

  // Block clicks during non-interactive phases (except toggle buttons)
  if (phase === 'floorTransition' || phase === 'bossCinematic') {
    // Only allow toggle buttons during transitions
    const bw = 28, bh = 10, bx = W - bw - 5, bgap = 3;
    const quitY = 16;
    const fastY = quitY + bh + bgap;
    if (x >= bx && x <= bx + bw && y >= quitY && y <= quitY + bh) {
      handleBack();
      return;
    }
    if (x >= bx && x <= bx + bw && y >= fastY && y <= fastY + bh) {
      fastMode = !fastMode;
      return;
    }
    return;
  }

  // Toggle buttons (visible on pathSelect and combat)
  if (phase === 'pathSelect' || phase === 'combat') {
    const bw = 28, bh = 10, bx = W - bw - 5, bgap = 3;
    const quitY = 16;
    const fastY = quitY + bh + bgap;
    const statsY = fastY + bh + bgap;
    if (x >= bx && x <= bx + bw && y >= quitY && y <= quitY + bh) {
      handleBack();
      return;
    }
    if (x >= bx && x <= bx + bw && y >= fastY && y <= fastY + bh) {
      fastMode = !fastMode;
      return;
    }
    if (x >= bx && x <= bx + bw && y >= statsY && y <= statsY + bh) {
      showStats = !showStats;
      return;
    }
  }

  if (phase === 'pathSelect') {
    handlePathClick(x, y);
  } else if (phase === 'combat') {
    handleCombatClick(x, y);
  } else if (phase === 'levelUp') {
    handleLevelUpClick(x, y);
  } else if (phase === 'reward') {
    handleRewardClick(x, y);
  } else if (phase === 'gameOver') {
    handleGameOverClick(x, y);
  } else if (phase === 'victory') {
    handleVictoryClick(x, y);
  }
}

function onMove(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = W / rect.width;
  const scaleY = H / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;

  if (phase === 'pathSelect') {
    handlePathHover(x, y);
  } else if (phase === 'levelUp') {
    handleLevelUpHover(x, y);
  } else if (phase === 'reward') {
    handleRewardHover(x, y);
  }
}

function onTouch(e) {
  e.preventDefault();
  if (e.touches.length > 0) {
    const touch = e.touches[0];
    onClick({ clientX: touch.clientX, clientY: touch.clientY });
  }
}

function onTouchMove(e) {
  e.preventDefault();
  if (e.touches.length > 0) {
    const touch = e.touches[0];
    onMove({ clientX: touch.clientX, clientY: touch.clientY });
  }
}

function addInputListeners() {
  canvas.addEventListener('click', onClick);
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('touchstart', onTouch, { passive: false });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
}

function removeInputListeners() {
  if (!canvas) return;
  canvas.removeEventListener('click', onClick);
  canvas.removeEventListener('mousemove', onMove);
  canvas.removeEventListener('touchstart', onTouch);
  canvas.removeEventListener('touchmove', onTouchMove);
}

// ── Click Handlers ─────────────────────────────────────────────────

function handlePathClick(x, y) {
  // Next Floor button (only when at least 1 path completed)
  if (completedPaths.length > 0) {
    const nfW = 80;
    const nfH = 16;
    const nfX = CX - nfW / 2;
    const nfY = H - 28;
    if (x >= nfX && x <= nfX + nfW && y >= nfY && y <= nfY + nfH) {
      advanceFloor();
      return;
    }
  }

  // Path cards
  const cardW = 90;
  const cardH = 110;
  const gap = 8;
  const totalW = paths.length * cardW + (paths.length - 1) * gap;
  const startX = CX - totalW / 2;
  const cardY = 50;

  for (let i = 0; i < paths.length; i++) {
    if (completedPaths.includes(i)) continue; // skip completed paths
    const cx = startX + i * (cardW + gap);
    if (x >= cx && x <= cx + cardW && y >= cardY && y <= cardY + cardH) {
      selectPath(i);
      return;
    }
  }
}

function handlePathHover(x, y) {
  const cardW = 90;
  const cardH = 110;
  const gap = 8;
  const totalW = paths.length * cardW + (paths.length - 1) * gap;
  const startX = CX - totalW / 2;
  const cardY = 50;

  pathHover = -1;
  for (let i = 0; i < paths.length; i++) {
    if (completedPaths.includes(i)) continue; // skip completed paths
    const cx = startX + i * (cardW + gap);
    if (x >= cx && x <= cx + cardW && y >= cardY && y <= cardY + cardH) {
      pathHover = i;
      return;
    }
  }
}

function handleCombatClick(x, y) {
  if (combatPhase !== 'playerTurn' || animating) return;

  const btnW = 42;
  const btnH = 16;
  const btnY = H - 22;
  const gap = 3;
  const itemBtnW = 28;
  const itemGap = 2;

  const mainBtns = floor < 10 ? 3 : 2;
  const totalW = mainBtns * btnW + (mainBtns - 1) * gap + gap + 4 * itemBtnW + 3 * itemGap;
  const startX = Math.round(CX - totalW / 2);

  // Attack
  const atkX = startX;
  if (x >= atkX && x <= atkX + btnW && y >= btnY && y <= btnY + btnH) {
    executePlayerAttack();
    return;
  }

  // Defend
  const defX = atkX + btnW + gap;
  if (x >= defX && x <= defX + btnW && y >= btnY && y <= btnY + btnH) {
    executePlayerDefend();
    return;
  }

  // Flee button (after defend, not on floor 10)
  let fleeEndX = defX + btnW;
  if (floor < 10) {
    const fleeX = defX + btnW + gap;
    if (x >= fleeX && x <= fleeX + btnW && y >= btnY && y <= btnY + btnH) {
      fleeCombat();
      return;
    }
    fleeEndX = fleeX + btnW;
  }

  // Belt items
  const itemStartX = fleeEndX + gap;
  for (let i = 0; i < 4; i++) {
    const ix = itemStartX + i * (itemBtnW + itemGap);
    if (x >= ix && x <= ix + itemBtnW && y >= btnY && y <= btnY + btnH) {
      if (player.belt[i]) {
        executePlayerItem(i);
        return;
      }
    }
  }

  // Click on turn queue slot to select target
  {
    const btnY = H - 22;
    const slotH = 12;
    const queueY = btnY - slotH - 6;
    const slotW = 50;
    const qGap = 3;
    const maxSlots = 5;
    const count = Math.min(turnQueue.length, maxSlots);
    const totalW = count * (slotW + qGap) - qGap;
    const qStartX = CX - totalW / 2;
    if (y >= queueY && y <= queueY + slotH) {
      for (let i = 0; i < count; i++) {
        const sx = qStartX + i * (slotW + qGap);
        if (x >= sx && x <= sx + slotW) {
          const entry = turnQueue[i];
          if (entry.type === 'enemy' && entry.enemyIndex != null && enemies[entry.enemyIndex] && enemies[entry.enemyIndex].alive) {
            targetEnemy = entry.enemyIndex;
          }
          return;
        }
      }
    }
  }

  // Click on enemy to switch target
  const aliveEnemies = enemies.filter(e => e.alive);
  const enemyGap = Math.min(60, (W - 20) / Math.max(1, enemies.length));
  const enemyStartX = CX - (enemies.length - 1) * enemyGap / 2;
  for (let i = 0; i < enemies.length; i++) {
    if (!enemies[i].alive) continue;
    const ex = enemyStartX + i * enemyGap;
    const ey = 55;
    if (x >= ex - 20 && x <= ex + 20 && y >= ey - 15 && y <= ey + 25) {
      targetEnemy = i;
      return;
    }
  }
}

function handleLevelUpClick(x, y) {
  const cardW = 85;
  const cardH = 120;
  const gap = 8;
  const totalW = 3 * cardW + 2 * gap;
  const startX = CX - totalW / 2;
  const cardY = 72;

  for (let i = 0; i < upgradeCards.length; i++) {
    const cx = startX + i * (cardW + gap);
    if (x >= cx && x <= cx + cardW && y >= cardY && y <= cardY + cardH) {
      applyUpgradeCard(i);
      return;
    }
  }
}

function handleLevelUpHover(x, y) {
  const cardW = 85;
  const cardH = 120;
  const gap = 8;
  const totalW = 3 * cardW + 2 * gap;
  const startX = CX - totalW / 2;
  const cardY = 72;

  levelUpHover = -1;
  for (let i = 0; i < upgradeCards.length; i++) {
    const cx = startX + i * (cardW + gap);
    if (x >= cx && x <= cx + cardW && y >= cardY && y <= cardY + cardH) {
      levelUpHover = i;
      return;
    }
  }
}

function handleRewardClick(x, y) {
  const cardW = 85;
  const cardH = 130;
  const gap = 8;
  const totalW = 3 * cardW + 2 * gap;
  const startX = CX - totalW / 2;
  const cardY = 68;

  for (let i = 0; i < lootCards.length; i++) {
    const cx = startX + i * (cardW + gap);
    if (x >= cx && x <= cx + cardW && y >= cardY && y <= cardY + cardH) {
      applyLootCard(i);
      return;
    }
  }

  // Skip button
  const skipW = 60;
  const skipH = 14;
  const skipX = CX - skipW / 2;
  const skipY = cardY + cardH + 10;
  if (x >= skipX && x <= skipX + skipW && y >= skipY && y <= skipY + skipH) {
    addLog('Skipped loot');
    lootCards = [];
    returnToPathSelect();
  }
}

function handleRewardHover(x, y) {
  const cardW = 85;
  const cardH = 130;
  const gap = 8;
  const totalW = 3 * cardW + 2 * gap;
  const startX = CX - totalW / 2;
  const cardY = 68;

  lootHover = -1;
  for (let i = 0; i < lootCards.length; i++) {
    const cx = startX + i * (cardW + gap);
    if (x >= cx && x <= cx + cardW && y >= cardY && y <= cardY + cardH) {
      lootHover = i;
      return;
    }
  }
}

function handleGameOverClick(x, y) {
  // Retry
  if (x >= CX - 55 && x <= CX - 5 && y >= 200 && y <= 220) {
    beginRun();
    return;
  }
  // Back
  if (x >= CX + 5 && x <= CX + 55 && y >= 200 && y <= 220) {
    handleBack();
    return;
  }
}

function handleVictoryClick(x, y) {
  // Again
  if (x >= CX - 55 && x <= CX - 5 && y >= 200 && y <= 220) {
    beginRun();
    return;
  }
  // Back
  if (x >= CX + 5 && x <= CX + 55 && y >= 200 && y <= 220) {
    handleBack();
    return;
  }
}

function handleBack() {
  stopCitadel();
  if (onBackCallback) onBackCallback();
}
