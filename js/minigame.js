// Plant Runner — endless runner minigame
// Chrome Dino-style: jump over fire, duck under bugs

import { renderPlant } from './plant-generator.js';
import { loadState, saveState } from './state.js';
import { potLevelFromExp, POT_LEVEL_THRESHOLDS } from './canvas-utils.js';

// ── Constants ──────────────────────────────────────────────────────
const W = 320;
const H = 160;
const GROUND_Y = 128;
const GRAVITY = 0.45;
const JUMP_VEL = -7.5;
const DUCK_HEIGHT_RATIO = 0.5;
const DUCK_WIDTH_RATIO = 1.2;
const JUMP_HEIGHT_RATIO = 1.2;
const JUMP_WIDTH_RATIO = 0.85;
const MIN_SPEED = 2.0;
const MAX_SPEED = 5.5;
const SPEED_ACCEL = 0.0006; // per frame
const SPAWN_MIN_GAP = 100;
const SPAWN_MAX_GAP = 200;
const COLLISION_INSET = 3;
const PLAYER_TARGET_H = 36;
const CLOUD_COUNT = 6;

// ── Module state ───────────────────────────────────────────────────
let canvas, ctx;
let rafId = null;
let running = false;
let gameStarted = false;
let onBackCallback = null;

// Sprites
let sprites = { normal: null, duck: null, jump: null };
let playerW, playerH;

// Game objects
let player, obstacles, speed, score, distance, frameCount;
let spawnTimer;
let clouds;
let groundOffset;
let lastTimestamp;
let gameOverTime; // timestamp when game over happened, to prevent instant restart

// Input state
let keys = {};
let touchZone = null; // 'upper' | 'lower' | null

// Currently selected plant for this session
let selectedPlant = null;

// Immunity flash effect
let immuneFlash = 0;
let immuneFlashColor = null;

// Pot EXP tracking
let runExpGained = 0;
let pendingLevelUp = null; // { oldLevel, newLevel, element }

// ── Public API ─────────────────────────────────────────────────────

export function startMinigame(plants, onBack) {
  onBackCallback = onBack;
  canvas = document.getElementById('minigameCanvas');
  ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  canvas.width = W;
  canvas.height = H;

  if (plants.length === 1) {
    // Only one eligible plant — skip picker
    selectAndStart(plants[0]);
  } else {
    showPlantPicker(plants);
  }
  addInputListeners();
}

function selectAndStart(plant) {
  selectedPlant = plant;
  preparePlayerSprites(plant);
  showStartScreen(plant);
}

export function stopMinigame() {
  running = false;
  gameStarted = false;
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  removeInputListeners();
}

// ── Sprite preparation ─────────────────────────────────────────────

