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

function drawCrystalTrunk(ctx, cx, soilY, height, rng, size) {
  const trunkHue = rng.pick([180, 200, 220, 260]);
  const trunkColors = [
    hsl(trunkHue, 25, 25),  // dark edge
    hsl(trunkHue, 30, 40),  // mid
    hsl(trunkHue, 20, 55),  // inner
    hsl(trunkHue, 15, 72),  // highlight streak
  ];

  const stemTop = soilY - height;
  const points = [];
  let drift = 0;
  const driftDir = rng.chance(0.5) ? 1 : -1;

  // Crystal trunk is slightly thicker, faceted
  const baseThick = 3;

  for (let y = soilY - 1; y >= stemTop; y--) {
    drift += (rng.random() - 0.5 + driftDir * 0.04);
    if (Math.abs(drift) > size * 0.08) drift *= 0.7;
    const px = Math.round(cx + drift);
    const progress = (soilY - y) / height;
    const thick = Math.max(2, Math.round(baseThick * (1 - progress * 0.4)));
    const half = Math.floor(thick / 2);

    for (let t = -half; t <= half; t++) {
      // Faceted shading — left dark, center bright, right mid
      let shade;
      if (t === -half) shade = 0;
      else if (t === half) shade = 1;
      else shade = 2;
      // Internal light streak every few pixels
      if (t === 0 && y % 3 === 0 && progress > 0.1 && progress < 0.85) shade = 3;
      setPixel(ctx, px + t, y, trunkColors[shade]);
    }

    points.push({ x: px, y });
  }

  return { points, trunkHue };
}

function drawCrystalBranches(ctx, stemPoints, rng, size, trunkHue) {
  const branchColors = [
    hsl(trunkHue, 25, 30),
    hsl(trunkHue, 30, 45),
    hsl(trunkHue, 20, 60),
  ];
  const branchPoints = [];
  const numBranches = rng.int(3, 6);

  for (let i = 0; i < numBranches; i++) {
    const idx = rng.int(
      Math.floor(stemPoints.length * 0.2),
      Math.floor(stemPoints.length * 0.85)
    );
    const start = stemPoints[idx];
    if (!start) continue;

    const dir = rng.chance(0.5) ? -1 : 1;
    const branchLen = rng.int(3, Math.max(5, Math.floor(size * 0.2)));
    let bx = start.x;
    let by = start.y;

    for (let j = 0; j < branchLen; j++) {
      bx += dir;
      if (rng.chance(0.55)) by -= 1;
      const shade = j < 2 ? 0 : j > branchLen - 2 ? 2 : 1;
      setPixel(ctx, bx, by, branchColors[shade]);
      if (j < branchLen * 0.4) {
        setPixel(ctx, bx, by + 1, branchColors[0]);
      }
      branchPoints.push({ x: bx, y: by });
    }
  }

  return branchPoints;
}

function drawCrystalFormation(ctx, x, y, height, width, angle, colors, accentColors, rng) {
  // Draw a single crystal prism at an angle
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);

  for (let row = 0; row < height; row++) {
    const t = row / height;
    // Hexagonal taper — widens slightly in middle, narrows at tip
    const widthMul = t < 0.3 ? (0.7 + t) : (1.0 - (t - 0.3) * 1.1);
    const w = Math.max(1, Math.round(width * Math.max(0.3, widthMul)));
    const half = Math.floor(w / 2);

    for (let col = -half; col <= half; col++) {
      const px = Math.round(x + cos * row * 0.15 + col);
      const py = Math.round(y - row + sin * col * 0.1);

      // Faceted shading with refraction
      let shade;
      const fromEdge = Math.min(col - (-half), half - col);
      if (fromEdge === 0) shade = 0;                        // dark edge
      else if (col < 0 && fromEdge === 1) shade = 1;        // left face
      else if (col > 0 && fromEdge === 1) shade = 2;        // right face (lighter)
      else shade = 3;                                        // bright interior

      // Internal refraction lines
      if (col === 0 && row % 2 === 0 && t > 0.15 && t < 0.8) shade = 4;
      // Prismatic glint near top
      if (t > 0.75 && fromEdge > 0 && rng.chance(0.4)) shade = 5;

      const c = shade >= colors.length ? colors[colors.length - 1] : colors[shade];
      setPixel(ctx, px, py, c);
    }
  }

  // Sharp tip highlight
  setPixel(ctx, Math.round(x + cos * height * 0.15), y - height, colors[colors.length - 1]);
  // Prismatic sparkle at tip
  if (rng.chance(0.6)) {
    const tipX = Math.round(x + cos * height * 0.15);
    const tipY = y - height;
    const sparkColor = rng.pick(accentColors);
    setPixel(ctx, tipX - 1, tipY, sparkColor);
    setPixel(ctx, tipX + 1, tipY, sparkColor);
    setPixel(ctx, tipX, tipY - 1, sparkColor);
  }
}

