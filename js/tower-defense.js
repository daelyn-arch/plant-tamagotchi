// Tower Defense — "Stop the Bugs"
// Plant sits at center, bugs swarm from all edges in waves
// Roguelite upgrades with rarity-scaled effects, elemental powers

import { renderPlant } from './plant-generator.js';
import { loadState, saveState } from './state.js';
import { potLevelFromExp, POT_LEVEL_THRESHOLDS } from './canvas-utils.js';

// ── Constants ──────────────────────────────────────────────────────
const W = 320;
const H = 320;
const CX = 160;
const CY = 160;
const CANVAS_SCALE = 2; // render at 640x640 for crisp text, game logic stays 320x320

// ── Module state ───────────────────────────────────────────────────
let canvas, ctx;
let rafId = null;
let running = false;
let gameStarted = false;
let onBackCallback = null;
let selectedPlant = null;
let plantSprite = null; // rendered plant canvas

// Player (plant) state
let player = {
  x: CX, y: CY,
  hp: 100, maxHp: 100,
  element: null,
  potLevel: 0,
};

// Game arrays
let enemies = [];
let projectiles = [];
let particles = [];

// Wave state
let wave = 0;
let waveTimer = 0;
let waveActive = false;
let waveSpawnQueue = [];
let wavePause = false; // between-wave pause
let wavePauseTimer = 0;
let waveAnnounceTimer = 0;

// Frame counter & score
let frameCount = 0;
let score = 0;

// EXP & leveling
let fertilizerExp = 0;
let playerLevel = 1;
let expToNextLevel = 10;

// Upgrades
let upgrades = {
  attackSpeed: 0,
  attackDamage: 0,
  weaponCount: 0,
  powerRecharge: 0,
  bugSlow: 0,
  health: 0,
  // Elemental upgrades
  burnDamage: 0,
  aoeRadius: 0,
  damageAura: 0,
  freezeChance: 0,
  slowStrength: 0,
  chillAura: 0,
  knockbackForce: 0,
  barrierChance: 0,
  thorns: 0,
  chainCount: 0,
  projSpeed: 0,
  dodgeChance: 0,
};

let attackTimer = 0;
let abilityCharge = 0;
let abilityMaxCharge = 100;
let abilityActive = false;
let abilityTimer = 0;

// Upgrade picker state
let pendingUpgrades = []; // queued level-up choices
let showingUpgradePicker = false;
let upgradeOptions = [];
let hoverCard = -1;
let showingDeck = false;
let deckScroll = 0;
let showingPauseMenu = false;

// Damage flash
let damageFlash = 0;
let abilityFlash = 0;
let abilityFlashColor = null;
let autoAbility = false;

// Citadel event state
let showingCitadelEvent = false;
let citadelAnimPhase = 0;   // 0: road rotation, 1: citadel approach, 2: choice shown
let citadelAnimTimer = 0;
let citadelApproachX = W + 60; // starts off-screen right
let roadRotation = 0;       // 0 = vertical, 1 = horizontal

// Background dots (deterministic)
let bgDots = [];

// Road / travel animation
let roadOffset = 0;        // scrolling offset for road markings
let travelAnim = 0;        // frames remaining in travel animation between waves
let plantHopFrame = 0;     // bounce counter during travel
let grassTufts = [];       // decorative grass positions

// ── Enemy Types ────────────────────────────────────────────────────
const ENEMY_TYPES = {
  basic: { hp: 10, speed: 0.5, w: 16, h: 12, damage: 5, exp: 1, color: '#2a1a0a' },
  fast:  { hp: 6,  speed: 1.0, w: 12, h: 10, damage: 3, exp: 1, color: '#4a3a1a' },
  tank:  { hp: 30, speed: 0.3, w: 22, h: 16, damage: 8, exp: 3, color: '#1a1a1a' },
  swarm: { hp: 4,  speed: 0.7, w: 10, h: 8, damage: 2, exp: 1, color: '#3a2a0a' },
  boss:  { hp: 100, speed: 0.2, w: 40, h: 28, damage: 20, exp: 10, color: '#0a0a0a' },
};

// ── Upgrade Definitions ────────────────────────────────────────────
const UPGRADE_DEFS = [
  {
    key: 'attackSpeed', name: 'Attack Speed', desc: 'Fires faster',
    values: { Common: 3, Uncommon: 5, Rare: 8, Epic: 12, Legendary: 18 },
  },
  {
    key: 'attackDamage', name: 'Attack Damage', desc: 'Deals more damage',
    values: { Common: 3, Uncommon: 5, Rare: 8, Epic: 12, Legendary: 20 },
  },
  {
    key: 'weaponCount', name: 'Weapon Count', desc: 'Extra projectile targets',
    values: { Common: 1, Uncommon: 1, Rare: 2, Epic: 2, Legendary: 3 },
  },
  {
    key: 'powerRecharge', name: 'Power Recharge', desc: 'Ability charges faster',
    values: { Common: 0.2, Uncommon: 0.4, Rare: 0.6, Epic: 1.0, Legendary: 1.5 },
  },
  {
    key: 'bugSlow', name: 'Bug Slow', desc: 'Enemies move slower',
    values: { Common: 3, Uncommon: 5, Rare: 8, Epic: 12, Legendary: 20 },
  },
  {
    key: 'health', name: 'Max Health', desc: 'More plant HP',
    values: { Common: 10, Uncommon: 20, Rare: 35, Epic: 50, Legendary: 80 },
  },
  {
    key: 'projSpeed', name: 'Proj Speed', desc: 'Projectiles fly faster',
    values: { Common: 1, Uncommon: 2, Rare: 3, Epic: 4, Legendary: 6 },
  },
];

// ── Elemental Upgrade Definitions (4th card) ─────────────────────
const ELEMENTAL_UPGRADE_DEFS = {
  fire: [
    {
      key: 'burnDamage', name: 'Inferno', desc: 'Burn deals more damage per tick',
      values: { Common: 2, Uncommon: 4, Rare: 6, Epic: 10, Legendary: 16 },
    },
    {
      key: 'aoeRadius', name: 'Blast Radius', desc: 'Explosions hit a wider area',
      values: { Common: 4, Uncommon: 6, Rare: 10, Epic: 14, Legendary: 20 },
    },
    {
      key: 'damageAura', name: 'Heat Aura', desc: 'Burns nearby enemies each second',
      values: { Common: 2, Uncommon: 4, Rare: 6, Epic: 10, Legendary: 15 },
    },
  ],
  ice: [
    {
      key: 'freezeChance', name: 'Deep Freeze', desc: 'Higher chance to freeze on hit',
      values: { Common: 3, Uncommon: 5, Rare: 8, Epic: 12, Legendary: 18 },
    },
    {
      key: 'slowStrength', name: 'Permafrost', desc: 'Slowed enemies move even slower',
      values: { Common: 5, Uncommon: 8, Rare: 12, Epic: 18, Legendary: 25 },
    },
    {
      key: 'chillAura', name: 'Chill Aura', desc: 'Passively slows nearby enemies',
      values: { Common: 5, Uncommon: 8, Rare: 12, Epic: 18, Legendary: 25 },
    },
  ],
  earth: [
    {
      key: 'knockbackForce', name: 'Tremor', desc: 'Knockback pushes farther',
      values: { Common: 1, Uncommon: 2, Rare: 3, Epic: 4, Legendary: 6 },
    },
    {
      key: 'barrierChance', name: 'Rock Wall', desc: 'Hits have higher barrier spawn chance',
      values: { Common: 5, Uncommon: 8, Rare: 12, Epic: 18, Legendary: 25 },
    },
    {
      key: 'thorns', name: 'Thorns', desc: 'When hit, damages all enemies + gains shield',
      values: { Common: 5, Uncommon: 10, Rare: 18, Epic: 30, Legendary: 50 },
    },
  ],
  wind: [
    {
      key: 'chainCount', name: 'Gust Chain', desc: 'Projectiles chain to more enemies',
      values: { Common: 1, Uncommon: 1, Rare: 2, Epic: 2, Legendary: 3 },
    },
    {
      key: 'projSpeed', name: 'Tailwind', desc: 'Projectiles fly faster',
      values: { Common: 1, Uncommon: 2, Rare: 3, Epic: 4, Legendary: 6 },
    },
    {
      key: 'dodgeChance', name: 'Evasion', desc: 'Chance to dodge enemy damage',
      values: { Common: 3, Uncommon: 5, Rare: 8, Epic: 12, Legendary: 18 },
    },
  ],
};

const RARITY_NAMES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];
const RARITY_WEIGHTS = [50, 30, 13, 6, 1];
const RARITY_COLORS = {
  Common: '#6b7b3a',
  Uncommon: '#2d8a4e',
  Rare: '#2d6fba',
  Epic: '#7b3fa0',
  Legendary: '#c49a1a',
};

// ── Elemental Colors ───────────────────────────────────────────────
const ELEMENT_PROJ_COLORS = {
  fire:  { main: '#ff6600', highlight: '#ffaa00' },
  ice:   { main: '#4090dd', highlight: '#80d0ff' },
  earth: { main: '#8a6a30', highlight: '#c0a060' },
  wind:  { main: '#40b0a0', highlight: '#80e0d0' },
  none:  { main: '#cccccc', highlight: '#ffffff' },
};

// ── Public API ─────────────────────────────────────────────────────

// Debug helpers
window.__debugTDState = () => ({
  running, gameStarted, wave, hp: player.hp, score,
  enemyCount: enemies.length, travelAnim, roadOffset,
  wavePause, waveActive,
});
window.__debugTDSetHP = (val) => { player.hp = val; };
window.__debugTDGameOver = () => { if (running) { player.hp = 0; tdGameOver(); } };
window.__debugTDSpawnEnemy = (type) => { spawnEnemy(type || 'basic'); };
window.__debugTDGetEnemies = () => enemies.map(e => ({ type: e.type, hp: e.hp, speed: e.speed, damage: e.damage }));
window.__debugTDSetWave = (w) => { wave = w; };
window.__debugTDClearEnemies = () => { enemies.length = 0; };
window.__debugTDForceWaveEnd = () => { waveSpawnQueue.length = 0; enemies.length = 0; };
window.__debugTDForceLevelUp = () => { fertilizerExp = expToNextLevel; checkLevelUp(); };
window.__debugTDGetUpgradeState = () => ({ showingUpgradePicker, pendingUpgrades: pendingUpgrades.length, upgradeOptions: upgradeOptions.map(o => ({ name: o.name, desc: o.desc, rarity: o.rarity, elemental: o.elemental || null })) });

export function startTowerDefense(plants, onBack) {
  onBackCallback = onBack;
  canvas = document.getElementById('tdCanvas');
  ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  canvas.width = W * CANVAS_SCALE;
  canvas.height = H * CANVAS_SCALE;

  if (plants.length === 1) {
    selectAndStart(plants[0]);
  } else {
    showPlantPicker(plants);
  }
  addInputListeners();
}

export function stopTowerDefense() {
  running = false;
  gameStarted = false;
  showingUpgradePicker = false;
  showingPauseMenu = false;
  showingDeck = false;
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  removeInputListeners();
}

// ── Plant Picker ───────────────────────────────────────────────────

function selectAndStart(plant) {
  selectedPlant = plant;
  preparePlantSprite(plant);
  showStartScreen(plant);
}

function preparePlantSprite(plant) {
  const srcCanvas = renderPlant(plant, plant.growthStage || 1.0);
  // Use 1x scale — the CANVAS_SCALE handles making it visible
  plantSprite = srcCanvas;
}

