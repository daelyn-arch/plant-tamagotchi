// Tower Defense — "Stop the Bugs"
// Plant sits at center, bugs swarm from all edges in waves
// Roguelite upgrades with rarity-scaled effects, elemental powers

import { renderPlant } from './plant-generator.js';
import { loadState, saveState } from './state.js';
import { potLevelFromExp } from './canvas-utils.js';

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

// Damage flash
let damageFlash = 0;
let abilityFlash = 0;
let abilityFlashColor = null;

// Background dots (deterministic)
let bgDots = [];

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
];

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
window.__debugTDState = () => ({ running, gameStarted, wave, hp: player.hp, score });
window.__debugTDSetHP = (val) => { player.hp = val; };
window.__debugTDGameOver = () => { if (running) { player.hp = 0; tdGameOver(); } };

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

  // Generate background dots
  bgDots = [];
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

  // If showing upgrade picker, pause game
  if (showingUpgradePicker) return;

  // Between-wave pause
  if (wavePause) {
    wavePauseTimer--;
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
        e.hp -= e.burnDamage || 3;
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
      // Reached plant — deal damage
      player.hp -= e.damage;
      damageFlash = 15;
      spawnParticles(CX, CY, '#ff0000', 4);
      enemies.splice(i, 1);
      if (player.hp <= 0) {
        player.hp = 0;
        tdGameOver();
        return;
      }
      continue;
    }

    let spd = e.speed * slowFactor;
    if (e.slowTimer > 0) spd *= 0.7; // elemental slow
    e.x += (dx / dist) * spd;
    e.y += (dy / dist) * spd;
  }

  // Plant auto-attack
  const fireRate = Math.max(10, 60 - upgrades.attackSpeed * 5);
  attackTimer++;
  if (attackTimer >= fireRate && enemies.length > 0) {
    attackTimer = 0;
    const weaponCount = 1 + upgrades.weaponCount;

    // Sort enemies by distance to center
    const sorted = [...enemies].sort((a, b) => {
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
  const hpScale = 1 + wave * 0.1;

  // Pick random edge
  const side = Math.floor(Math.random() * 4);
  let x, y;
  if (side === 0) { x = Math.random() * W; y = -def.h; }       // top
  else if (side === 1) { x = W + def.w; y = Math.random() * H; } // right
  else if (side === 2) { x = Math.random() * W; y = H + def.h; } // bottom
  else { x = -def.w; y = Math.random() * H; }                   // left

  const hp = type === 'boss' ? def.hp * (wave / 5) * hpScale : Math.round(def.hp * hpScale);

  enemies.push({
    type,
    x, y,
    w: def.w, h: def.h,
    hp, maxHp: hp,
    speed: def.speed,
    damage: def.damage,
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
  let speed = 3;
  if (element === 'wind' && player.potLevel >= 1) speed = 4.5;

  const damage = 10 + upgrades.attackDamage * 5;

  projectiles.push({
    x: CX, y: CY,
    vx: (dx / dist) * speed,
    vy: (dy / dist) * speed,
    damage,
    element,
    life: 200,
  });
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
      for (let j = enemies.length - 1; j >= 0; j--) {
        if (j === enemyIdx) continue;
        const e2 = enemies[j];
        const d = Math.sqrt((e2.x - enemy.x) ** 2 + (e2.y - enemy.y) ** 2);
        if (d < 8) {
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
      for (const e2 of enemies) {
        const d = Math.sqrt((e2.x - enemy.x) ** 2 + (e2.y - enemy.y) ** 2);
        if (d < 12) e2.slowTimer = 120;
      }
    }
    // Lv3: 15% freeze
    if (potLv >= 3 && Math.random() < 0.15) {
      enemy.freezeTimer = 90;
    }
    spawnParticles(proj.x, proj.y, '#80d0ff', 3);
  } else if (element === 'earth') {
    // Lv1: knockback
    if (potLv >= 1) {
      const dx = enemy.x - CX;
      const dy = enemy.y - CY;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      enemy.knockbackTimer = 8;
      enemy.knockbackVx = (dx / d) * 2;
      enemy.knockbackVy = (dy / d) * 2;
    }
    // Lv3: spawn rock barrier
    if (potLv >= 3 && Math.random() < 0.2) {
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
  } else if (element === 'wind') {
    // Lv3: chain to 2 nearby enemies
    if (potLv >= 3) {
      let chainCount = 0;
      for (const e2 of enemies) {
        if (e2 === enemy || chainCount >= 2) break;
        const d = Math.sqrt((e2.x - enemy.x) ** 2 + (e2.y - enemy.y) ** 2);
        if (d < 30) {
          e2.hp -= Math.round(proj.damage * 0.5);
          spawnParticles(e2.x, e2.y, '#80e0d0', 2);
          chainCount++;
          if (e2.hp <= 0) {
            const idx = enemies.indexOf(e2);
            if (idx >= 0) killEnemy(idx);
          }
        }
      }
    }
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
}

function generateUpgradeOptions() {
  const options = [];
  const used = new Set();

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
    player.maxHp += option.value;
    player.hp += option.value;
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
  upgradeOptions = [];
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

  // Cards
  const cardW = 88;
  const cardH = 120;
  const gap = 10;
  const totalW = cardW * 3 + gap * 2;
  const startX = (W - totalW) / 2;
  const startY = 70;

  for (let i = 0; i < upgradeOptions.length; i++) {
    const opt = upgradeOptions[i];
    const cx = startX + i * (cardW + gap);
    const cy = hoverCard === i ? startY - 5 : startY;
    const borderColor = RARITY_COLORS[opt.rarity] || '#888';

    // Card background
    ctx.fillStyle = '#1a1a12';
    ctx.fillRect(cx, cy, cardW, cardH);

    // Inner background (slightly lighter)
    ctx.fillStyle = '#222218';
    ctx.fillRect(cx + 2, cy + 2, cardW - 4, cardH - 4);

    // Border
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = hoverCard === i ? 3 : 2;
    ctx.strokeRect(cx, cy, cardW, cardH);

    // Rarity label
    ctx.fillStyle = borderColor;
    ctx.font = '6px monospace';
    ctx.fillText(opt.rarity, cx + 6, cy + 16);

    // Name
    ctx.fillStyle = '#ffffff';
    ctx.font = '7px monospace';
    ctx.fillText(opt.name, cx + 6, cy + 34);

    // Description
    ctx.fillStyle = '#999999';
    ctx.font = '6px monospace';
    const lines = wrapText(opt.desc, cardW - 12, ctx);
    for (let l = 0; l < lines.length; l++) {
      ctx.fillText(lines[l], cx + 6, cy + 50 + l * 10);
    }

    // Value — big and colored
    ctx.fillStyle = borderColor;
    ctx.font = '10px monospace';
    const valStr = `+${opt.value}`;
    ctx.fillText(valStr, cx + 6, cy + cardH - 12);
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

  const cardW = 88;
  const cardH = 120;
  const gap = 10;
  const totalW = cardW * 3 + gap * 2;
  const startX = (W - totalW) / 2;
  const startY = 70;

  for (let i = 0; i < upgradeOptions.length; i++) {
    const cx = startX + i * (cardW + gap);
    if (x >= cx && x <= cx + cardW && y >= startY - 5 && y <= startY + cardH) {
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

  const cardW = 88;
  const cardH = 120;
  const gap = 10;
  const totalW = cardW * 3 + gap * 2;
  const startX = (W - totalW) / 2;
  const startY = 70;

  hoverCard = -1;
  for (let i = 0; i < upgradeOptions.length; i++) {
    const cx = startX + i * (cardW + gap);
    if (x >= cx && x <= cx + cardW && y >= startY - 5 && y <= startY + cardH) {
      hoverCard = i;
      break;
    }
  }
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

// ── Rendering ──────────────────────────────────────────────────────

function render() {
  ctx.save();
  ctx.scale(CANVAS_SCALE, CANVAS_SCALE);

  // Background — dark earth
  ctx.fillStyle = '#1a1a12';
  ctx.fillRect(0, 0, W, H);

  // Radial glow from center
  const grad = ctx.createRadialGradient(CX, CY, 10, CX, CY, 140);
  grad.addColorStop(0, 'rgba(80, 100, 50, 0.15)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Dirt dots
  ctx.fillStyle = '#2a2a1a';
  for (const dot of bgDots) {
    ctx.fillRect(dot.x, dot.y, dot.size, dot.size);
  }

  // Range circle (subtle)
  ctx.strokeStyle = 'rgba(100, 120, 80, 0.15)';
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

  // Particles (non-special)
  for (const p of particles) {
    if (p.isFireTrail || p.isRockBarrier) continue;
    const alpha = p.life / p.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;

  // Plant at center
  if (plantSprite) {
    const px = CX - plantSprite.width / 2;
    const py = CY - plantSprite.height / 2;
    ctx.drawImage(plantSprite, Math.round(px), Math.round(py));
  }

  // HP bar above plant
  const barOffsetY = plantSprite ? plantSprite.height / 2 : 20;
  renderHpBar(CX - 25, CY - barOffsetY - 12, 50, 4, player.hp, player.maxHp, '#44aa44');

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
    renderUpgradePicker();
  }

  ctx.restore();
}

function renderEnemy(e) {
  const bx = Math.round(e.x - e.w / 2);
  const by = Math.round(e.y - e.h / 2);
  const f = e.frame;
  const p = 2; // pixel size for chunky pixel art

  ctx.save();

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
    <span class="td-hud-hp">HP ${player.hp}/${player.maxHp}</span>
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
    const elementNames = { fire: 'Fire', ice: 'Ice', earth: 'Earth', wind: 'Wind' };
    const eleName = elementNames[selectedPlant.potElement] || selectedPlant.potElement;
    expHtml = `<div class="mg-exp-gained">+${fertilizerExp} ${eleName} Pot EXP</div>`;
  }

  content.innerHTML = `
    <div class="mg-title">Overrun!</div>
    <div class="mg-score-final">Wave ${wave}</div>
    ${isNewHigh ? '<div class="mg-new-high">New Best Wave!</div>' : ''}
    <div class="mg-high-score">Best: Wave ${highWave}</div>
    <div class="mg-score-final" style="font-size:0.6rem">Score: ${score}</div>
    <div class="mg-score-final" style="font-size:0.5rem">Level: ${playerLevel}</div>
    ${expHtml}
    <button class="btn mg-play-btn" id="tdRetryBtn">Retry</button>
    <button class="btn mg-back-btn" id="tdBackBtn2">Back to Plant</button>
  `;

  document.getElementById('tdRetryBtn').addEventListener('click', beginGame);
  document.getElementById('tdBackBtn2').addEventListener('click', handleBack);
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

  if (showingUpgradePicker) {
    handleUpgradeClick(x, y);
    return;
  }

  // Activate ability on click/touch
  if (gameStarted && running) {
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

function addInputListeners() {
  canvas.addEventListener('click', onClick);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
}

function removeInputListeners() {
  if (!canvas) return;
  canvas.removeEventListener('click', onClick);
  canvas.removeEventListener('mousemove', onMouseMove);
  canvas.removeEventListener('touchstart', onTouchStart);
}
