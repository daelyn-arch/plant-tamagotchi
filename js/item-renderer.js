// Pixel art renderer for items — each item type has a unique sprite
// that gets more detailed at higher rarities

import { createCanvas, setPixel, hsl } from './canvas-utils.js';
import { RARITY } from './plant-data.js';

const RARITY_DETAIL = {
  [RARITY.COMMON]: 0,
  [RARITY.UNCOMMON]: 1,
  [RARITY.RARE]: 2,
  [RARITY.EPIC]: 3,
  [RARITY.LEGENDARY]: 4,
};

const RARITY_GLOW = {
  [RARITY.COMMON]: null,
  [RARITY.UNCOMMON]: null,
  [RARITY.RARE]: null,
  [RARITY.EPIC]: null,
  [RARITY.LEGENDARY]: null,
};

// ── Sprite drawing helpers ──────────────────────────────────────

function fill(ctx, pixels, color) {
  ctx.fillStyle = color;
  for (const [x, y] of pixels) {
    ctx.fillRect(x, y, 1, 1);
  }
}

function outline(ctx, pixels, color) {
  ctx.fillStyle = color;
  const set = new Set(pixels.map(([x, y]) => `${x},${y}`));
  const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
  for (const [x, y] of pixels) {
    for (const [dx, dy] of dirs) {
      const key = `${x+dx},${y+dy}`;
      if (!set.has(key)) {
        ctx.fillRect(x+dx, y+dy, 1, 1);
      }
    }
  }
}

// ── Growth Surge (watering_boost) — Water droplet ───────────────

function drawGrowthSurge(ctx, size, detail) {
  const cx = Math.floor(size / 2);
  // Base droplet shape
  const base = '#4a9ade';
  const light = '#8acaff';
  const dark = '#2a6a9e';
  const white = '#e0f0ff';

  // Simple droplet
  fill(ctx, [[cx, 2], [cx-1, 3], [cx, 3], [cx+1, 3]], base);
  fill(ctx, [[cx-2, 4], [cx-1, 4], [cx, 4], [cx+1, 4], [cx+2, 4]], base);
  fill(ctx, [[cx-2, 5], [cx-1, 5], [cx, 5], [cx+1, 5], [cx+2, 5]], base);
  fill(ctx, [[cx-2, 6], [cx-1, 6], [cx, 6], [cx+1, 6], [cx+2, 6]], base);
  fill(ctx, [[cx-1, 7], [cx, 7], [cx+1, 7]], base);

  // Highlight
  fill(ctx, [[cx-1, 4], [cx-1, 5]], light);

  if (detail >= 1) {
    // Bigger droplet body
    fill(ctx, [[cx-3, 5], [cx+3, 5], [cx-3, 6], [cx+3, 6]], base);
    fill(ctx, [[cx, 1]], base);
    fill(ctx, [[cx-1, 8], [cx, 8], [cx+1, 8]], base);
    fill(ctx, [[cx-1, 3]], light);
    fill(ctx, [[cx+1, 6], [cx+1, 7]], dark);
  }
  if (detail >= 2) {
    // Sparkle highlight
    fill(ctx, [[cx-2, 4]], white);
    fill(ctx, [[cx+2, 7]], dark);
    // Small ripple at bottom
    fill(ctx, [[cx-2, 9], [cx+2, 9]], '#6ab4e8');
    fill(ctx, [[cx-1, 9], [cx, 9], [cx+1, 9]], '#6ab4e8');
  }
  if (detail >= 3) {
    // Inner glow streaks
    fill(ctx, [[cx-2, 5], [cx-2, 6]], light);
    fill(ctx, [[cx, 2]], white);
    // Outer sparkles
    fill(ctx, [[cx-4, 3], [cx+4, 4]], white);
    fill(ctx, [[cx+3, 8]], '#6ab4e8');
  }
  if (detail >= 4) {
    // Crown sparkle
    fill(ctx, [[cx, 0]], white);
    fill(ctx, [[cx-1, 1], [cx+1, 1]], light);
    // Multiple sparkle points
    fill(ctx, [[cx-5, 5], [cx+5, 6]], white);
    fill(ctx, [[cx-3, 2], [cx+3, 2]], '#b0d8ff');
    fill(ctx, [[cx-3, 9], [cx+3, 9]], '#b0d8ff');
  }
}

// ── Sun Stone (day_boost) — Glowing sun ─────────────────────────

