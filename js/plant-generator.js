// Procedural pixel art plant generator
// Renders a plant deterministically from seed + growth stage

import { createRng } from './rng.js';
import {
  createCanvas,
  setPixel,
  clearCanvas,
  generatePalette,
  hsl,
} from './canvas-utils.js';
import {
  getCanvasSize,
  LEAF_TEMPLATES,
  FLOWER_TEMPLATES,
} from './plant-data.js';

// ── Pot ────────────────────────────────────────────────────────────

function drawPot(ctx, size, palette, rng) {
  const potColors = palette.pot;
  const bottomY = size - 1;
  const potHeight = Math.max(5, Math.floor(size * 0.24));
  const rimHeight = Math.max(2, Math.floor(potHeight * 0.28));
  const potBottom = bottomY;
  const potTop = potBottom - potHeight;

  const bottomW = Math.floor(size * 0.36);
  const topW = Math.floor(size * 0.54);
  const cx = Math.floor(size / 2);

  // Pot body with highlight stripe
  for (let row = 0; row < potHeight - rimHeight; row++) {
    const t = row / (potHeight - rimHeight || 1);
    const w = Math.round(bottomW + (topW - bottomW) * t);
    const left = cx - Math.floor(w / 2);
    for (let x = left; x < left + w; x++) {
      // Shading: left edge dark, center has a vertical highlight
      const fromLeft = x - left;
      const fromRight = (left + w - 1) - x;
      let shade;
      if (fromLeft === 0 || fromRight === 0) shade = 0;
      else if (fromLeft <= 1) shade = 0;
      else if (fromLeft >= Math.floor(w * 0.4) && fromLeft <= Math.floor(w * 0.55)) shade = 2;
      else shade = 1;
      setPixel(ctx, x, potBottom - row, potColors[Math.min(shade, potColors.length - 1)]);
    }
  }

  // Rim — slightly flared
  const rimW = topW + 4;
  for (let row = 0; row < rimHeight; row++) {
    const t = row / (rimHeight || 1);
    const rw = Math.round(rimW - t * 2); // slight taper upward
    const left = cx - Math.floor(rw / 2);
    for (let x = left; x < left + rw; x++) {
      const fromLeft = x - left;
      const fromRight = (left + rw - 1) - x;
      let shade;
      if (fromLeft === 0 || fromRight === 0) shade = 0;
      else if (fromLeft >= Math.floor(rw * 0.4) && fromLeft <= Math.floor(rw * 0.55)) shade = 2;
      else shade = 1;
      setPixel(ctx, x, potTop + rimHeight - row, potColors[Math.min(shade, potColors.length - 1)]);
    }
  }

  // Rim line (thin top edge)
  const rimLineW = rimW - 2;
  const rimLineLeft = cx - Math.floor(rimLineW / 2);
  for (let x = rimLineLeft; x < rimLineLeft + rimLineW; x++) {
    setPixel(ctx, x, potTop + 1, potColors[0]);
  }

  // Soil — textured fill inside pot
  const soilY = potTop + rimHeight - 1;
  const soilW = topW - 2;
  const soilLeft = cx - Math.floor(soilW / 2);
  for (let row = 0; row < 2; row++) {
    for (let x = soilLeft; x < soilLeft + soilW; x++) {
      const c = rng.chance(0.35) ? palette.soil[0] : palette.soil[1];
      setPixel(ctx, x, soilY - row, c);
    }
  }

  // Pot decoration — small detail line for richer pots
  if (rng.chance(0.5)) {
    const decoY = potBottom - Math.floor((potHeight - rimHeight) * 0.5);
    const decoT = ((potHeight - rimHeight) * 0.5) / (potHeight - rimHeight || 1);
    const decoW = Math.round(bottomW + (topW - bottomW) * decoT) - 4;
    const decoLeft = cx - Math.floor(decoW / 2);
    for (let x = decoLeft; x < decoLeft + decoW; x++) {
      if (rng.chance(0.7)) {
        setPixel(ctx, x, decoY, potColors[2]);
      }
    }
  }

  return { soilY, cx };
}

// ── Stem ───────────────────────────────────────────────────────────