function showPlantPicker(plants) {
  const overlay = document.getElementById('tdOverlay');
  const content = document.getElementById('tdOverlayContent');
  overlay.classList.remove('hidden');
  document.getElementById('tdHud').style.display = 'none';

  let html = '<div class="mg-title">Choose Your Defender</div><div class="mg-picker-grid" id="tdPickerGrid"></div>';
  html += '<button class="btn mg-back-btn" id="tdPickerBack">Back to Plant</button>';
  content.innerHTML = html;

  const grid = document.getElementById('tdPickerGrid');
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

    if (plant.potElement) {
      const ELEMENT_TAG_COLORS = { fire: '#e06020', ice: '#60c0e0', earth: '#a08860', wind: '#70d0c0' };
      const eleTag = document.createElement('span');
      eleTag.className = 'mg-picker-tag';
      eleTag.style.background = ELEMENT_TAG_COLORS[plant.potElement] || '#888';
      eleTag.style.color = '#fff';
      eleTag.textContent = plant.potElement.charAt(0).toUpperCase() + plant.potElement.slice(1);
      name.appendChild(eleTag);
    }

    card.appendChild(imgWrap);
    card.appendChild(name);
    card.addEventListener('click', () => selectAndStart(plant));
    grid.appendChild(card);
  }

  document.getElementById('tdPickerBack').addEventListener('click', handleBack);
}

function showStartScreen(plant) {
  const overlay = document.getElementById('tdOverlay');
  const content = document.getElementById('tdOverlayContent');
  overlay.classList.remove('hidden');
  document.getElementById('tdHud').style.display = 'none';

  const state = loadState();
  const highWave = state.stats.tdHighWave || 0;

  content.innerHTML = `
    <div class="mg-title">Stop the Bugs</div>
    <div class="mg-preview" id="tdPreview"></div>
    <div class="mg-instructions">
      <span>Defend your plant!</span>
      <span>Auto-fires at nearest bug</span>
      <span>Touch/Click to activate ability</span>
    </div>
    ${highWave > 0 ? `<div class="mg-high-score">Best Wave: ${highWave}</div>` : ''}
    <button class="btn mg-play-btn" id="tdStartBtn">Start</button>
    <button class="btn mg-back-btn" id="tdBackBtn">Back to Plant</button>
  `;

  const previewWrap = document.getElementById('tdPreview');
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

  document.getElementById('tdStartBtn').addEventListener('click', beginGame);
  document.getElementById('tdBackBtn').addEventListener('click', handleBack);
}

// ── Game Init ──────────────────────────────────────────────────────

function resetGame() {
  const potLevel = selectedPlant ? (selectedPlant.potLevel || potLevelFromExp(selectedPlant.potExp || 0)) : 0;
  const potElement = selectedPlant ? selectedPlant.potElement : null;

  player = {
    x: CX, y: CY,
    hp: 100, maxHp: 100,
    shield: 0,
    element: potElement || null,
    potLevel: potLevel,
  };

  enemies = [];
  projectiles = [];
  particles = [];

  wave = 0;
  waveTimer = 0;
  waveActive = false;
  waveSpawnQueue = [];
  wavePause = true;
  wavePauseTimer = 120; // 2s initial pause before wave 1
  waveAnnounceTimer = 0;

  frameCount = 0;
  score = 0;

  fertilizerExp = 0;
  playerLevel = 1;
  expToNextLevel = 10;

  upgrades = {
    attackSpeed: 0,
    attackDamage: 0,
    weaponCount: 0,
    powerRecharge: 0,
    bugSlow: 0,
    health: 0,
    burnDamage: 0,
    aoeRadius: 0,
    damageAura: 0,
    freezeChance: 0,
    slowStrength: 0,
    chillAura: 0,
    knockbackForce: 0,
    barrierChance: 0,
    thorns: 0,
    chainCount: 0,
    projSpeed: 0,
    dodgeChance: 0,
  };

  attackTimer = 0;
  abilityCharge = 0;
  abilityMaxCharge = 100;
  abilityActive = false;
  abilityTimer = 0;

  pendingUpgrades = [];
  showingUpgradePicker = false;
  upgradeOptions = [];
  hoverCard = -1;

  damageFlash = 0;
  abilityFlash = 0;
  autoAbility = false;

  roadOffset = 0;
  travelAnim = 0;
  plantHopFrame = 0;

  showingCitadelEvent = false;
  citadelAnimPhase = 0;
  citadelAnimTimer = 0;
  citadelApproachX = W + 60;
  roadRotation = 0;

  // Generate background dots & grass tufts
  bgDots = [];
  grassTufts = [];
  const seed = selectedPlant ? selectedPlant.seed : Date.now();
  let s = seed;
  for (let i = 0; i < 80; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    bgDots.push({
      x: (s % W),
      y: ((s >> 8) % H),
      size: 1 + (s >> 16) % 2,
    });
  }
  for (let i = 0; i < 50; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    grassTufts.push({
      x: (s % W),
      y: ((s >> 8) % H),
      h: 2 + (s >> 16) % 3,
      shade: (s >> 20) % 3,
    });
  }
}

function beginGame() {
  resetGame();
  gameStarted = true;
  running = true;
  const overlay = document.getElementById('tdOverlay');
  overlay.classList.add('hidden');
  document.getElementById('tdHud').style.display = '';
  updateHud();
  rafId = requestAnimationFrame(gameLoop);
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

  if (damageFlash > 0) damageFlash--;
  if (abilityFlash > 0) abilityFlash--;
  if (waveAnnounceTimer > 0) waveAnnounceTimer--;
  // If showing upgrade picker, pause menu, or stats, pause game
  if (showingUpgradePicker) return;
  if (showingPauseMenu) return;
  if (showingStats) return;

  // Between-wave pause
  if (wavePause) {
    // Citadel event animation
    if (showingCitadelEvent) {
      citadelAnimTimer++;
      if (citadelAnimPhase === 0) {
        // Phase 0: rotate road from vertical to horizontal (90 frames)
        roadRotation = Math.min(1, citadelAnimTimer / 90);
        roadOffset = (roadOffset + 2) % 16;
        plantHopFrame++;
        if (citadelAnimTimer >= 90) {
          citadelAnimPhase = 1;
          citadelAnimTimer = 0;
        }
      } else if (citadelAnimPhase === 1) {
        // Phase 1: citadel approaches from right (120 frames)
        roadOffset = (roadOffset + 2) % 16;
        plantHopFrame++;
        const t = Math.min(1, citadelAnimTimer / 120);
        // Ease-out approach
        const ease = 1 - (1 - t) * (1 - t);
        citadelApproachX = W + 60 - ease * (W + 60 - 230);
        if (citadelAnimTimer >= 120) {
          citadelAnimPhase = 2;
          citadelAnimTimer = 0;
        }
      }
      // Phase 2: waiting for click, no updates needed
      return;
    }

    wavePauseTimer--;

    // Travel animation: scroll road + bounce plant
    if (travelAnim > 0) {
      travelAnim--;
      roadOffset = (roadOffset + 2) % 16;
      plantHopFrame++;
    }

    // Let projectiles finish moving / expire
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      if (p.x < -10 || p.x > W + 10 || p.y < -10 || p.y > H + 10 || p.life <= 0) {
        projectiles.splice(i, 1);
      }
    }

    // Let particles finish animating
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) {
        particles.splice(i, 1);
      }
    }

    // If level-up pending, show picker
    if (pendingUpgrades.length > 0 && !showingUpgradePicker) {
      showUpgradePicker();
      return;
    }
    if (wavePauseTimer <= 0) {
      wavePause = false;
      startNextWave();
    }
    return;
  }

  // Ability recharge
  const rechargeRate = 0.15 + upgrades.powerRecharge;
  if (!abilityActive && player.element) {
    abilityCharge = Math.min(abilityMaxCharge, abilityCharge + rechargeRate);
    if (autoAbility && abilityCharge >= abilityMaxCharge) {
      activateAbility();
    }
  }

  // Ability active timer
  if (abilityActive) {
    abilityTimer--;
    updateAbilityEffect();
    if (abilityTimer <= 0) {
      abilityActive = false;
    }
  }

  // Spawn from queue
  if (waveSpawnQueue.length > 0) {
    waveTimer--;
    if (waveTimer <= 0) {
      const next = waveSpawnQueue.shift();
      spawnEnemy(next);
      waveTimer = 15; // stagger
    }
  }

  // Check wave complete
  if (waveActive && waveSpawnQueue.length === 0 && enemies.length === 0) {
    waveActive = false;
    wavePause = true;
    wavePauseTimer = 180; // 3s between waves
    travelAnim = 120;     // 2s travel animation
    plantHopFrame = 0;
    // Bonus upgrade after every completed wave
    generateUpgradeOptions();

    // Citadel event: triggers after wave 14 if not yet unlocked
    if (wave === 14 && !loadState().stats.citadelUnlocked) {
      showingCitadelEvent = true;
      citadelAnimPhase = 0;
      citadelAnimTimer = 0;
      citadelApproachX = W + 60;
      roadRotation = 0;
      wavePauseTimer = 99999; // freeze normal flow
    }
  }

  // Update enemies
  const slowFactor = 1 - Math.min(0.8, upgrades.bugSlow / 100);
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.frame++;

    // Status effects
    if (e.slowTimer > 0) {
      e.slowTimer--;
    }
    if (e.freezeTimer > 0) {
      e.freezeTimer--;
      continue; // frozen, skip movement
    }
    if (e.burnTimer > 0) {
      e.burnTimer--;
      if (e.burnTimer % 20 === 0) {
        e.hp -= (e.burnDamage || 3) + upgrades.burnDamage;
        spawnParticles(e.x, e.y, '#ff6600', 2);
        if (e.hp <= 0) {
          killEnemy(i);
          continue;
        }
      }
    }

    // Knockback
    if (e.knockbackTimer > 0) {
      e.knockbackTimer--;
      e.x += e.knockbackVx;
      e.y += e.knockbackVy;
      continue;
    }

    // Move toward center
    const dx = CX - e.x;
    const dy = CY - e.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 20) {
      // Dodge chance (wind upgrade)
      if (upgrades.dodgeChance > 0 && Math.random() < upgrades.dodgeChance / 100) {
        spawnParticles(CX, CY, '#80e0d0', 3);
        enemies.splice(i, 1);
        continue;
      }
      // Reached plant — deal damage (shield absorbs first)
      let dmg = e.damage;
      if (player.shield > 0) {
        const absorbed = Math.min(player.shield, dmg);
        player.shield -= absorbed;
        dmg -= absorbed;
        spawnParticles(CX, CY, '#44ccff', 3);
      }
      player.hp -= dmg;
      damageFlash = 15;
      spawnParticles(CX, CY, '#ff0000', 4);
      enemies.splice(i, 1);
      // Thorns (earth upgrade) — retaliation burst: damage all enemies + gain shield
      if (upgrades.thorns > 0) {
        spawnAoeRing(CX, CY, 150, '#c0a060', 25);
        for (let j = enemies.length - 1; j >= 0; j--) {
          enemies[j].hp -= upgrades.thorns;
          spawnParticles(enemies[j].x, enemies[j].y, '#c0a060', 2);
          if (enemies[j].hp <= 0) killEnemy(j);
        }
        player.shield += Math.round(e.damage * 0.25);
      }
      if (player.hp <= 0) {
        player.hp = 0;
        tdGameOver();
        return;
      }
      continue;
    }

    let spd = e.speed * slowFactor;
    if (e.slowTimer > 0) spd *= Math.max(0.1, 0.7 - upgrades.slowStrength / 100); // elemental slow
    e.x += (dx / dist) * spd;
    e.y += (dy / dist) * spd;
  }

  // Plant auto-attack
  const fireRate = Math.max(10, 60 - upgrades.attackSpeed * 5);
  attackTimer++;
  if (attackTimer >= fireRate && enemies.length > 0) {
    attackTimer = 0;
    const weaponCount = 1 + upgrades.weaponCount;

    // Sort enemies by distance to center, skip those already doomed
    const sorted = [...enemies]
      .filter(e => getEffectiveHp(e) > 0)
      .sort((a, b) => {
        const da = Math.sqrt((a.x - CX) ** 2 + (a.y - CY) ** 2);
        const db = Math.sqrt((b.x - CX) ** 2 + (b.y - CY) ** 2);
        return da - db;
      });

    for (let w = 0; w < Math.min(weaponCount, sorted.length); w++) {
      fireProjectile(sorted[w]);
    }
  }

  // Update projectiles
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life--;

    // Fire trail (earth lv3 leaves rock barriers handled differently)
    if (p.element === 'fire' && player.potLevel >= 3 && frameCount % 3 === 0) {
      particles.push({
        x: p.x, y: p.y,
        vx: 0, vy: 0,
        life: 60, maxLife: 60,
        color: '#ff4400',
        size: 2,
        isFireTrail: true,
      });
    }

    // Check collision with enemies
    let hit = false;
    let pierceCount = 0;
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      if (Math.abs(p.x - e.x) < e.w && Math.abs(p.y - e.y) < e.h) {
        applyProjectileHit(p, e, j);
        hit = true;

        // Earth lv2: piercing
        if (p.element === 'earth' && player.potLevel >= 2) {
          pierceCount++;
          if (pierceCount >= 2) break;
          continue;
        }
        break;
      }
    }

    if (hit && !(p.element === 'earth' && player.potLevel >= 2 && pierceCount < 2)) {
      projectiles.splice(i, 1);
      continue;
    }

    // Off-screen or expired
    if (p.x < -10 || p.x > W + 10 || p.y < -10 || p.y > H + 10 || p.life <= 0) {
      projectiles.splice(i, 1);
    }
  }

  // Fire trail damage (particles with isFireTrail)
  for (const pt of particles) {
    if (pt.isFireTrail && pt.life > 0) {
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        if (Math.abs(pt.x - e.x) < 4 && Math.abs(pt.y - e.y) < 4) {
          if (frameCount % 10 === 0) {
            e.hp -= 2;
            if (e.hp <= 0) killEnemy(j);
          }
        }
      }
    }
  }

  // Fire: Heat Aura — damage nearby enemies every second
  if (upgrades.damageAura > 0 && frameCount % 60 === 0) {
    const auraRange = 120;
    spawnAoeRing(CX, CY, auraRange, '#ff4400', 30);
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      const d = Math.sqrt((e.x - CX) ** 2 + (e.y - CY) ** 2);
      if (d < auraRange) {
        e.hp -= upgrades.damageAura;
        spawnParticles(e.x, e.y, '#ff4400', 1);
        if (e.hp <= 0) killEnemy(j);
      }
    }
  }

  // Ice: Chill Aura — passively slow nearby enemies
  if (upgrades.chillAura > 0 && frameCount % 30 === 0) {
    const chillRange = 120;
    spawnAoeRing(CX, CY, chillRange, '#80d0ff', 20);
    for (const e of enemies) {
      const d = Math.sqrt((e.x - CX) ** 2 + (e.y - CY) ** 2);
      if (d < chillRange) {
        e.slowTimer = Math.max(e.slowTimer, 60);
      }
    }
  }

  // Update particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }

  // Update HUD
  if (frameCount % 10 === 0) updateHud();
}