function drawSunStone(ctx, size, detail) {
  const cx = Math.floor(size / 2);
  const cy = Math.floor(size / 2);
  const gold = '#e8c030';
  const bright = '#f0e060';
  const dark = '#c09020';
  const white = '#fffce0';

  // Core
  fill(ctx, [
    [cx-1, cy-1], [cx, cy-1], [cx+1, cy-1],
    [cx-1, cy], [cx, cy], [cx+1, cy],
    [cx-1, cy+1], [cx, cy+1], [cx+1, cy+1],
  ], gold);

  // Center highlight
  fill(ctx, [[cx, cy]], bright);

  // Basic rays (4 cardinal)
  fill(ctx, [[cx, cy-3], [cx, cy+3], [cx-3, cy], [cx+3, cy]], gold);

  if (detail >= 1) {
    fill(ctx, [[cx, cy-4], [cx, cy+4], [cx-4, cy], [cx+4, cy]], dark);
    fill(ctx, [[cx-1, cy], [cx, cy-1]], bright);
    // Diagonal stubs
    fill(ctx, [[cx-2, cy-2], [cx+2, cy-2], [cx-2, cy+2], [cx+2, cy+2]], gold);
  }
  if (detail >= 2) {
    // Longer diagonal rays
    fill(ctx, [[cx-3, cy-3], [cx+3, cy-3], [cx-3, cy+3], [cx+3, cy+3]], dark);
    // Inner glow
    fill(ctx, [[cx-2, cy-1], [cx+2, cy-1], [cx-2, cy+1], [cx+2, cy+1]], gold);
    fill(ctx, [[cx-1, cy-2], [cx+1, cy-2], [cx-1, cy+2], [cx+1, cy+2]], gold);
    fill(ctx, [[cx, cy]], white);
  }
  if (detail >= 3) {
    // Extended rays with tips
    fill(ctx, [[cx, cy-5], [cx, cy+5], [cx-5, cy], [cx+5, cy]], '#f0d050');
    fill(ctx, [[cx-4, cy-4], [cx+4, cy-4], [cx-4, cy+4], [cx+4, cy+4]], '#d0a020');
    fill(ctx, [[cx-1, cy-1], [cx+1, cy+1]], white);
  }
  if (detail >= 4) {
    // Corona glow pixels
    fill(ctx, [[cx-1, cy-5], [cx+1, cy-5], [cx-1, cy+5], [cx+1, cy+5]], '#f0e070');
    fill(ctx, [[cx-5, cy-1], [cx+5, cy-1], [cx-5, cy+1], [cx+5, cy+1]], '#f0e070');
    fill(ctx, [[cx, cy-6], [cx, cy+6], [cx-6, cy], [cx+6, cy]], '#e8d040');
    fill(ctx, [[cx-5, cy-5], [cx+5, cy-5], [cx-5, cy+5], [cx+5, cy+5]], '#c09020');
  }
}

// ── Rain Charm (auto_water) — Cloud with rain ───────────────────

function drawRainCharm(ctx, size, detail) {
  const cx = Math.floor(size / 2);
  const cloud = '#d0d8e0';
  const cloudDark = '#a0a8b0';
  const rain = '#6ab4e8';
  const white = '#f0f4f8';

  // Cloud body
  fill(ctx, [
    [cx-2, 3], [cx-1, 3], [cx, 3], [cx+1, 3], [cx+2, 3],
    [cx-3, 4], [cx-2, 4], [cx-1, 4], [cx, 4], [cx+1, 4], [cx+2, 4], [cx+3, 4],
    [cx-3, 5], [cx-2, 5], [cx-1, 5], [cx, 5], [cx+1, 5], [cx+2, 5], [cx+3, 5],
  ], cloud);
  // Cloud top bumps
  fill(ctx, [[cx-1, 2], [cx, 2], [cx+1, 2]], cloud);
  fill(ctx, [[cx+2, 3]], cloud);

  // Shadow
  fill(ctx, [[cx-3, 5], [cx-2, 5], [cx+2, 5], [cx+3, 5]], cloudDark);

  // Rain drops
  fill(ctx, [[cx-2, 7], [cx, 7], [cx+2, 7]], rain);

  if (detail >= 1) {
    fill(ctx, [[cx-2, 2], [cx+2, 2]], cloud);
    fill(ctx, [[cx, 1]], cloud);
    fill(ctx, [[cx-1, 8], [cx+1, 8]], rain);
    fill(ctx, [[cx, 3]], white);
  }
  if (detail >= 2) {
    fill(ctx, [[cx-3, 8], [cx+3, 8]], rain);
    fill(ctx, [[cx-2, 9], [cx, 9], [cx+2, 9]], rain);
    fill(ctx, [[cx-1, 3], [cx, 2]], white);
    fill(ctx, [[cx+3, 3], [cx-3, 3]], cloud);
  }
  if (detail >= 3) {
    // Lightning bolt
    fill(ctx, [[cx+1, 6], [cx, 7], [cx+1, 7], [cx, 8], [cx-1, 9]], '#f0e060');
    fill(ctx, [[cx-4, 4], [cx+4, 4]], cloud);
    fill(ctx, [[cx-4, 5], [cx+4, 5]], cloudDark);
  }
  if (detail >= 4) {
    // Wind streaks
    fill(ctx, [[cx-5, 3], [cx-5, 4]], '#c8d0d8');
    fill(ctx, [[cx+5, 3], [cx+5, 4]], '#c8d0d8');
    // Extra rain
    fill(ctx, [[cx-3, 10], [cx-1, 10], [cx+1, 10], [cx+3, 10]], rain);
    // Cloud highlight
    fill(ctx, [[cx-1, 1], [cx+1, 1]], white);
  }
}