function drawStem(ctx, cx, soilY, height, palette, rng, complexity, size) {
  const green = palette.greens;
  const stemTop = soilY - height;
  const points = [];
  let drift = 0;
  const driftDir = rng.chance(0.5) ? 1 : -1;
  const curviness = rng.float(0.03, 0.1);

  // Determine stem thickness
  const baseThick = complexity >= 4 ? 3 : complexity >= 2 ? 2 : 1;

  // Stem color — brown-green for woody plants, green for others
  const stemDark = complexity >= 4 ? palette.stem || green[0] : green[0];
  const stemMid = green[1];

  for (let y = soilY - 1; y >= stemTop; y--) {
    drift += (rng.random() - 0.5 + driftDir * curviness);
    if (Math.abs(drift) > size * 0.12) drift *= 0.7;
    const px = Math.round(cx + drift);

    // Thickness tapers from base to tip
    const progress = (soilY - y) / height; // 0 at base, 1 at tip
    const thick = Math.max(1, Math.round(baseThick * (1 - progress * 0.6)));

    for (let t = -Math.floor(thick / 2); t <= Math.floor(thick / 2); t++) {
      const isEdge = Math.abs(t) === Math.floor(thick / 2) && thick > 1;
      setPixel(ctx, px + t, y, isEdge ? stemDark : stemMid);
    }

    // Bark texture on thick stems
    if (thick >= 2 && rng.chance(0.15)) {
      setPixel(ctx, px + rng.int(-Math.floor(thick / 2), Math.floor(thick / 2)), y, green[0]);
    }

    points.push({ x: px, y });
  }

  return points;
}

// ── Branches ───────────────────────────────────────────────────────

function drawBranches(ctx, stemPoints, palette, rng, complexity, growthStage, size) {
  const green = palette.greens;
  const branchPoints = [];
  const numBranches = complexity + rng.int(1, 3);

  // Try to space branches out vertically
  const usedZones = [];

  for (let i = 0; i < numBranches; i++) {
    const idx = rng.int(
      Math.floor(stemPoints.length * 0.15),
      Math.floor(stemPoints.length * 0.88)
    );
    const start = stemPoints[idx];
    if (!start) continue;

    // Avoid branches too close together
    const zone = Math.floor(idx / (stemPoints.length * 0.15));
    if (usedZones.includes(zone) && rng.chance(0.5)) continue;
    usedZones.push(zone);

    const dir = rng.chance(0.5) ? -1 : 1;
    const branchLen = rng.int(3, Math.max(4, Math.floor(stemPoints.length * 0.45)));
    let bx = start.x;
    let by = start.y;
    const upBias = rng.float(0.3, 0.6);

    for (let j = 0; j < branchLen; j++) {
      bx += dir;
      if (rng.chance(upBias)) by -= 1;
      else if (rng.chance(0.15)) by += 1;

      // Branch thickness tapers
      const thick = j < branchLen * 0.3 && complexity >= 3 ? 2 : 1;
      for (let t = 0; t < thick; t++) {
        setPixel(ctx, bx, by - t, green[rng.chance(0.4) ? 0 : 1]);
      }
      branchPoints.push({ x: bx, y: by });

      // Sub-branches for high complexity
      if (complexity >= 4 && j > branchLen * 0.4 && rng.chance(0.25)) {
        const subDir = rng.chance(0.5) ? -1 : 1;
        let sx = bx, sy = by;
        const subLen = rng.int(2, 4);
        for (let k = 0; k < subLen; k++) {
          sx += subDir;
          if (rng.chance(0.5)) sy -= 1;
          setPixel(ctx, sx, sy, green[rng.chance(0.3) ? 0 : 1]);
          branchPoints.push({ x: sx, y: sy });
        }
      }
    }
  }

  return branchPoints;
}

// ── Leaves ─────────────────────────────────────────────────────────

