// Pixel art renderer for items — Pokemon evolution style
// Each rarity tier is a bigger, more evolved version of the item

import { createCanvas, setPixel, hsl } from './canvas-utils.js';
import { RARITY } from './plant-data.js';

const RARITY_DETAIL = {
  [RARITY.COMMON]: 0,
  [RARITY.UNCOMMON]: 1,
  [RARITY.RARE]: 2,
  [RARITY.EPIC]: 3,
  [RARITY.LEGENDARY]: 4,
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
      if (!set.has(`${x+dx},${y+dy}`)) {
        ctx.fillRect(x+dx, y+dy, 1, 1);
      }
    }
  }
}

function ellipse(ctx, cx, cy, rx, ry, color) {
  ctx.fillStyle = color;
  for (let dy = -ry; dy <= ry; dy++) {
    for (let dx = -rx; dx <= rx; dx++) {
      if ((dx*dx)/(rx*rx) + (dy*dy)/(ry*ry) <= 1) {
        ctx.fillRect(cx+dx, cy+dy, 1, 1);
      }
    }
  }
}

function groundShadow(ctx, cx, y, rx) {
  ellipse(ctx, cx, y, rx, 1, 'rgba(0,0,0,0.15)');
}

// ── Growth Surge (watering_boost) — Water droplet evolves ─────────

function drawGrowthSurge(ctx, size, detail) {
  const cx = 8;

  if (detail === 0) {
    // Common: tiny droplet
    groundShadow(ctx, cx, 12, 2);
    const body = [
      [cx, 6],
      [cx-1, 7], [cx, 7], [cx+1, 7],
      [cx-1, 8], [cx, 8], [cx+1, 8],
      [cx, 9],
    ];
    outline(ctx, body, '#1a4a6a');
    fill(ctx, body, '#4a9ade');
    fill(ctx, [[cx-1, 7]], '#6abaee');
    fill(ctx, [[cx, 6]], '#7ac8ff');
    return;
  }

  if (detail === 1) {
    // Uncommon: medium drop with highlight
    groundShadow(ctx, cx, 13, 2);
    const body = [
      [cx, 4],
      [cx-1, 5], [cx, 5], [cx+1, 5],
      [cx-2, 6], [cx-1, 6], [cx, 6], [cx+1, 6], [cx+2, 6],
      [cx-2, 7], [cx-1, 7], [cx, 7], [cx+1, 7], [cx+2, 7],
      [cx-2, 8], [cx-1, 8], [cx, 8], [cx+1, 8], [cx+2, 8],
      [cx-1, 9], [cx, 9], [cx+1, 9],
      [cx, 10],
    ];
    outline(ctx, body, '#1a4a6a');
    fill(ctx, body, '#4a9ade');
    fill(ctx, [[cx-1, 6], [cx-2, 7], [cx-1, 5]], '#6abaee');
    fill(ctx, [[cx+1, 8], [cx+2, 8], [cx+1, 9]], '#2a7abe');
    fill(ctx, [[cx, 5], [cx-1, 6]], '#7ac8ff');
    fill(ctx, [[cx, 4]], '#b0dcff');
    return;
  }

  if (detail === 2) {
    // Rare: large drop with shine streak
    groundShadow(ctx, cx, 14, 3);
    const body = [
      [cx, 2],
      [cx-1, 3], [cx, 3], [cx+1, 3],
      [cx-2, 4], [cx-1, 4], [cx, 4], [cx+1, 4], [cx+2, 4],
      [cx-3, 5], [cx-2, 5], [cx-1, 5], [cx, 5], [cx+1, 5], [cx+2, 5], [cx+3, 5],
      [cx-3, 6], [cx-2, 6], [cx-1, 6], [cx, 6], [cx+1, 6], [cx+2, 6], [cx+3, 6],
      [cx-3, 7], [cx-2, 7], [cx-1, 7], [cx, 7], [cx+1, 7], [cx+2, 7], [cx+3, 7],
      [cx-3, 8], [cx-2, 8], [cx-1, 8], [cx, 8], [cx+1, 8], [cx+2, 8], [cx+3, 8],
      [cx-2, 9], [cx-1, 9], [cx, 9], [cx+1, 9], [cx+2, 9],
      [cx-1, 10], [cx, 10], [cx+1, 10],
      [cx, 11],
    ];
    outline(ctx, body, '#1a4a6a');
    fill(ctx, body, '#4a9ade');
    fill(ctx, [[cx-2, 5], [cx-3, 6], [cx-3, 7], [cx-2, 4], [cx-2, 6]], '#6abaee');
    fill(ctx, [[cx+2, 7], [cx+3, 7], [cx+3, 8], [cx+2, 9], [cx+1, 10], [cx, 11]], '#2a7abe');
    fill(ctx, [[cx-1, 4], [cx-1, 5], [cx, 4]], '#7ac8ff');
    fill(ctx, [[cx-1, 4]], '#b0e0ff');
    fill(ctx, [[cx, 3]], '#c0e8ff');
    fill(ctx, [[cx, 2]], '#e0f4ff');
    return;
  }

  if (detail === 3) {
    // Epic: large drop with ripple ring at base
    groundShadow(ctx, cx, 15, 4);
    const body = [
      [cx, 1],
      [cx-1, 2], [cx, 2], [cx+1, 2],
      [cx-2, 3], [cx-1, 3], [cx, 3], [cx+1, 3], [cx+2, 3],
      [cx-3, 4], [cx-2, 4], [cx-1, 4], [cx, 4], [cx+1, 4], [cx+2, 4], [cx+3, 4],
      [cx-3, 5], [cx-2, 5], [cx-1, 5], [cx, 5], [cx+1, 5], [cx+2, 5], [cx+3, 5],
      [cx-4, 6], [cx-3, 6], [cx-2, 6], [cx-1, 6], [cx, 6], [cx+1, 6], [cx+2, 6], [cx+3, 6], [cx+4, 6],
      [cx-4, 7], [cx-3, 7], [cx-2, 7], [cx-1, 7], [cx, 7], [cx+1, 7], [cx+2, 7], [cx+3, 7], [cx+4, 7],
      [cx-4, 8], [cx-3, 8], [cx-2, 8], [cx-1, 8], [cx, 8], [cx+1, 8], [cx+2, 8], [cx+3, 8], [cx+4, 8],
      [cx-3, 9], [cx-2, 9], [cx-1, 9], [cx, 9], [cx+1, 9], [cx+2, 9], [cx+3, 9],
      [cx-2, 10], [cx-1, 10], [cx, 10], [cx+1, 10], [cx+2, 10],
      [cx-1, 11], [cx, 11], [cx+1, 11],
    ];
    outline(ctx, body, '#1a4a6a');
    fill(ctx, body, '#4a9ade');
    fill(ctx, [[cx-3, 5], [cx-4, 6], [cx-4, 7], [cx-3, 4], [cx-3, 6], [cx-2, 5]], '#6abaee');
    fill(ctx, [[cx+3, 7], [cx+4, 7], [cx+4, 8], [cx+3, 9], [cx+2, 10], [cx+1, 11], [cx, 11]], '#2a7abe');
    fill(ctx, [[cx-1, 3], [cx-2, 4], [cx-2, 5], [cx-1, 4], [cx, 3]], '#7ac8ff');
    fill(ctx, [[cx-1, 3], [cx-1, 4]], '#a0daff');
    fill(ctx, [[cx, 2]], '#c0e8ff');
    fill(ctx, [[cx, 1]], '#e0f4ff');
    // Ripple
    fill(ctx, [[cx-4, 12], [cx-3, 12], [cx+3, 12], [cx+4, 12]], '#6ab8e8');
    fill(ctx, [[cx-5, 13], [cx+5, 13]], '#80c8f0');
    return;
  }

  // Legendary: massive drop with crown splash
  groundShadow(ctx, cx, 15, 5);
  const body = [
    [cx, 0],
    [cx-1, 1], [cx, 1], [cx+1, 1],
    [cx-2, 2], [cx-1, 2], [cx, 2], [cx+1, 2], [cx+2, 2],
    [cx-3, 3], [cx-2, 3], [cx-1, 3], [cx, 3], [cx+1, 3], [cx+2, 3], [cx+3, 3],
    [cx-3, 4], [cx-2, 4], [cx-1, 4], [cx, 4], [cx+1, 4], [cx+2, 4], [cx+3, 4],
    [cx-4, 5], [cx-3, 5], [cx-2, 5], [cx-1, 5], [cx, 5], [cx+1, 5], [cx+2, 5], [cx+3, 5], [cx+4, 5],
    [cx-5, 6], [cx-4, 6], [cx-3, 6], [cx-2, 6], [cx-1, 6], [cx, 6], [cx+1, 6], [cx+2, 6], [cx+3, 6], [cx+4, 6], [cx+5, 6],
    [cx-5, 7], [cx-4, 7], [cx-3, 7], [cx-2, 7], [cx-1, 7], [cx, 7], [cx+1, 7], [cx+2, 7], [cx+3, 7], [cx+4, 7], [cx+5, 7],
    [cx-5, 8], [cx-4, 8], [cx-3, 8], [cx-2, 8], [cx-1, 8], [cx, 8], [cx+1, 8], [cx+2, 8], [cx+3, 8], [cx+4, 8], [cx+5, 8],
    [cx-4, 9], [cx-3, 9], [cx-2, 9], [cx-1, 9], [cx, 9], [cx+1, 9], [cx+2, 9], [cx+3, 9], [cx+4, 9],
    [cx-3, 10], [cx-2, 10], [cx-1, 10], [cx, 10], [cx+1, 10], [cx+2, 10], [cx+3, 10],
    [cx-2, 11], [cx-1, 11], [cx, 11], [cx+1, 11], [cx+2, 11],
  ];
  outline(ctx, body, '#1a4a6a');
  fill(ctx, body, '#4a9ade');
  fill(ctx, [[cx-4, 5], [cx-5, 6], [cx-5, 7], [cx-4, 6], [cx-3, 5], [cx-3, 4], [cx-3, 6], [cx-4, 7]], '#6abaee');
  fill(ctx, [[cx+4, 7], [cx+5, 7], [cx+5, 8], [cx+4, 9], [cx+3, 10], [cx+2, 11], [cx+4, 8], [cx+3, 9]], '#2a7abe');
  fill(ctx, [[cx-2, 3], [cx-3, 4], [cx-2, 4], [cx-1, 3], [cx-2, 5], [cx-1, 4], [cx, 3], [cx-1, 2]], '#7ac8ff');
  fill(ctx, [[cx-1, 2], [cx-2, 3], [cx-1, 3]], '#a0daff');
  fill(ctx, [[cx, 1], [cx-1, 2]], '#c0e8ff');
  fill(ctx, [[cx, 0]], '#e0f4ff');
  // Crown splash — small droplets flying up from sides
  fill(ctx, [[cx-6, 9], [cx-6, 8]], '#6ab8e8');
  fill(ctx, [[cx+6, 9], [cx+6, 8]], '#6ab8e8');
  fill(ctx, [[cx-7, 7]], '#80c8f0');
  fill(ctx, [[cx+7, 7]], '#80c8f0');
  fill(ctx, [[cx-5, 11], [cx+5, 11]], '#4a9ade');
  // Ripple rings
  fill(ctx, [[cx-6, 12], [cx-5, 12], [cx+5, 12], [cx+6, 12]], '#6ab8e8');
  fill(ctx, [[cx-7, 13], [cx+7, 13]], '#80c8f0');
}