function preparePlayerSprites(plant) {
  // Render the plant at full growth
  const srcCanvas = renderPlant(plant, plant.growthStage || 1.0);

  // Trim to bounding box of non-transparent pixels
  const srcCtx = srcCanvas.getContext('2d');
  const imgData = srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);
  let minX = srcCanvas.width, minY = srcCanvas.height, maxX = 0, maxY = 0;

  for (let y = 0; y < srcCanvas.height; y++) {
    for (let x = 0; x < srcCanvas.width; x++) {
      const a = imgData.data[(y * srcCanvas.width + x) * 4 + 3];
      if (a > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX) { minX = 0; maxX = srcCanvas.width - 1; minY = 0; maxY = srcCanvas.height - 1; }

  const trimW = maxX - minX + 1;
  const trimH = maxY - minY + 1;

  // Create trimmed canvas
  const trimmed = document.createElement('canvas');
  trimmed.width = trimW;
  trimmed.height = trimH;
  const tCtx = trimmed.getContext('2d');
  tCtx.drawImage(srcCanvas, minX, minY, trimW, trimH, 0, 0, trimW, trimH);

  // Scale to target height
  const scale = PLAYER_TARGET_H / trimH;
  const scaledW = Math.max(1, Math.round(trimW * scale));
  const scaledH = PLAYER_TARGET_H;

  // Normal sprite
  sprites.normal = makeScaledCanvas(trimmed, scaledW, scaledH);

  // Duck sprite: 50% height, 120% width
  const duckW = Math.round(scaledW * DUCK_WIDTH_RATIO);
  const duckH = Math.round(scaledH * DUCK_HEIGHT_RATIO);
  sprites.duck = makeScaledCanvas(trimmed, duckW, duckH);

  // Jump sprite: 120% height, 85% width
  const jumpW = Math.round(scaledW * JUMP_WIDTH_RATIO);
  const jumpH = Math.round(scaledH * JUMP_HEIGHT_RATIO);
  sprites.jump = makeScaledCanvas(trimmed, jumpW, jumpH);

  playerW = scaledW;
  playerH = scaledH;
}

function makeScaledCanvas(src, w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const cx = c.getContext('2d');
  cx.imageSmoothingEnabled = false;
  cx.drawImage(src, 0, 0, w, h);
  return c;
}

// ── Game init ──────────────────────────────────────────────────────

function resetGame() {
  player = {
    x: 16,
    y: GROUND_Y - playerH,
    vy: 0,
    jumping: false,
    ducking: false,
    grounded: true,
  };
  obstacles = [];
  speed = MIN_SPEED;
  score = 0;
  distance = 0;
  frameCount = 0;
  spawnTimer = 60; // initial delay before first obstacle
  groundOffset = 0;
  lastTimestamp = 0;
  gameOverTime = 0;
  immuneFlash = 0;
  immuneFlashColor = null;
  runExpGained = 0;
  pendingLevelUp = null;

  clouds = [];
  for (let i = 0; i < CLOUD_COUNT; i++) {
    clouds.push({
      x: Math.random() * W,
      y: 8 + Math.random() * 40,
      w: 16 + Math.floor(Math.random() * 24),
      speed: 0.2 + Math.random() * 0.3,
    });
  }
}

function beginGame() {
  resetGame();
  gameStarted = true;
  running = true;
  const overlay = document.getElementById('minigameOverlay');
  overlay.classList.add('hidden');
  document.getElementById('minigameHud').style.display = '';
  lastTimestamp = performance.now();
  rafId = requestAnimationFrame(gameLoop);
}

// ── Game loop ──────────────────────────────────────────────────────

function gameLoop(timestamp) {
  if (!running) return;

  // Fixed-step ~60fps
  update();
  render();

  rafId = requestAnimationFrame(gameLoop);
}

function update() {
  frameCount++;

  // Speed up
  if (speed < MAX_SPEED) {
    speed = Math.min(MAX_SPEED, speed + SPEED_ACCEL);
  }

  // Distance & score
  distance += speed;
  score = Math.floor(distance / 10);

  // Update score HUD
  document.getElementById('minigameScore').textContent = score;

  // Player physics
  if (player.ducking) {
    // Stay on ground while ducking
    player.y = GROUND_Y - Math.round(playerH * DUCK_HEIGHT_RATIO);
    player.grounded = true;
    player.jumping = false;
  } else if (player.jumping || !player.grounded) {
    player.vy += GRAVITY;
    player.y += player.vy;
    const groundLevel = GROUND_Y - playerH;
    if (player.y >= groundLevel) {
      player.y = groundLevel;
      player.vy = 0;
      player.jumping = false;
      player.grounded = true;
    }
  } else {
    player.y = GROUND_Y - playerH;
  }

  // Spawn obstacles
  spawnTimer -= speed;
  if (spawnTimer <= 0) {
    spawnObstacle();
    // Gap shrinks as speed increases
    const gapRange = SPAWN_MAX_GAP - SPAWN_MIN_GAP;
    const speedFactor = (speed - MIN_SPEED) / (MAX_SPEED - MIN_SPEED);
    const gap = SPAWN_MAX_GAP - gapRange * speedFactor * 0.5;
    spawnTimer = gap + Math.random() * 30;
  }

  // Move obstacles
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const obs = obstacles[i];
    obs.x -= speed;
    obs.frame = (obs.frame || 0) + 1;
    if (obs.x + obs.w < -5) {
      obstacles.splice(i, 1);
    }
  }

  // Move clouds
  for (const cloud of clouds) {
    cloud.x -= cloud.speed;
    if (cloud.x + cloud.w < 0) {
      cloud.x = W + Math.random() * 40;
      cloud.y = 8 + Math.random() * 40;
    }
  }

  // Scroll ground
  groundOffset = (groundOffset + speed) % 8;

  // Check collisions
  if (checkCollisions()) {
    gameOver();
  }
}