function drawLeaf(ctx, x, y, template, colors, flip, rng) {
  const pixels = LEAF_TEMPLATES[template] || LEAF_TEMPLATES.round;
  for (const [dx, dy] of pixels) {
    const fx = flip ? -dx : dx;
    // Vary shade per pixel for depth
    const shade = rng.int(0, colors.length - 1);
    // Edges darker, center lighter
    const dist = Math.abs(dx) + Math.abs(dy);
    const edgeShade = dist > 2 ? Math.max(0, shade - 1) : shade;
    setPixel(ctx, x + fx, y + dy, colors[edgeShade]);
  }
}

function drawLeaves(ctx, points, palette, rng, leafType, growthStage, complexity, size) {
  const green = palette.greens;
  // More leaves for bigger / more complex plants
  const density = 0.3 + complexity * 0.15;
  const numLeaves = Math.max(
    2,
    Math.floor(points.length * density * growthStage)
  );

  // Prefer placing leaves at branch tips and upper stem
  const sorted = [...points].sort((a, b) => a.y - b.y);
  const tipBias = sorted.slice(0, Math.floor(sorted.length * 0.6));

  for (let i = 0; i < numLeaves; i++) {
    // 70% chance to pick from upper portion
    const pt = rng.chance(0.7) ? rng.pick(tipBias) : rng.pick(points);
    const flip = rng.chance(0.5);
    // Use 2-3 shades for each leaf for richness
    const baseShade = rng.int(1, 3);
    const leafColors = [
      green[Math.max(0, baseShade - 1)],
      green[Math.min(baseShade, green.length - 1)],
      green[Math.min(baseShade + 1, green.length - 1)],
    ];
    drawLeaf(ctx, pt.x, pt.y, leafType, leafColors, flip, rng);
  }
}

// ── Flowers ────────────────────────────────────────────────────────

function drawFlowers(ctx, points, palette, rng, growthStage, complexity, size) {
  const flowerColors = palette.flowers;
  const templateKey = rng.pick(Object.keys(FLOWER_TEMPLATES));
  const template = FLOWER_TEMPLATES[templateKey][0];

  // Place flowers at the highest points / branch tips
  const topPoints = [...points]
    .sort((a, b) => a.y - b.y)
    .slice(0, Math.max(8, Math.floor(points.length * 0.35)));

  // More flowers for complex plants
  const numFlowers = rng.int(
    Math.max(1, Math.floor(complexity * 0.5)),
    Math.min(6, complexity + 1)
  );
  const minDist = size > 40 ? 5 : 3; // space them out
  const placed = [];

  for (let i = 0; i < numFlowers; i++) {
    // Try a few candidates to find one that's spaced out
    let best = null;
    for (let attempt = 0; attempt < 8; attempt++) {
      const pt = rng.pick(topPoints);
      const tooClose = placed.some(
        (p) => Math.abs(p.x - pt.x) + Math.abs(p.y - pt.y) < minDist
      );
      if (!tooClose) { best = pt; break; }
      if (!best) best = pt;
    }
    if (!best) continue;
    placed.push(best);

    // Bloom progress — flowers open gradually
    const bloom = Math.min(1, (growthStage - 0.7) / 0.25);

    // Petals — outer layer
    const petalColor1 = flowerColors[2];
    const petalColor2 = flowerColors[1];
    for (const [dx, dy] of template.petals) {
      // Scale petals by bloom — only draw outer ones when fully bloomed
      const dist = Math.abs(dx) + Math.abs(dy);
      if (dist > 3 && bloom < 0.5) continue;
      const c = dist > 2 ? petalColor1 : petalColor2;
      setPixel(ctx, best.x + dx, best.y + dy, c);
    }

    // Center — always drawn once bloom starts
    const centerColor = flowerColors[0];
    for (const [cdx, cdy] of template.center) {
      setPixel(ctx, best.x + cdx, best.y + cdy, centerColor);
    }
  }
}

// ── Sparkles ───────────────────────────────────────────────────────

function drawSparkles(ctx, size, rng, frameOffset) {
  const colors = ['#fffbe6', '#fff5cc', '#ffffff'];
  const numSparkles = rng.int(5, 12);
  for (let i = 0; i < numSparkles; i++) {
    const sx = rng.int(3, size - 4);
    const sy = rng.int(3, size - 8);
    if ((i + (frameOffset || 0)) % 3 === 0) {
      const c = rng.pick(colors);
      // 4-point star sparkle
      setPixel(ctx, sx, sy, c);
      setPixel(ctx, sx - 1, sy, c);
      setPixel(ctx, sx + 1, sy, c);
      setPixel(ctx, sx, sy - 1, c);
      setPixel(ctx, sx, sy + 1, c);
    }
  }
}