// ── Wave Generation ────────────────────────────────────────────────

function startNextWave() {
  wave++;
  waveActive = true;
  waveTimer = 0;
  waveSpawnQueue = [];
  waveAnnounceTimer = 90;

  const baseCount = 3 + wave * 2;

  // Basic bugs
  for (let i = 0; i < baseCount; i++) {
    waveSpawnQueue.push('basic');
  }

  // Wave 3+: fast bugs
  if (wave >= 3) {
    const fastCount = Math.floor(wave / 2);
    for (let i = 0; i < fastCount; i++) {
      waveSpawnQueue.push('fast');
    }
  }

  // Wave 4+: swarm groups (every even wave)
  if (wave >= 4 && wave % 2 === 0) {
    for (let i = 0; i < 5; i++) {
      waveSpawnQueue.push('swarm');
    }
  }

  // Wave 5+: tanks
  if (wave >= 5) {
    const tankCount = Math.floor((wave - 4) / 3) + 1;
    for (let i = 0; i < tankCount; i++) {
      waveSpawnQueue.push('tank');
    }
  }

  // Every 5th wave: boss
  if (wave % 5 === 0) {
    waveSpawnQueue.push('boss');
  }

  // Shuffle spawn order
  for (let i = waveSpawnQueue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [waveSpawnQueue[i], waveSpawnQueue[j]] = [waveSpawnQueue[j], waveSpawnQueue[i]];
  }

  score += wave * 10;
}

// ── Enemy Spawning ─────────────────────────────────────────────────

function spawnEnemy(type) {
  const def = ENEMY_TYPES[type];
  // 30% compound scaling per wave
  const waveScale = Math.pow(1.3, wave - 1);

  // Pick random edge
  const side = Math.floor(Math.random() * 4);
  let x, y;
  if (side === 0) { x = Math.random() * W; y = -def.h; }       // top
  else if (side === 1) { x = W + def.w; y = Math.random() * H; } // right
  else if (side === 2) { x = Math.random() * W; y = H + def.h; } // bottom
  else { x = -def.w; y = Math.random() * H; }                   // left

  const hp = type === 'boss'
    ? Math.round(def.hp * (wave / 5) * waveScale)
    : Math.round(def.hp * waveScale);
  const spd = def.speed * (1 + (waveScale - 1) * 0.3); // speed scales at 30% of hp rate
  const dmg = Math.round(def.damage * (1 + (waveScale - 1) * 0.5)); // damage scales at 50% of hp rate

  enemies.push({
    type,
    x, y,
    w: def.w, h: def.h,
    hp, maxHp: hp,
    speed: spd,
    damage: dmg,
    exp: def.exp,
    color: def.color,
    frame: 0,
    slowTimer: 0,
    freezeTimer: 0,
    burnTimer: 0,
    burnDamage: 0,
    knockbackTimer: 0,
    knockbackVx: 0,
    knockbackVy: 0,
  });
}

// ── Projectile System ──────────────────────────────────────────────

function fireProjectile(target) {
  const dx = target.x - CX;
  const dy = target.y - CY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return;

  const element = player.element || 'none';
  let speed = 3 + upgrades.projSpeed * 0.5;
  if (element === 'wind' && player.potLevel >= 1) speed = 4.5 + upgrades.projSpeed * 0.5;

  const damage = 10 + upgrades.attackDamage * 5;

  projectiles.push({
    x: CX, y: CY,
    vx: (dx / dist) * speed,
    vy: (dy / dist) * speed,
    damage,
    element,
    life: 200,
    target,
  });
}

function getEffectiveHp(enemy) {
  // Calculate HP remaining after all projectiles already targeting this enemy land
  let incoming = 0;
  for (const p of projectiles) {
    if (p.target === enemy) incoming += p.damage;
  }
  return enemy.hp - incoming;
}

function fireRicochets(source, count, damage, depth) {
  const element = player.element || 'none';
  let speed = 3 + upgrades.projSpeed * 0.5;
  if (element === 'wind') speed = 4.5 + upgrades.projSpeed * 0.5;

  const targeted = new Set([source]);

  for (let i = 0; i < count; i++) {
    // Find closest enemy with effective HP > 0 that we haven't targeted
    let best = null, bestDist = Infinity;
    for (const e of enemies) {
      if (targeted.has(e)) continue;
      if (getEffectiveHp(e) <= 0) continue;
      const d = Math.sqrt((e.x - source.x) ** 2 + (e.y - source.y) ** 2);
      if (d < bestDist) {
        best = e;
        bestDist = d;
      }
    }
    if (!best) break;
    targeted.add(best);

    const dx = best.x - source.x;
    const dy = best.y - source.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) continue;

    projectiles.push({
      x: source.x, y: source.y,
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed,
      damage,
      element,
      life: 200,
      target: best,
      ricochetDepth: depth,
    });

    spawnParticles(source.x, source.y, '#80e0d0', 2);
  }
}

function applyProjectileHit(proj, enemy, enemyIdx) {
  enemy.hp -= proj.damage;
  const element = proj.element;
  const potLv = player.potLevel;

  // Elemental effects
  if (element === 'fire') {
    // Lv1: burn DoT
    if (potLv >= 1) {
      enemy.burnTimer = 60; // 3 ticks over ~1s each
      enemy.burnDamage = 3;
    }
    // Lv2: AoE explosion
    if (potLv >= 2) {
      const aoeR = 28 + upgrades.aoeRadius;
      spawnAoeRing(enemy.x, enemy.y, aoeR, '#ff6600', 15);
      for (let j = enemies.length - 1; j >= 0; j--) {
        if (j === enemyIdx) continue;
        const e2 = enemies[j];
        const d = Math.sqrt((e2.x - enemy.x) ** 2 + (e2.y - enemy.y) ** 2);
        if (d < aoeR) {
          e2.hp -= Math.round(proj.damage * 0.3);
          spawnParticles(e2.x, e2.y, '#ff6600', 2);
          if (e2.hp <= 0) killEnemy(j);
        }
      }
      spawnParticles(enemy.x, enemy.y, '#ffaa00', 4);
    }
    spawnParticles(proj.x, proj.y, '#ff6600', 3);
  } else if (element === 'ice') {
    // Lv1: slow
    if (potLv >= 1) {
      enemy.slowTimer = 120;
    }
    // Lv2: AoE slow
    if (potLv >= 2) {
      spawnAoeRing(enemy.x, enemy.y, 12, '#80d0ff', 15);
      for (const e2 of enemies) {
        const d = Math.sqrt((e2.x - enemy.x) ** 2 + (e2.y - enemy.y) ** 2);
        if (d < 12) e2.slowTimer = 120;
      }
    }
    // Lv3: freeze chance (base 15% + upgrade)
    const freezePct = 0.15 + upgrades.freezeChance / 100;
    if (potLv >= 3 && Math.random() < freezePct) {
      enemy.freezeTimer = 90;
    }
    spawnParticles(proj.x, proj.y, '#80d0ff', 3);
  } else if (element === 'earth') {
    // Lv1: knockback
    if (potLv >= 1) {
      const dx = enemy.x - CX;
      const dy = enemy.y - CY;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const kbForce = 2 + upgrades.knockbackForce;
      enemy.knockbackTimer = 8 + Math.floor(upgrades.knockbackForce);
      enemy.knockbackVx = (dx / d) * kbForce;
      enemy.knockbackVy = (dy / d) * kbForce;
      spawnAoeRing(enemy.x, enemy.y, 10 + upgrades.knockbackForce * 2, '#c0a060', 10);
    }
    // Lv3: spawn rock barrier (base 20% + upgrade)
    if (potLv >= 3 && Math.random() < 0.2 + upgrades.barrierChance / 100) {
      particles.push({
        x: enemy.x, y: enemy.y,
        vx: 0, vy: 0,
        life: 180, maxLife: 180,
        color: '#8a6a30',
        size: 6,
        isRockBarrier: true,
      });
    }
    spawnParticles(proj.x, proj.y, '#c0a060', 3);
  } else if (element === 'wind' && (proj.ricochetDepth || 0) < upgrades.chainCount + 1) {
    // Ricochet: fire projectiles from hit location, depth-limited
    const ricochetDmg = Math.round(proj.damage * 0.5);
    fireRicochets(enemy, 1, ricochetDmg, (proj.ricochetDepth || 0) + 1);
    spawnParticles(proj.x, proj.y, '#80e0d0', 3);
  } else {
    spawnParticles(proj.x, proj.y, '#ffffff', 2);
  }

  // Rock barrier collision check
  for (const pt of particles) {
    if (pt.isRockBarrier && pt.life > 0) {
      const d = Math.sqrt((enemy.x - pt.x) ** 2 + (enemy.y - pt.y) ** 2);
      if (d < pt.size + 4) {
        enemy.hp -= 5;
        // Push enemy back slightly
        const dx = enemy.x - pt.x;
        const dy = enemy.y - pt.y;
        const dd = Math.sqrt(dx * dx + dy * dy) || 1;
        enemy.knockbackTimer = 5;
        enemy.knockbackVx = (dx / dd) * 1.5;
        enemy.knockbackVy = (dy / dd) * 1.5;
      }
    }
  }

  if (enemy.hp <= 0) {
    killEnemy(enemyIdx);
  }
}

function killEnemy(idx) {
  const e = enemies[idx];
  if (!e) return;
  const elementColor = ELEMENT_PROJ_COLORS[player.element || 'none'].main;
  spawnParticles(e.x, e.y, elementColor, 6);
  score += e.exp * 10;

  // Grant EXP
  fertilizerExp += e.exp;
  checkLevelUp();

  enemies.splice(idx, 1);
}