// ── Sun Stone (day_boost) — Gem evolves from pebble to radiant sun ─

function drawSunStone(ctx, size, detail) {
  const cx = 8;

  if (detail === 0) {
    // Common: small rough amber pebble
    groundShadow(ctx, cx, 12, 2);
    const body = [
      [cx-1, 6], [cx, 6], [cx+1, 6],
      [cx-1, 7], [cx, 7], [cx+1, 7],
      [cx-1, 8], [cx, 8], [cx+1, 8],
    ];
    outline(ctx, body, '#8a5a10');
    fill(ctx, body, '#d0a030');
    fill(ctx, [[cx-1, 6], [cx, 6]], '#e0b840');
    fill(ctx, [[cx+1, 8]], '#b08820');
    return;
  }

  if (detail === 1) {
    // Uncommon: faceted gem
    groundShadow(ctx, cx, 13, 2);
    const body = [
      [cx, 4],
      [cx-1, 5], [cx, 5], [cx+1, 5],
      [cx-2, 6], [cx-1, 6], [cx, 6], [cx+1, 6], [cx+2, 6],
      [cx-2, 7], [cx-1, 7], [cx, 7], [cx+1, 7], [cx+2, 7],
      [cx-2, 8], [cx-1, 8], [cx, 8], [cx+1, 8], [cx+2, 8],
      [cx-1, 9], [cx, 9], [cx+1, 9],
      [cx, 10],
    ];
    outline(ctx, body, '#8a5a10');
    fill(ctx, body, '#e8a830');
    fill(ctx, [[cx-1, 5], [cx-2, 6], [cx-1, 6]], '#f0c040');
    fill(ctx, [[cx+1, 8], [cx+2, 8], [cx, 10]], '#c08020');
    fill(ctx, [[cx, 5]], '#f8d860');
    fill(ctx, [[cx, 4]], '#fff0a0');
    return;
  }

  if (detail === 2) {
    // Rare: larger gem with 4 small ray stubs
    groundShadow(ctx, cx, 14, 3);
    const body = [
      [cx-1, 3], [cx, 3], [cx+1, 3],
      [cx-2, 4], [cx-1, 4], [cx, 4], [cx+1, 4], [cx+2, 4],
      [cx-3, 5], [cx-2, 5], [cx-1, 5], [cx, 5], [cx+1, 5], [cx+2, 5], [cx+3, 5],
      [cx-3, 6], [cx-2, 6], [cx-1, 6], [cx, 6], [cx+1, 6], [cx+2, 6], [cx+3, 6],
      [cx-3, 7], [cx-2, 7], [cx-1, 7], [cx, 7], [cx+1, 7], [cx+2, 7], [cx+3, 7],
      [cx-3, 8], [cx-2, 8], [cx-1, 8], [cx, 8], [cx+1, 8], [cx+2, 8], [cx+3, 8],
      [cx-2, 9], [cx-1, 9], [cx, 9], [cx+1, 9], [cx+2, 9],
      [cx-1, 10], [cx, 10], [cx+1, 10],
    ];
    outline(ctx, body, '#8a5a10');
    fill(ctx, body, '#e8a830');
    fill(ctx, [[cx-2, 4], [cx-3, 5], [cx-3, 6], [cx-2, 5], [cx-1, 4]], '#f0c040');
    fill(ctx, [[cx+2, 8], [cx+3, 8], [cx+2, 9], [cx+1, 10], [cx, 10]], '#c08020');
    fill(ctx, [[cx-1, 4], [cx, 3], [cx, 4]], '#f8d860');
    fill(ctx, [[cx, 3]], '#fff0a0');
    // Ray stubs
    fill(ctx, [[cx, 1], [cx, 12]], '#e0b030');
    fill(ctx, [[cx-5, 6], [cx+5, 6]], '#e0b030');
    return;
  }

  if (detail === 3) {
    // Epic: sun stone with medium rays
    groundShadow(ctx, cx, 15, 3);
    const body = [
      [cx-1, 2], [cx, 2], [cx+1, 2],
      [cx-2, 3], [cx-1, 3], [cx, 3], [cx+1, 3], [cx+2, 3],
      [cx-3, 4], [cx-2, 4], [cx-1, 4], [cx, 4], [cx+1, 4], [cx+2, 4], [cx+3, 4],
      [cx-4, 5], [cx-3, 5], [cx-2, 5], [cx-1, 5], [cx, 5], [cx+1, 5], [cx+2, 5], [cx+3, 5], [cx+4, 5],
      [cx-4, 6], [cx-3, 6], [cx-2, 6], [cx-1, 6], [cx, 6], [cx+1, 6], [cx+2, 6], [cx+3, 6], [cx+4, 6],
      [cx-4, 7], [cx-3, 7], [cx-2, 7], [cx-1, 7], [cx, 7], [cx+1, 7], [cx+2, 7], [cx+3, 7], [cx+4, 7],
      [cx-4, 8], [cx-3, 8], [cx-2, 8], [cx-1, 8], [cx, 8], [cx+1, 8], [cx+2, 8], [cx+3, 8], [cx+4, 8],
      [cx-3, 9], [cx-2, 9], [cx-1, 9], [cx, 9], [cx+1, 9], [cx+2, 9], [cx+3, 9],
      [cx-2, 10], [cx-1, 10], [cx, 10], [cx+1, 10], [cx+2, 10],
      [cx-1, 11], [cx, 11], [cx+1, 11],
    ];
    outline(ctx, body, '#8a5a10');
    fill(ctx, body, '#e8a830');
    fill(ctx, [[cx-3, 4], [cx-4, 5], [cx-4, 6], [cx-3, 5], [cx-2, 4], [cx-2, 3]], '#f0c040');
    fill(ctx, [[cx+3, 8], [cx+4, 8], [cx+3, 9], [cx+2, 10], [cx+1, 11], [cx, 11]], '#c08020');
    fill(ctx, [[cx-1, 3], [cx, 2], [cx, 3], [cx-1, 4]], '#f8d860');
    fill(ctx, [[cx, 2]], '#fff8c0');
    // Rays
    fill(ctx, [[cx, 0], [cx, 1]], '#f0d060');
    fill(ctx, [[cx, 13], [cx, 12]], '#d0a030');
    fill(ctx, [[cx-6, 6], [cx-5, 6]], '#f0c040');
    fill(ctx, [[cx+5, 6], [cx+6, 6]], '#d0a030');
    // Diagonal rays
    fill(ctx, [[cx-4, 3], [cx+4, 3]], '#e8c040');
    fill(ctx, [[cx-4, 10], [cx+4, 10]], '#c89828');
    return;
  }

  // Legendary: massive radiant sun
  groundShadow(ctx, cx, 15, 4);
  const body = [
    [cx-1, 2], [cx, 2], [cx+1, 2],
    [cx-2, 3], [cx-1, 3], [cx, 3], [cx+1, 3], [cx+2, 3],
    [cx-3, 4], [cx-2, 4], [cx-1, 4], [cx, 4], [cx+1, 4], [cx+2, 4], [cx+3, 4],
    [cx-4, 5], [cx-3, 5], [cx-2, 5], [cx-1, 5], [cx, 5], [cx+1, 5], [cx+2, 5], [cx+3, 5], [cx+4, 5],
    [cx-4, 6], [cx-3, 6], [cx-2, 6], [cx-1, 6], [cx, 6], [cx+1, 6], [cx+2, 6], [cx+3, 6], [cx+4, 6],
    [cx-4, 7], [cx-3, 7], [cx-2, 7], [cx-1, 7], [cx, 7], [cx+1, 7], [cx+2, 7], [cx+3, 7], [cx+4, 7],
    [cx-4, 8], [cx-3, 8], [cx-2, 8], [cx-1, 8], [cx, 8], [cx+1, 8], [cx+2, 8], [cx+3, 8], [cx+4, 8],
    [cx-3, 9], [cx-2, 9], [cx-1, 9], [cx, 9], [cx+1, 9], [cx+2, 9], [cx+3, 9],
    [cx-2, 10], [cx-1, 10], [cx, 10], [cx+1, 10], [cx+2, 10],
    [cx-1, 11], [cx, 11], [cx+1, 11],
  ];
  outline(ctx, body, '#8a5a10');
  fill(ctx, body, '#e8a830');
  fill(ctx, [[cx-3, 4], [cx-4, 5], [cx-4, 6], [cx-3, 5], [cx-2, 4], [cx-2, 3]], '#f0c040');
  fill(ctx, [[cx+3, 8], [cx+4, 8], [cx+3, 9], [cx+2, 10], [cx+1, 11], [cx, 11]], '#c08020');
  fill(ctx, [[cx-1, 3], [cx, 2], [cx, 3], [cx-1, 4], [cx-1, 5]], '#f8d860');
  fill(ctx, [[cx, 2]], '#fffce0');
  fill(ctx, [[cx, 5], [cx, 6]], '#f8e070');
  // Long rays — all 8 directions
  fill(ctx, [[cx, 0], [cx, 1]], '#f0d060');
  fill(ctx, [[cx, 13], [cx, 12]], '#d0a030');
  fill(ctx, [[cx-7, 6], [cx-6, 6], [cx-5, 6]], '#f0c040');
  fill(ctx, [[cx+5, 6], [cx+6, 6], [cx+7, 6]], '#d0a030');
  fill(ctx, [[cx-5, 3], [cx-4, 3]], '#e8c040');
  fill(ctx, [[cx+4, 3], [cx+5, 3]], '#d0a030');
  fill(ctx, [[cx-5, 10], [cx-4, 10]], '#e8c040');
  fill(ctx, [[cx+4, 10], [cx+5, 10]], '#c89828');
  fill(ctx, [[cx-6, 4], [cx+6, 4]], '#e0b838');
  fill(ctx, [[cx-6, 9], [cx+6, 9]], '#c89828');
}

