// Canvas utilities — pixel drawing, palettes, canvas creation

export function createCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

export function setPixel(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
}

export function drawRect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), w, h);
}

// Draw a filled trapezoid (for pots)
export function drawTrapezoid(ctx, x, y, topW, bottomW, h, color) {
  ctx.fillStyle = color;
  const topLeft = x + Math.floor((bottomW - topW) / 2);
  for (let row = 0; row < h; row++) {
    const t = row / (h - 1 || 1);
    const w = Math.round(topW + (bottomW - topW) * (1 - t));
    const rx = x + Math.floor((bottomW - w) / 2);
    ctx.fillRect(rx, y + row, w, 1);
  }
}

// HSL to hex
export function hsl(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r, g, b;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (v) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Generate a plant palette from RNG
export function generatePalette(rng) {
  // Green base hue with variation
  const greenHue = rng.int(90, 150);
  const greens = [
    hsl(greenHue, rng.int(40, 70), 20), // dark
    hsl(greenHue, rng.int(50, 80), 35), // medium
    hsl(greenHue, rng.int(50, 80), 50), // light
    hsl(greenHue, rng.int(40, 60), 65), // highlight
  ];

  // Flower accent hue — complementary-ish
  const flowerHue = rng.pick([0, 30, 45, 280, 300, 320, 340, 200, 60]);
  const flowers = [
    hsl(flowerHue, rng.int(60, 90), 40),
    hsl(flowerHue, rng.int(70, 95), 55),
    hsl(flowerHue, rng.int(70, 95), 70),
  ];

  // Pot colors
  const potPresets = [
    // Terracotta
    [hsl(15, 60, 30), hsl(15, 55, 40), hsl(15, 50, 50)],
    // Stone
    [hsl(30, 10, 35), hsl(30, 10, 45), hsl(30, 10, 55)],
    // Ceramic white
    [hsl(40, 15, 70), hsl(40, 15, 80), hsl(40, 10, 88)],
    // Wood
    [hsl(25, 50, 25), hsl(25, 45, 35), hsl(25, 40, 45)],
    // Dark ceramic
    [hsl(220, 15, 25), hsl(220, 15, 35), hsl(220, 10, 45)],
  ];
  const pot = rng.pick(potPresets);

  // Soil
  const soil = [hsl(25, 40, 18), hsl(25, 35, 25)];

  // Stem/bark — woody brown for complex plants
  const stem = hsl(rng.int(20, 35), rng.int(30, 50), rng.int(20, 30));

  return { greens, flowers, pot, soil, stem };
}

// Elemental pot color palettes
export const ELEMENTAL_POT_PALETTES = {
  fire: {
    pot: ['#8b2500', '#c44000', '#e06030'],
    soil: ['#3a1a0a', '#5a2a10'],
  },
  ice: {
    pot: ['#1a5a7a', '#3a9ac0', '#80d0f0'],
    soil: ['#1a3040', '#2a4a5a'],
  },
  earth: {
    pot: ['#4a3a20', '#7a6040', '#a08860'],
    soil: ['#2a1a08', '#4a3018'],
  },
  wind: {
    pot: ['#1a5a4a', '#3a9a8a', '#70d0c0'],
    soil: ['#1a3a2a', '#2a5a4a'],
  },
};

// Clear canvas with transparent background
export function clearCanvas(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
}