function drawCrystalShards(ctx, points, palette, rng, growthStage, size) {
  // Primary crystal hue
  const crystalHue = rng.pick([180, 200, 260, 290, 330]);
  // Secondary accent hue for prismatic refraction
  const accentHue = (crystalHue + rng.pick([40, 60, 120, 180])) % 360;

  const crystalColors = [
    hsl(crystalHue, 45, 28),   // dark edge
    hsl(crystalHue, 55, 42),   // left face
    hsl(crystalHue, 60, 58),   // right face
    hsl(crystalHue, 50, 72),   // bright interior
    hsl(accentHue, 70, 78),    // refraction line
    '#ffffff',                  // tip sparkle
  ];

  const accentColors = [
    hsl(accentHue, 70, 70),
    hsl((crystalHue + 30) % 360, 60, 80),
    hsl((crystalHue - 30 + 360) % 360, 60, 75),
    '#ffe8ff',
    '#e8ffff',
  ];

  // Sort points for placement — top and branch ends
  const sorted = [...points].sort((a, b) => a.y - b.y);
  const topPoints = sorted.slice(0, Math.max(12, Math.floor(sorted.length * 0.5)));

  // Large prominent crystals at the crown
  const numLarge = Math.min(5, Math.max(1, Math.floor(growthStage * 5)));
  const placed = [];

  for (let i = 0; i < numLarge; i++) {
    const pt = rng.pick(topPoints);
    const tooClose = placed.some(p => Math.abs(p.x - pt.x) + Math.abs(p.y - pt.y) < 4);
    if (tooClose && i > 0) continue;
    placed.push(pt);

    const h = rng.int(5, Math.max(7, Math.floor(size * 0.18)));
    const w = rng.int(2, Math.max(3, Math.floor(h * 0.5)));
    const angle = rng.float(-0.5, 0.5);
    drawCrystalFormation(ctx, pt.x, pt.y, h, w, angle, crystalColors, accentColors, rng);
  }

  // Medium crystals scattered around
  const numMedium = Math.min(8, Math.floor(growthStage * 8));
  for (let i = 0; i < numMedium; i++) {
    const pt = rng.pick(topPoints);
    const h = rng.int(3, Math.max(4, Math.floor(size * 0.1)));
    const w = rng.int(1, Math.max(2, Math.floor(h * 0.5)));
    const angle = rng.float(-0.8, 0.8);
    drawCrystalFormation(ctx, pt.x, pt.y, h, w, angle, crystalColors, accentColors, rng);
  }

  // Small crystal clusters at branch junctions
  if (growthStage > 0.5) {
    const midPoints = sorted.slice(
      Math.floor(sorted.length * 0.3),
      Math.floor(sorted.length * 0.7)
    );
    const numSmall = Math.min(6, Math.floor(growthStage * 6));
    for (let i = 0; i < numSmall; i++) {
      const pt = rng.pick(midPoints.length > 0 ? midPoints : topPoints);
      // Tiny 2-3 pixel crystal nub
      const h = rng.int(2, 3);
      for (let row = 0; row < h; row++) {
        setPixel(ctx, pt.x, pt.y - row, crystalColors[row === 0 ? 1 : 3]);
        if (row === 0) {
          setPixel(ctx, pt.x - 1, pt.y, crystalColors[0]);
          setPixel(ctx, pt.x + 1, pt.y, crystalColors[2]);
        }
      }
    }
  }

  // Prismatic light scattering — rainbow glints across the tree
  if (growthStage > 0.6) {
    const numGlints = Math.floor(growthStage * 8);
    for (let i = 0; i < numGlints; i++) {
      const pt = rng.pick(sorted.slice(0, Math.floor(sorted.length * 0.6)));
      const glintColor = rng.pick(accentColors);
      setPixel(ctx, pt.x + rng.int(-2, 2), pt.y + rng.int(-1, 1), glintColor);
    }
  }

  // Base crystal cluster around soil line
  if (growthStage > 0.3) {
    const basePoints = sorted.filter(p => p.y > sorted[sorted.length - 1].y - 5);
    const numBase = Math.min(4, Math.floor(growthStage * 3));
    for (let i = 0; i < numBase; i++) {
      const pt = basePoints.length > 0 ? rng.pick(basePoints) : sorted[sorted.length - 1];
      const dir = rng.chance(0.5) ? -1 : 1;
      const bx = pt.x + dir * rng.int(1, 3);
      const h = rng.int(2, 4);
      for (let row = 0; row < h; row++) {
        setPixel(ctx, bx, pt.y - row, crystalColors[row === h - 1 ? 3 : 1]);
        if (row < h - 1) setPixel(ctx, bx + dir, pt.y - row, crystalColors[0]);
      }
    }
  }
}