// ── Rain Charm (auto_water) — Cloud evolves ───────────────────────

function drawRainCharm(ctx, size, detail) {
  const cx = 8;

  if (detail === 0) {
    groundShadow(ctx, cx, 12, 2);
    const body = [
      [cx-1, 5], [cx, 5], [cx+1, 5],
      [cx-2, 6], [cx-1, 6], [cx, 6], [cx+1, 6], [cx+2, 6],
      [cx-2, 7], [cx-1, 7], [cx, 7], [cx+1, 7], [cx+2, 7],
    ];
    outline(ctx, body, '#6a7a8a');
    fill(ctx, body, '#c0c8d4');
    fill(ctx, [[cx-1, 5], [cx, 5]], '#d4dce4');
    fill(ctx, [[cx-2, 7], [cx+2, 7]], '#9aa8b8');
    fill(ctx, [[cx, 9], [cx-1, 10]], '#4a9ade');
    return;
  }

  if (detail === 1) {
    groundShadow(ctx, cx, 13, 3);
    const body = [
      [cx-1, 3], [cx, 3], [cx+1, 3],
      [cx-3, 4], [cx-2, 4], [cx-1, 4], [cx, 4], [cx+1, 4], [cx+2, 4], [cx+3, 4],
      [cx-3, 5], [cx-2, 5], [cx-1, 5], [cx, 5], [cx+1, 5], [cx+2, 5], [cx+3, 5],
      [cx-3, 6], [cx-2, 6], [cx-1, 6], [cx, 6], [cx+1, 6], [cx+2, 6], [cx+3, 6],
    ];
    outline(ctx, body, '#6a7a8a');
    fill(ctx, body, '#c0c8d4');
    fill(ctx, [[cx-1, 3], [cx, 3], [cx-2, 4], [cx-1, 4]], '#d8e0e8');
    fill(ctx, [[cx-3, 6], [cx+3, 6], [cx+2, 6]], '#9aa8b8');
    fill(ctx, [[cx, 3]], '#e8eef4');
    fill(ctx, [[cx-1, 8], [cx+1, 8], [cx, 9]], '#4a9ade');
    fill(ctx, [[cx-1, 8]], '#7ac0f0');
    return;
  }

  if (detail === 2) {
    groundShadow(ctx, cx, 14, 4);
    const body = [
      [cx-1, 2], [cx, 2], [cx+1, 2],
      [cx-2, 3], [cx-1, 3], [cx, 3], [cx+1, 3], [cx+2, 3], [cx+3, 3],
      [cx-3, 4], [cx-2, 4], [cx-1, 4], [cx, 4], [cx+1, 4], [cx+2, 4], [cx+3, 4], [cx+4, 4],
      [cx-4, 5], [cx-3, 5], [cx-2, 5], [cx-1, 5], [cx, 5], [cx+1, 5], [cx+2, 5], [cx+3, 5], [cx+4, 5],
      [cx-4, 6], [cx-3, 6], [cx-2, 6], [cx-1, 6], [cx, 6], [cx+1, 6], [cx+2, 6], [cx+3, 6], [cx+4, 6],
      [cx-3, 7], [cx-2, 7], [cx-1, 7], [cx, 7], [cx+1, 7], [cx+2, 7], [cx+3, 7],
    ];
    outline(ctx, body, '#6a7a8a');
    fill(ctx, body, '#c8d4e0');
    fill(ctx, [[cx-1, 2], [cx, 2], [cx-2, 3], [cx-1, 3], [cx, 3], [cx-3, 4], [cx-2, 4]], '#dce4ec');
    fill(ctx, [[cx-4, 6], [cx+4, 6], [cx-3, 7], [cx+3, 7], [cx+4, 5]], '#9aa8b8');
    fill(ctx, [[cx, 2]], '#eef2f8');
    // 3 rain drops
    const drops = [[cx-2, 9], [cx, 10], [cx+2, 9]];
    for (const [dx, dy] of drops) {
      fill(ctx, [[dx, dy], [dx, dy+1]], '#4a9ade');
      fill(ctx, [[dx, dy]], '#7ac0f0');
    }
    return;
  }

  if (detail === 3) {
    groundShadow(ctx, cx, 15, 5);
    const body = [
      [cx-1, 1], [cx, 1], [cx+1, 1],
      [cx-3, 2], [cx-2, 2], [cx-1, 2], [cx, 2], [cx+1, 2], [cx+2, 2], [cx+3, 2],
      [cx-4, 3], [cx-3, 3], [cx-2, 3], [cx-1, 3], [cx, 3], [cx+1, 3], [cx+2, 3], [cx+3, 3], [cx+4, 3],
      [cx-5, 4], [cx-4, 4], [cx-3, 4], [cx-2, 4], [cx-1, 4], [cx, 4], [cx+1, 4], [cx+2, 4], [cx+3, 4], [cx+4, 4], [cx+5, 4],
      [cx-5, 5], [cx-4, 5], [cx-3, 5], [cx-2, 5], [cx-1, 5], [cx, 5], [cx+1, 5], [cx+2, 5], [cx+3, 5], [cx+4, 5], [cx+5, 5],
      [cx-4, 6], [cx-3, 6], [cx-2, 6], [cx-1, 6], [cx, 6], [cx+1, 6], [cx+2, 6], [cx+3, 6], [cx+4, 6],
    ];
    outline(ctx, body, '#6a7a8a');
    fill(ctx, body, '#c8d4e0');
    fill(ctx, [[cx-1, 1], [cx, 1], [cx-3, 2], [cx-2, 2], [cx-1, 2], [cx, 2], [cx-4, 3], [cx-3, 3], [cx-2, 3]], '#dce4ec');
    fill(ctx, [[cx-5, 5], [cx+5, 5], [cx-4, 6], [cx+4, 6], [cx+5, 4]], '#9aa8b8');
    fill(ctx, [[cx, 1]], '#eef2f8');
    // Lightning
    fill(ctx, [[cx+1, 6], [cx, 7], [cx+1, 7], [cx, 8]], '#f0e060');
    fill(ctx, [[cx, 7]], '#fffce0');
    // Rain
    const drops = [[cx-3, 8], [cx-1, 9], [cx+1, 8], [cx+3, 9]];
    for (const [dx, dy] of drops) {
      fill(ctx, [[dx, dy], [dx, dy+1]], '#4a9ade');
      fill(ctx, [[dx, dy]], '#7ac0f0');
    }
    return;
  }

  // Legendary: massive storm cloud with lightning + heavy rain
  groundShadow(ctx, cx, 15, 6);
  const body = [
    [cx-1, 0], [cx, 0], [cx+1, 0],
    [cx-3, 1], [cx-2, 1], [cx-1, 1], [cx, 1], [cx+1, 1], [cx+2, 1], [cx+3, 1],
    [cx-5, 2], [cx-4, 2], [cx-3, 2], [cx-2, 2], [cx-1, 2], [cx, 2], [cx+1, 2], [cx+2, 2], [cx+3, 2], [cx+4, 2], [cx+5, 2],
    [cx-6, 3], [cx-5, 3], [cx-4, 3], [cx-3, 3], [cx-2, 3], [cx-1, 3], [cx, 3], [cx+1, 3], [cx+2, 3], [cx+3, 3], [cx+4, 3], [cx+5, 3], [cx+6, 3],
    [cx-6, 4], [cx-5, 4], [cx-4, 4], [cx-3, 4], [cx-2, 4], [cx-1, 4], [cx, 4], [cx+1, 4], [cx+2, 4], [cx+3, 4], [cx+4, 4], [cx+5, 4], [cx+6, 4],
    [cx-5, 5], [cx-4, 5], [cx-3, 5], [cx-2, 5], [cx-1, 5], [cx, 5], [cx+1, 5], [cx+2, 5], [cx+3, 5], [cx+4, 5], [cx+5, 5],
  ];
  outline(ctx, body, '#5a6878');
  fill(ctx, body, '#b0bcc8');
  fill(ctx, [[cx-1, 0], [cx, 0], [cx-3, 1], [cx-2, 1], [cx-1, 1], [cx, 1], [cx-5, 2], [cx-4, 2], [cx-3, 2], [cx-2, 2]], '#c8d4e0');
  fill(ctx, [[cx-6, 4], [cx+6, 4], [cx-5, 5], [cx+5, 5], [cx+6, 3]], '#8a98a8');
  fill(ctx, [[cx, 0]], '#dce8f0');
  // Lightning bolt
  fill(ctx, [[cx, 5], [cx-1, 6], [cx, 6], [cx+1, 6], [cx, 7], [cx-1, 8], [cx, 8]], '#f0e060');
  fill(ctx, [[cx, 6]], '#fffce0');
  fill(ctx, [[cx-1, 8]], '#f0d840');
  // Heavy rain — 6 drops
  const drops = [[cx-5, 7], [cx-3, 8], [cx-1, 9], [cx+1, 7], [cx+3, 9], [cx+5, 8]];
  for (const [dx, dy] of drops) {
    fill(ctx, [[dx, dy], [dx, dy+1]], '#4a9ade');
    fill(ctx, [[dx, dy]], '#7ac0f0');
  }
  fill(ctx, [[cx-4, 10], [cx-2, 11], [cx, 11], [cx+2, 10], [cx+4, 11]], '#4a9ade');
}