// ── Prism Shard (art_reroll) — Crystal/prism ────────────────────

function drawPrismShard(ctx, size, detail) {
  const cx = Math.floor(size / 2);
  const crystal = '#a080d0';
  const light = '#c8a8f0';
  const dark = '#7060a0';
  const white = '#e8d8ff';
  const rainbow = ['#ff6060', '#f0a030', '#e0e040', '#60c060', '#6090e0', '#a060d0'];

  // Crystal shape
  fill(ctx, [[cx, 1], [cx, 2]], crystal);
  fill(ctx, [[cx-1, 3], [cx, 3], [cx+1, 3]], crystal);
  fill(ctx, [[cx-1, 4], [cx, 4], [cx+1, 4]], crystal);
  fill(ctx, [[cx-2, 5], [cx-1, 5], [cx, 5], [cx+1, 5], [cx+2, 5]], crystal);
  fill(ctx, [[cx-2, 6], [cx-1, 6], [cx, 6], [cx+1, 6], [cx+2, 6]], crystal);
  fill(ctx, [[cx-1, 7], [cx, 7], [cx+1, 7]], crystal);
  fill(ctx, [[cx, 8]], crystal);

  // Facet highlights
  fill(ctx, [[cx-1, 4], [cx-1, 5]], light);
  fill(ctx, [[cx+1, 5], [cx+1, 6]], dark);

  if (detail >= 1) {
    fill(ctx, [[cx, 0]], crystal);
    fill(ctx, [[cx-3, 6], [cx+3, 6]], crystal);
    fill(ctx, [[cx-2, 7], [cx+2, 7]], crystal);
    fill(ctx, [[cx, 3]], white);
    fill(ctx, [[cx+2, 6]], dark);
  }
  if (detail >= 2) {
    // Rainbow refraction
    fill(ctx, [[cx+3, 3]], rainbow[0]);
    fill(ctx, [[cx+4, 4]], rainbow[1]);
    fill(ctx, [[cx+4, 5]], rainbow[2]);
    fill(ctx, [[cx+3, 7]], rainbow[3]);
    fill(ctx, [[cx-3, 5]], rainbow[4]);
    fill(ctx, [[cx-3, 4]], rainbow[5]);
  }
  if (detail >= 3) {
    // Longer rainbow arc
    fill(ctx, [[cx+5, 3]], rainbow[0]);
    fill(ctx, [[cx+5, 4]], rainbow[1]);
    fill(ctx, [[cx+5, 5]], rainbow[2]);
    fill(ctx, [[cx+5, 6]], rainbow[3]);
    fill(ctx, [[cx+4, 7]], rainbow[4]);
    fill(ctx, [[cx-4, 4]], rainbow[5]);
    fill(ctx, [[cx-4, 5]], rainbow[4]);
    fill(ctx, [[cx-4, 6]], rainbow[3]);
    fill(ctx, [[cx, 2]], white);
  }
  if (detail >= 4) {
    // Sparkle stars around crystal
    fill(ctx, [[cx-5, 2], [cx+5, 1]], white);
    fill(ctx, [[cx-4, 8], [cx+4, 8]], white);
    fill(ctx, [[cx-6, 5], [cx+6, 5]], '#d0c0f0');
    // Inner shine
    fill(ctx, [[cx-1, 5], [cx, 4]], white);
    fill(ctx, [[cx, 9]], dark);
    fill(ctx, [[cx-1, 8], [cx+1, 8]], crystal);
  }
}

// ── Fertile Soil (garden_upgrade) — Bag of soil/seeds ───────────