// ── Obstacle spawning ──────────────────────────────────────────────

const GROUND_OBSTACLE_TYPES = ['fire', 'ice', 'rock', 'wind'];

// Map obstacle type to pot element for immunity check
const OBSTACLE_ELEMENT_MAP = {
  fire: 'fire',
  ice: 'ice',
  rock: 'earth',
  wind: 'wind',
};

function spawnObstacle() {
  if (Math.random() < 0.5) {
    // Ground obstacle — pick random element type
    const type = GROUND_OBSTACLE_TYPES[Math.floor(Math.random() * GROUND_OBSTACLE_TYPES.length)];
    const w = 16 + Math.floor(Math.random() * 12); // 16-27px
    obstacles.push({
      type,
      x: W + 5,
      y: GROUND_Y - 20,
      w: w,
      h: 20,
      frame: 0,
    });
  } else {
    // Bug (flying)
    obstacles.push({
      type: 'bug',
      x: W + 5,
      y: 20 + Math.floor(Math.random() * 42), // y: 20-62
      w: 20,
      h: 12,
      frame: 0,
    });
  }
}

// ── Collision ──────────────────────────────────────────────────────

const ELEMENT_FLASH_COLORS = {
  fire: 'rgba(255, 100, 0, 0.5)',
  ice: 'rgba(100, 200, 255, 0.5)',
  earth: 'rgba(180, 140, 60, 0.5)',
  wind: 'rgba(100, 220, 200, 0.5)',
};

function checkCollisions() {
  // Player hitbox
  let px, py, pw, ph;
  if (player.ducking) {
    pw = Math.round(playerW * DUCK_WIDTH_RATIO);
    ph = Math.round(playerH * DUCK_HEIGHT_RATIO);
    px = player.x;
    py = GROUND_Y - ph;
  } else {
    pw = playerW;
    ph = playerH;
    px = player.x;
    py = player.y;
  }

  // Apply forgiveness inset
  const px1 = px + COLLISION_INSET;
  const py1 = py + COLLISION_INSET;
  const px2 = px + pw - COLLISION_INSET;
  const py2 = py + ph - COLLISION_INSET;

  const potElement = selectedPlant && selectedPlant.potElement;

  for (const obs of obstacles) {
    // Immunity check: matching element passes through
    const obsElement = OBSTACLE_ELEMENT_MAP[obs.type];
    if (potElement && obsElement && potElement === obsElement) {
      // Check overlap for flash effect
      const ox1 = obs.x + COLLISION_INSET;
      const oy1 = obs.y + COLLISION_INSET;
      const ox2 = obs.x + obs.w - COLLISION_INSET;
      const oy2 = obs.y + obs.h - COLLISION_INSET;
      if (px1 < ox2 && px2 > ox1 && py1 < oy2 && py2 > oy1) {
        immuneFlash = 12;
        immuneFlashColor = ELEMENT_FLASH_COLORS[potElement] || 'rgba(255,255,255,0.5)';
        if (!obs.expCounted) {
          obs.expCounted = true;
          runExpGained++;
        }
      }
      continue;
    }

    const ox1 = obs.x + COLLISION_INSET;
    const oy1 = obs.y + COLLISION_INSET;
    const ox2 = obs.x + obs.w - COLLISION_INSET;
    const oy2 = obs.y + obs.h - COLLISION_INSET;

    // AABB overlap
    if (px1 < ox2 && px2 > ox1 && py1 < oy2 && py2 > oy1) {
      return true;
    }
  }
  return false;
}