// ── Prism Shard (art_reroll) — Crystal grows ──────────────────────

function drawPrismShard(ctx, size, detail) {
  const cx = 8;
  const rainbow = ['#ff6868', '#f0a840', '#e8e040', '#60c060', '#6090e0', '#a060d0'];

  if (detail === 0) {
    groundShadow(ctx, cx, 12, 1);
    const body = [
      [cx, 5],
      [cx-1, 6], [cx, 6], [cx+1, 6],
      [cx-1, 7], [cx, 7], [cx+1, 7],
      [cx-1, 8], [cx, 8], [cx+1, 8],
      [cx, 9],
    ];
    outline(ctx, body, '#4a3878');
    fill(ctx, body, '#9a78c0');
    fill(ctx, [[cx-1, 6], [cx-1, 7]], '#b098d0');
    fill(ctx, [[cx, 5]], '#c8b0e0');
    return;
  }

  if (detail === 1) {
    groundShadow(ctx, cx, 13, 2);
    const body = [
      [cx, 3], [cx, 4],
      [cx-1, 5], [cx, 5], [cx+1, 5],
      [cx-2, 6], [cx-1, 6], [cx, 6], [cx+1, 6], [cx+2, 6],
      [cx-2, 7], [cx-1, 7], [cx, 7], [cx+1, 7], [cx+2, 7],
      [cx-1, 8], [cx, 8], [cx+1, 8],
      [cx, 9], [cx, 10],
    ];
    outline(ctx, body, '#4a3878');
    fill(ctx, body, '#a080d0');
    fill(ctx, [[cx-1, 5], [cx-2, 6], [cx-1, 6], [cx-2, 7]], '#c0a0e8');
    fill(ctx, [[cx+1, 7], [cx+2, 7], [cx+1, 8], [cx, 10]], '#7a60a8');
    fill(ctx, [[cx, 3], [cx, 4]], '#d0b8f0');
    fill(ctx, [[cx, 3]], '#e0d0f8');
    return;
  }

  if (detail === 2) {
    groundShadow(ctx, cx, 14, 2);
    const body = [
      [cx, 2], [cx, 3],
      [cx-1, 4], [cx, 4], [cx+1, 4],
      [cx-2, 5], [cx-1, 5], [cx, 5], [cx+1, 5], [cx+2, 5],
      [cx-2, 6], [cx-1, 6], [cx, 6], [cx+1, 6], [cx+2, 6],
      [cx-3, 7], [cx-2, 7], [cx-1, 7], [cx, 7], [cx+1, 7], [cx+2, 7], [cx+3, 7],
      [cx-2, 8], [cx-1, 8], [cx, 8], [cx+1, 8], [cx+2, 8],
      [cx-1, 9], [cx, 9], [cx+1, 9],
      [cx, 10], [cx, 11],
    ];
    outline(ctx, body, '#4a3878');
    fill(ctx, body, '#a080d0');
    fill(ctx, [[cx-1, 4], [cx-2, 5], [cx-2, 6], [cx-3, 7], [cx-1, 5], [cx-2, 7]], '#c0a0e8');
    fill(ctx, [[cx+2, 7], [cx+3, 7], [cx+2, 8], [cx+1, 9], [cx, 11]], '#7a60a8');
    fill(ctx, [[cx, 2], [cx, 3], [cx-1, 4]], '#d0b8f0');
    fill(ctx, [[cx, 2]], '#eee0ff');
    // Rainbow
    fill(ctx, [[cx+3, 5]], rainbow[0]);
    fill(ctx, [[cx+4, 6]], rainbow[2]);
    fill(ctx, [[cx+4, 7]], rainbow[4]);
    return;
  }

  if (detail === 3) {
    groundShadow(ctx, cx, 15, 2);
    const body = [
      [cx, 1], [cx, 2],
      [cx-1, 3], [cx, 3], [cx+1, 3],
      [cx-2, 4], [cx-1, 4], [cx, 4], [cx+1, 4], [cx+2, 4],
      [cx-2, 5], [cx-1, 5], [cx, 5], [cx+1, 5], [cx+2, 5],
      [cx-3, 6], [cx-2, 6], [cx-1, 6], [cx, 6], [cx+1, 6], [cx+2, 6], [cx+3, 6],
      [cx-3, 7], [cx-2, 7], [cx-1, 7], [cx, 7], [cx+1, 7], [cx+2, 7], [cx+3, 7],
      [cx-3, 8], [cx-2, 8], [cx-1, 8], [cx, 8], [cx+1, 8], [cx+2, 8], [cx+3, 8],
      [cx-2, 9], [cx-1, 9], [cx, 9], [cx+1, 9], [cx+2, 9],
      [cx-1, 10], [cx, 10], [cx+1, 10],
      [cx, 11], [cx, 12],
    ];
    outline(ctx, body, '#4a3878');
    fill(ctx, body, '#a080d0');
    fill(ctx, [[cx-1, 3], [cx-2, 4], [cx-2, 5], [cx-3, 6], [cx-3, 7], [cx-1, 4], [cx-2, 6], [cx-1, 5]], '#c0a0e8');
    fill(ctx, [[cx+2, 7], [cx+3, 7], [cx+3, 8], [cx+2, 9], [cx+1, 10], [cx, 12]], '#7a60a8');
    fill(ctx, [[cx, 1], [cx, 2], [cx-1, 3], [cx-1, 4]], '#d0b8f0');
    fill(ctx, [[cx, 1]], '#eee0ff');
    // Rainbow arc
    for (let i = 0; i < 6; i++) {
      fill(ctx, [[cx+4, 4+i]], rainbow[i]);
      fill(ctx, [[cx+5, 4+i]], rainbow[i]);
    }
    return;
  }

  // Legendary: massive crystal cluster with full rainbow
  groundShadow(ctx, cx, 15, 3);
  // Main crystal
  const body = [
    [cx, 0], [cx, 1],
    [cx-1, 2], [cx, 2], [cx+1, 2],
    [cx-2, 3], [cx-1, 3], [cx, 3], [cx+1, 3], [cx+2, 3],
    [cx-2, 4], [cx-1, 4], [cx, 4], [cx+1, 4], [cx+2, 4],
    [cx-3, 5], [cx-2, 5], [cx-1, 5], [cx, 5], [cx+1, 5], [cx+2, 5], [cx+3, 5],
    [cx-3, 6], [cx-2, 6], [cx-1, 6], [cx, 6], [cx+1, 6], [cx+2, 6], [cx+3, 6],
    [cx-4, 7], [cx-3, 7], [cx-2, 7], [cx-1, 7], [cx, 7], [cx+1, 7], [cx+2, 7], [cx+3, 7], [cx+4, 7],
    [cx-4, 8], [cx-3, 8], [cx-2, 8], [cx-1, 8], [cx, 8], [cx+1, 8], [cx+2, 8], [cx+3, 8], [cx+4, 8],
    [cx-3, 9], [cx-2, 9], [cx-1, 9], [cx, 9], [cx+1, 9], [cx+2, 9], [cx+3, 9],
    [cx-2, 10], [cx-1, 10], [cx, 10], [cx+1, 10], [cx+2, 10],
    [cx-1, 11], [cx, 11], [cx+1, 11],
    [cx, 12],
  ];
  outline(ctx, body, '#4a3878');
  fill(ctx, body, '#a080d0');
  fill(ctx, [[cx-1, 2], [cx-2, 3], [cx-2, 4], [cx-3, 5], [cx-3, 6], [cx-4, 7], [cx-1, 3], [cx-2, 5], [cx-1, 4], [cx-3, 7], [cx-4, 8]], '#c0a0e8');
  fill(ctx, [[cx+3, 7], [cx+4, 7], [cx+4, 8], [cx+3, 9], [cx+2, 10], [cx+1, 11], [cx, 12]], '#7a60a8');
  fill(ctx, [[cx, 0], [cx, 1], [cx-1, 2], [cx-1, 3], [cx-1, 4]], '#d0b8f0');
  fill(ctx, [[cx, 0]], '#f0e8ff');
  // Side crystal spurs
  fill(ctx, [[cx-5, 6], [cx-5, 7], [cx-6, 7]], '#b098d8');
  fill(ctx, [[cx+5, 6], [cx+5, 7], [cx+6, 7]], '#8a68b8');
  // Full rainbow arc both sides
  for (let i = 0; i < 6; i++) {
    fill(ctx, [[cx+5, 3+i]], rainbow[i]);
    fill(ctx, [[cx+6, 3+i]], rainbow[i]);
    fill(ctx, [[cx-6, 3+i]], rainbow[5-i]);
    fill(ctx, [[cx-7, 3+i]], rainbow[5-i]);
  }
}