// ── Succulent ──────────────────────────────────────────────────────

function drawSucculent(ctx, cx, soilY, height, palette, rng, growthStage, size) {
  const green = palette.greens;
  const layers = Math.max(1, Math.floor(growthStage * 7));
  const baseY = soilY - 2;
  const maxRadius = Math.max(3, Math.floor(size * 0.28));

  for (let layer = 0; layer < layers; layer++) {
    const t = layer / Math.max(1, layers - 1);
    const radius = Math.max(2, Math.floor(maxRadius * (1 - t * 0.45)));
    const angle = layer * 0.75 + rng.float(0, 0.6);
    const y = baseY - layer * Math.max(1, Math.floor(size * 0.04));
    const numPetals = layer < 2 ? 6 : 5;

    for (let a = 0; a < numPetals; a++) {
      const dir = (a * Math.PI * 2) / numPetals + angle;

      for (let r = 0; r < radius; r++) {
        const rt = r / radius;
        const px = Math.round(cx + Math.cos(dir) * r);
        const py = Math.round(y + Math.sin(dir) * r * 0.55);

        // Fat leaf cross-section (wider in the middle)
        const width = Math.max(1, Math.round((1 - Math.abs(rt - 0.5) * 2) * 2.5));
        const perp = dir + Math.PI / 2;

        for (let w = -Math.floor(width / 2); w <= Math.floor(width / 2); w++) {
          const wx = Math.round(px + Math.cos(perp) * w);
          const wy = Math.round(py + Math.sin(perp) * w * 0.55);
          // Shade: lighter at tip, darker at edge
          let shade;
          if (w === -Math.floor(width / 2) || w === Math.floor(width / 2)) shade = 0;
          else if (rt > 0.8) shade = 3;
          else shade = layer % 2 === 0 ? 2 : 1;
          setPixel(ctx, wx, wy, green[Math.min(shade, green.length - 1)]);
        }
      }
    }
  }

  // Tiny highlight dots on leaf tips
  for (let i = 0; i < layers; i++) {
    const angle = i * 0.75 + rng.float(0, 0.6);
    const y = baseY - i * Math.max(1, Math.floor(size * 0.04));
    const radius = Math.max(2, Math.floor(maxRadius * (1 - (i / Math.max(1, layers - 1)) * 0.45)));
    const numPetals = i < 2 ? 6 : 5;
    for (let a = 0; a < numPetals; a++) {
      const dir = (a * Math.PI * 2) / numPetals + angle;
      const tipX = Math.round(cx + Math.cos(dir) * (radius - 1));
      const tipY = Math.round(y + Math.sin(dir) * (radius - 1) * 0.55);
      setPixel(ctx, tipX, tipY, green[3]);
    }
  }
}

// ── Bonsai ─────────────────────────────────────────────────────────