// ── Rendering ──────────────────────────────────────────────────────

function render() {
  // Clear — sky gradient
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, W, H);

  // Sky gradient (subtle)
  const grad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  grad.addColorStop(0, '#1a1a2e');
  grad.addColorStop(1, '#2d2d44');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, GROUND_Y);

  // Clouds
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  for (const cloud of clouds) {
    ctx.fillRect(Math.round(cloud.x), cloud.y, cloud.w, 6);
    ctx.fillRect(Math.round(cloud.x) + 4, cloud.y - 2, cloud.w - 8, 2);
    ctx.fillRect(Math.round(cloud.x) + 2, cloud.y + 6, cloud.w - 4, 2);
  }

  // Ground
  ctx.fillStyle = '#3a2e1e';
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);

  // Ground detail — scrolling dots
  ctx.fillStyle = '#4a3e2e';
  for (let x = -groundOffset; x < W; x += 12) {
    ctx.fillRect(Math.round(x), GROUND_Y + 2, 2, 2);
    ctx.fillRect(Math.round(x) + 6, GROUND_Y + 6, 2, 2);
  }

  // Ground line
  ctx.fillStyle = '#5a4e3e';
  ctx.fillRect(0, GROUND_Y, W, 2);

  // Obstacles
  for (const obs of obstacles) {
    if (obs.type === 'fire') {
      renderFire(ctx, obs);
    } else if (obs.type === 'ice') {
      renderIce(ctx, obs);
    } else if (obs.type === 'rock') {
      renderRock(ctx, obs);
    } else if (obs.type === 'wind') {
      renderTornado(ctx, obs);
    } else {
      renderBug(ctx, obs);
    }
  }

  // Player
  renderPlayer(ctx);

  // Immunity flash overlay on player
  if (immuneFlash > 0) {
    immuneFlash--;
    const alpha = immuneFlash / 12;
    ctx.globalAlpha = alpha * 0.6;
    ctx.fillStyle = immuneFlashColor || 'rgba(255,255,255,0.5)';
    let sprite;
    let drawY;
    if (player.ducking) {
      sprite = sprites.duck;
      drawY = GROUND_Y - sprite.height;
    } else if (player.jumping || !player.grounded) {
      sprite = sprites.jump;
      drawY = Math.round(player.y) - (sprite.height - playerH);
    } else {
      sprite = sprites.normal;
      drawY = Math.round(player.y);
    }
    if (sprite) {
      ctx.fillRect(Math.round(player.x) - 1, drawY - 1, sprite.width + 2, sprite.height + 2);
    }
    ctx.globalAlpha = 1;
  }
}

function renderFire(ctx, obs) {
  const f = obs.frame || 0;

  // Flickering flame colors
  const colors = ['#ff4400', '#ff6600', '#ffaa00', '#ffdd00'];

  for (let x = 0; x < obs.w; x++) {
    // Each column has a different flame height that flickers
    const flicker = Math.sin(f * 0.3 + x * 1.7) * 4 + Math.sin(f * 0.5 + x * 0.9) * 3;
    const maxH = 12 + flicker;

    for (let y = 0; y < maxH; y++) {
      const t = y / maxH;
      let colorIdx;
      if (t < 0.3) colorIdx = 3; // yellow tip
      else if (t < 0.5) colorIdx = 2; // orange
      else if (t < 0.75) colorIdx = 1; // dark orange
      else colorIdx = 0; // red base

      // Add some randomness per frame
      if (Math.sin(f * 0.7 + x * 2.3 + y * 1.1) > 0.5) {
        colorIdx = Math.max(0, colorIdx - 1);
      }

      ctx.fillStyle = colors[colorIdx];
      ctx.fillRect(
        Math.round(obs.x + x),
        Math.round(obs.y + obs.h - y),
        2, 2
      );
    }
  }

  // Embers — small particles above flame
  if (f % 4 < 2) {
    const ex = obs.x + Math.floor(obs.w / 2) + Math.sin(f * 0.2) * 5;
    const ey = obs.y - 4 - (f % 12);
    ctx.fillStyle = '#ffaa00';
    ctx.fillRect(Math.round(ex), Math.round(ey), 2, 2);
  }
}