// ── Face (animated plants) ────────────────────────────────────────

function findFacePosition(ctx, size) {
  // Scan the plant area (above pot) to find center of mass of plant pixels
  const potHeight = Math.max(5, Math.floor(size * 0.24));
  const plantTop = Math.floor(size * 0.05);
  const plantBottom = size - potHeight - 2;
  const h = plantBottom - plantTop;
  if (h <= 0) return { x: Math.floor(size / 2), y: Math.floor(size * 0.45) };

  const data = ctx.getImageData(0, plantTop, size, h);

  let totalX = 0, totalY = 0, count = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < size; x++) {
      if (data.data[(y * size + x) * 4 + 3] > 128) {
        totalX += x;
        totalY += y;
        count++;
      }
    }
  }

  if (count === 0) {
    return { x: Math.floor(size / 2), y: Math.floor(size * 0.45) };
  }

  return {
    x: Math.floor(totalX / count),
    y: plantTop + Math.floor(totalY / count),
  };
}

function drawFace(ctx, size, rng) {
  const pos = findFacePosition(ctx, size);
  const cx = pos.x;
  const cy = pos.y;

  // Scale: eye radius grows with canvas size
  const ratio = size / 32;
  const eyeR = Math.max(2, Math.round(ratio * 2));       // eye radius
  const eyeGap = Math.max(3, Math.round(ratio * 2.5));   // center-to-center half-distance
  const lx = cx - eyeGap;
  const rx = cx + eyeGap;

  // Seed-based color for iris
  const irisHue = rng.int(0, 359);
  const irisMid = hsl(irisHue, 60, 40);
  const irisDark = hsl(irisHue, 65, 25);

  // Draw one anime eye: white sclera circle, colored iris, dark pupil, big highlight
  function drawEye(ex, ey) {
    // White sclera — filled circle
    for (let dy = -eyeR; dy <= eyeR; dy++) {
      for (let dx = -eyeR; dx <= eyeR; dx++) {
        if (dx * dx + dy * dy <= eyeR * eyeR) {
          setPixel(ctx, ex + dx, ey + dy, '#ffffff');
        }
      }
    }
    // Dark outline
    for (let dy = -eyeR; dy <= eyeR; dy++) {
      for (let dx = -eyeR; dx <= eyeR; dx++) {
        const d2 = dx * dx + dy * dy;
        if (d2 <= eyeR * eyeR && d2 > (eyeR - 1) * (eyeR - 1)) {
          setPixel(ctx, ex + dx, ey + dy, '#1a1a2a');
        }
      }
    }
    // Iris — slightly smaller, sits in lower half of eye
    const irisR = Math.max(1, eyeR - 1);
    const irisY = ey + Math.max(0, Math.floor(eyeR * 0.2));
    for (let dy = -irisR; dy <= irisR; dy++) {
      for (let dx = -irisR; dx <= irisR; dx++) {
        if (dx * dx + dy * dy <= irisR * irisR) {
          setPixel(ctx, ex + dx, irisY + dy, irisMid);
        }
      }
    }
    // Pupil — dark center
    const pupilR = Math.max(1, Math.floor(irisR * 0.5));
    for (let dy = -pupilR; dy <= pupilR; dy++) {
      for (let dx = -pupilR; dx <= pupilR; dx++) {
        if (dx * dx + dy * dy <= pupilR * pupilR) {
          setPixel(ctx, ex + dx, irisY + dy, irisDark);
        }
      }
    }
    // Big anime highlight — upper-right
    const hiR = Math.max(1, Math.floor(eyeR * 0.4));
    const hiX = ex + Math.max(1, Math.floor(eyeR * 0.3));
    const hiY = ey - Math.max(1, Math.floor(eyeR * 0.3));
    for (let dy = -hiR; dy <= hiR; dy++) {
      for (let dx = -hiR; dx <= hiR; dx++) {
        if (dx * dx + dy * dy <= hiR * hiR) {
          setPixel(ctx, hiX + dx, hiY + dy, '#ffffff');
        }
      }
    }
    // Small secondary highlight — lower-left
    if (eyeR >= 2) {
      setPixel(ctx, ex - 1, irisY + Math.max(1, Math.floor(irisR * 0.4)), '#ffffff');
    }
  }

  drawEye(lx, cy);
  drawEye(rx, cy);
}