function drawBonsaiCanopy(ctx, points, palette, rng, growthStage, size) {
  const green = palette.greens;
  // Find a few cluster points — the top and branch ends
  const sorted = [...points].sort((a, b) => a.y - b.y);
  const clusterCount = Math.max(1, Math.min(4, Math.floor(growthStage * 4)));
  const clusters = [];
  const minClusterDist = size * 0.15;

  for (const pt of sorted) {
    const tooClose = clusters.some(
      (c) => Math.abs(c.x - pt.x) + Math.abs(c.y - pt.y) < minClusterDist
    );
    if (!tooClose) {
      clusters.push(pt);
      if (clusters.length >= clusterCount) break;
    }
  }

  for (const pt of clusters) {
    const radius = rng.int(
      Math.max(3, Math.floor(size * 0.08)),
      Math.max(4, Math.floor(size * 0.16 * growthStage))
    );

    // Irregular cloud shape
    for (let dy = -radius; dy <= Math.floor(radius * 0.3); dy++) {
      const vertT = (dy + radius) / (radius * 1.3);
      const rowW = Math.floor(radius * Math.sin(vertT * Math.PI) * 1.6);
      for (let dx = -rowW; dx <= rowW; dx++) {
        // Irregular edges
        const edgeDist = Math.sqrt(dx * dx + dy * dy);
        if (edgeDist > radius * 1.2 + rng.float(-1, 1)) continue;

        const isEdge = Math.abs(dx) >= rowW - 1 || dy === -radius || dy >= Math.floor(radius * 0.3) - 1;
        const shade = isEdge ? rng.int(0, 1) : rng.int(1, 3);
        setPixel(ctx, pt.x + dx, pt.y + dy, green[Math.min(shade, green.length - 1)]);
      }
    }

    // Highlight dots on top of canopy
    for (let i = 0; i < radius; i++) {
      const hx = pt.x + rng.int(-radius + 2, radius - 2);
      const hy = pt.y - rng.int(1, radius - 1);
      setPixel(ctx, hx, hy, green[3]);
    }
  }
}

// ── Cactus body ────────────────────────────────────────────────────

function drawCactusBody(ctx, cx, soilY, height, palette, rng, growthStage, size) {
  const green = palette.greens;
  const bodyW = Math.max(3, Math.floor(size * 0.14));
  const bodyTop = soilY - height;

  // Main body — thick column with rounded top
  for (let y = soilY - 1; y >= bodyTop; y--) {
    const progress = (soilY - y) / height;
    // Rounded at top
    let w = bodyW;
    if (progress > 0.85) {
      const roundT = (progress - 0.85) / 0.15;
      w = Math.max(1, Math.round(bodyW * (1 - roundT * 0.7)));
    }

    const left = cx - Math.floor(w / 2);
    for (let x = left; x < left + w; x++) {
      const fromLeft = x - left;
      const isEdge = fromLeft === 0 || fromLeft === w - 1;
      // Vertical ribs
      const isRib = (x - left) % 2 === 0 && w > 3;
      let shade;
      if (isEdge) shade = 0;
      else if (isRib) shade = 1;
      else shade = 2;
      setPixel(ctx, x, y, green[shade]);
    }
  }

  // Spines
  for (let y = bodyTop + 2; y < soilY - 2; y += 3) {
    if (rng.chance(0.7)) {
      const left = cx - Math.floor(bodyW / 2);
      setPixel(ctx, left - 1, y, '#d4c8a0');
      setPixel(ctx, left - 2, y - 1, '#d4c8a0');
    }
    if (rng.chance(0.7)) {
      const right = cx + Math.floor(bodyW / 2);
      setPixel(ctx, right + 1, y, '#d4c8a0');
      setPixel(ctx, right + 2, y - 1, '#d4c8a0');
    }
  }

  // Arms if growth > 0.4
  const armPoints = [];
  if (growthStage > 0.4) {
    const numArms = rng.int(1, Math.min(3, Math.floor(growthStage * 3)));
    for (let i = 0; i < numArms; i++) {
      const armY = Math.floor(soilY - height * rng.float(0.3, 0.7));
      const dir = rng.chance(0.5) ? -1 : 1;
      const armLen = rng.int(3, Math.max(4, Math.floor(height * 0.3)));
      let ax = cx + dir * Math.floor(bodyW / 2);
      let ay = armY;

      // Horizontal segment
      for (let j = 0; j < Math.floor(armLen * 0.5); j++) {
        ax += dir;
        for (let t = 0; t < 2; t++) {
          setPixel(ctx, ax, ay + t, green[t === 0 ? 1 : 2]);
        }
        armPoints.push({ x: ax, y: ay });
      }
      // Vertical segment going up
      for (let j = 0; j < Math.floor(armLen * 0.6); j++) {
        ay -= 1;
        for (let t = 0; t < 2; t++) {
          setPixel(ctx, ax + t, ay, green[t === 0 ? 1 : 2]);
        }
        armPoints.push({ x: ax, y: ay });
        // Spines on arms
        if (rng.chance(0.4)) {
          setPixel(ctx, ax + dir * 2, ay, '#d4c8a0');
        }
      }
    }
  }

  // Return top point + arm tips for flower placement
  const allPoints = [{ x: cx, y: bodyTop }, ...armPoints];
  return allPoints;
}

