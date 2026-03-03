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
const SPEED_ACCEL = 0.005; // per frame
const SPAWN_MIN_GAP = 100;
const SPAWN_MAX_GAP = 200;
const COLLISION_INSET = 3;
const POT_HITBOX_W = 14;   // Universal pot collision width (obstacles hit this)
const POT_HITBOX_H = 12;   // Universal pot collision height
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

// Bug kill tracking (for TD unlock)
let bugKillsThisRun = 0;
let bugDialogues = [];  // active dialogue bubbles on screen
let tdAlreadyUnlocked = false; // cached at game start

// Dead bug corpses (fall then scroll off-screen)
let deadBugs = [];

// Elemental projectile state
let projectiles = [];
let projectileCooldown = 0;

// Ability state (elemental pot lv2+)
let abilityCharge = 0;
let abilityMaxCharge = 0;
let abilityReady = false;
let abilityElement = null;
let abilityLevel = 0;
let abilityDuckTriggered = false; // debounce for fire/ice duck activation

// Fire ability
let fireSafetyTimer = 0;  // frames remaining where no obstacles spawn (180 = 3s)
let fireWaveFrame = 0;     // animation countdown

// Ice ability
let iceSlowTimer = 0;      // frames remaining for 50% slow (600 = 10s)

// Earth ability
let earthArmorActive = false;
let earthArmorFlash = 0;    // visual flash when armor breaks

// Wind ability
let windBugImmune = false;
let windUsedDoubleJump = false;

// Unlock cutscene state
let cutsceneActive = false;
let cutscenePhase = 0;
let cutsceneTimer = 0;
let cutsceneBugs = [];
let cutsceneBossBug = null;
let cutscenePlayerX = 0;

const BUG_KILL_MESSAGES = [
  "Be careful... Mother won't be happy.",
  "The hive remembers...",
  "You'll regret this...",
  "They were just scouts...",
  "Something stirs beneath the soil...",
  "She is watching you...",
  "The swarm grows restless...",
  "You cannot stop what is coming...",
  "Every kill awakens another hundred...",
  "The queen knows your scent now...",
];

function addBugDialogue(x, y) {
  if (tdAlreadyUnlocked) return;
  const msg = BUG_KILL_MESSAGES[Math.floor(Math.random() * BUG_KILL_MESSAGES.length)];
  bugDialogues.push({ msg, x, y: y - 10, alpha: 1.0, life: 120 });
}

function killBug(obs) {
  deadBugs.push({
    x: obs.x, y: obs.y, w: obs.w, h: obs.h,
    vy: -1.5,       // slight upward pop
    frame: obs.frame || 0,
    grounded: false,
  });
}

// Ability cost lookup: [element][level] -> maxCharge
const ABILITY_COSTS = {
  fire:  { 1: 15, 2: 10, 3: 5 },
  ice:   { 1: 15, 2: 10, 3: 5 },
  earth: { 1: 5,  2: 3,  3: 1 },
  wind:  { 1: 5,  2: 3,  3: 1 },
};

// ── Public API ─────────────────────────────────────────────────────