function renderIce(ctx, obs) {
  const f = obs.frame || 0;
  const colors = ['#1a5080', '#3090c0', '#60c0e0', '#a0e0ff'];

  // Jagged crystal columns
  for (let x = 0; x < obs.w; x += 3) {
    const colH = 10 + Math.sin(x * 1.3 + 0.5) * 5;
    const sparkle = Math.sin(f * 0.2 + x * 2.1) > 0.7;

    for (let y = 0; y < colH; y++) {
      const t = y / colH;
      let colorIdx;
      if (t < 0.2) colorIdx = 3; // white tip
      else if (t < 0.5) colorIdx = 2; // cyan
      else if (t < 0.8) colorIdx = 1; // blue
      else colorIdx = 0; // dark base

      if (sparkle && y < 3) colorIdx = 3;

      ctx.fillStyle = colors[colorIdx];
      ctx.fillRect(Math.round(obs.x + x), Math.round(obs.y + obs.h - y), 3, 2);
    }
  }

  // Sparkle points
  if (f % 8 < 4) {
    ctx.fillStyle = '#e0f4ff';
    const sx = obs.x + (f * 3 + 5) % obs.w;
    ctx.fillRect(Math.round(sx), Math.round(obs.y + 2), 2, 2);
  }
}

function renderRock(ctx, obs) {
  const colors = ['#3a2a18', '#5a4a30', '#7a6a50', '#908070'];

  // Stacked boulders
  const boulderCount = Math.ceil(obs.w / 10);
  for (let i = 0; i < boulderCount; i++) {
    const bx = obs.x + i * 9;
    const bw = 10 + (i % 2) * 4;
    const bh = 12 + (i % 3) * 4;
    const by = obs.y + obs.h - bh;

    // Dark outline
    ctx.fillStyle = colors[0];
    ctx.fillRect(Math.round(bx), Math.round(by), bw, bh);

    // Body
    ctx.fillStyle = colors[1 + (i % 2)];
    ctx.fillRect(Math.round(bx + 1), Math.round(by + 1), bw - 2, bh - 2);

    // Highlight
    ctx.fillStyle = colors[3];
    ctx.fillRect(Math.round(bx + 2), Math.round(by + 2), 3, 2);
  }

  // Cracks / texture
  ctx.fillStyle = colors[0];
  ctx.fillRect(Math.round(obs.x + 4), Math.round(obs.y + obs.h - 8), 1, 4);
  ctx.fillRect(Math.round(obs.x + obs.w - 6), Math.round(obs.y + obs.h - 10), 1, 5);
}