// ── Fertile Soil (garden_upgrade) — Bag grows ─────────────────────

function drawFertileSoil(ctx, size, detail) {
  const cx = 8;

  if (detail === 0) {
    groundShadow(ctx, cx, 12, 2);
    const body = [
      [cx-1, 6], [cx, 6], [cx+1, 6],
      [cx-2, 7], [cx-1, 7], [cx, 7], [cx+1, 7], [cx+2, 7],
      [cx-2, 8], [cx-1, 8], [cx, 8], [cx+1, 8], [cx+2, 8],
      [cx-1, 9], [cx, 9], [cx+1, 9],
    ];
    outline(ctx, body, '#3a2810');
    fill(ctx, body, '#9a7a4a');
    fill(ctx, [[cx-1, 7], [cx-2, 7]], '#b0986a');
    fill(ctx, [[cx+1, 8], [cx+2, 8]], '#7a5a30');
    fill(ctx, [[cx, 5]], '#6a4a22');
    fill(ctx, [[cx, 6]], '#4a3020');
    return;
  }

  if (detail === 1) {
    groundShadow(ctx, cx, 13, 3);
    const body = [
      [cx-1, 4], [cx, 4], [cx+1, 4],
      [cx-2, 5], [cx-1, 5], [cx, 5], [cx+1, 5], [cx+2, 5],
      [cx-3, 6], [cx-2, 6], [cx-1, 6], [cx, 6], [cx+1, 6], [cx+2, 6], [cx+3, 6],
      [cx-3, 7], [cx-2, 7], [cx-1, 7], [cx, 7], [cx+1, 7], [cx+2, 7], [cx+3, 7],
      [cx-3, 8], [cx-2, 8], [cx-1, 8], [cx, 8], [cx+1, 8], [cx+2, 8], [cx+3, 8],
      [cx-2, 9], [cx-1, 9], [cx, 9], [cx+1, 9], [cx+2, 9],
    ];
    outline(ctx, body, '#3a2810');
    fill(ctx, body, '#9a7a4a');
    fill(ctx, [[cx-2, 5], [cx-3, 6], [cx-2, 6]], '#b0986a');
    fill(ctx, [[cx+2, 8], [cx+3, 8], [cx+2, 9]], '#7a5a30');
    fill(ctx, [[cx, 3]], '#6a4a22');
    fill(ctx, [[cx, 4]], '#4a3020');
    fill(ctx, [[cx, 2]], '#5a9a3a');
    fill(ctx, [[cx-1, 1]], '#7ac050');
    return;
  }

  if (detail === 2) {
    groundShadow(ctx, cx, 14, 3);
    const body = [
      [cx-1, 3], [cx, 3], [cx+1, 3],
      [cx-3, 4], [cx-2, 4], [cx-1, 4], [cx, 4], [cx+1, 4], [cx+2, 4], [cx+3, 4],
      [cx-4, 5], [cx-3, 5], [cx-2, 5], [cx-1, 5], [cx, 5], [cx+1, 5], [cx+2, 5], [cx+3, 5], [cx+4, 5],
      [cx-4, 6], [cx-3, 6], [cx-2, 6], [cx-1, 6], [cx, 6], [cx+1, 6], [cx+2, 6], [cx+3, 6], [cx+4, 6],
      [cx-4, 7], [cx-3, 7], [cx-2, 7], [cx-1, 7], [cx, 7], [cx+1, 7], [cx+2, 7], [cx+3, 7], [cx+4, 7],
      [cx-4, 8], [cx-3, 8], [cx-2, 8], [cx-1, 8], [cx, 8], [cx+1, 8], [cx+2, 8], [cx+3, 8], [cx+4, 8],
      [cx-3, 9], [cx-2, 9], [cx-1, 9], [cx, 9], [cx+1, 9], [cx+2, 9], [cx+3, 9],
      [cx-2, 10], [cx-1, 10], [cx, 10], [cx+1, 10], [cx+2, 10],
    ];
    outline(ctx, body, '#3a2810');
    fill(ctx, body, '#9a7a4a');
    fill(ctx, [[cx-3, 5], [cx-4, 6], [cx-4, 7], [cx-3, 4], [cx-3, 6]], '#b0986a');
    fill(ctx, [[cx+3, 7], [cx+4, 7], [cx+4, 8], [cx+3, 9], [cx+2, 10]], '#7a5a30');
    fill(ctx, [[cx, 2]], '#6a4a22');
    fill(ctx, [[cx, 3]], '#4a3020');
    fill(ctx, [[cx, 7]], '#5a9a3a');
    fill(ctx, [[cx-1, 7]], '#6aaa4a');
    fill(ctx, [[cx, 0], [cx, 1]], '#5a9a3a');
    fill(ctx, [[cx-1, 0]], '#7ac050');
    fill(ctx, [[cx+1, 1]], '#5a9a3a');
    return;
  }

  if (detail === 3) {
    groundShadow(ctx, cx, 15, 4);
    const body = [
      [cx-1, 3], [cx, 3], [cx+1, 3],
      [cx-3, 4], [cx-2, 4], [cx-1, 4], [cx, 4], [cx+1, 4], [cx+2, 4], [cx+3, 4],
      [cx-4, 5], [cx-3, 5], [cx-2, 5], [cx-1, 5], [cx, 5], [cx+1, 5], [cx+2, 5], [cx+3, 5], [cx+4, 5],
      [cx-5, 6], [cx-4, 6], [cx-3, 6], [cx-2, 6], [cx-1, 6], [cx, 6], [cx+1, 6], [cx+2, 6], [cx+3, 6], [cx+4, 6], [cx+5, 6],
      [cx-5, 7], [cx-4, 7], [cx-3, 7], [cx-2, 7], [cx-1, 7], [cx, 7], [cx+1, 7], [cx+2, 7], [cx+3, 7], [cx+4, 7], [cx+5, 7],
      [cx-5, 8], [cx-4, 8], [cx-3, 8], [cx-2, 8], [cx-1, 8], [cx, 8], [cx+1, 8], [cx+2, 8], [cx+3, 8], [cx+4, 8], [cx+5, 8],
      [cx-5, 9], [cx-4, 9], [cx-3, 9], [cx-2, 9], [cx-1, 9], [cx, 9], [cx+1, 9], [cx+2, 9], [cx+3, 9], [cx+4, 9], [cx+5, 9],
      [cx-4, 10], [cx-3, 10], [cx-2, 10], [cx-1, 10], [cx, 10], [cx+1, 10], [cx+2, 10], [cx+3, 10], [cx+4, 10],
      [cx-3, 11], [cx-2, 11], [cx-1, 11], [cx, 11], [cx+1, 11], [cx+2, 11], [cx+3, 11],
    ];
    outline(ctx, body, '#3a2810');
    fill(ctx, body, '#9a7a4a');
    fill(ctx, [[cx-4, 5], [cx-5, 6], [cx-5, 7], [cx-4, 6], [cx-3, 5]], '#b0986a');
    fill(ctx, [[cx+4, 8], [cx+5, 8], [cx+5, 9], [cx+4, 10], [cx+3, 11]], '#7a5a30');
    fill(ctx, [[cx, 2]], '#6a4a22');
    fill(ctx, [[cx, 3]], '#4a3020');
    // Leaf tag
    fill(ctx, [[cx, 7], [cx, 8], [cx-1, 7], [cx+1, 8]], '#5a9a3a');
    fill(ctx, [[cx-1, 7]], '#6aaa4a');
    // Big sprout
    fill(ctx, [[cx, 0], [cx, 1]], '#5a9a3a');
    fill(ctx, [[cx-1, 0], [cx-2, 0]], '#7ac050');
    fill(ctx, [[cx+1, 0], [cx+1, 1]], '#5a9a3a');
    fill(ctx, [[cx+2, 1]], '#6aaa4a');
    return;
  }

  // Legendary: overflowing sack with blooming plant on top
  groundShadow(ctx, cx, 15, 5);
  const body = [
    [cx-2, 4], [cx-1, 4], [cx, 4], [cx+1, 4], [cx+2, 4],
    [cx-4, 5], [cx-3, 5], [cx-2, 5], [cx-1, 5], [cx, 5], [cx+1, 5], [cx+2, 5], [cx+3, 5], [cx+4, 5],
    [cx-5, 6], [cx-4, 6], [cx-3, 6], [cx-2, 6], [cx-1, 6], [cx, 6], [cx+1, 6], [cx+2, 6], [cx+3, 6], [cx+4, 6], [cx+5, 6],
    [cx-6, 7], [cx-5, 7], [cx-4, 7], [cx-3, 7], [cx-2, 7], [cx-1, 7], [cx, 7], [cx+1, 7], [cx+2, 7], [cx+3, 7], [cx+4, 7], [cx+5, 7], [cx+6, 7],
    [cx-6, 8], [cx-5, 8], [cx-4, 8], [cx-3, 8], [cx-2, 8], [cx-1, 8], [cx, 8], [cx+1, 8], [cx+2, 8], [cx+3, 8], [cx+4, 8], [cx+5, 8], [cx+6, 8],
    [cx-6, 9], [cx-5, 9], [cx-4, 9], [cx-3, 9], [cx-2, 9], [cx-1, 9], [cx, 9], [cx+1, 9], [cx+2, 9], [cx+3, 9], [cx+4, 9], [cx+5, 9], [cx+6, 9],
    [cx-5, 10], [cx-4, 10], [cx-3, 10], [cx-2, 10], [cx-1, 10], [cx, 10], [cx+1, 10], [cx+2, 10], [cx+3, 10], [cx+4, 10], [cx+5, 10],
    [cx-4, 11], [cx-3, 11], [cx-2, 11], [cx-1, 11], [cx, 11], [cx+1, 11], [cx+2, 11], [cx+3, 11], [cx+4, 11],
  ];
  outline(ctx, body, '#3a2810');
  fill(ctx, body, '#9a7a4a');
  fill(ctx, [[cx-5, 6], [cx-6, 7], [cx-6, 8], [cx-5, 7], [cx-4, 6]], '#b0986a');
  fill(ctx, [[cx+5, 8], [cx+6, 8], [cx+6, 9], [cx+5, 10], [cx+4, 11]], '#7a5a30');
  fill(ctx, [[cx, 3]], '#6a4a22');
  fill(ctx, [[cx, 4]], '#4a3020');
  // Blooming plant on top
  fill(ctx, [[cx, 1], [cx, 2], [cx, 3]], '#5a9a3a');
  fill(ctx, [[cx-1, 0], [cx-2, 0], [cx-1, 1]], '#7ac050');
  fill(ctx, [[cx+1, 0], [cx+2, 0], [cx+1, 1]], '#5a9a3a');
  fill(ctx, [[cx+2, 1]], '#6aaa4a');
  fill(ctx, [[cx-3, 0]], '#7ac050');
  fill(ctx, [[cx+3, 0]], '#6aaa4a');
  // Flowers
  fill(ctx, [[cx-2, 1]], '#f08080');
  fill(ctx, [[cx+2, 0]], '#f0a060');
  // Leaf tag
  fill(ctx, [[cx, 8], [cx-1, 8], [cx+1, 9]], '#5a9a3a');
}