// ── Fusion shimmer ────────────────────────────────────────────────

function drawFusionShimmer(ctx, size, rng, frameOffset) {
  const colors = ['#c0c8d4', '#d4dce8', '#e8e0f0', '#dce8d4'];
  const numShimmer = rng.int(4, 8);
  for (let i = 0; i < numShimmer; i++) {
    const sx = rng.int(4, size - 5);
    const sy = rng.int(4, size - 10);
    if ((i + (frameOffset || 0)) % 4 === 0) {
      const c = rng.pick(colors);
      setPixel(ctx, sx, sy, c);
      if (rng.chance(0.5)) setPixel(ctx, sx + 1, sy, c);
      if (rng.chance(0.5)) setPixel(ctx, sx, sy + 1, c);
    }
  }
}

// Render a fusion hybrid plant by layering two full parent renders.
// The higher-rarity parent renders first as the base (with its original seed),
// then the lower/equal-rarity parent renders on top (with its original seed).
// This creates a genuine "two plants merged" effect where both are visible.
function renderHybridPlant(plant, growthStage, frameOffset) {
  const baseSize = getCanvasSize(plant.rarity);
  const parents = plant.fusionParents;
  // Fusion of two non-unique plants grows 25% bigger; fusions involving uniques stay normal
  const hasUniqueParent = parents.some(p => p.wasUnique);
  const size = hasUniqueParent ? baseSize : Math.ceil(baseSize * 1.25);

  // Determine base (higher-rarity) vs overlay (lower-rarity) parent.
  // plant.species was inherited from the higher-rarity parent during combine.
  let baseParent = parents[0];
  let overlayParent = parents[1];
  if (parents[1].species === plant.species && parents[0].species !== plant.species) {
    baseParent = parents[1];
    overlayParent = parents[0];
  }

  // Construct plant-like objects — no unique/fusionParents to avoid recursion
  const basePlant = {
    seed: baseParent.seed,
    species: baseParent.species,
    leafType: baseParent.leafType,
    hasFlowers: baseParent.hasFlowers,
    complexity: baseParent.complexity || 2,
    rarity: plant.rarity,
  };

  const overlayPlant = {
    seed: overlayParent.seed,
    species: overlayParent.species,
    leafType: overlayParent.leafType,
    hasFlowers: overlayParent.hasFlowers,
    complexity: overlayParent.complexity || 2,
    rarity: plant.rarity,
  };

  // Render both parents at normal size through the body pipeline (no face overlay)
  const baseCanvas = renderPlantBody(basePlant, growthStage, frameOffset);
  const overlayCanvas = renderPlantBody(overlayPlant, growthStage, frameOffset);

  // Calculate soil line at original size — exclude pot/soil from the overlay
  const potHeight = Math.max(5, Math.floor(baseSize * 0.24));
  const rimHeight = Math.max(2, Math.floor(potHeight * 0.28));
  const soilY = (baseSize - 1 - potHeight) + rimHeight - 1;
  const cropY = Math.max(0, soilY - 3); // a few pixels above soil to avoid pot bleed

  // Composite — pot at 1:1, plant portions scaled up
  const { canvas, ctx } = createCanvas(size, size);
  ctx.imageSmoothingEnabled = false;

  const potRegionHeight = baseSize - cropY;
  const potDestY = size - potRegionHeight;          // pot sits at bottom of larger canvas
  const potOffsetX = Math.floor((size - baseSize) / 2); // center pot horizontally

  // Uniform scale for plant portion
  const scaleFactor = size / baseSize;
  const scaledPlantH = Math.ceil(cropY * scaleFactor);
  const plantDestY = potDestY - scaledPlantH;       // align plant bottom to pot top

  // 1. Draw base pot at 1:1, centered at the bottom
  ctx.drawImage(baseCanvas,
    0, cropY, baseSize, potRegionHeight,
    potOffsetX, potDestY, baseSize, potRegionHeight);

  // 2. Draw base plant portion, uniformly scaled
  ctx.drawImage(baseCanvas,
    0, 0, baseSize, cropY,
    0, plantDestY, size, scaledPlantH);

  // 3. Draw overlay plant portion on top, same scale
  ctx.drawImage(overlayCanvas,
    0, 0, baseSize, cropY,
    0, plantDestY, size, scaledPlantH);

  // Fusion shimmer
  if (growthStage >= 0.8) {
    const shimmerRng = createRng(plant.seed + 777);
    drawFusionShimmer(ctx, size, shimmerRng, frameOffset);
  }

  // Completion sparkles
  if (growthStage >= 1.0) {
    const sparkRng = createRng(plant.seed + 999);
    drawSparkles(ctx, size, sparkRng, frameOffset);
  }

  return canvas;
}