function renderTornado(ctx, obs) {
  const f = obs.frame || 0;
  const colors = ['#4a5a6a', '#6a8a8a', '#80b0b0', '#a0d0d0'];

  // Swirling funnel — wider at top, narrower at bottom
  for (let y = 0; y < obs.h; y++) {
    const t = y / obs.h;
    const funnelW = Math.round(obs.w * (0.3 + 0.7 * (1 - t)));
    const wobble = Math.sin(f * 0.15 + y * 0.5) * 3;
    const cx = obs.x + obs.w / 2 + wobble;
    const left = cx - funnelW / 2;

    for (let x = 0; x < funnelW; x++) {
      const xn = x / funnelW;
      // Swirl pattern
      const swirl = Math.sin(f * 0.1 + y * 0.3 + x * 0.8);
      let colorIdx;
      if (swirl > 0.4) colorIdx = 3;
      else if (swirl > 0) colorIdx = 2;
      else if (swirl > -0.4) colorIdx = 1;
      else colorIdx = 0;

      // Darker at edges
      if (xn < 0.15 || xn > 0.85) colorIdx = Math.max(0, colorIdx - 1);

      ctx.fillStyle = colors[colorIdx];
      ctx.fillRect(Math.round(left + x), Math.round(obs.y + y), 2, 2);
    }
  }

  // Debris particles
  if (f % 6 < 3) {
    ctx.fillStyle = '#5a4a3a';
    const dx = obs.x + obs.w / 2 + Math.sin(f * 0.3) * 8;
    const dy = obs.y + (f * 2) % obs.h;
    ctx.fillRect(Math.round(dx), Math.round(dy), 2, 2);
  }
}

function renderBug(ctx, obs) {
  const f = obs.frame || 0;
  const bx = Math.round(obs.x);
  const by = Math.round(obs.y);

  // Body (dark brown/black)
  ctx.fillStyle = '#2a1a0a';
  ctx.fillRect(bx + 6, by + 4, 10, 6); // thorax
  ctx.fillRect(bx + 2, by + 4, 4, 4); // head

  // Eyes
  ctx.fillStyle = '#ff3333';
  ctx.fillRect(bx + 2, by + 4, 2, 2);

  // Wings — flapping animation
  const wingUp = (f % 6) < 3;
  ctx.fillStyle = 'rgba(180, 200, 220, 0.6)';
  if (wingUp) {
    // Wings up
    ctx.fillRect(bx + 8, by, 8, 4);
  } else {
    // Wings down
    ctx.fillRect(bx + 8, by + 8, 8, 4);
  }

  // Legs
  ctx.fillStyle = '#1a0a00';
  ctx.fillRect(bx + 6, by + 10, 2, 2);
  ctx.fillRect(bx + 10, by + 10, 2, 2);
  ctx.fillRect(bx + 14, by + 10, 2, 2);
}

function renderPlayer(ctx) {
  let sprite, drawY;

  if (player.ducking) {
    sprite = sprites.duck;
    drawY = GROUND_Y - sprite.height;
  } else if (player.jumping || !player.grounded) {
    sprite = sprites.jump;
    drawY = Math.round(player.y) - (sprite.height - playerH);
  } else {
    sprite = sprites.normal;
    drawY = Math.round(player.y);
  }

  if (sprite) {
    ctx.drawImage(sprite, Math.round(player.x), drawY);
  }
}

// ── Game over ──────────────────────────────────────────────────────

function gameOver() {
  running = false;
  gameStarted = false;
  gameOverTime = Date.now();
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  // Save high score
  const state = loadState();
  if (!state.stats.minigameHighScore) state.stats.minigameHighScore = 0;
  const isNewHigh = score > state.stats.minigameHighScore;
  if (isNewHigh) {
    state.stats.minigameHighScore = score;
  }

  // Persist pot EXP
  if (selectedPlant && selectedPlant.potElement && runExpGained > 0) {
    const gardenPlant = state.garden.find(p => p.id === selectedPlant.id);
    if (gardenPlant) {
      const oldExp = gardenPlant.potExp || 0;
      const oldLevel = potLevelFromExp(oldExp);
      gardenPlant.potExp = oldExp + runExpGained;
      gardenPlant.potLevel = potLevelFromExp(gardenPlant.potExp);
      if (gardenPlant.potLevel > oldLevel) {
        pendingLevelUp = { oldLevel, newLevel: gardenPlant.potLevel, element: gardenPlant.potElement };
      }
    }
  }

  if (isNewHigh || (selectedPlant && selectedPlant.potElement && runExpGained > 0)) {
    saveState(state);
  }

  showGameOver(score, state.stats.minigameHighScore, isNewHigh);
}