// Debug helpers (accessed from tests)
window.__debugMinigameState = () => ({
  running, gameStarted, abilityElement, abilityLevel, abilityMaxCharge,
  abilityCharge, abilityReady, fireSafetyTimer, iceSlowTimer,
  earthArmorActive, windBugImmune, windUsedDoubleJump,
  bugKillsThisRun, projectileCount: projectiles ? projectiles.length : 0,
  obstacleCount: obstacles ? obstacles.length : 0,
  cutsceneActive,
  selectedPlant: selectedPlant ? {
    species: selectedPlant.species,
    potElement: selectedPlant.potElement,
    potExp: selectedPlant.potExp,
    potLevel: selectedPlant.potLevel,
  } : null,
});
window.__debugSetAbilityCharge = (val) => {
  abilityCharge = val;
  if (abilityCharge >= abilityMaxCharge) {
    abilityCharge = abilityMaxCharge;
    abilityReady = true;
  }
};
window.__debugSpawnBug = (x, y) => {
  obstacles.push({ type: 'bug', x: x || W - 40, y: y != null ? y : 40, w: 20, h: 12, frame: 0 });
};
window.__debugSetBugKills = (n) => { bugKillsThisRun = n; };
window.__debugTriggerJump = () => { if (player) doJump(); };
window.__debugGetProjectiles = () => projectiles.map(p => ({ x: p.x, y: p.y, element: p.element }));
window.__debugForceGameOver = () => { if (running) gameOver(); };

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
  bugKillsThisRun = 0;
  bugDialogues = [];
  projectiles = [];
  projectileCooldown = 0;
  deadBugs = [];
  cutsceneActive = false;
  tdAlreadyUnlocked = loadState().stats.tdUnlocked || false;

  // Reset ability state
  abilityCharge = 0;
  abilityMaxCharge = 0;
  abilityReady = false;
  abilityElement = null;
  abilityLevel = 0;
  abilityDuckTriggered = false;
  fireSafetyTimer = 0;
  fireWaveFrame = 0;
  iceSlowTimer = 0;
  earthArmorActive = false;
  earthArmorFlash = 0;
  windBugImmune = false;
  windUsedDoubleJump = false;

  // Initialize ability if pot is level 2+
  if (selectedPlant) {
    const potLevel = selectedPlant.potLevel || 0;
    const potElement = selectedPlant.potElement;
    if (potLevel >= 1 && potElement && ABILITY_COSTS[potElement]) {
      abilityElement = potElement;
      abilityLevel = potLevel;
      abilityMaxCharge = ABILITY_COSTS[potElement][Math.min(potLevel, 3)] || 0;
    }
  }

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

  // Speed up (ice slow: accel still applies but at reduced base)
  if (iceSlowTimer > 0) {
    iceSlowTimer--;
    if (iceSlowTimer === 0) {
      // Ice expired: let current speed stand (already accel'd from slow base)
    }
  }
  if (speed < MAX_SPEED) {
    speed = Math.min(MAX_SPEED, speed + SPEED_ACCEL);
  }

  // Fire safety timer: suppress obstacle spawning
  if (fireSafetyTimer > 0) fireSafetyTimer--;
  if (fireWaveFrame > 0) fireWaveFrame--;
  if (earthArmorFlash > 0) earthArmorFlash--;

  // Duck ability activation (fire / ice) with debounce
  if (player.ducking && abilityReady && !abilityDuckTriggered) {
    if (abilityElement === 'fire') {
      // Flame wave: destroy all obstacles + 3s no-spawn safety
      // Count bugs killed by fire wave
      for (const obs of obstacles) {
        if (obs.type === 'bug') {
          bugKillsThisRun++;
          addBugDialogue(obs.x, obs.y);
          killBug(obs);
        }
      }
      obstacles.length = 0;
      fireSafetyTimer = 180;
      fireWaveFrame = 20;
      abilityCharge = 0;
      abilityReady = false;
      abilityDuckTriggered = true;
    } else if (abilityElement === 'ice') {
      // Ice slow: 50% speed for 10s
      speed *= 0.5;
      iceSlowTimer = 600;
      abilityCharge = 0;
      abilityReady = false;
      abilityDuckTriggered = true;
    }
  }
  // Clear duck debounce when duck released
  if (!player.ducking) abilityDuckTriggered = false;

  // Wind: clear double jump state on landing
  if (windUsedDoubleJump && player.grounded) {
    windBugImmune = false;
    windUsedDoubleJump = false;
  }

  // Wind: bug immunity while ability is charged (even before using double jump)
  if (abilityReady && abilityElement === 'wind') {
    windBugImmune = true;
  }

  // Distance & score
  distance += speed;
  score = Math.floor(distance / 10);

  // Update score HUD
  document.getElementById('minigameScore').textContent = score;

  // Player physics
  if (player.ducking) {
    // Duck always snaps to ground (fast-fall if mid-air)
    if (!player.grounded && windUsedDoubleJump) {
      windBugImmune = false;
      windUsedDoubleJump = false;
    }
    player.y = GROUND_Y - Math.round(playerH * DUCK_HEIGHT_RATIO);
    player.vy = 0;
    player.grounded = true;
    player.jumping = false;
  } else if (player.jumping || !player.grounded) {
    // Wind glide: reduced gravity after double jump
    const grav = windUsedDoubleJump ? GRAVITY * 0.25 : GRAVITY;
    player.vy += grav;
    // Cap fall speed during wind glide
    if (windUsedDoubleJump && player.vy > 1.5) player.vy = 1.5;
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

  // Spawn obstacles (suppressed during fire safety timer)
  if (fireSafetyTimer <= 0) {
    spawnTimer -= speed;
    if (spawnTimer <= 0) {
      spawnObstacle();
      // Gap shrinks as speed increases
      const gapRange = SPAWN_MAX_GAP - SPAWN_MIN_GAP;
      const speedFactor = (speed - MIN_SPEED) / (MAX_SPEED - MIN_SPEED);
      const gap = SPAWN_MAX_GAP - gapRange * speedFactor * 0.5;
      spawnTimer = gap + Math.random() * 30;
    }
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

  // Update dead bugs: fall with gravity, then scroll left on ground
  for (let i = deadBugs.length - 1; i >= 0; i--) {
    const db = deadBugs[i];
    db.frame++;
    if (!db.grounded) {
      db.vy += 0.3; // gravity
      db.y += db.vy;
      if (db.y >= GROUND_Y - db.h) {
        db.y = GROUND_Y - db.h;
        db.grounded = true;
      }
    } else {
      db.x -= speed;
    }
    if (db.x + db.w < -10) {
      deadBugs.splice(i, 1);
    }
  }

  // Update projectiles
  if (projectileCooldown > 0) projectileCooldown--;
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];

    // Re-acquire target if current one was removed
    if (!p.target || !obstacles.includes(p.target)) {
      p.target = null;
      let nearest = Infinity;
      for (const obs of obstacles) {
        if (obs.type !== 'bug') continue;
        const dx = obs.x - p.x;
        if (dx > -10 && dx < nearest) { nearest = dx; p.target = obs; }
      }
    }

    // Arc trajectory: launch upward, then curve toward target
    p.age++;
    const blend = Math.min(1, p.age / 15); // 0→1 over 15 frames
    const spd = 5;
    if (p.target) {
      const tx = p.target.x + p.target.w / 2;
      const ty = p.target.y + p.target.h / 2;
      const dx = tx - p.x;
      const dy = ty - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0) {
        const homeX = (dx / dist) * spd;
        const homeY = (dy / dist) * spd;
        // Blend from upward launch to homing
        p.x += homeX * blend;
        p.y += -spd * (1 - blend) + homeY * blend;
      }
    } else {
      p.x += spd * blend;
      p.y += -spd * (1 - blend);
    }

    // Remove if off-screen
    if (p.x > W + 10 || p.x < -10 || p.y > H + 10 || p.y < -10) {
      projectiles.splice(i, 1);
      continue;
    }
    // AABB collision with bugs
    let hit = false;
    for (let j = obstacles.length - 1; j >= 0; j--) {
      const obs = obstacles[j];
      if (obs.type !== 'bug') continue;
      if (p.x + 6 > obs.x && p.x < obs.x + obs.w &&
          p.y + 6 > obs.y && p.y < obs.y + obs.h) {
        bugKillsThisRun++;
        addBugDialogue(obs.x, obs.y);
        killBug(obs);
        obstacles.splice(j, 1);
        hit = true;
        break;
      }
    }
    if (hit) {
      projectiles.splice(i, 1);
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

  // Update bug dialogues
  updateBugDialogues();

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
  // Full sprite hitbox (used for EXP/immunity overlap detection)
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

  const px1 = px + COLLISION_INSET;
  const py1 = py + COLLISION_INSET;
  const px2 = px + pw - COLLISION_INSET;
  const py2 = py + ph - COLLISION_INSET;

  // Universal pot hitbox for lethal obstacle collision
  const potCenterX = player.x + playerW / 2;
  const potBottom = player.ducking ? GROUND_Y : (player.y + playerH);
  const hx1 = potCenterX - POT_HITBOX_W / 2 + COLLISION_INSET;
  const hy1 = potBottom - POT_HITBOX_H + COLLISION_INSET;
  const hx2 = potCenterX + POT_HITBOX_W / 2 - COLLISION_INSET;
  const hy2 = potBottom - COLLISION_INSET;

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
          // Charge ability if element matches
          if (abilityMaxCharge > 0 && abilityElement === potElement) {
            if (abilityCharge < abilityMaxCharge) {
              abilityCharge++;
            }
            if (abilityCharge >= abilityMaxCharge) {
              abilityReady = true;
              abilityCharge = abilityMaxCharge;
              // Earth: auto-activate armor immediately when charged
              if (abilityElement === 'earth' && !earthArmorActive) {
                earthArmorActive = true;
                abilityCharge = 0;
                abilityReady = false;
              }
            }
          }
        }
      }
      continue;
    }

    // Wind bug immunity: skip bug collisions during double jump
    if (windBugImmune && obs.type === 'bug') continue;

    const ox1 = obs.x + COLLISION_INSET;
    const oy1 = obs.y + COLLISION_INSET;
    const ox2 = obs.x + obs.w - COLLISION_INSET;
    const oy2 = obs.y + obs.h - COLLISION_INSET;

    // AABB overlap using pot hitbox for lethal collisions
    if (hx1 < ox2 && hx2 > ox1 && hy1 < oy2 && hy2 > oy1) {
      // Earth armor: absorb one hit
      if (earthArmorActive) {
        earthArmorActive = false;
        earthArmorFlash = 20;
        // Track bug kill if it was a bug
        if (obs.type === 'bug') {
          bugKillsThisRun++;
          addBugDialogue(obs.x, obs.y);
          killBug(obs);
        }
        // Remove this obstacle
        obstacles.splice(obstacles.indexOf(obs), 1);
        return false;
      }
      // Track bug kill on lethal collision
      if (obs.type === 'bug') {
        bugKillsThisRun++;
        addBugDialogue(obs.x, obs.y);
        killBug(obs);
      }
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

  // Dead bugs (fallen corpses)
  for (const db of deadBugs) {
    renderDeadBug(ctx, db);
  }

  // Projectiles
  for (const proj of projectiles) {
    renderProjectile(ctx, proj);
  }

  // Ice slow overlay
  if (iceSlowTimer > 0) {
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#60c0ff';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }

  // Fire wave animation
  if (fireWaveFrame > 0) {
    const progress = 1 - (fireWaveFrame / 20); // 0→1 as frames count down
    const waveX = progress * W;
    const waveW = 40;
    ctx.globalAlpha = 0.6 * (fireWaveFrame / 20);
    // Flame sweep expanding across screen
    const grad = ctx.createLinearGradient(waveX - waveW, 0, waveX, 0);
    grad.addColorStop(0, 'rgba(255, 68, 0, 0)');
    grad.addColorStop(0.3, '#ff6600');
    grad.addColorStop(0.6, '#ffaa00');
    grad.addColorStop(1, 'rgba(255, 221, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, GROUND_Y - 30, waveX, 35);
    ctx.globalAlpha = 1;
  }

  // Player
  renderPlayer(ctx);

  // Earth armor icon near player
  if (earthArmorActive) {
    const shieldX = Math.round(player.x) - 6;
    const shieldY = Math.round(player.y) + 2;
    // Small rock/shield icon
    ctx.fillStyle = '#8a7a50';
    ctx.fillRect(shieldX, shieldY, 5, 6);
    ctx.fillStyle = '#a09060';
    ctx.fillRect(shieldX + 1, shieldY + 1, 3, 4);
    ctx.fillStyle = '#c0b080';
    ctx.fillRect(shieldX + 2, shieldY + 2, 1, 2);
  }

  // Earth armor break flash
  if (earthArmorFlash > 0) {
    ctx.globalAlpha = earthArmorFlash / 20 * 0.4;
    ctx.fillStyle = '#c0a060';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }

  // Wind double-jump trail
  if (windUsedDoubleJump && !player.grounded) {
    const trailX = Math.round(player.x) + Math.round(playerW / 2);
    const trailY = Math.round(player.y) + playerH;
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#80d0c0';
    for (let i = 0; i < 4; i++) {
      const ty = trailY + i * 4 + (frameCount % 3);
      ctx.fillRect(trailX - 1 + (i % 2) * 2, ty, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

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

  // Bug kill dialogues
  renderBugDialogues(ctx);

  // Ability charge bar (top-right, only if ability active)
  if (abilityMaxCharge > 0) {
    renderAbilityBar(ctx);
  }
}

const ABILITY_BAR_COLORS = {
  fire: '#e06020',
  ice: '#60c0e0',
  earth: '#a08860',
  wind: '#70d0c0',
};

function renderAbilityBar(ctx) {
  const barW = 50;
  const barH = 5;
  const barX = W - barW - 6;
  const barY = 6;
  const fill = abilityCharge / abilityMaxCharge;
  const color = ABILITY_BAR_COLORS[abilityElement] || '#888';

  // Background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

  // Fill
  ctx.fillStyle = color;
  ctx.fillRect(barX, barY, Math.round(barW * fill), barH);

  // Ready state: pulsing bright outline
  if (abilityReady) {
    const pulse = 0.5 + 0.5 * Math.sin(frameCount * 0.15);
    ctx.globalAlpha = 0.4 + pulse * 0.6;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX - 1.5, barY - 1.5, barW + 3, barH + 3);
    ctx.globalAlpha = 1;

    // "RDY" label
    ctx.fillStyle = '#fff';
    ctx.font = '5px monospace';
    ctx.fillText('RDY', barX - 20, barY + barH);
  }

  // Element icon (small colored dot)
  ctx.fillStyle = color;
  ctx.fillRect(barX - 5, barY, 3, barH);
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

function renderDeadBug(ctx, db) {
  const bx = Math.round(db.x);
  // Draw upside-down flush with ground: place bottom of body at db.y + db.h
  const groundY = Math.round(db.y + db.h);

  ctx.save();
  ctx.globalAlpha = 0.6;

  // Legs pointing up (drawn above body)
  ctx.fillStyle = '#1a0a00';
  ctx.fillRect(bx + 6, groundY - 12, 2, 2);
  ctx.fillRect(bx + 10, groundY - 12, 2, 2);
  ctx.fillRect(bx + 14, groundY - 12, 2, 2);

  // Body (flush with ground)
  ctx.fillStyle = '#1a0a00';
  ctx.fillRect(bx + 6, groundY - 6, 10, 6);
  ctx.fillRect(bx + 2, groundY - 4, 4, 4);

  // Eyes (dimmed)
  ctx.fillStyle = '#662222';
  ctx.fillRect(bx + 2, groundY - 4, 2, 2);

  // Wings flat underneath (barely visible)
  ctx.fillStyle = 'rgba(140, 160, 180, 0.3)';
  ctx.fillRect(bx + 8, groundY - 4, 8, 4);

  ctx.restore();
}

function renderProjectile(ctx, proj) {
  const px = Math.round(proj.x);
  const py = Math.round(proj.y);
  const flicker = frameCount % 4 < 2;

  switch (proj.element) {
    case 'fire':
      // Orange/yellow flickering 4x4 with trail
      ctx.fillStyle = flicker ? '#ff6600' : '#ffaa00';
      ctx.fillRect(px, py, 4, 4);
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#ff4400';
      ctx.fillRect(px - 3, py + 1, 3, 2);
      ctx.globalAlpha = 1;
      break;
    case 'ice':
      // Cyan crystal shard 5x3 with sparkle
      ctx.fillStyle = '#60d0ff';
      ctx.fillRect(px, py, 5, 3);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(px + (flicker ? 1 : 3), py, 1, 1);
      break;
    case 'earth':
      // Brown pebble 5x5 with highlight
      ctx.fillStyle = '#8a6a3a';
      ctx.fillRect(px, py, 5, 5);
      ctx.fillStyle = '#b09060';
      ctx.fillRect(px + 1, py + 1, 2, 2);
      break;
    case 'wind':
      // Teal blade 6x2 with transparency
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#60c0b0';
      ctx.fillRect(px, py, 6, 2);
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#80e0d0';
      ctx.fillRect(px + 1, py, 4, 1);
      ctx.globalAlpha = 1;
      break;
  }
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

  // Persist bug kills
  if (bugKillsThisRun > 0) {
    state.stats.bugKillsTotal = (state.stats.bugKillsTotal || 0) + bugKillsThisRun;
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

  saveState(state);

  // Check if unlock cutscene should trigger
  if (state.stats.bugKillsTotal >= 10 && !state.stats.tdUnlocked) {
    startUnlockCutscene();
    return;
  }

  showGameOver(score, state.stats.minigameHighScore, isNewHigh);
}

// ── Bug Dialogue Rendering ─────────────────────────────────────────

function updateBugDialogues() {
  for (let i = bugDialogues.length - 1; i >= 0; i--) {
    const d = bugDialogues[i];
    d.life--;
    d.y -= 0.3;
    d.alpha = Math.min(1, d.life / 30);
    if (d.life <= 0) bugDialogues.splice(i, 1);
  }
}

function renderBugDialogues(ctx) {
  for (const d of bugDialogues) {
    ctx.save();
    ctx.globalAlpha = d.alpha;
    ctx.font = 'bold 8px monospace';
    const textW = ctx.measureText(d.msg).width;
    const bx = Math.max(2, Math.min(W - textW - 8, d.x - textW / 2));
    const by = Math.max(14, d.y);
    // Speech bubble background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(bx - 4, by - 10, textW + 8, 14);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(bx - 3, by - 11, textW + 6, 1);
    ctx.fillRect(bx - 3, by + 4, textW + 6, 1);
    // Text outline for contrast
    ctx.fillStyle = '#000000';
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        if (ox === 0 && oy === 0) continue;
        ctx.fillText(d.msg, bx + ox, by + oy);
      }
    }
    // Main text
    ctx.fillStyle = '#ff6666';
    ctx.fillText(d.msg, bx, by);
    ctx.restore();
  }
}

// ── Unlock Cutscene ────────────────────────────────────────────────

function startUnlockCutscene() {
  cutsceneActive = true;
  cutscenePhase = 0;
  cutsceneTimer = 0;
  cutsceneBugs = [];
  cutsceneBossBug = null;
  cutscenePlayerX = player ? player.x : 16;

  document.getElementById('minigameHud').style.display = 'none';
  const overlay = document.getElementById('minigameOverlay');
  overlay.classList.add('hidden');

  rafId = requestAnimationFrame(cutsceneLoop);
}

function cutsceneLoop() {
  if (!cutsceneActive) return;

  cutsceneTimer++;
  updateCutscene();
  renderCutscene();

  rafId = requestAnimationFrame(cutsceneLoop);
}

function updateCutscene() {
  // Phase 0: Rumble (0-120 frames, ~2s)
  // Phase 1: Bug swarm (120-300 frames, ~3s)
  // Phase 2: Boss bug (300-420 frames, ~2s)
  // Phase 3: Plant flees (420-540 frames, ~2s)
  // Phase 4: Fade to black (540-630 frames, ~1.5s)

  if (cutsceneTimer === 120) cutscenePhase = 1;
  if (cutsceneTimer === 300) cutscenePhase = 2;
  if (cutsceneTimer === 420) cutscenePhase = 3;
  if (cutsceneTimer === 540) cutscenePhase = 4;

  // Phase 1: spawn bugs from all sides
  if (cutscenePhase === 1 && cutsceneTimer % 3 === 0) {
    const side = Math.floor(Math.random() * 4);
    let bx, by;
    if (side === 0) { bx = Math.random() * W; by = -10; }
    else if (side === 1) { bx = W + 10; by = Math.random() * H; }
    else if (side === 2) { bx = Math.random() * W; by = H + 10; }
    else { bx = -10; by = Math.random() * H; }
    const angle = Math.atan2(H / 2 - by, W / 2 - bx);
    cutsceneBugs.push({
      x: bx, y: by,
      vx: Math.cos(angle) * (0.5 + Math.random() * 0.5),
      vy: Math.sin(angle) * (0.5 + Math.random() * 0.5),
      frame: Math.floor(Math.random() * 20),
    });
  }

  // Move cutscene bugs
  for (const b of cutsceneBugs) {
    b.x += b.vx;
    b.y += b.vy;
    b.frame++;
  }

  // Phase 2: Boss enters from right
  if (cutscenePhase === 2 && !cutsceneBossBug) {
    cutsceneBossBug = { x: W + 20, y: H / 2 - 30, frame: 0 };
  }
  if (cutsceneBossBug) {
    cutsceneBossBug.frame++;
    if (cutsceneBossBug.x > W / 2 - 40) {
      cutsceneBossBug.x -= 0.8;
    }
  }

  // Phase 3: Player flees left
  if (cutscenePhase === 3) {
    cutscenePlayerX -= 3;
  }

  // Phase 4: End cutscene (extended to let text linger)
  if (cutsceneTimer >= 900) {
    endCutscene();
  }
}

function renderCutscene() {
  // Base scene
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, W, H);
  const grad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  grad.addColorStop(0, '#1a1a2e');
  grad.addColorStop(1, '#2d2d44');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, GROUND_Y);
  ctx.fillStyle = '#3a2e1e';
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
  ctx.fillStyle = '#5a4e3e';
  ctx.fillRect(0, GROUND_Y, W, 2);

  // Phase 0: Rumble + red tint
  if (cutscenePhase === 0) {
    const intensity = Math.sin(cutsceneTimer * 0.5) * 3;
    ctx.save();
    ctx.translate(intensity, Math.sin(cutsceneTimer * 0.7) * 2);
    // Red edge tint
    ctx.fillStyle = `rgba(255, 0, 0, ${0.05 + 0.05 * Math.sin(cutsceneTimer * 0.3)})`;
    ctx.fillRect(0, 0, W, H);
  }

  // Draw player (phases 0-3)
  if (cutscenePhase <= 3 && sprites.normal) {
    const px = cutscenePhase === 3 ? cutscenePlayerX : 16;
    const py = GROUND_Y - playerH;
    ctx.drawImage(sprites.normal, Math.round(px), py);

    // Motion trail in phase 3
    if (cutscenePhase === 3) {
      for (let i = 1; i <= 4; i++) {
        ctx.globalAlpha = 0.15 / i;
        ctx.drawImage(sprites.normal, Math.round(px + i * 12), py);
      }
      ctx.globalAlpha = 1;
    }
  }

  // Draw cutscene bugs
  for (const b of cutsceneBugs) {
    renderBug(ctx, { x: b.x, y: b.y, w: 20, h: 12, frame: b.frame, type: 'bug' });
  }

  // Draw boss bug
  if (cutsceneBossBug) {
    ctx.save();
    const bx = Math.round(cutsceneBossBug.x);
    const by = Math.round(cutsceneBossBug.y);
    const f = cutsceneBossBug.frame;

    // 4x scaled boss bug body
    ctx.fillStyle = '#1a0a00';
    ctx.fillRect(bx + 24, by + 16, 40, 24); // thorax
    ctx.fillRect(bx + 8, by + 16, 16, 16); // head

    // Armored shell highlights
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(bx + 26, by + 18, 36, 20);
    ctx.fillStyle = '#4a3a2a';
    ctx.fillRect(bx + 30, by + 20, 28, 16);

    // Glowing red eyes
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(bx + 8, by + 16, 6, 6);
    ctx.fillStyle = '#ff4444';
    ctx.fillRect(bx + 10, by + 18, 2, 2);

    // Mandibles
    ctx.fillStyle = '#2a1a0a';
    ctx.fillRect(bx, by + 24, 8, 4);
    ctx.fillRect(bx, by + 16, 8, 4);

    // Wings
    ctx.fillStyle = 'rgba(180, 200, 220, 0.5)';
    const wingUp = (f % 8) < 4;
    if (wingUp) {
      ctx.fillRect(bx + 32, by, 32, 16);
    } else {
      ctx.fillRect(bx + 32, by + 36, 32, 16);
    }

    ctx.restore();
  }

  if (cutscenePhase === 0) {
    ctx.restore();
  }

  // Phase 4: Fade to black with text
  if (cutscenePhase === 4) {
    const phaseDuration = 360; // frames for full phase 4
    const elapsed = cutsceneTimer - 540;
    const fadeProgress = Math.min(1, elapsed / 60); // fade to black in 1s
    ctx.fillStyle = `rgba(0, 0, 0, ${fadeProgress})`;
    ctx.fillRect(0, 0, W, H);

    if (elapsed > 40) {
      // Text fades in, holds, then fades out at end
      const textIn = Math.min(1, (elapsed - 40) / 40);
      const textOut = Math.max(0, 1 - (elapsed - (phaseDuration - 60)) / 60);
      ctx.globalAlpha = elapsed > phaseDuration - 60 ? textOut : textIn;
      ctx.font = 'bold 10px monospace';
      const text = 'Something stirs in the garden...';
      const tw = ctx.measureText(text).width;
      const tx = (W - tw) / 2;
      const ty = H / 2;
      // Text outline
      ctx.fillStyle = '#000000';
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          if (ox === 0 && oy === 0) continue;
          ctx.fillText(text, tx + ox, ty + oy);
        }
      }
      ctx.fillStyle = '#ff4444';
      ctx.fillText(text, tx, ty);
      ctx.globalAlpha = 1;
    }
  }
}