// ── Elemental Abilities ────────────────────────────────────────────

function activateAbility() {
  if (!player.element || abilityCharge < abilityMaxCharge || abilityActive) return;

  abilityCharge = 0;
  abilityActive = true;
  abilityFlash = 20;

  const elem = player.element;
  const potLv = player.potLevel;

  if (elem === 'fire') {
    // Screen-wide damage wave
    abilityFlashColor = '#ff4400';
    abilityTimer = 1;
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      const dmg = Math.round(e.hp * 0.5);
      e.hp -= dmg;
      spawnParticles(e.x, e.y, '#ff6600', 3);
      if (e.hp <= 0) killEnemy(i);
    }
  } else if (elem === 'ice') {
    // Freeze all enemies
    abilityFlashColor = '#80d0ff';
    abilityTimer = 1;
    for (const e of enemies) {
      e.freezeTimer = 180; // 3 seconds
    }
  } else if (elem === 'earth') {
    // Rock ring barrier
    abilityFlashColor = '#c0a060';
    abilityTimer = 300; // 5 seconds
    // Create ring of rock particles around plant
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 / 12) * i;
      particles.push({
        x: CX + Math.cos(angle) * 30,
        y: CY + Math.sin(angle) * 30,
        vx: 0, vy: 0,
        life: 300, maxLife: 300,
        color: '#8a6a30',
        size: 5,
        isRockBarrier: true,
      });
    }
  } else if (elem === 'wind') {
    // Tornado — push all enemies to edges
    abilityFlashColor = '#80e0d0';
    abilityTimer = 1;
    for (const e of enemies) {
      const dx = e.x - CX;
      const dy = e.y - CY;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      e.knockbackTimer = 30;
      e.knockbackVx = (dx / d) * 4;
      e.knockbackVy = (dy / d) * 4;
      spawnParticles(e.x, e.y, '#80e0d0', 2);
    }
  }
}

function updateAbilityEffect() {
  // Rock barrier: damage enemies that touch barriers
  if (player.element === 'earth' && abilityActive) {
    for (const pt of particles) {
      if (!pt.isRockBarrier || pt.life <= 0) continue;
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        const d = Math.sqrt((e.x - pt.x) ** 2 + (e.y - pt.y) ** 2);
        if (d < pt.size + e.w / 2) {
          if (frameCount % 15 === 0) {
            e.hp -= 8;
            const dx = e.x - pt.x;
            const dy = e.y - pt.y;
            const dd = Math.sqrt(dx * dx + dy * dy) || 1;
            e.knockbackTimer = 5;
            e.knockbackVx = (dx / dd) * 2;
            e.knockbackVy = (dy / dd) * 2;
            spawnParticles(e.x, e.y, '#c0a060', 2);
            if (e.hp <= 0) killEnemy(j);
          }
        }
      }
    }
  }

  // Wind lv2: periodic pushback
  if (player.element === 'wind' && player.potLevel >= 2 && frameCount % 120 === 0) {
    for (const e of enemies) {
      const dx = e.x - CX;
      const dy = e.y - CY;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      e.knockbackTimer = 10;
      e.knockbackVx = (dx / d) * 1.5;
      e.knockbackVy = (dy / d) * 1.5;
    }
  }
}

// ── EXP & Leveling ─────────────────────────────────────────────────

function checkLevelUp() {
  while (fertilizerExp >= expToNextLevel) {
    fertilizerExp -= expToNextLevel;
    playerLevel++;
    expToNextLevel = Math.floor(10 * Math.pow(1.5, playerLevel - 1));
    generateUpgradeOptions();
  }
  // Immediately show picker mid-wave so the game pauses for the choice
  if (pendingUpgrades.length > 0 && !showingUpgradePicker) {
    showUpgradePicker();
  }
}

function generateUpgradeOptions() {
  const options = [];
  const used = new Set();

  // 3 generic upgrade cards
  while (options.length < 3) {
    const idx = Math.floor(Math.random() * UPGRADE_DEFS.length);
    if (used.has(idx) && UPGRADE_DEFS.length >= 3) continue;
    used.add(idx);

    const def = UPGRADE_DEFS[idx];
    const rarity = rollRarity();
    const value = def.values[rarity];

    options.push({
      key: def.key,
      name: def.name,
      desc: def.desc,
      rarity,
      value,
    });
  }

  // 4th card: elemental upgrade (if player has an element)
  const elem = player.element;
  const elemDefs = elem ? ELEMENTAL_UPGRADE_DEFS[elem] : null;
  if (elemDefs && elemDefs.length > 0) {
    const def = elemDefs[Math.floor(Math.random() * elemDefs.length)];
    const rarity = rollRarity();
    const value = def.values[rarity];
    options.push({
      key: def.key,
      name: def.name,
      desc: def.desc,
      rarity,
      value,
      elemental: elem,
    });
  }

  pendingUpgrades.push(options);
}

function rollRarity() {
  const total = RARITY_WEIGHTS.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < RARITY_WEIGHTS.length; i++) {
    r -= RARITY_WEIGHTS[i];
    if (r <= 0) return RARITY_NAMES[i];
  }
  return 'Common';
}

function applyUpgrade(option) {
  upgrades[option.key] += option.value;
  if (option.key === 'health') {
    const bonus = Math.round(option.value * 1.25);
    player.maxHp += bonus;
    player.hp = player.maxHp;
    player.shield += bonus;
  }
}

// ── Upgrade Picker UI ──────────────────────────────────────────────

function showUpgradePicker() {
  if (pendingUpgrades.length === 0) return;
  showingUpgradePicker = true;
  upgradeOptions = pendingUpgrades.shift();
  hoverCard = -1;
}

function hideUpgradePicker() {
  showingUpgradePicker = false;
  showingDeck = false;
  upgradeOptions = [];
}

const ELEMENT_CARD_BG = {
  fire:  { outer: '#2a1208', inner: '#301810' },
  ice:   { outer: '#0a1a2a', inner: '#101e2e' },
  earth: { outer: '#1a1808', inner: '#221e10' },
  wind:  { outer: '#0a2220', inner: '#102826' },
};

function getCardPositions() {
  const cardW = 88;
  const cardH = 100;
  const gap = 10;
  const topRow = upgradeOptions.filter(o => !o.elemental);
  const elemCard = upgradeOptions.find(o => o.elemental);
  const topCount = topRow.length;
  const totalTopW = cardW * topCount + gap * (topCount - 1);
  const topStartX = (W - totalTopW) / 2;
  const topStartY = 65;

  const positions = [];
  for (let i = 0; i < upgradeOptions.length; i++) {
    const opt = upgradeOptions[i];
    if (!opt.elemental) {
      const row1Idx = topRow.indexOf(opt);
      positions.push({
        x: topStartX + row1Idx * (cardW + gap),
        y: topStartY,
        w: cardW,
        h: cardH,
      });
    } else {
      // Center beneath the middle (2nd) card
      const midX = topStartX + 1 * (cardW + gap);
      positions.push({
        x: midX,
        y: topStartY + cardH + gap,
        w: cardW,
        h: cardH,
      });
    }
  }
  return { positions, cardW, cardH };
}

function renderUpgradePicker() {
  // Dim background — opaque enough to hide game
  ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.fillRect(0, 0, W, H);

  // Title
  ctx.fillStyle = '#ffdd00';
  ctx.font = '10px monospace';
  const title = `Level Up! (Lv.${playerLevel})`;
  const tw = ctx.measureText(title).width;
  ctx.fillText(title, (W - tw) / 2, 40);

  ctx.font = '7px monospace';
  ctx.fillStyle = '#aaaaaa';
  const sub = 'Choose an upgrade:';
  const sw = ctx.measureText(sub).width;
  ctx.fillText(sub, (W - sw) / 2, 55);

  const { positions, cardW, cardH } = getCardPositions();

  for (let i = 0; i < upgradeOptions.length; i++) {
    const opt = upgradeOptions[i];
    const pos = positions[i];
    const cx = pos.x;
    const cy = hoverCard === i ? pos.y - 5 : pos.y;
    const borderColor = RARITY_COLORS[opt.rarity] || '#888';
    const isElemental = !!opt.elemental;
    const elemBg = isElemental ? ELEMENT_CARD_BG[opt.elemental] : null;

    // Card background
    ctx.fillStyle = elemBg ? elemBg.outer : '#1a1a12';
    ctx.fillRect(cx, cy, cardW, cardH);

    // Inner background
    ctx.fillStyle = elemBg ? elemBg.inner : '#222218';
    ctx.fillRect(cx + 2, cy + 2, cardW - 4, cardH - 4);

    // Border — elemental cards use element color
    const elemColor = isElemental ? ELEMENT_PROJ_COLORS[opt.elemental].main : null;
    ctx.strokeStyle = isElemental ? elemColor : borderColor;
    ctx.lineWidth = hoverCard === i ? 3 : 2;
    ctx.strokeRect(cx, cy, cardW, cardH);

    // Element tag for elemental cards
    if (isElemental) {
      ctx.fillStyle = elemColor;
      ctx.font = '5px monospace';
      const tag = opt.elemental.toUpperCase();
      const tagW = ctx.measureText(tag).width;
      ctx.fillText(tag, cx + cardW - tagW - 5, cy + 14);
    }

    // Rarity label
    ctx.fillStyle = borderColor;
    ctx.font = '6px monospace';
    ctx.fillText(opt.rarity, cx + 6, cy + 14);

    // Name
    ctx.fillStyle = isElemental ? elemColor : '#ffffff';
    ctx.font = '7px monospace';
    ctx.fillText(opt.name, cx + 6, cy + 28);

    // Description
    ctx.fillStyle = '#999999';
    ctx.font = '6px monospace';
    const lines = wrapText(opt.desc, cardW - 12, ctx);
    for (let l = 0; l < lines.length; l++) {
      ctx.fillText(lines[l], cx + 6, cy + 42 + l * 10);
    }

    // Value — big and colored
    ctx.fillStyle = isElemental ? elemColor : borderColor;
    ctx.font = '10px monospace';
    const valStr = `+${opt.value}`;
    ctx.fillText(valStr, cx + 6, cy + cardH - 10);
  }
}

function wrapText(text, maxW, ctx) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function handleUpgradeClick(x, y) {
  if (!showingUpgradePicker) return false;

  const { positions, cardW, cardH } = getCardPositions();

  for (let i = 0; i < upgradeOptions.length; i++) {
    const pos = positions[i];
    if (x >= pos.x && x <= pos.x + cardW && y >= pos.y - 5 && y <= pos.y + cardH) {
      applyUpgrade(upgradeOptions[i]);
      hideUpgradePicker();
      // Check if more pending
      if (pendingUpgrades.length > 0) {
        showUpgradePicker();
      }
      return true;
    }
  }
  return false;
}

function handleUpgradeHover(x, y) {
  if (!showingUpgradePicker) return;

  const { positions, cardW, cardH } = getCardPositions();

  hoverCard = -1;
  for (let i = 0; i < upgradeOptions.length; i++) {
    const pos = positions[i];
    if (x >= pos.x && x <= pos.x + cardW && y >= pos.y - 5 && y <= pos.y + cardH) {
      hoverCard = i;
      break;
    }
  }
}

// ── Deck View (all upgrades) ───────────────────────────────────────

const DECK_BTN = { x: 270, y: 10, w: 40, h: 18 };
const DECK_BACK_BTN = { x: 5, y: 5, w: 40, h: 18 };

function renderDeckButton() {
  const b = DECK_BTN;
  ctx.fillStyle = '#333';
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1;
  ctx.strokeRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = '#ccc';
  ctx.font = '7px monospace';
  ctx.fillText('Deck', b.x + 7, b.y + 13);
}