function drawFertileSoil(ctx, size, detail) {
  const cx = Math.floor(size / 2);
  const bag = '#8a6a3a';
  const bagLight = '#a88a5a';
  const bagDark = '#6a4a2a';
  const soil = '#4a3020';
  const green = '#5a9a3a';
  const white = '#e8e0cc';

  // Bag body
  fill(ctx, [
    [cx-2, 3], [cx-1, 3], [cx, 3], [cx+1, 3], [cx+2, 3],
    [cx-3, 4], [cx-2, 4], [cx-1, 4], [cx, 4], [cx+1, 4], [cx+2, 4], [cx+3, 4],
    [cx-3, 5], [cx-2, 5], [cx-1, 5], [cx, 5], [cx+1, 5], [cx+2, 5], [cx+3, 5],
    [cx-3, 6], [cx-2, 6], [cx-1, 6], [cx, 6], [cx+1, 6], [cx+2, 6], [cx+3, 6],
    [cx-3, 7], [cx-2, 7], [cx-1, 7], [cx, 7], [cx+1, 7], [cx+2, 7], [cx+3, 7],
    [cx-2, 8], [cx-1, 8], [cx, 8], [cx+1, 8], [cx+2, 8],
  ], bag);

  // Bag tie
  fill(ctx, [[cx-1, 2], [cx, 2], [cx+1, 2]], bagDark);
  fill(ctx, [[cx, 1]], bagDark);

  // Soil visible at top
  fill(ctx, [[cx-1, 3], [cx, 3], [cx+1, 3]], soil);

  // Highlight
  fill(ctx, [[cx-2, 4], [cx-2, 5]], bagLight);

  if (detail >= 1) {
    // Sprout on top
    fill(ctx, [[cx, 0]], green);
    fill(ctx, [[cx-1, 1]], green);
    fill(ctx, [[cx+1, 1]], green);
    fill(ctx, [[cx-3, 8], [cx+3, 8]], bag);
    fill(ctx, [[cx+2, 5], [cx+2, 6]], bagDark);
  }
  if (detail >= 2) {
    // Leaf detail
    fill(ctx, [[cx+1, 0]], green);
    fill(ctx, [[cx-1, 0]], '#7ac050');
    // Soil texture dots
    fill(ctx, [[cx-1, 5], [cx+1, 6]], '#5a4030');
    // Bag stitch
    fill(ctx, [[cx, 5], [cx, 7]], white);
  }
  if (detail >= 3) {
    // Multiple sprouts
    fill(ctx, [[cx-2, 1], [cx+2, 1]], green);
    fill(ctx, [[cx-2, 0]], '#7ac050');
    // Sparkle on soil
    fill(ctx, [[cx, 3]], '#8a7050');
    fill(ctx, [[cx-3, 5], [cx+3, 5]], bagLight);
    fill(ctx, [[cx-4, 5], [cx+4, 5], [cx-4, 6], [cx+4, 6]], bag);
  }
  if (detail >= 4) {
    // Golden glow particles
    fill(ctx, [[cx-5, 2], [cx+5, 2]], '#e8c030');
    fill(ctx, [[cx-4, 0], [cx+4, 0]], '#e8c030');
    fill(ctx, [[cx-5, 7], [cx+5, 7]], '#e8c030');
    // Rich soil texture
    fill(ctx, [[cx-2, 6], [cx+1, 5]], '#3a2010');
    fill(ctx, [[cx-4, 7], [cx+4, 7], [cx-4, 8], [cx+4, 8]], bag);
  }
}

// ── Fusion Seed (plant_combine) — DNA helix / seed ──────────────

function drawFusionSeed(ctx, size, detail) {
  const cx = Math.floor(size / 2);
  const seedA = '#c0c8d4';
  const seedB = '#9ab4cc';
  const dark = '#708090';
  const glow = '#e0e8f0';
  const gold = '#e8c030';

  // Seed shape
  fill(ctx, [[cx, 1], [cx, 2]], seedA);
  fill(ctx, [[cx-1, 3], [cx, 3], [cx+1, 3]], seedA);
  fill(ctx, [[cx-2, 4], [cx-1, 4], [cx, 4], [cx+1, 4], [cx+2, 4]], seedA);
  fill(ctx, [[cx-2, 5], [cx-1, 5], [cx, 5], [cx+1, 5], [cx+2, 5]], seedA);
  fill(ctx, [[cx-1, 6], [cx, 6], [cx+1, 6]], seedA);
  fill(ctx, [[cx, 7]], seedA);

  // Inner swirl
  fill(ctx, [[cx-1, 4], [cx, 5]], seedB);
  fill(ctx, [[cx+1, 4], [cx, 3]], dark);

  if (detail >= 1) {
    fill(ctx, [[cx-1, 5], [cx+1, 5]], seedB);
    fill(ctx, [[cx, 2]], glow);
    fill(ctx, [[cx-2, 6], [cx+2, 6]], seedA);
    fill(ctx, [[cx, 8]], seedA);
  }
  if (detail >= 2) {
    // Double helix hint
    fill(ctx, [[cx-3, 4], [cx+3, 5]], seedB);
    fill(ctx, [[cx+3, 4], [cx-3, 5]], dark);
    fill(ctx, [[cx, 0]], seedA);
    fill(ctx, [[cx-1, 2]], glow);
  }
  if (detail >= 3) {
    // Energy arc
    fill(ctx, [[cx-4, 3], [cx-4, 4], [cx-4, 5]], '#a0b8d0');
    fill(ctx, [[cx+4, 3], [cx+4, 4], [cx+4, 5]], '#a0b8d0');
    fill(ctx, [[cx-3, 2], [cx+3, 2]], '#a0b8d0');
    fill(ctx, [[cx-3, 7], [cx+3, 7]], '#a0b8d0');
    fill(ctx, [[cx, 4]], glow);
  }
  if (detail >= 4) {
    // Golden fusion aura
    fill(ctx, [[cx-5, 4], [cx+5, 4]], gold);
    fill(ctx, [[cx-5, 5], [cx+5, 5]], gold);
    fill(ctx, [[cx-4, 2], [cx+4, 2]], gold);
    fill(ctx, [[cx-4, 7], [cx+4, 7]], gold);
    fill(ctx, [[cx, 0]], glow);
    fill(ctx, [[cx, 9]], seedA);
    fill(ctx, [[cx-1, 8], [cx+1, 8]], seedA);
  }
}