// ── Fusion Seed, Life Spark, Seed, Ember Crown, Frost Shard, Stone Heart, Gale Feather, Cool Shades
// Using same evolution pattern: small→medium→large→huge→massive

function drawFusionSeed(ctx, size, detail) {
  const cx = 8;
  // Size scales with detail
  const r = [2, 3, 4, 5, 6][detail];
  const cy = detail <= 1 ? 8 : 7;
  groundShadow(ctx, cx, cy + r + 2, r);

  const body = [];
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++)
      if (dx*dx + dy*dy <= r*r) body.push([cx+dx, cy+dy]);

  outline(ctx, body, '#4a5a6a');
  fill(ctx, body, '#b0bcc8');
  // Shadow side
  for (const [x, y] of body) if (x > cx && y > cy) fill(ctx, [[x, y]], '#8898a8');
  // Light side
  for (const [x, y] of body) if (x < cx - 1 && y < cy) fill(ctx, [[x, y]], '#c8d4e0');
  // Specular
  fill(ctx, [[cx-1, cy-r+1]], '#e8ecf4');
  fill(ctx, [[cx, cy-r]], '#dce4f0');
  // Swirl
  fill(ctx, [[cx, cy]], '#a0b8d8');
  if (r >= 3) {
    fill(ctx, [[cx-1, cy]], '#c0a8d8');
    fill(ctx, [[cx+1, cy]], '#a8d0c0');
    fill(ctx, [[cx, cy-1]], '#b0c0e0');
    fill(ctx, [[cx, cy+1]], '#98b0c8');
  }
  if (detail >= 3) {
    fill(ctx, [[cx-2, cy], [cx+2, cy]], '#c0a8d8');
    fill(ctx, [[cx, cy-2], [cx, cy+2]], '#a8d0c0');
  }
  if (detail >= 4) {
    // Energy arcs
    fill(ctx, [[cx-r-1, cy], [cx+r+1, cy]], '#c0a8d8');
    fill(ctx, [[cx, cy-r-1], [cx, cy+r+1]], '#a8d0c0');
    fill(ctx, [[cx-r-1, cy-1], [cx+r+1, cy-1]], '#b0c0e0');
    fill(ctx, [[cx-r-1, cy+1], [cx+r+1, cy+1]], '#98b0c8');
  }
}