function renderDeck() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
  ctx.fillRect(0, 0, W, H);

  // Back button
  const bb = DECK_BACK_BTN;
  ctx.fillStyle = '#333';
  ctx.fillRect(bb.x, bb.y, bb.w, bb.h);
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1;
  ctx.strokeRect(bb.x, bb.y, bb.w, bb.h);
  ctx.fillStyle = '#ccc';
  ctx.font = '7px monospace';
  ctx.fillText('Back', bb.x + 7, bb.y + 13);

  // Title
  ctx.fillStyle = '#ffdd00';
  ctx.font = '9px monospace';
  const title = 'All Upgrades';
  const tw = ctx.measureText(title).width;
  ctx.fillText(title, (W - tw) / 2, 18);

  // Build list: generic upgrades, then elemental
  const elem = player.element;
  const allDefs = [];

  for (const def of UPGRADE_DEFS) {
    allDefs.push({ def, elemental: null });
  }
  if (elem && ELEMENTAL_UPGRADE_DEFS[elem]) {
    for (const def of ELEMENTAL_UPGRADE_DEFS[elem]) {
      allDefs.push({ def, elemental: elem });
    }
  }

  // Layout: 3 columns
  const colW = 100;
  const rowH = 52;
  const cols = 3;
  const gap = 5;
  const totalGridW = colW * cols + gap * (cols - 1);
  const gridX = (W - totalGridW) / 2;
  const gridY = 30;
  const maxVisible = H - gridY - 5;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, gridY, W, maxVisible);
  ctx.clip();

  for (let i = 0; i < allDefs.length; i++) {
    const { def, elemental: elemType } = allDefs[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = gridX + col * (colW + gap);
    const cy = gridY + row * (rowH + gap) - deckScroll;

    // Skip if off screen
    if (cy + rowH < gridY || cy > H) continue;

    const isElem = !!elemType;
    const elemBg = isElem ? ELEMENT_CARD_BG[elemType] : null;
    const elemColor = isElem ? ELEMENT_PROJ_COLORS[elemType].main : null;

    // Card bg
    ctx.fillStyle = elemBg ? elemBg.outer : '#1a1a12';
    ctx.fillRect(cx, cy, colW, rowH);
    ctx.fillStyle = elemBg ? elemBg.inner : '#222218';
    ctx.fillRect(cx + 1, cy + 1, colW - 2, rowH - 2);

    // Border
    ctx.strokeStyle = isElem ? elemColor : '#555';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx, cy, colW, rowH);

    // Name
    ctx.fillStyle = isElem ? elemColor : '#ffffff';
    ctx.font = '6px monospace';
    ctx.fillText(def.name, cx + 4, cy + 12);

    // Current level
    const curVal = upgrades[def.key] || 0;
    if (curVal > 0) {
      ctx.fillStyle = '#ffdd00';
      ctx.font = '5px monospace';
      const lvStr = `+${curVal}`;
      const lvW = ctx.measureText(lvStr).width;
      ctx.fillText(lvStr, cx + colW - lvW - 4, cy + 12);
    }

    // Desc
    ctx.fillStyle = '#888';
    ctx.font = '5px monospace';
    const lines = wrapText(def.desc, colW - 8, ctx);
    for (let l = 0; l < Math.min(lines.length, 2); l++) {
      ctx.fillText(lines[l], cx + 4, cy + 22 + l * 8);
    }

    // Element tag
    if (isElem) {
      ctx.fillStyle = elemColor;
      ctx.font = '4px monospace';
      ctx.fillText(elemType.toUpperCase(), cx + 4, cy + rowH - 4);
    }

    // Rarity range
    const vals = def.values;
    ctx.fillStyle = '#666';
    ctx.font = '4px monospace';
    const range = `${vals.Common}-${vals.Legendary}`;
    const rw = ctx.measureText(range).width;
    ctx.fillText(range, cx + colW - rw - 4, cy + rowH - 4);
  }

  ctx.restore();

  // Scroll indicators
  const totalRows = Math.ceil(allDefs.length / cols);
  const totalH = totalRows * (rowH + gap);
  if (totalH > maxVisible) {
    const scrollBarH = Math.max(20, maxVisible * (maxVisible / totalH));
    const scrollBarY = gridY + (deckScroll / (totalH - maxVisible)) * (maxVisible - scrollBarH);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(W - 4, scrollBarY, 3, scrollBarH);
  }
}

function handleDeckClick(x, y) {
  // Back button — return to upgrade picker or pause menu
  const bb = DECK_BACK_BTN;
  if (x >= bb.x && x <= bb.x + bb.w && y >= bb.y && y <= bb.y + bb.h) {
    showingDeck = false;
    return true;
  }
  return false;
}

function getDeckMaxScroll() {
  const elem = player.element;
  let count = UPGRADE_DEFS.length;
  if (elem && ELEMENTAL_UPGRADE_DEFS[elem]) count += ELEMENTAL_UPGRADE_DEFS[elem].length;
  const cols = 3;
  const rowH = 52;
  const gap = 5;
  const totalRows = Math.ceil(count / cols);
  const totalH = totalRows * (rowH + gap);
  const maxVisible = H - 30 - 5;
  return Math.max(0, totalH - maxVisible);
}

// ── Stats Screen ─────────────────────────────────────────────────

const STATS_BACK_BTN = { x: 4, y: 4, w: 40, h: 14 };

function renderStatsScreen() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
  ctx.fillRect(0, 0, W, H);

  // Back button
  const bb = STATS_BACK_BTN;
  ctx.fillStyle = '#222';
  ctx.fillRect(bb.x, bb.y, bb.w, bb.h);
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 1;
  ctx.strokeRect(bb.x, bb.y, bb.w, bb.h);
  ctx.fillStyle = '#ccc';
  ctx.font = '6px monospace';
  ctx.fillText('← Back', bb.x + 4, bb.y + 10);

  // Title
  ctx.fillStyle = '#ffdd00';
  ctx.font = '10px monospace';
  const title = 'Plant Stats';
  const tw = ctx.measureText(title).width;
  ctx.fillText(title, (W - tw) / 2, 30);

  // Scrollable area
  ctx.save();
  const areaY = 40;
  const areaH = H - areaY;
  ctx.beginPath();
  ctx.rect(0, areaY, W, areaH);
  ctx.clip();

  let y = areaY - statsScroll;
  const lh = 11; // line height
  const col1 = 12;
  const col2 = W - 12;

  // ── Core Stats ──
  y += 4;
  ctx.fillStyle = '#ff6644';
  ctx.font = '7px monospace';
  ctx.fillText('── CORE ──', col1, y);
  y += lh + 2;

  const fireRate = Math.max(10, 60 - upgrades.attackSpeed * 5);
  const aps = (60 / fireRate).toFixed(1);
  const dmg = 10 + upgrades.attackDamage * 5;
  const projCount = 1 + upgrades.weaponCount;
  const rechargeRate = (0.15 + upgrades.powerRecharge).toFixed(2);
  const slowPct = upgrades.bugSlow;

  const coreStats = [
    ['HP', `${player.hp}/${player.maxHp}`],
    ['Shield', `${player.shield}`],
    ['Attack Dmg', `${dmg}`],
    ['Atk Speed', `${aps}/s (${upgrades.attackSpeed} pts)`],
    ['Projectiles', `${projCount}`],
    ['Ability Rchg', `${rechargeRate}/frame`],
    ['Bug Slow', `${slowPct}%`],
    ['Wave', `${wave}`],
    ['Level', `${playerLevel}`],
    ['Score', `${score}`],
  ];

  ctx.font = '5px monospace';
  for (const [label, val] of coreStats) {
    ctx.fillStyle = '#aaa';
    ctx.fillText(label, col1, y);
    ctx.fillStyle = '#fff';
    const vw = ctx.measureText(val).width;
    ctx.fillText(val, col2 - vw, y);
    y += lh;
  }

  // ── Element ──
  if (player.element) {
    y += 6;
    const elemColors = { fire: '#ff6600', ice: '#80d0ff', earth: '#c0a060', wind: '#88ddaa' };
    ctx.fillStyle = elemColors[player.element] || '#ffdd00';
    ctx.font = '7px monospace';
    ctx.fillText(`── ${player.element.toUpperCase()} ──`, col1, y);
    y += lh + 2;

    const elemDefs = ELEMENTAL_UPGRADE_DEFS[player.element] || [];
    const elemStats = [];
    for (const def of elemDefs) {
      const val = upgrades[def.key];
      if (val > 0) {
        let display = `${val}`;
        if (def.key === 'freezeChance' || def.key === 'barrierChance' || def.key === 'dodgeChance') {
          display = `${val}%`;
        }
        elemStats.push([def.name, display, def.desc]);
      }
    }

    ctx.font = '5px monospace';
    if (elemStats.length === 0) {
      ctx.fillStyle = '#666';
      ctx.fillText('No elemental upgrades yet', col1, y);
      y += lh;
    } else {
      for (const [label, val, desc] of elemStats) {
        ctx.fillStyle = '#aaa';
        ctx.fillText(label, col1, y);
        ctx.fillStyle = '#fff';
        const vw = ctx.measureText(val).width;
        ctx.fillText(val, col2 - vw, y);
        y += lh - 2;
        ctx.fillStyle = '#666';
        ctx.font = '4px monospace';
        ctx.fillText(desc, col1 + 4, y);
        ctx.font = '5px monospace';
        y += lh;
      }
    }
  }

  // ── Upgrades Collected ──
  y += 6;
  ctx.fillStyle = '#aa88ff';
  ctx.font = '7px monospace';
  ctx.fillText('── UPGRADES ──', col1, y);
  y += lh + 2;

  const allDefs = [...UPGRADE_DEFS];
  if (player.element && ELEMENTAL_UPGRADE_DEFS[player.element]) {
    allDefs.push(...ELEMENTAL_UPGRADE_DEFS[player.element]);
  }

  ctx.font = '5px monospace';
  let hasAny = false;
  for (const def of allDefs) {
    const val = upgrades[def.key];
    if (val > 0) {
      hasAny = true;
      ctx.fillStyle = '#ccc';
      ctx.fillText(def.name, col1, y);
      ctx.fillStyle = '#ffdd00';
      const vStr = `+${val}`;
      const vw = ctx.measureText(vStr).width;
      ctx.fillText(vStr, col2 - vw, y);
      y += lh;
    }
  }
  if (!hasAny) {
    ctx.fillStyle = '#666';
    ctx.fillText('No upgrades yet', col1, y);
    y += lh;
  }

  // Total content height for scrolling
  const totalContentH = y + statsScroll - areaY;
  ctx.restore();

  // Scroll indicator
  if (totalContentH > areaH) {
    const scrollBarH = Math.max(20, areaH * (areaH / totalContentH));
    const maxScroll = totalContentH - areaH;
    const scrollBarY = areaY + (statsScroll / maxScroll) * (areaH - scrollBarH);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(W - 4, scrollBarY, 3, scrollBarH);
  }
}

function handleStatsClick(x, y) {
  const bb = STATS_BACK_BTN;
  if (x >= bb.x && x <= bb.x + bb.w && y >= bb.y && y <= bb.y + bb.h) {
    showingStats = false;
    statsScroll = 0;
    return;
  }
}

function getStatsMaxScroll() {
  // Estimate total content height
  let lines = 12; // core stats
  if (player.element) {
    const elemDefs = ELEMENTAL_UPGRADE_DEFS[player.element] || [];
    lines += 2 + elemDefs.filter(d => upgrades[d.key] > 0).length * 2;
  }
  const allDefs = [...UPGRADE_DEFS];
  if (player.element && ELEMENTAL_UPGRADE_DEFS[player.element]) allDefs.push(...ELEMENTAL_UPGRADE_DEFS[player.element]);
  lines += 2 + allDefs.filter(d => upgrades[d.key] > 0).length;
  const totalH = lines * 11 + 40;
  return Math.max(0, totalH - (H - 40));
}

// ── Pause Menu ────────────────────────────────────────────────────

const HAMBURGER_BTN = { x: 4, y: 18, w: 18, h: 16 };
const AUTO_BTN = { x: 4, y: 38, w: 18, h: 12 };
const STATS_BTN = { x: 26, y: 18, w: 28, h: 16 };
let showingStats = false;
let statsScroll = 0;

function renderHamburgerButton() {
  if (showingUpgradePicker || showingPauseMenu) return;
  const b = HAMBURGER_BTN;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = '#ccc';
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(b.x + 4, b.y + 4 + i * 4, 10, 2);
  }
}