// ── Moon Lily special ──────────────────────────────────────────────

function drawMoonLilyPetals(ctx, points, palette, rng, growthStage, size) {
  const flowerColors = palette.flowers;
  // Ethereal large lily blooms
  const topPoints = [...points].sort((a, b) => a.y - b.y).slice(0, 5);
  const numFlowers = rng.int(1, 3);
  const placed = [];

  for (let i = 0; i < numFlowers; i++) {
    const pt = rng.pick(topPoints);
    const tooClose = placed.some(p => Math.abs(p.x - pt.x) + Math.abs(p.y - pt.y) < 6);
    if (tooClose && i > 0) continue;
    placed.push(pt);

    const bloom = Math.min(1, (growthStage - 0.7) / 0.25);
    const petalLen = Math.max(2, Math.floor(size * 0.1 * bloom));
    const numPetals = 6;

    for (let p = 0; p < numPetals; p++) {
      const angle = (p * Math.PI * 2) / numPetals + rng.float(0, 0.3);
      for (let r = 0; r < petalLen; r++) {
        const px = Math.round(pt.x + Math.cos(angle) * r);
        const py = Math.round(pt.y + Math.sin(angle) * r * 0.7);
        const rt = r / petalLen;
        // Petal widens then tapers
        const width = Math.max(1, Math.round(Math.sin(rt * Math.PI) * 2.5));
        const perp = angle + Math.PI / 2;
        for (let w = -Math.floor(width / 2); w <= Math.floor(width / 2); w++) {
          const wx = Math.round(px + Math.cos(perp) * w);
          const wy = Math.round(py + Math.sin(perp) * w * 0.7);
          const isEdge = Math.abs(w) === Math.floor(width / 2);
          setPixel(ctx, wx, wy, isEdge ? flowerColors[1] : flowerColors[2]);
        }
      }
    }
    // Glowing center
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        setPixel(ctx, pt.x + dx, pt.y + dy, flowerColors[0]);
      }
    }
    setPixel(ctx, pt.x, pt.y, '#fffbe6');
  }
}

// ── Crystal Tree special ───────────────────────────────────────────

function drawCrystalShards(ctx, points, palette, rng, growthStage, size) {
  const crystalHue = rng.pick([180, 200, 260, 290, 330]);
  const crystalColors = [
    hsl(crystalHue, 50, 40),
    hsl(crystalHue, 60, 55),
    hsl(crystalHue, 65, 70),
    hsl(crystalHue, 40, 85),
  ];

  const topPoints = [...points].sort((a, b) => a.y - b.y).slice(0, 10);
  const numCrystals = Math.min(8, Math.floor(growthStage * 10));

  for (let i = 0; i < numCrystals; i++) {
    const pt = rng.pick(topPoints);
    const crystalH = rng.int(3, Math.max(4, Math.floor(size * 0.12)));
    const crystalW = rng.int(2, Math.max(3, Math.floor(crystalH * 0.6)));

    // Draw a faceted crystal shape pointing up
    for (let row = 0; row < crystalH; row++) {
      const t = row / crystalH;
      const w = Math.max(1, Math.round(crystalW * (1 - t * 0.7)));
      const left = pt.x - Math.floor(w / 2);
      for (let x = left; x < left + w; x++) {
        const fromLeft = x - left;
        let shade;
        if (fromLeft === 0) shade = 0;
        else if (fromLeft === w - 1) shade = 1;
        else shade = t < 0.3 ? 2 : 3;
        setPixel(ctx, x, pt.y - row, crystalColors[shade]);
      }
    }
    // Tip highlight
    setPixel(ctx, pt.x, pt.y - crystalH, crystalColors[3]);
  }
}

// ── Main render ────────────────────────────────────────────────────