// ── Life Spark (animate) — Sparkly face/star ────────────────────

function drawLifeSpark(ctx, size, detail) {
  const cx = Math.floor(size / 2);
  const cy = Math.floor(size / 2);
  const spark = '#f0d060';
  const bright = '#fff8c0';
  const warm = '#e0a030';
  const pink = '#f08080';

  // Central spark
  fill(ctx, [[cx, cy]], bright);
  fill(ctx, [[cx-1, cy], [cx+1, cy], [cx, cy-1], [cx, cy+1]], spark);

  // Cross rays
  fill(ctx, [[cx, cy-2], [cx, cy+2], [cx-2, cy], [cx+2, cy]], spark);

  // Small diagonal
  fill(ctx, [[cx-1, cy-1], [cx+1, cy-1], [cx-1, cy+1], [cx+1, cy+1]], warm);

  if (detail >= 1) {
    fill(ctx, [[cx, cy-3], [cx, cy+3], [cx-3, cy], [cx+3, cy]], warm);
    fill(ctx, [[cx-1, cy], [cx, cy-1]], bright);
    // Tiny eyes hint
    fill(ctx, [[cx-1, cy+2], [cx+1, cy+2]], '#402020');
  }
  if (detail >= 2) {
    // Face emerges
    fill(ctx, [[cx-2, cy+1], [cx+2, cy+1]], pink);
    // Sparkle tips
    fill(ctx, [[cx-2, cy-2], [cx+2, cy-2], [cx-2, cy+2], [cx+2, cy+2]], spark);
    fill(ctx, [[cx, cy-4], [cx, cy+4], [cx-4, cy], [cx+4, cy]], '#d0b040');
  }
  if (detail >= 3) {
    // Longer rays
    fill(ctx, [[cx, cy-5], [cx, cy+5], [cx-5, cy], [cx+5, cy]], '#c0a030');
    fill(ctx, [[cx-3, cy-3], [cx+3, cy-3], [cx-3, cy+3], [cx+3, cy+3]], warm);
    // Cheek blush
    fill(ctx, [[cx-2, cy+1]], '#f0a0a0');
    fill(ctx, [[cx+2, cy+1]], '#f0a0a0');
  }
  if (detail >= 4) {
    // Full sparkle corona
    fill(ctx, [[cx-4, cy-4], [cx+4, cy-4], [cx-4, cy+4], [cx+4, cy+4]], '#d0a020');
    fill(ctx, [[cx, cy-6], [cx, cy+6], [cx-6, cy], [cx+6, cy]], spark);
    // Heart above
    fill(ctx, [[cx-1, cy-5], [cx+1, cy-5]], pink);
    fill(ctx, [[cx, cy-4]], pink);
  }
}

// ── Plant Seed (seed) — Oval seed with sprout ────────────────────

function drawSeed(ctx, size, detail) {
  const cx = Math.floor(size / 2);
  const brown = '#8a6030';
  const brownLight = '#b08050';
  const brownDark = '#5a3a18';
  const green = '#5a9a3a';
  const greenLight = '#7ac050';
  const white = '#f0e8d0';
  const gold = '#e8c030';

  // Base oval seed shape
  fill(ctx, [[cx, 2]], brown);
  fill(ctx, [[cx-1, 3], [cx, 3], [cx+1, 3]], brown);
  fill(ctx, [[cx-2, 4], [cx-1, 4], [cx, 4], [cx+1, 4], [cx+2, 4]], brown);
  fill(ctx, [[cx-2, 5], [cx-1, 5], [cx, 5], [cx+1, 5], [cx+2, 5]], brown);
  fill(ctx, [[cx-2, 6], [cx-1, 6], [cx, 6], [cx+1, 6], [cx+2, 6]], brown);
  fill(ctx, [[cx-1, 7], [cx, 7], [cx+1, 7]], brown);
  fill(ctx, [[cx, 8]], brown);

  // Highlight stripe
  fill(ctx, [[cx-1, 4], [cx-1, 5]], brownLight);
  // Shadow
  fill(ctx, [[cx+1, 6], [cx+1, 7]], brownDark);
  // Seed seam line
  fill(ctx, [[cx, 3], [cx, 4], [cx, 5], [cx, 6], [cx, 7]], brownDark);

  if (detail >= 1) {
    // Wider seed body
    fill(ctx, [[cx-3, 5], [cx+3, 5], [cx-3, 6], [cx+3, 6]], brown);
    fill(ctx, [[cx-2, 7], [cx+2, 7]], brown);
    fill(ctx, [[cx-1, 8], [cx+1, 8]], brown);
    fill(ctx, [[cx-2, 4]], brownLight);
    fill(ctx, [[cx+2, 6]], brownDark);
  }
  if (detail >= 2) {
    // Small sprout on top
    fill(ctx, [[cx, 1]], green);
    fill(ctx, [[cx-1, 0], [cx+1, 1]], greenLight);
    // Texture dots
    fill(ctx, [[cx-1, 6]], '#7a5028');
    fill(ctx, [[cx+1, 4]], '#7a5028');
  }
  if (detail >= 3) {
    // Larger sprout with two leaves
    fill(ctx, [[cx, 0]], green);
    fill(ctx, [[cx-1, 0]], greenLight);
    fill(ctx, [[cx+1, 0]], green);
    fill(ctx, [[cx-2, 0]], greenLight);
    fill(ctx, [[cx+2, 0]], green);
    fill(ctx, [[cx-1, 1], [cx+1, 1]], green);
    // Glow at base
    fill(ctx, [[cx, 2]], brownLight);
    fill(ctx, [[cx-3, 4], [cx+3, 4]], brown);
  }
  if (detail >= 4) {
    // Full sprout + golden glow particles
    fill(ctx, [[cx-3, 0]], greenLight);
    fill(ctx, [[cx+3, 0]], green);
    fill(ctx, [[cx, -1]], greenLight);
    // Golden aura
    fill(ctx, [[cx-4, 3], [cx+4, 3]], gold);
    fill(ctx, [[cx-4, 7], [cx+4, 7]], gold);
    fill(ctx, [[cx-5, 5], [cx+5, 5]], gold);
    // Sparkle
    fill(ctx, [[cx-3, 1], [cx+3, 1]], white);
    fill(ctx, [[cx, 9]], brownDark);
  }
}