function renderStatsButton() {
  if (showingUpgradePicker || showingPauseMenu || showingStats) return;
  const b = STATS_BTN;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = '#ccc';
  ctx.font = '6px monospace';
  const label = 'STATS';
  const lw = ctx.measureText(label).width;
  ctx.fillText(label, b.x + (b.w - lw) / 2, b.y + 11);
}

function renderAutoButton() {
  if (showingUpgradePicker || showingPauseMenu || showingStats) return;
  if (!player.element) return;
  const b = AUTO_BTN;
  ctx.fillStyle = autoAbility ? 'rgba(0,180,80,0.6)' : 'rgba(0,0,0,0.5)';
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.strokeStyle = autoAbility ? '#44ff88' : '#666';
  ctx.lineWidth = 1;
  ctx.strokeRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = autoAbility ? '#fff' : '#999';
  ctx.font = '5px monospace';
  const label = 'AUTO';
  const lw = ctx.measureText(label).width;
  ctx.fillText(label, b.x + (b.w - lw) / 2, b.y + 9);
}

const PAUSE_BTNS = {
  resume:  { x: 110, y: 120, w: 100, h: 24, label: 'Resume' },
  deck:    { x: 110, y: 152, w: 100, h: 24, label: 'Deck' },
  retry:   { x: 110, y: 184, w: 100, h: 24, label: 'Retry' },
  exit:    { x: 110, y: 216, w: 100, h: 24, label: 'Exit' },
};

function renderPauseMenu() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#ffdd00';
  ctx.font = '12px monospace';
  const title = 'Paused';
  const tw = ctx.measureText(title).width;
  ctx.fillText(title, (W - tw) / 2, 80);

  ctx.font = '7px monospace';
  ctx.fillStyle = '#888';
  const info = `Wave ${wave}  |  Lv.${playerLevel}  |  Score ${score}`;
  const iw = ctx.measureText(info).width;
  ctx.fillText(info, (W - iw) / 2, 100);

  for (const key of Object.keys(PAUSE_BTNS)) {
    const b = PAUSE_BTNS[key];
    ctx.fillStyle = key === 'exit' ? '#3a1a1a' : '#222';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = key === 'exit' ? '#aa4444' : '#666';
    ctx.lineWidth = 1;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = key === 'exit' ? '#ff6666' : '#ccc';
    ctx.font = '8px monospace';
    const lw = ctx.measureText(b.label).width;
    ctx.fillText(b.label, b.x + (b.w - lw) / 2, b.y + 16);
  }
}

function handlePauseMenuClick(x, y) {
  for (const [key, b] of Object.entries(PAUSE_BTNS)) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
      if (key === 'resume') {
        showingPauseMenu = false;
      } else if (key === 'deck') {
        showingDeck = true;
        deckScroll = 0;
      } else if (key === 'retry') {
        showingPauseMenu = false;
        beginGame();
      } else if (key === 'exit') {
        showingPauseMenu = false;
        handleBack();
      }
      return true;
    }
  }
  return false;
}

// ── Particles ──────────────────────────────────────────────────────

function spawnParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.5 + Math.random() * 1.5;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 20 + Math.floor(Math.random() * 20),
      maxLife: 40,
      color,
      size: 1 + Math.floor(Math.random() * 2),
    });
  }
}

function spawnAoeRing(x, y, radius, color, duration) {
  particles.push({
    x, y,
    vx: 0, vy: 0,
    life: duration,
    maxLife: duration,
    color,
    size: radius,
    isAoeRing: true,
  });
}

function spawnChainLine(x1, y1, x2, y2, color, duration) {
  particles.push({
    x: x1, y: y1,
    vx: x2, vy: y2, // reuse vx/vy as target coords
    life: duration,
    maxLife: duration,
    color,
    size: 0,
    isChainLine: true,
  });
}

// ── Rendering ──────────────────────────────────────────────────────