// ── Overlays ───────────────────────────────────────────────────────

function showPlantPicker(plants) {
  const overlay = document.getElementById('minigameOverlay');
  const content = document.getElementById('minigameOverlayContent');
  overlay.classList.remove('hidden');
  document.getElementById('minigameHud').style.display = 'none';

  content.innerHTML = `
    <div class="mg-title">Choose Your Runner</div>
    <div class="mg-picker-grid" id="mgPickerGrid"></div>
    <button class="btn mg-back-btn" id="mgPickerBack">Back to Plant</button>
  `;

  const grid = document.getElementById('mgPickerGrid');

  for (const plant of plants) {
    const card = document.createElement('div');
    card.className = 'mg-picker-card';

    // Render a small preview of the plant
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

    const isGrowing = plant.growthStage !== undefined && plant.growthStage < 1.0;
    if (isGrowing) {
      const tag = document.createElement('span');
      tag.className = 'mg-picker-tag';
      tag.textContent = 'Growing';
      name.appendChild(tag);
    }

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

    card.addEventListener('click', () => {
      selectAndStart(plant);
    });

    grid.appendChild(card);
  }

  document.getElementById('mgPickerBack').addEventListener('click', handleBack);
}

function showStartScreen(plant) {
  const overlay = document.getElementById('minigameOverlay');
  const content = document.getElementById('minigameOverlayContent');
  overlay.classList.remove('hidden');
  document.getElementById('minigameHud').style.display = 'none';

  const state = loadState();
  const highScore = state.stats.minigameHighScore || 0;

  content.innerHTML = `
    <div class="mg-title">Plant Runner</div>
    <div class="mg-preview" id="mgPreview"></div>
    <div class="mg-instructions">
      <span>Space/Up: Jump</span>
      <span>Down/S: Duck</span>
    </div>
    ${highScore > 0 ? `<div class="mg-high-score">Best: ${highScore}</div>` : ''}
    <button class="btn mg-play-btn" id="mgStartBtn">Start</button>
    <button class="btn mg-back-btn" id="mgBackBtn">Back to Plant</button>
  `;

  // Show plant preview
  const previewWrap = document.getElementById('mgPreview');
  if (sprites.normal) {
    const previewCanvas = document.createElement('canvas');
    const s = 4;
    previewCanvas.width = sprites.normal.width * s;
    previewCanvas.height = sprites.normal.height * s;
    previewCanvas.style.imageRendering = 'pixelated';
    const pCtx = previewCanvas.getContext('2d');
    pCtx.imageSmoothingEnabled = false;
    pCtx.drawImage(sprites.normal, 0, 0, previewCanvas.width, previewCanvas.height);
    previewWrap.appendChild(previewCanvas);
  }

  document.getElementById('mgStartBtn').addEventListener('click', beginGame);
  document.getElementById('mgBackBtn').addEventListener('click', handleBack);
}