// ── Main render ────────────────────────────────────────────────────

export function renderPlant(plant, growthStage, frameOffset = 0) {
  let canvas;

  if (plant.unique && plant.fusionParents && plant.fusionParents.length === 2) {
    canvas = renderHybridPlant(plant, growthStage, frameOffset);
  } else {
    canvas = renderPlantBody(plant, growthStage, frameOffset);
  }

  // Face overlay for animated plants
  if (plant.animated && growthStage >= 0.2) {
    const ctx = canvas.getContext('2d');
    const faceRng = createRng(plant.seed + 555);
    drawFace(ctx, canvas.width, faceRng);
  }

  return canvas;
}

// Internal: renders the plant without face overlay
function renderPlantBody(plant, growthStage, frameOffset) {
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

  // ── Crystal Tree — fully custom rendering ──
  if (species === 'Crystal Tree') {
    const { points: crystalStemPts, trunkHue } = drawCrystalTrunk(ctx, cx, soilY, stemHeight, rng, size);
    let crystalPts = [...crystalStemPts];

    if (growthStage > 0.25) {
      const branchPts = drawCrystalBranches(ctx, crystalStemPts, rng, size, trunkHue);
      crystalPts = [...crystalPts, ...branchPts];
    }

    if (growthStage > 0.3) {
      drawCrystalShards(ctx, crystalPts, palette, rng, growthStage, size);
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