// ── Ember Crown (pot_fire) — Flame-topped crown ──────────────────

function drawEmberCrown(ctx, size, detail) {
  const cx = Math.floor(size / 2);
  const red = '#c02020';
  const orange = '#e06020';
  const yellow = '#f0c040';
  const dark = '#801010';
  const white = '#fff0c0';

  // Crown base
  fill(ctx, [
    [cx-3, 7], [cx-2, 7], [cx-1, 7], [cx, 7], [cx+1, 7], [cx+2, 7], [cx+3, 7],
    [cx-3, 8], [cx-2, 8], [cx-1, 8], [cx, 8], [cx+1, 8], [cx+2, 8], [cx+3, 8],
    [cx-2, 9], [cx-1, 9], [cx, 9], [cx+1, 9], [cx+2, 9],
  ], red);

  // Crown points
  fill(ctx, [[cx-3, 6], [cx, 5], [cx+3, 6]], orange);
  fill(ctx, [[cx-2, 5], [cx+2, 5]], orange);

  // Flames on tips
  fill(ctx, [[cx, 3], [cx, 4]], yellow);
  fill(ctx, [[cx-3, 5]], orange);
  fill(ctx, [[cx+3, 5]], orange);

  // Highlight
  fill(ctx, [[cx-1, 7], [cx, 7]], orange);

  if (detail >= 1) {
    fill(ctx, [[cx-2, 4], [cx+2, 4]], yellow);
    fill(ctx, [[cx, 2]], yellow);
    fill(ctx, [[cx-4, 7], [cx+4, 7]], dark);
    fill(ctx, [[cx-1, 8]], orange);
  }
  if (detail >= 2) {
    fill(ctx, [[cx-3, 4], [cx+3, 4]], orange);
    fill(ctx, [[cx-1, 3], [cx+1, 3]], yellow);
    fill(ctx, [[cx, 1]], white);
    fill(ctx, [[cx-4, 8], [cx+4, 8]], red);
  }
  if (detail >= 3) {
    fill(ctx, [[cx-4, 6], [cx+4, 6]], dark);
    fill(ctx, [[cx-2, 3], [cx+2, 3]], orange);
    fill(ctx, [[cx-1, 2], [cx+1, 2]], yellow);
    fill(ctx, [[cx, 0]], white);
  }
  if (detail >= 4) {
    fill(ctx, [[cx-5, 7], [cx+5, 7]], dark);
    fill(ctx, [[cx-4, 5], [cx+4, 5]], orange);
    fill(ctx, [[cx-3, 3], [cx+3, 3]], yellow);
    fill(ctx, [[cx-1, 1], [cx+1, 1]], white);
    fill(ctx, [[cx-5, 4], [cx+5, 4]], '#f08030');
  }
}

// ── Frost Shard (pot_ice) — Ice crystal ──────────────────────────