function render() {
  ctx.save();
  ctx.scale(CANVAS_SCALE, CANVAS_SCALE);

  // Background — grass field
  ctx.fillStyle = '#3a7a2a';
  ctx.fillRect(0, 0, W, H);

  // Grass color variation
  const grassGrad = ctx.createRadialGradient(CX, CY, 20, CX, CY, 200);
  grassGrad.addColorStop(0, 'rgba(60, 140, 50, 0.3)');
  grassGrad.addColorStop(0.5, 'rgba(50, 120, 40, 0.1)');
  grassGrad.addColorStop(1, 'rgba(30, 90, 25, 0.2)');
  ctx.fillStyle = grassGrad;
  ctx.fillRect(0, 0, W, H);

  // Grass detail dots
  const grassShades = ['#4a8a35', '#358a28', '#2d7a22'];
  for (const tuft of grassTufts) {
    ctx.fillStyle = grassShades[tuft.shade];
    ctx.fillRect(tuft.x, tuft.y, 1, tuft.h);
    ctx.fillRect(tuft.x - 1, tuft.y + 1, 1, tuft.h - 1);
  }

  // Road — vertical dirt path through center
  const roadW = 48;
  const roadX = CX - roadW / 2;
  ctx.fillStyle = '#8a7a5a';
  ctx.fillRect(roadX, 0, roadW, H);
  // Road edges
  ctx.fillStyle = '#6a6040';
  ctx.fillRect(roadX, 0, 2, H);
  ctx.fillRect(roadX + roadW - 2, 0, 2, H);
  // Road surface detail
  ctx.fillStyle = '#9a8a68';
  ctx.fillRect(roadX + 4, 0, roadW - 8, H);
  // Center dashes (scroll with roadOffset)
  ctx.fillStyle = '#b0a078';
  for (let y = -16 + (roadOffset % 16); y < H; y += 16) {
    ctx.fillRect(CX - 1, y, 2, 8);
  }
  // Dirt speckle on road
  ctx.fillStyle = '#7a6a4a';
  for (const dot of bgDots) {
    if (dot.x > roadX + 4 && dot.x < roadX + roadW - 4) {
      ctx.fillRect(dot.x, dot.y, dot.size, dot.size);
    }
  }

  // Citadel event overrides normal gameplay rendering
  if (showingCitadelEvent) {
    renderCitadelEvent();
    ctx.restore();
    return;
  }

  // Range circle (subtle, over grass)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(CX, CY, 120, 0, Math.PI * 2);
  ctx.stroke();

  // Rock barriers
  for (const pt of particles) {
    if (pt.isRockBarrier && pt.life > 0) {
      const alpha = Math.min(1, pt.life / 30);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#5a4a20';
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
      ctx.fillStyle = '#8a7a40';
      ctx.fillRect(pt.x - pt.size / 2 + 1, pt.y - pt.size / 2 + 1, pt.size - 2, pt.size - 2);
      ctx.globalAlpha = 1;
    }
  }

  // Fire trails
  for (const pt of particles) {
    if (pt.isFireTrail && pt.life > 0) {
      const alpha = pt.life / pt.maxLife * 0.6;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - 1, pt.y - 1, pt.size, pt.size);
      ctx.globalAlpha = 1;
    }
  }

  // Enemies
  for (const e of enemies) {
    renderEnemy(e);
  }

  // Projectiles
  for (const p of projectiles) {
    renderProjectile(p);
  }

  // AoE rings
  for (const p of particles) {
    if (!p.isAoeRing) continue;
    const t = 1 - p.life / p.maxLife; // 0 → 1 over lifetime
    const curR = p.size * t; // expand from 0 to full radius
    const alpha = (1 - t) * 0.7;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, curR, 0, Math.PI * 2);
    ctx.stroke();
    // Inner fill
    ctx.globalAlpha = alpha * 0.15;
    ctx.fillStyle = p.color;
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Chain lines
  for (const p of particles) {
    if (!p.isChainLine) continue;
    const alpha = (p.life / p.maxLife) * 0.8;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.vx, p.vy); // vx/vy store target coords
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Particles (non-special)
  for (const p of particles) {
    if (p.isFireTrail || p.isRockBarrier || p.isAoeRing || p.isChainLine) continue;
    const alpha = p.life / p.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;

  // Plant at center (hop during travel animation)
  if (plantSprite) {
    const px = CX - plantSprite.width / 2;
    let py = CY - plantSprite.height / 2;
    if (travelAnim > 0) {
      // Bouncy hop: sine wave creating a hopping motion
      const hopHeight = Math.abs(Math.sin(plantHopFrame * 0.2)) * 6;
      py -= hopHeight;
    }
    ctx.drawImage(plantSprite, Math.round(px), Math.round(py));
  }

  // HP bar above plant
  const barOffsetY = plantSprite ? plantSprite.height / 2 : 20;
  renderHpBar(CX - 25, CY - barOffsetY - 12, 50, 4, player.hp, player.maxHp, '#44aa44');
  // Shield bar overlay (cyan, on top of HP bar)
  if (player.shield > 0) {
    const shieldPct = Math.min(1, player.shield / player.maxHp);
    ctx.fillStyle = 'rgba(68, 204, 255, 0.6)';
    ctx.fillRect(CX - 25, CY - barOffsetY - 12, Math.round(50 * shieldPct), 4);
  }

  // Ability charge bar below HP bar
  if (player.element) {
    const elemColor = ELEMENT_PROJ_COLORS[player.element].main;
    renderHpBar(CX - 25, CY - barOffsetY - 6, 50, 3, abilityCharge, abilityMaxCharge, elemColor);

    // "RDY" label when ability is full
    if (abilityCharge >= abilityMaxCharge) {
      const pulse = 0.5 + 0.5 * Math.sin(frameCount * 0.15);
      ctx.globalAlpha = 0.5 + pulse * 0.5;
      ctx.fillStyle = elemColor;
      ctx.font = '6px monospace';
      ctx.fillText('TAP', CX + 28, CY - barOffsetY - 3);
      ctx.globalAlpha = 1;
    }
  }

  // Evade % for wind element
  if (player.element === 'wind') {
    const evadePct = Math.min(upgrades.dodgeChance, 100);
    ctx.fillStyle = '#80e0d0';
    ctx.font = '5px monospace';
    const evadeStr = `Evade ${evadePct}%`;
    const ew = ctx.measureText(evadeStr).width;
    ctx.fillText(evadeStr, CX - ew / 2, CY - barOffsetY + 1);
  }

  // Damage flash
  if (damageFlash > 0) {
    ctx.globalAlpha = damageFlash / 15 * 0.3;
    ctx.fillStyle = '#ff0000';
    // Edge flash
    ctx.fillRect(0, 0, 4, H);
    ctx.fillRect(W - 4, 0, 4, H);
    ctx.fillRect(0, 0, W, 4);
    ctx.fillRect(0, H - 4, W, 4);
    ctx.globalAlpha = 1;
  }

  // Ability activation flash
  if (abilityFlash > 0) {
    ctx.globalAlpha = abilityFlash / 20 * 0.3;
    ctx.fillStyle = abilityFlashColor || '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }

  // Wave announcement / Get Ready
  if (waveAnnounceTimer > 0 && wave > 0) {
    const alpha = Math.min(1, waveAnnounceTimer / 30);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ff6644';
    ctx.font = '12px monospace';
    const text = `Wave ${wave}`;
    const tw = ctx.measureText(text).width;
    ctx.fillText(text, (W - tw) / 2, 30);
    ctx.globalAlpha = 1;
  } else if (wave === 0 && wavePause) {
    const pulse = 0.5 + 0.5 * Math.sin(frameCount * 0.08);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '8px monospace';
    const text = 'Get Ready...';
    const tw = ctx.measureText(text).width;
    ctx.fillText(text, (W - tw) / 2, 30);
    ctx.globalAlpha = 1;
  }

  // Upgrade picker overlay
  if (showingUpgradePicker) {
    if (showingDeck) {
      renderDeck();
    } else {
      renderUpgradePicker();
    }
  }

  // Pause menu overlay
  if (showingPauseMenu) {
    if (showingDeck) {
      renderDeck();
    } else {
      renderPauseMenu();
    }
  }

  // Hamburger button (during gameplay, not during overlays)
  if (gameStarted && running && !showingUpgradePicker && !showingPauseMenu) {
    renderHamburgerButton();
    renderStatsButton();
    renderAutoButton();
  }

  // Stats overlay (renders on top of everything)
  if (showingStats) {
    renderStatsScreen();
  }

  ctx.restore();
}

function renderEnemy(e) {
  const f = e.frame;
  const p = 2; // pixel size for chunky pixel art

  ctx.save();

  // Flip sprite if enemy is to the left of center (so it faces the plant)
  const facingRight = e.x < CX;
  if (facingRight) {
    ctx.translate(Math.round(e.x) * 2, 0);
    ctx.scale(-1, 1);
  }

  const bx = Math.round(e.x - e.w / 2);
  const by = Math.round(e.y - e.h / 2);

  // Freeze tint
  if (e.freezeTimer > 0) {
    ctx.globalAlpha = 0.7;
  }

  if (e.type === 'boss') {
    // Big boss bug body
    ctx.fillStyle = '#0a0a00';
    ctx.fillRect(bx + 10, by + 6, e.w - 14, e.h - 10);
    ctx.fillRect(bx, by + 6, 10, e.h - 12); // head

    // Armored shell
    ctx.fillStyle = '#2a1a0a';
    ctx.fillRect(bx + 12, by + 8, e.w - 18, e.h - 14);
    ctx.fillStyle = '#3a2a15';
    ctx.fillRect(bx + 14, by + 10, e.w - 22, e.h - 18);

    // Red eyes
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(bx + 2, by + 8, 4, 4);
    ctx.fillStyle = '#ff4444';
    ctx.fillRect(bx + 3, by + 9, 2, 2);

    // Mandibles
    ctx.fillStyle = '#1a0a00';
    ctx.fillRect(bx - 4, by + e.h - 10, 6, 4);
    ctx.fillRect(bx - 4, by + 6, 6, 4);

    // Wings
    ctx.fillStyle = 'rgba(180, 200, 220, 0.4)';
    const wingUp = (f % 8) < 4;
    if (wingUp) ctx.fillRect(bx + 12, by - 4, e.w - 18, 8);
    else ctx.fillRect(bx + 12, by + e.h - 4, e.w - 18, 8);
  } else if (e.type === 'tank') {
    // Armored tank bug
    ctx.fillStyle = '#1a1a10';
    ctx.fillRect(bx + p, by + p, e.w - p * 2, e.h - p * 2);
    ctx.fillStyle = '#2a2a1a';
    ctx.fillRect(bx + p * 2, by + p * 2, e.w - p * 4, e.h - p * 4);
    // Shell highlight
    ctx.fillStyle = '#4a4a3a';
    ctx.fillRect(bx + p * 3, by + p * 2, p * 2, p);
    // Eyes
    ctx.fillStyle = '#ff3333';
    ctx.fillRect(bx + p, by + p * 2, p, p);
    // Legs
    ctx.fillStyle = '#0a0a00';
    ctx.fillRect(bx + p * 2, by + e.h - p, p, p);
    ctx.fillRect(bx + p * 4, by + e.h - p, p, p);
    ctx.fillRect(bx + p * 6, by + e.h - p, p, p);
  } else if (e.type === 'fast') {
    // Fast bug
    ctx.fillStyle = '#4a3a1a';
    ctx.fillRect(bx + p, by + p, e.w - p * 2, e.h - p * 2);
    ctx.fillStyle = '#7a6a3a';
    ctx.fillRect(bx + p * 2, by + p, e.w - p * 4, e.h - p * 2);
    // Eyes
    ctx.fillStyle = '#ffaa00';
    ctx.fillRect(bx, by + p, p, p);
    // Wings
    ctx.fillStyle = 'rgba(200, 220, 180, 0.6)';
    if ((f % 4) < 2) ctx.fillRect(bx + p * 2, by - p, e.w - p * 3, p * 2);
    else ctx.fillRect(bx + p * 2, by + e.h - p, e.w - p * 3, p * 2);
  } else if (e.type === 'swarm') {
    // Swarm bug
    ctx.fillStyle = '#3a2a0a';
    ctx.fillRect(bx, by, e.w, e.h);
    ctx.fillStyle = '#6a5a2a';
    ctx.fillRect(bx + p, by + p, e.w - p * 2, e.h - p * 2);
    ctx.fillStyle = '#ff3333';
    ctx.fillRect(bx, by + p, p, p);
  } else {
    // Basic bug — body
    ctx.fillStyle = e.color;
    ctx.fillRect(bx + p * 2, by + p, e.w - p * 3, e.h - p * 2); // thorax
    ctx.fillRect(bx, by + p, p * 2, e.h - p * 3); // head

    // Eyes
    ctx.fillStyle = '#ff3333';
    ctx.fillRect(bx, by + p, p, p);

    // Wings — flapping
    ctx.fillStyle = 'rgba(180, 200, 220, 0.6)';
    if ((f % 6) < 3) ctx.fillRect(bx + p * 3, by - p, e.w - p * 4, p * 2);
    else ctx.fillRect(bx + p * 3, by + e.h - p, e.w - p * 4, p * 2);

    // Legs
    ctx.fillStyle = '#1a0a00';
    ctx.fillRect(bx + p * 2, by + e.h - p, p, p);
    ctx.fillRect(bx + p * 4, by + e.h - p, p, p);
    ctx.fillRect(bx + p * 6, by + e.h - p, p, p);
  }

  // Slow tint overlay
  if (e.slowTimer > 0) {
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#4090dd';
    ctx.fillRect(bx, by, e.w, e.h);
  }

  // Freeze visual
  if (e.freezeTimer > 0) {
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#80d0ff';
    ctx.fillRect(bx - 1, by - 1, e.w + 2, e.h + 2);
  }

  ctx.restore();

  // HP bar (only show if damaged)
  if (e.hp < e.maxHp) {
    renderHpBar(bx, by - 4, e.w, 2, e.hp, e.maxHp, '#cc4444');
  }
}

function renderProjectile(p) {
  const colors = ELEMENT_PROJ_COLORS[p.element] || ELEMENT_PROJ_COLORS.none;
  const px = Math.round(p.x);
  const py = Math.round(p.y);

  // Glow
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = colors.highlight;
  ctx.fillRect(px - 4, py - 4, 8, 8);
  ctx.globalAlpha = 1;

  // 5x5 body
  ctx.fillStyle = colors.main;
  ctx.fillRect(px - 2, py - 2, 5, 5);

  // 3x3 highlight center
  ctx.fillStyle = colors.highlight;
  ctx.fillRect(px - 1, py - 1, 3, 3);

  // 1x1 bright core
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(px, py, 1, 1);
}

function renderHpBar(x, y, w, h, current, max, color) {
  const pct = Math.max(0, current / max);
  // Background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(x, y, w, h);
  // Fill
  ctx.fillStyle = color;
  ctx.fillRect(x, y, Math.round(w * pct), h);
}

// ── HUD ────────────────────────────────────────────────────────────

function updateHud() {
  const hud = document.getElementById('tdHud');
  if (!hud) return;

  const expPct = Math.round((fertilizerExp / expToNextLevel) * 100);
  hud.innerHTML = `
    <span class="td-hud-wave">Wave ${wave}</span>
    <span class="td-hud-hp">HP ${player.hp}/${player.maxHp}${player.shield > 0 ? ` +${player.shield}🛡` : ''}</span>
    <span class="td-hud-score">Score ${score}</span>
    <span class="td-hud-level">Lv.${playerLevel} (${expPct}%)</span>
  `;
}

// ── Game Over ──────────────────────────────────────────────────────

function tdGameOver() {
  running = false;
  gameStarted = false;
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  // Save high wave & fertilizer EXP
  const state = loadState();
  const isNewHigh = wave > (state.stats.tdHighWave || 0);
  if (isNewHigh) {
    state.stats.tdHighWave = wave;
  }

  // Persist pot EXP from TD
  if (selectedPlant && selectedPlant.potElement && fertilizerExp > 0) {
    const gardenPlant = state.garden.find(p => p.id === selectedPlant.id);
    if (gardenPlant) {
      gardenPlant.potExp = (gardenPlant.potExp || 0) + fertilizerExp;
      gardenPlant.potLevel = potLevelFromExp(gardenPlant.potExp);
    }
  }

  saveState(state);

  showGameOverScreen(isNewHigh, state.stats.tdHighWave || wave);
}

function showGameOverScreen(isNewHigh, highWave) {
  const overlay = document.getElementById('tdOverlay');
  const content = document.getElementById('tdOverlayContent');
  overlay.classList.remove('hidden');

  let expHtml = '';
  if (selectedPlant && selectedPlant.potElement && fertilizerExp > 0) {
    const state = loadState();
    const gardenPlant = state.garden.find(p => p.id === selectedPlant.id);
    const totalExp = gardenPlant ? (gardenPlant.potExp || 0) : 0;
    const currentLevel = potLevelFromExp(totalExp);
    const oldLevel = potLevelFromExp(totalExp - fertilizerExp);
    const nextThreshold = currentLevel < 3 ? POT_LEVEL_THRESHOLDS[currentLevel + 1] : null;
    const prevThreshold = POT_LEVEL_THRESHOLDS[currentLevel];

    const elementNames = { fire: 'Fire', ice: 'Ice', earth: 'Earth', wind: 'Wind' };
    const eleName = elementNames[selectedPlant.potElement] || selectedPlant.potElement;

    const prevExp = totalExp - fertilizerExp;
    let progressHtml = '';
    if (nextThreshold !== null) {
      const oldPct = Math.min(100, Math.max(0, Math.round(((prevExp - prevThreshold) / (nextThreshold - prevThreshold)) * 100)));
      const newPct = Math.min(100 - oldPct, Math.round((fertilizerExp / (nextThreshold - prevThreshold)) * 100));
      progressHtml = `
        <div class="mg-exp-progress">
          <div class="mg-exp-bar">
            <div class="mg-exp-bar-fill" style="width:${oldPct}%"></div>
            <div class="mg-exp-bar-new" style="width:${newPct}%"></div>
          </div>
          <span class="mg-exp-numbers">${prevExp} <span class="mg-exp-earned">+${fertilizerExp}</span> / ${nextThreshold} EXP</span>
        </div>`;
    } else {
      progressHtml = `<div class="mg-exp-numbers">${prevExp} <span class="mg-exp-earned">+${fertilizerExp}</span> EXP (MAX)</div>`;
    }

    expHtml = `
      ${currentLevel > oldLevel ? `<div class="mg-level-up">Pot Level Up! Lv.${oldLevel} → Lv.${currentLevel}</div>` : ''}
      <div class="mg-exp-section">
        <span class="mg-pot-level">Pot Lv.${currentLevel}</span>
        ${progressHtml}
      </div>`;
  } else if (selectedPlant && selectedPlant.potElement && fertilizerExp === 0) {
    expHtml = `<div class="mg-exp-gained mg-exp-none">No EXP earned</div>`;
  }

  content.innerHTML = `
    <div class="mg-title">Overrun!</div>
    <div class="mg-score-final">Wave ${wave}</div>
    ${isNewHigh ? '<div class="mg-new-high">New Best Wave!</div>' : ''}
    <div class="mg-high-score">Best: Wave ${highWave}</div>
    ${expHtml}
    <button class="btn mg-play-btn" id="tdRetryBtn">Retry</button>
    <button class="btn mg-back-btn" id="tdBackBtn2">Back to Plant</button>
  `;

  document.getElementById('tdRetryBtn').addEventListener('click', beginGame);
  document.getElementById('tdBackBtn2').addEventListener('click', handleBack);
}

// ── Citadel Event ─────────────────────────────────────────────────

function renderCitadel(x) {
  const baseW = 50, baseH = 80;
  const bx = Math.round(x - baseW / 2);
  const by = Math.round(CY - baseH / 2 - 10);

  // Purple aura glow
  const pulse = 0.3 + 0.2 * Math.sin(frameCount * 0.05);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#6a1a8a';
  ctx.fillRect(bx - 6, by - 6, baseW + 12, baseH + 12);
  ctx.globalAlpha = pulse * 0.5;
  ctx.fillRect(bx - 10, by - 10, baseW + 20, baseH + 20);
  ctx.globalAlpha = 1;

  // Main stone body
  ctx.fillStyle = '#1a1a2a';
  ctx.fillRect(bx + 8, by + 10, baseW - 16, baseH - 10);

  // Left tower
  ctx.fillStyle = '#1a1a2a';
  ctx.fillRect(bx, by + 20, 12, baseH - 20);
  // Left tower top (pointed)
  ctx.fillRect(bx + 1, by + 14, 10, 6);
  ctx.fillRect(bx + 2, by + 10, 8, 4);
  ctx.fillRect(bx + 3, by + 6, 6, 4);
  ctx.fillRect(bx + 4, by + 3, 4, 3);
  ctx.fillRect(bx + 5, by + 1, 2, 2);

  // Right tower
  ctx.fillRect(bx + baseW - 12, by + 20, 12, baseH - 20);
  // Right tower top
  ctx.fillRect(bx + baseW - 11, by + 14, 10, 6);
  ctx.fillRect(bx + baseW - 10, by + 10, 8, 4);
  ctx.fillRect(bx + baseW - 9, by + 6, 6, 4);
  ctx.fillRect(bx + baseW - 8, by + 3, 4, 3);
  ctx.fillRect(bx + baseW - 7, by + 1, 2, 2);

  // Center spire
  ctx.fillRect(bx + 20, by + 5, 10, 10);
  ctx.fillRect(bx + 21, by + 1, 8, 4);
  ctx.fillRect(bx + 22, by - 2, 6, 3);
  ctx.fillRect(bx + 23, by - 5, 4, 3);
  ctx.fillRect(bx + 24, by - 7, 2, 2);

  // Stone highlights
  ctx.fillStyle = '#2a2a3a';
  ctx.fillRect(bx + 10, by + 12, baseW - 20, 2);
  ctx.fillRect(bx + 10, by + 30, baseW - 20, 1);
  ctx.fillRect(bx + 10, by + 45, baseW - 20, 1);

  // Dark archway entrance
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(bx + 17, by + baseH - 28, 16, 28);
  ctx.fillRect(bx + 18, by + baseH - 32, 14, 4);
  ctx.fillRect(bx + 19, by + baseH - 34, 12, 2);

  // Glowing windows - red/purple
  const glow = 0.6 + 0.4 * Math.sin(frameCount * 0.08);
  ctx.globalAlpha = glow;
  // Left tower windows
  ctx.fillStyle = '#cc2244';
  ctx.fillRect(bx + 3, by + 24, 4, 3);
  ctx.fillStyle = '#8822aa';
  ctx.fillRect(bx + 3, by + 34, 4, 3);
  // Right tower windows
  ctx.fillStyle = '#cc2244';
  ctx.fillRect(bx + baseW - 8, by + 24, 4, 3);
  ctx.fillStyle = '#8822aa';
  ctx.fillRect(bx + baseW - 8, by + 34, 4, 3);
  // Center windows
  ctx.fillStyle = '#aa1144';
  ctx.fillRect(bx + 14, by + 20, 3, 4);
  ctx.fillRect(bx + baseW - 17, by + 20, 3, 4);
  // Archway glow
  ctx.fillStyle = '#6a1a3a';
  ctx.fillRect(bx + 19, by + baseH - 26, 12, 20);
  ctx.globalAlpha = 1;
}

function renderCitadelEvent() {
  const roadW = 48;

  if (citadelAnimPhase === 0) {
    // Phase 0: crossfade vertical road to horizontal
    const t = roadRotation; // 0 to 1

    // Vertical road fading out
    if (t < 1) {
      ctx.globalAlpha = 1 - t;
      const roadX = CX - roadW / 2;
      ctx.fillStyle = '#8a7a5a';
      ctx.fillRect(roadX, 0, roadW, H);
      ctx.fillStyle = '#6a6040';
      ctx.fillRect(roadX, 0, 2, H);
      ctx.fillRect(roadX + roadW - 2, 0, 2, H);
      ctx.fillStyle = '#9a8a68';
      ctx.fillRect(roadX + 4, 0, roadW - 8, H);
      ctx.fillStyle = '#b0a078';
      for (let y = -16 + (roadOffset % 16); y < H; y += 16) {
        ctx.fillRect(CX - 1, y, 2, 8);
      }
      ctx.globalAlpha = 1;
    }

    // Horizontal road fading in
    if (t > 0) {
      ctx.globalAlpha = t;
      const roadY = CY - roadW / 2;
      ctx.fillStyle = '#8a7a5a';
      ctx.fillRect(0, roadY, W, roadW);
      ctx.fillStyle = '#6a6040';
      ctx.fillRect(0, roadY, W, 2);
      ctx.fillRect(0, roadY + roadW - 2, W, 2);
      ctx.fillStyle = '#9a8a68';
      ctx.fillRect(0, roadY + 4, W, roadW - 8);
      ctx.fillStyle = '#b0a078';
      for (let x = -16 + (roadOffset % 16); x < W; x += 16) {
        ctx.fillRect(x, CY - 1, 8, 2);
      }
      ctx.globalAlpha = 1;
    }

    // Plant hopping at center
    if (plantSprite) {
      const px = CX - plantSprite.width / 2;
      let py = CY - plantSprite.height / 2;
      const hopHeight = Math.abs(Math.sin(plantHopFrame * 0.2)) * 6;
      py -= hopHeight;
      ctx.drawImage(plantSprite, Math.round(px), Math.round(py));
    }
  } else {
    // Phase 1 & 2: horizontal road + plant on left + citadel sliding in
    const roadY = CY - roadW / 2;
    ctx.fillStyle = '#8a7a5a';
    ctx.fillRect(0, roadY, W, roadW);
    ctx.fillStyle = '#6a6040';
    ctx.fillRect(0, roadY, W, 2);
    ctx.fillRect(0, roadY + roadW - 2, W, 2);
    ctx.fillStyle = '#9a8a68';
    ctx.fillRect(0, roadY + 4, W, roadW - 8);
    ctx.fillStyle = '#b0a078';
    for (let x = -16 + (roadOffset % 16); x < W; x += 16) {
      ctx.fillRect(x, CY - 1, 8, 2);
    }

    // Dirt speckle on horizontal road
    ctx.fillStyle = '#7a6a4a';
    for (const dot of bgDots) {
      if (dot.y > roadY + 4 && dot.y < roadY + roadW - 4) {
        ctx.fillRect(dot.x, dot.y, dot.size, dot.size);
      }
    }

    // Plant on left side
    if (plantSprite) {
      const px = 50 - plantSprite.width / 2;
      let py = CY - plantSprite.height / 2;
      if (citadelAnimPhase === 1) {
        const hopHeight = Math.abs(Math.sin(plantHopFrame * 0.2)) * 6;
        py -= hopHeight;
      }
      ctx.drawImage(plantSprite, Math.round(px), Math.round(py));
    }

    // Citadel
    renderCitadel(citadelApproachX);

    // Phase 2: show choice buttons
    if (citadelAnimPhase === 2) {
      // Dramatic text
      ctx.fillStyle = '#e0d0ff';
      ctx.font = '9px monospace';
      const title = 'A dark citadel looms ahead...';
      const tw = ctx.measureText(title).width;
      ctx.fillText(title, (W - tw) / 2, CY - 56);

      // "Enter the Citadel" button
      const btn1 = { x: CX - 65, y: CY + 28, w: 130, h: 22 };
      ctx.fillStyle = '#2a1040';
      ctx.fillRect(btn1.x, btn1.y, btn1.w, btn1.h);
      ctx.strokeStyle = '#8844cc';
      ctx.lineWidth = 1;
      ctx.strokeRect(btn1.x, btn1.y, btn1.w, btn1.h);
      ctx.fillStyle = '#cc88ff';
      ctx.font = '8px monospace';
      const t1 = 'Enter the Citadel';
      const tw1 = ctx.measureText(t1).width;
      ctx.fillText(t1, btn1.x + (btn1.w - tw1) / 2, btn1.y + 14);

      // "Continue Down the Road" button
      const btn2 = { x: CX - 65, y: CY + 56, w: 130, h: 22 };
      ctx.fillStyle = '#2a2a18';
      ctx.fillRect(btn2.x, btn2.y, btn2.w, btn2.h);
      ctx.strokeStyle = '#8a8a5a';
      ctx.lineWidth = 1;
      ctx.strokeRect(btn2.x, btn2.y, btn2.w, btn2.h);
      ctx.fillStyle = '#cccc88';
      ctx.font = '8px monospace';
      const t2 = 'Continue Down the Road';
      const tw2 = ctx.measureText(t2).width;
      ctx.fillText(t2, btn2.x + (btn2.w - tw2) / 2, btn2.y + 14);
    }
  }
}

function handleCitadelClick(x, y) {
  if (citadelAnimPhase !== 2) return;

  // "Enter the Citadel" button
  const btn1 = { x: CX - 65, y: CY + 28, w: 130, h: 22 };
  if (x >= btn1.x && x <= btn1.x + btn1.w && y >= btn1.y && y <= btn1.y + btn1.h) {
    const state = loadState();
    state.stats.citadelUnlocked = true;
    saveState(state);
    showingCitadelEvent = false;
    handleBack();
    return;
  }

  // "Continue Down the Road" button
  const btn2 = { x: CX - 65, y: CY + 56, w: 130, h: 22 };
  if (x >= btn2.x && x <= btn2.x + btn2.w && y >= btn2.y && y <= btn2.y + btn2.h) {
    showingCitadelEvent = false;
    roadRotation = 0;
    wavePauseTimer = 60;
    travelAnim = 0;
    return;
  }
}

function handleBack() {
  stopTowerDefense();
  if (onBackCallback) onBackCallback();
}

// ── Input Handling ─────────────────────────────────────────────────

function onClick(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = W / rect.width;
  const scaleY = H / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;

  // Stats screen
  if (showingStats) {
    handleStatsClick(x, y);
    return;
  }

  // Deck view (shared between upgrade picker and pause menu)
  if (showingDeck) {
    handleDeckClick(x, y);
    return;
  }

  if (showingCitadelEvent) {
    handleCitadelClick(x, y);
    return;
  }

  if (showingPauseMenu) {
    handlePauseMenuClick(x, y);
    return;
  }

  if (showingUpgradePicker) {
    handleUpgradeClick(x, y);
    return;
  }

  // Hamburger button
  if (gameStarted && running) {
    const hb = HAMBURGER_BTN;
    if (x >= hb.x && x <= hb.x + hb.w && y >= hb.y && y <= hb.y + hb.h) {
      showingPauseMenu = true;
      return;
    }
    const sb = STATS_BTN;
    if (x >= sb.x && x <= sb.x + sb.w && y >= sb.y && y <= sb.y + sb.h) {
      showingStats = true;
      statsScroll = 0;
      return;
    }
    const ab = AUTO_BTN;
    if (player.element && x >= ab.x && x <= ab.x + ab.w && y >= ab.y && y <= ab.y + ab.h) {
      autoAbility = !autoAbility;
      return;
    }
    activateAbility();
  }
}

function onMouseMove(e) {
  if (!showingUpgradePicker) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = W / rect.width;
  const scaleY = H / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;
  handleUpgradeHover(x, y);
}

function onTouchStart(e) {
  e.preventDefault();
  const touch = e.touches[0];
  onClick({ clientX: touch.clientX, clientY: touch.clientY });
}

function onWheel(e) {
  if (showingStats) {
    e.preventDefault();
    statsScroll = Math.max(0, Math.min(getStatsMaxScroll(), statsScroll + e.deltaY * 0.5));
    return;
  }
  if (!showingDeck) return;
  e.preventDefault();
  deckScroll = Math.max(0, Math.min(getDeckMaxScroll(), deckScroll + e.deltaY * 0.5));
}

function addInputListeners() {
  canvas.addEventListener('click', onClick);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('wheel', onWheel, { passive: false });
}

function removeInputListeners() {
  if (!canvas) return;
  canvas.removeEventListener('click', onClick);
  canvas.removeEventListener('mousemove', onMouseMove);
  canvas.removeEventListener('touchstart', onTouchStart);
  canvas.removeEventListener('wheel', onWheel);
}