function drawLifeSpark(ctx, size, detail) {
  const cx = 8, cy = 7;
  const r = [2, 3, 3, 4, 5][detail];
  const rayLen = [0, 1, 2, 3, 4][detail];
  groundShadow(ctx, cx, cy + r + rayLen + 2, r);

  // Star body
  const body = [];
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++)
      if (Math.abs(dx) + Math.abs(dy) <= r) body.push([cx+dx, cy+dy]);

  outline(ctx, body, '#9a7020');
  fill(ctx, body, '#f0d060');
  for (const [x, y] of body) {
    if (x > cx && y > cy) fill(ctx, [[x, y]], '#d0a830');
    if (x < cx && y < cy) fill(ctx, [[x, y]], '#f8e880');
  }
  fill(ctx, [[cx, cy]], '#fffef0');
  fill(ctx, [[cx, cy-1]], '#fff8d0');

  // Rays
  for (let i = 1; i <= rayLen; i++) {
    const a = i === rayLen ? '#d0b040' : '#e8c850';
    fill(ctx, [[cx, cy-r-i], [cx, cy+r+i], [cx-r-i, cy], [cx+r+i, cy]], a);
  }
  // Face at higher tiers
  if (detail >= 2) {
    fill(ctx, [[cx-1, cy+1], [cx+1, cy+1]], '#504020');
  }
  if (detail >= 3) {
    fill(ctx, [[cx-r+1, cy+1], [cx+r-1, cy+1]], '#f0a0a0');
  }
  if (detail >= 4) {
    fill(ctx, [[cx-1, cy-r-2], [cx+1, cy-r-2]], '#f08080');
    fill(ctx, [[cx, cy-r-1]], '#f08080');
  }
}

function drawSeed(ctx, size, detail) {
  const cx = 8;
  const r = [2, 3, 3, 4, 5][detail];
  const sproutH = [0, 0, 2, 4, 6][detail];
  const cy = detail <= 1 ? 8 : 7;
  groundShadow(ctx, cx, cy + r + 2, r);

  const body = [];
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++)
      if ((dx*dx)/(r*r) + (dy*dy)/(r*r) <= 1) body.push([cx+dx, cy+dy]);

  outline(ctx, body, '#3a2810');
  fill(ctx, body, '#8a6a38');
  for (const [x, y] of body) {
    if (x > cx && y > cy) fill(ctx, [[x, y]], '#5a4020');
    if (x < cx - 1 && y < cy) fill(ctx, [[x, y]], '#a88850');
  }
  fill(ctx, [[cx-1, cy-r+1]], '#b89860');
  fill(ctx, [[cx, cy-r]], '#c0a068');
  // Seam
  for (let dy = -r+1; dy <= r-1; dy++) fill(ctx, [[cx, cy+dy]], '#6a4a28');

  // Sprout
  if (sproutH > 0) {
    for (let i = 1; i <= sproutH; i++) fill(ctx, [[cx, cy-r-i]], '#5a9a3a');
    fill(ctx, [[cx-1, cy-r-sproutH]], '#7ac050');
    fill(ctx, [[cx+1, cy-r-sproutH+1]], '#5a9a3a');
    if (sproutH >= 4) {
      fill(ctx, [[cx-2, cy-r-sproutH]], '#7ac050');
      fill(ctx, [[cx+2, cy-r-sproutH+1]], '#6aaa4a');
    }
    if (sproutH >= 6) {
      fill(ctx, [[cx-3, cy-r-sproutH+1]], '#7ac050');
      fill(ctx, [[cx+3, cy-r-sproutH+2]], '#6aaa4a');
      // Flower bud
      fill(ctx, [[cx, cy-r-sproutH-1]], '#f08080');
      fill(ctx, [[cx-1, cy-r-sproutH]], '#f0a080');
    }
  }
}

function drawEmberCrown(ctx, size, detail) {
  const cx = 8;
  const w = [3, 4, 5, 6, 6][detail];
  const flameH = [1, 2, 3, 4, 4][detail];
  const crownY = detail <= 1 ? 9 : detail <= 3 ? 8 : 9;
  groundShadow(ctx, cx, crownY + 3, w);

  // Crown base band
  for (let dy = 0; dy <= 2; dy++)
    for (let dx = -w; dx <= w; dx++)
      fill(ctx, [[cx+dx, crownY+dy]], dy === 0 ? '#d04030' : dy === 1 ? '#c03020' : '#901818');

  // Crown points (3 or 5 depending on size)
  const points = detail >= 2 ? [-w+1, -Math.floor(w/2), 0, Math.floor(w/2), w-1] : [-w+1, 0, w-1];
  for (const px of points) {
    for (let h = 1; h <= 2; h++) fill(ctx, [[cx+px, crownY-h]], '#d04030');
  }
  // Center point taller
  for (let h = 1; h <= 3; h++) fill(ctx, [[cx, crownY-h]], '#e04838');

  // Gems
  fill(ctx, [[cx, crownY]], '#f0c040');
  if (detail >= 2) {
    fill(ctx, [[cx-Math.floor(w/2), crownY]], '#f0c040');
    fill(ctx, [[cx+Math.floor(w/2), crownY]], '#f0c040');
  }

  // Flames on tips — grow taller with rarity
  fill(ctx, [[cx, crownY-3]], '#f0a030');
  for (let h = 0; h < flameH; h++) {
    fill(ctx, [[cx, crownY-4-h]], h < flameH-1 ? '#f0a030' : '#f0c040');
  }
  if (detail >= 1) {
    for (const px of points) {
      fill(ctx, [[cx+px, crownY-3]], '#f0a030');
      if (flameH >= 2) fill(ctx, [[cx+px, crownY-4]], '#f0c040');
    }
  }
  if (detail >= 4) {
    fill(ctx, [[cx, crownY-4-flameH]], '#fffce0');
    fill(ctx, [[cx-1, crownY-3-flameH], [cx+1, crownY-3-flameH]], '#f0d860');
  }

  // Outline
  const allPx = [];
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const d = ctx.getImageData(x, y, 1, 1).data;
      if (d[3] > 30) allPx.push([x, y]);
    }
  outline(ctx, allPx, '#601010');
  // Re-fill (outline overwrites some)
  for (let dy = 0; dy <= 2; dy++)
    for (let dx = -w; dx <= w; dx++)
      fill(ctx, [[cx+dx, crownY+dy]], dy === 0 ? '#d04030' : dy === 1 ? '#c03020' : '#901818');
  fill(ctx, [[cx, crownY]], '#f0c040');
}