function endCutscene() {
  cutsceneActive = false;
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  const state = loadState();
  state.stats.tdUnlocked = true;
  saveState(state);

  // Return to plant screen and show toast
  if (onBackCallback) {
    onBackCallback();
  }
  // Show toast after a short delay to let screen transition happen
  setTimeout(() => {
    const toastEl = document.createElement('div');
    toastEl.className = 'toast toast-success';
    toastEl.textContent = 'New game mode unlocked: Stop the Bugs!';
    document.body.appendChild(toastEl);
    requestAnimationFrame(() => toastEl.classList.add('toast-visible'));
    setTimeout(() => {
      toastEl.classList.remove('toast-visible');
      setTimeout(() => toastEl.remove(), 300);
    }, 4000);
  }, 500);
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

    const prevExp = totalExp - runExpGained;
    let progressHtml = '';
    if (nextThreshold !== null) {
      const oldPct = Math.min(100, Math.max(0, Math.round(((prevExp - prevThreshold) / (nextThreshold - prevThreshold)) * 100)));
      const newPct = Math.min(100 - oldPct, Math.round((runExpGained / (nextThreshold - prevThreshold)) * 100));
      progressHtml = `
        <div class="mg-exp-progress">
          <div class="mg-exp-bar">
            <div class="mg-exp-bar-fill" style="width:${oldPct}%"></div>
            <div class="mg-exp-bar-new" style="width:${newPct}%"></div>
          </div>
          <span class="mg-exp-numbers">${prevExp} <span class="mg-exp-earned">+${runExpGained}</span> / ${nextThreshold} EXP</span>
        </div>`;
    } else {
      progressHtml = `<div class="mg-exp-numbers">${prevExp} <span class="mg-exp-earned">+${runExpGained}</span> EXP (MAX)</div>`;
    }

    expHtml = `
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

function tryShootProjectile() {
  if (!selectedPlant || !selectedPlant.potElement) return;
  if (projectileCooldown > 0) return;

  // Find nearest bug ahead of the player
  let nearestBug = null;
  let nearestDist = Infinity;
  for (const obs of obstacles) {
    if (obs.type !== 'bug') continue;
    const dx = obs.x - player.x;
    if (dx > 0 && dx < nearestDist) {
      nearestDist = dx;
      nearestBug = obs;
    }
  }
  if (!nearestBug) return;

  projectiles.push({
    x: player.x + playerW,
    y: player.y + playerH / 2,
    target: nearestBug,
    element: selectedPlant.potElement,
    age: 0,
  });
  projectileCooldown = 30;
}

function doJump() {
  if (player.grounded && !player.ducking) {
    player.vy = JUMP_VEL;
    player.jumping = true;
    player.grounded = false;
    tryShootProjectile();
  } else if (!player.grounded && abilityReady && abilityElement === 'wind' && !windUsedDoubleJump) {
    // Wind double jump
    player.vy = JUMP_VEL;
    windBugImmune = true;
    windUsedDoubleJump = true;
    abilityCharge = 0;
    abilityReady = false;
    tryShootProjectile();
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