export function renderPlant(plant, growthStage, frameOffset = 0) {
  const size = getCanvasSize(plant.rarity);
  const { canvas, ctx } = createCanvas(size, size);
  const rng = createRng(plant.seed);
  const palette = generatePalette(rng);
  const species = plant.species;
  const complexity = plant.complexity || 2;

  clearCanvas(ctx, size, size);

  // Always draw pot
  const { soilY, cx } = drawPot(ctx, size, palette, rng);

  if (growthStage < 0.05) {
    return canvas;
  }

  // Calculate stem height based on growth
  const maxStemHeight = Math.floor((soilY - 4) * 0.78);
  const stemProgress = Math.min(1, growthStage / 0.7);
  const stemHeight = Math.max(3, Math.floor(maxStemHeight * stemProgress));

  // ── Succulent ──
  if (species === 'Succulent') {
    drawSucculent(ctx, cx, soilY, stemHeight, palette, rng, growthStage, size);
    if (growthStage >= 1.0) {
      const sparkRng = createRng(plant.seed + 999);
      drawSparkles(ctx, size, sparkRng, frameOffset);
    }
    return canvas;
  }

  // ── Cactus Rose ──
  if (species === 'Cactus Rose') {
    const cactusPoints = drawCactusBody(ctx, cx, soilY, stemHeight, palette, rng, growthStage, size);
    if (growthStage > 0.7 && plant.hasFlowers) {
      drawFlowers(ctx, cactusPoints, palette, rng, growthStage, complexity, size);
    }
    if (growthStage >= 1.0) {
      const sparkRng = createRng(plant.seed + 999);
      drawSparkles(ctx, size, sparkRng, frameOffset);
    }
    return canvas;
  }

  // ── Standard stem-based plants ──
  const stemPoints = drawStem(ctx, cx, soilY, stemHeight, palette, rng, complexity, size);
  let allPoints = [...stemPoints];

  // Branches at growth > 0.25 for complexity >= 2
  if (growthStage > 0.25 && complexity >= 2) {
    const branchPoints = drawBranches(ctx, stemPoints, palette, rng, complexity, growthStage, size);
    allPoints = [...allPoints, ...branchPoints];
  }

  // Bonsai canopy
  if (species === 'Bonsai' && growthStage > 0.25) {
    drawBonsaiCanopy(ctx, allPoints, palette, rng, growthStage, size);
  }

  // Crystal Tree shards
  if (species === 'Crystal Tree' && growthStage > 0.3) {
    // Draw leaves first as background foliage
    const leafGrowth = Math.min(1, (growthStage - 0.15) / 0.55);
    drawLeaves(ctx, allPoints, palette, rng, plant.leafType || 'tiny', leafGrowth, complexity, size);
    drawCrystalShards(ctx, allPoints, palette, rng, growthStage, size);
    if (growthStage >= 1.0) {
      const sparkRng = createRng(plant.seed + 999);
      drawSparkles(ctx, size, sparkRng, frameOffset);
    }
    return canvas;
  }

  // Leaves at growth > 0.15
  if (growthStage > 0.15) {
    const leafGrowth = Math.min(1, (growthStage - 0.15) / 0.55);
    drawLeaves(ctx, allPoints, palette, rng, plant.leafType || 'round', leafGrowth, complexity, size);
  }

  // Moon Lily special flowers
  if (species === 'Moon Lily' && growthStage > 0.7) {
    drawMoonLilyPetals(ctx, allPoints, palette, rng, growthStage, size);
  }
  // Standard flowers
  else if (growthStage > 0.7 && plant.hasFlowers) {
    drawFlowers(ctx, allPoints, palette, rng, growthStage, complexity, size);
  }

  // Completion sparkle
  if (growthStage >= 1.0) {
    const sparkRng = createRng(plant.seed + 999);
    drawSparkles(ctx, size, sparkRng, frameOffset);
  }

  return canvas;
}

// Render at display scale
export function renderPlantScaled(plant, growthStage, scale = 6, frameOffset = 0) {
  const srcCanvas = renderPlant(plant, growthStage, frameOffset);
  const w = srcCanvas.width * scale;
  const h = srcCanvas.height * scale;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.style.imageRendering = 'pixelated';
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(srcCanvas, 0, 0, w, h);
  return canvas;
}