function drawFrostShard(ctx, size, detail) {
  const cx = 8;
  const h = [4, 6, 8, 10, 11][detail];
  const branches = [0, 1, 2, 3, 3][detail];
  const topY = 8 - Math.floor(h/2);
  groundShadow(ctx, cx, topY + h + 1, 2);

  // Main crystal shaft
  const body = [];
  for (let i = 0; i < h; i++) {
    const w = i < 2 ? 0 : i < h-2 ? 1 : 0;
    for (let dx = -w; dx <= w; dx++) body.push([cx+dx, topY+i]);
  }
  outline(ctx, body, '#0a3858');
  // Left facet
  for (const [x, y] of body) if (x < cx) fill(ctx, [[x, y]], '#80d0f0');
  // Right facet
  for (const [x, y] of body) if (x > cx) fill(ctx, [[x, y]], '#3090c0');
  // Center
  for (const [x, y] of body) if (x === cx) fill(ctx, [[x, y]], '#50b0e0');
  // Specular
  fill(ctx, [[cx, topY]], '#e0f4ff');
  fill(ctx, [[cx, topY+1]], '#c0ecff');

  // Side branches grow with rarity
  for (let b = 0; b < branches; b++) {
    const by = topY + 2 + b * Math.floor((h-3) / Math.max(branches, 1));
    const blen = 1 + Math.floor(b * 0.5);
    for (let i = 1; i <= blen; i++) {
      fill(ctx, [[cx-1-i, by-i]], '#80d0f0');
      fill(ctx, [[cx+1+i, by+i]], '#3090c0');
    }
    fill(ctx, [[cx-1-blen, by-blen]], '#a0e0ff');
    fill(ctx, [[cx+1+blen, by+blen]], '#2080a0');
  }
}

function drawStoneHeart(ctx, size, detail) {
  const cx = 8;
  const r = [2, 3, 4, 5, 5][detail];
  const cy = detail <= 1 ? 8 : 7;
  const geodeR = [0, 1, 1, 2, 3][detail];
  groundShadow(ctx, cx, cy + r + 2, r + 1);

  // Rock body — irregular ellipse
  const body = [];
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -(r+1); dx <= r+1; dx++)
      if ((dx*dx)/((r+1)*(r+1)) + (dy*dy)/(r*r) <= 1) body.push([cx+dx, cy+dy]);

  outline(ctx, body, '#2a1a08');
  fill(ctx, body, '#7a6848');
  for (const [x, y] of body) {
    if (x > cx + 1 && y > cy) fill(ctx, [[x, y]], '#5a4830');
    if (x < cx - 1 && y < cy) fill(ctx, [[x, y]], '#9a8868');
  }
  fill(ctx, [[cx-1, cy-r+1]], '#aaa078');
  fill(ctx, [[cx, cy-r]], '#bab090');

  // Geode opening — amber crystals
  if (geodeR > 0) {
    for (let dy = -geodeR; dy <= geodeR; dy++)
      for (let dx = -geodeR; dx <= geodeR; dx++)
        if (Math.abs(dx) + Math.abs(dy) <= geodeR)
          fill(ctx, [[cx+dx, cy+dy]], '#c09040');
    fill(ctx, [[cx, cy]], '#e0c868');
    if (geodeR >= 2) {
      fill(ctx, [[cx-1, cy]], '#d0b050');
      fill(ctx, [[cx, cy-1]], '#d8b858');
      fill(ctx, [[cx+1, cy+1]], '#a07030');
    }
    if (geodeR >= 3) {
      fill(ctx, [[cx, cy]], '#f0d878');
      fill(ctx, [[cx-1, cy-1]], '#e0c060');
      fill(ctx, [[cx-2, cy]], '#d0b050');
    }
  }
}

function drawGaleFeather(ctx, size, detail) {
  const cx = 8;
  const len = [5, 7, 9, 11, 12][detail];
  const barbW = [1, 1, 2, 2, 3][detail];
  const topY = 8 - Math.floor(len/2);
  groundShadow(ctx, cx, topY + len + 1, barbW + 1);

  // Shaft
  for (let i = 0; i < len; i++) fill(ctx, [[cx, topY+i]], '#308068');

  // Barbs — grow wider with rarity
  for (let i = 1; i < len-1; i++) {
    for (let b = 1; b <= barbW; b++) {
      const leftY = topY + i - (b > 1 ? 1 : 0);
      const rightY = topY + i + (b > 1 ? 1 : 0);
      fill(ctx, [[cx-b, leftY]], b === 1 ? '#60c0a8' : '#80d8c0');
      fill(ctx, [[cx+b, rightY]], b === 1 ? '#40a088' : '#308068');
    }
  }

  // Tip highlight
  fill(ctx, [[cx, topY]], '#b0f0e0');
  fill(ctx, [[cx, topY+1]], '#90d8c0');

  // Outline all
  const allPx = [];
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const d = ctx.getImageData(x, y, 1, 1).data;
      if (d[3] > 30) allPx.push([x, y]);
    }
  outline(ctx, allPx, '#18504a');
  // Redraw shaft on top of outline
  for (let i = 0; i < len; i++) fill(ctx, [[cx, topY+i]], '#308068');
  fill(ctx, [[cx, topY]], '#b0f0e0');
}

// ── Cool Shades — classic "deal with it" pixel sunglasses ─────────
// Matches the iconic meme sprite: thick top bar, big blocky staircase lenses

function drawCoolShades(ctx, size, detail) {
  const b = '#000000';
  const w = '#ffffff';

  // Thick top bar — 3 rows, full width
  for (let y = 3; y <= 5; y++)
    for (let x = 0; x <= 15; x++)
      fill(ctx, [[x, y]], b);

  // Left lens — big block with staircase bottom
  // Row 6: full lens width
  fill(ctx, [[0,6],[1,6],[2,6],[3,6],[4,6],[5,6],[6,6]], b);
  // Row 7
  fill(ctx, [[0,7],[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]], b);
  // Row 8: step in by 1
  fill(ctx, [[1,8],[2,8],[3,8],[4,8],[5,8],[6,8]], b);
  // Row 9: step in by 1 more
  fill(ctx, [[2,9],[3,9],[4,9],[5,9]], b);

  // Right lens — mirrored
  fill(ctx, [[9,6],[10,6],[11,6],[12,6],[13,6],[14,6],[15,6]], b);
  fill(ctx, [[9,7],[10,7],[11,7],[12,7],[13,7],[14,7],[15,7]], b);
  fill(ctx, [[9,8],[10,8],[11,8],[12,8],[13,8],[14,8]], b);
  fill(ctx, [[10,9],[11,9],[12,9],[13,9]], b);

  // Bridge between lenses
  fill(ctx, [[7,6],[8,6]], b);

  // White glare — small squares inside each lens
  fill(ctx, [[1,6],[2,6]], w);
  fill(ctx, [[1,7]], w);
  fill(ctx, [[13,6],[14,6]], w);
  fill(ctx, [[14,7]], w);
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
  sunglasses: drawCoolShades,
  seed: drawSeed,
  pot_fire: drawEmberCrown,
  pot_ice: drawFrostShard,
  pot_earth: drawStoneHeart,
  pot_wind: drawGaleFeather,
};

export function renderItemIcon(type, rarity, scale = 3) {
  const pixelSize = 16;
  const detail = RARITY_DETAIL[rarity] ?? 0;
  const { canvas: src, ctx } = createCanvas(pixelSize, pixelSize);

  const renderer = RENDERERS[type];
  if (renderer) {
    renderer(ctx, pixelSize, detail);
  }

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

  return display;
}