function drawFrostShard(ctx, size, detail) {
  const cx = Math.floor(size / 2);
  const blue = '#3080c0';
  const cyan = '#60c0e0';
  const light = '#a0e0ff';
  const white = '#e0f4ff';
  const dark = '#1a5080';

  // Central crystal body
  fill(ctx, [[cx, 1], [cx, 2]], cyan);
  fill(ctx, [[cx-1, 3], [cx, 3], [cx+1, 3]], blue);
  fill(ctx, [[cx-1, 4], [cx, 4], [cx+1, 4]], blue);
  fill(ctx, [[cx-2, 5], [cx-1, 5], [cx, 5], [cx+1, 5], [cx+2, 5]], blue);
  fill(ctx, [[cx-2, 6], [cx-1, 6], [cx, 6], [cx+1, 6], [cx+2, 6]], blue);
  fill(ctx, [[cx-1, 7], [cx, 7], [cx+1, 7]], blue);
  fill(ctx, [[cx, 8]], blue);

  // Facet highlights
  fill(ctx, [[cx-1, 4], [cx-1, 5]], light);
  fill(ctx, [[cx+1, 6], [cx+1, 7]], dark);
  fill(ctx, [[cx, 3]], white);

  if (detail >= 1) {
    fill(ctx, [[cx-3, 5], [cx+3, 6]], cyan);
    fill(ctx, [[cx-3, 6], [cx+3, 5]], cyan);
    fill(ctx, [[cx, 0]], light);
    fill(ctx, [[cx-2, 7], [cx+2, 7]], blue);
  }
  if (detail >= 2) {
    // Side crystal branches
    fill(ctx, [[cx-4, 4], [cx+4, 4]], cyan);
    fill(ctx, [[cx-4, 5], [cx+4, 5]], light);
    fill(ctx, [[cx, 2]], white);
    fill(ctx, [[cx-2, 4]], light);
  }
  if (detail >= 3) {
    fill(ctx, [[cx-5, 3], [cx+5, 3]], cyan);
    fill(ctx, [[cx-5, 5], [cx+5, 5]], light);
    fill(ctx, [[cx-3, 2], [cx+3, 2]], cyan);
    fill(ctx, [[cx-4, 7], [cx+4, 7]], dark);
    fill(ctx, [[cx, 4]], white);
  }
  if (detail >= 4) {
    fill(ctx, [[cx-6, 4], [cx+6, 4]], light);
    fill(ctx, [[cx-5, 2], [cx+5, 2]], white);
    fill(ctx, [[cx-4, 0], [cx+4, 0]], light);
    fill(ctx, [[cx-3, 8], [cx+3, 8]], cyan);
    fill(ctx, [[cx, 9]], dark);
  }
}

// ── Stone Heart (pot_earth) — Rock/geode ──────────────────────────

function drawStoneHeart(ctx, size, detail) {
  const cx = Math.floor(size / 2);
  const brown = '#6a5030';
  const gray = '#808080';
  const dark = '#3a2a18';
  const amber = '#c09040';
  const light = '#a0a0a0';

  // Rock body
  fill(ctx, [[cx-1, 2], [cx, 2], [cx+1, 2]], gray);
  fill(ctx, [[cx-2, 3], [cx-1, 3], [cx, 3], [cx+1, 3], [cx+2, 3]], brown);
  fill(ctx, [[cx-3, 4], [cx-2, 4], [cx-1, 4], [cx, 4], [cx+1, 4], [cx+2, 4], [cx+3, 4]], brown);
  fill(ctx, [[cx-3, 5], [cx-2, 5], [cx-1, 5], [cx, 5], [cx+1, 5], [cx+2, 5], [cx+3, 5]], brown);
  fill(ctx, [[cx-3, 6], [cx-2, 6], [cx-1, 6], [cx, 6], [cx+1, 6], [cx+2, 6], [cx+3, 6]], brown);
  fill(ctx, [[cx-2, 7], [cx-1, 7], [cx, 7], [cx+1, 7], [cx+2, 7]], gray);
  fill(ctx, [[cx-1, 8], [cx, 8], [cx+1, 8]], gray);

  // Inner geode crystals
  fill(ctx, [[cx-1, 4], [cx, 5]], amber);
  fill(ctx, [[cx+1, 4]], amber);

  // Shadow/highlight
  fill(ctx, [[cx-2, 3], [cx-3, 4]], dark);
  fill(ctx, [[cx+2, 6], [cx+2, 7]], dark);
  fill(ctx, [[cx-1, 3]], light);

  if (detail >= 1) {
    fill(ctx, [[cx-4, 5], [cx+4, 5]], brown);
    fill(ctx, [[cx-4, 6], [cx+4, 6]], dark);
    fill(ctx, [[cx, 4]], '#e0b050');
    fill(ctx, [[cx-1, 5]], amber);
  }
  if (detail >= 2) {
    fill(ctx, [[cx+1, 5]], '#e0b050');
    fill(ctx, [[cx-2, 4]], gray);
    fill(ctx, [[cx, 1]], gray);
    fill(ctx, [[cx-3, 7], [cx+3, 7]], brown);
    fill(ctx, [[cx, 6]], amber);
  }
  if (detail >= 3) {
    fill(ctx, [[cx-5, 5], [cx+5, 5]], dark);
    fill(ctx, [[cx-4, 4], [cx+4, 4]], brown);
    fill(ctx, [[cx-1, 4]], '#f0c860');
    fill(ctx, [[cx+1, 5]], '#f0c860');
    fill(ctx, [[cx-3, 3], [cx+3, 3]], gray);
  }
  if (detail >= 4) {
    fill(ctx, [[cx-5, 4], [cx+5, 4]], dark);
    fill(ctx, [[cx-5, 6], [cx+5, 6]], dark);
    fill(ctx, [[cx-4, 3], [cx+4, 3]], brown);
    fill(ctx, [[cx, 0]], light);
    fill(ctx, [[cx-1, 1], [cx+1, 1]], gray);
    fill(ctx, [[cx, 5]], '#f0d870');
  }
}