function showGameOver(finalScore, highScore, isNewHigh) {
  const overlay = document.getElementById('minigameOverlay');
  const content = document.getElementById('minigameOverlayContent');
  overlay.classList.remove('hidden');

  // Build EXP section if applicable
  let expHtml = '';
  if (selectedPlant && selectedPlant.potElement && runExpGained > 0) {
    const state = loadState();
    const gardenPlant = state.garden.find(p => p.id === selectedPlant.id);
    const totalExp = gardenPlant ? (gardenPlant.potExp || 0) : 0;
    const currentLevel = potLevelFromExp(totalExp);
    const nextThreshold = currentLevel < 3 ? POT_LEVEL_THRESHOLDS[currentLevel + 1] : null;
    const prevThreshold = POT_LEVEL_THRESHOLDS[currentLevel];

    const elementNames = { fire: 'Fire', ice: 'Ice', earth: 'Earth', wind: 'Wind' };
    const eleName = elementNames[selectedPlant.potElement] || selectedPlant.potElement;

    let progressHtml = '';
    if (nextThreshold !== null) {
      const pct = Math.min(100, Math.round(((totalExp - prevThreshold) / (nextThreshold - prevThreshold)) * 100));
      progressHtml = `
        <div class="mg-exp-progress">
          <div class="mg-exp-bar"><div class="mg-exp-bar-fill" style="width:${pct}%"></div></div>
          <span class="mg-exp-numbers">${totalExp} / ${nextThreshold} EXP</span>
        </div>`;
    } else {
      progressHtml = `<div class="mg-exp-numbers">${totalExp} EXP (MAX)</div>`;
    }

    expHtml = `
      <div class="mg-exp-gained">+${runExpGained} ${eleName} Pot EXP</div>
      ${pendingLevelUp ? `<div class="mg-level-up">Pot Level Up! Lv.${pendingLevelUp.oldLevel} → Lv.${pendingLevelUp.newLevel}</div>` : ''}
      <div class="mg-exp-section">
        <span class="mg-pot-level">Pot Lv.${currentLevel}</span>
        ${progressHtml}
      </div>`;
  } else if (selectedPlant && selectedPlant.potElement && runExpGained === 0) {
    expHtml = `<div class="mg-exp-gained mg-exp-none">No obstacles absorbed</div>`;
  }

  content.innerHTML = `
    <div class="mg-title">Game Over</div>
    <div class="mg-score-final">Score: ${finalScore}</div>
    ${isNewHigh ? '<div class="mg-new-high">New High Score!</div>' : ''}
    <div class="mg-high-score">Best: ${highScore}</div>
    ${expHtml}
    <button class="btn mg-play-btn" id="mgRetryBtn">Retry</button>
    <button class="btn mg-back-btn" id="mgBackBtn2">Back to Plant</button>
  `;

  document.getElementById('mgRetryBtn').addEventListener('click', beginGame);
  document.getElementById('mgBackBtn2').addEventListener('click', handleBack);
}

function handleBack() {
  stopMinigame();
  if (onBackCallback) onBackCallback();
}

// ── Input handling ─────────────────────────────────────────────────

function onKeyDown(e) {
  if (!gameStarted || !running) return;

  const key = e.key;
  if (['ArrowUp', 'w', 'W', ' '].includes(key)) {
    e.preventDefault();
    doJump();
  }
  if (['ArrowDown', 's', 'S'].includes(key)) {
    e.preventDefault();
    player.ducking = true;
  }
  keys[key] = true;
}

function onKeyUp(e) {
  const key = e.key;
  keys[key] = false;
  if (['ArrowDown', 's', 'S'].includes(key)) {
    if (player) player.ducking = false;
  }
}

function onTouchStart(e) {
  if (!gameStarted || !running) return;
  e.preventDefault();

  const touch = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  const relY = (touch.clientY - rect.top) / rect.height;

  if (relY < 0.5) {
    // Upper half — jump
    touchZone = 'upper';
    doJump();
  } else {
    // Lower half — duck
    touchZone = 'lower';
    player.ducking = true;
  }
}

function onTouchEnd(e) {
  if (touchZone === 'lower' && player) {
    player.ducking = false;
  }
  touchZone = null;
}

function doJump() {
  if (player.grounded && !player.ducking) {
    player.vy = JUMP_VEL;
    player.jumping = true;
    player.grounded = false;
  }
}

function addInputListeners() {
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd);
}

function removeInputListeners() {
  document.removeEventListener('keydown', onKeyDown);
  document.removeEventListener('keyup', onKeyUp);
  if (canvas) {
    canvas.removeEventListener('touchstart', onTouchStart);
    canvas.removeEventListener('touchend', onTouchEnd);
  }
}