// ── Gale Feather (pot_wind) — Swirl/feather ──────────────────────

function drawGaleFeather(ctx, size, detail) {
  const cx = Math.floor(size / 2);
  const teal = '#40a090';
  const light = '#80d0c0';
  const white = '#d0f0e8';
  const green = '#308060';
  const dark = '#206050';

  // Feather shaft
  fill(ctx, [[cx, 1], [cx, 2], [cx, 3], [cx, 4], [cx, 5], [cx, 6], [cx, 7], [cx, 8]], teal);

  // Feather barbs — left
  fill(ctx, [[cx-1, 2], [cx-2, 3], [cx-3, 4]], light);
  fill(ctx, [[cx-1, 5], [cx-2, 6]], light);

  // Feather barbs — right
  fill(ctx, [[cx+1, 3], [cx+2, 4], [cx+3, 5]], light);
  fill(ctx, [[cx+1, 6], [cx+2, 7]], light);

  // Tip
  fill(ctx, [[cx, 0]], white);

  if (detail >= 1) {
    fill(ctx, [[cx-1, 3], [cx-2, 4], [cx-3, 5]], green);
    fill(ctx, [[cx+1, 4], [cx+2, 5], [cx+3, 6]], green);
    fill(ctx, [[cx-4, 5], [cx+4, 6]], teal);
    fill(ctx, [[cx-1, 1]], white);
  }
  if (detail >= 2) {
    // Swirl motif
    fill(ctx, [[cx+1, 1], [cx+2, 2]], light);
    fill(ctx, [[cx-1, 7], [cx-2, 8]], light);
    fill(ctx, [[cx-4, 4]], teal);
    fill(ctx, [[cx+4, 7]], teal);
    fill(ctx, [[cx, 9]], dark);
  }
  if (detail >= 3) {
    fill(ctx, [[cx-5, 5], [cx+5, 6]], green);
    fill(ctx, [[cx-4, 3], [cx+4, 4]], light);
    fill(ctx, [[cx-3, 2], [cx+3, 3]], white);
    fill(ctx, [[cx+1, 8], [cx+2, 9]], green);
  }
  if (detail >= 4) {
    fill(ctx, [[cx-6, 5], [cx+6, 6]], dark);
    fill(ctx, [[cx-5, 4], [cx+5, 5]], teal);
    fill(ctx, [[cx-4, 2], [cx+4, 3]], light);
    fill(ctx, [[cx-1, 0], [cx+1, 0]], white);
    fill(ctx, [[cx-3, 8], [cx+3, 9]], teal);
  }
}

// ── Dispatch ────────────────────────────────────────────────────

const RENDERERS = {
  watering_boost: drawGrowthSurge,
  day_boost: drawSunStone,
  auto_water: drawRainCharm,
  art_reroll: drawPrismShard,
  garden_upgrade: drawFertileSoil,
  plant_combine: drawFusionSeed,
  animate: drawLifeSpark,
  seed: drawSeed,
  pot_fire: drawEmberCrown,
  pot_ice: drawFrostShard,
  pot_earth: drawStoneHeart,
  pot_wind: drawGaleFeather,
};

/**
 * Render an item's pixel art icon to a canvas element.
 * @param {string} type — item type key
 * @param {string} rarity — rarity string
 * @param {number} scale — display scale multiplier (default 4)
 * @returns {HTMLCanvasElement}
 */
export function renderItemIcon(type, rarity, scale = 4) {
  const pixelSize = 13;
  const detail = RARITY_DETAIL[rarity] ?? 0;
  const { canvas: src, ctx } = createCanvas(pixelSize, pixelSize);

  const renderer = RENDERERS[type];
  if (renderer) {
    renderer(ctx, pixelSize, detail);
  }

  // Scale up to display canvas
  const displayW = pixelSize * scale;
  const displayH = pixelSize * scale;
  const display = document.createElement('canvas');
  display.width = displayW;
  display.height = displayH;
  display.style.imageRendering = 'pixelated';
  display.className = 'item-pixel-icon';
  const dctx = display.getContext('2d');
  dctx.imageSmoothingEnabled = false;
  dctx.drawImage(src, 0, 0, displayW, displayH);

  // Add rarity glow overlay
  const glow = RARITY_GLOW[rarity];
  if (glow) {
    dctx.fillStyle = glow;
    dctx.fillRect(0, 0, displayW, displayH);
  }

  return display;
}
