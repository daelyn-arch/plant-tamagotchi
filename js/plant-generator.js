// Procedural pixel art plant generator
// Renders a plant deterministically from seed + growth stage

import { createRng } from './rng.js';
import {
  createCanvas,
  setPixel,
  clearCanvas,
  generatePalette,
  hsl,
  ELEMENTAL_POT_PALETTES,
  potLevelFromExp,
} from './canvas-utils.js';
import {
  getCanvasSize,
  LEAF_TEMPLATES,
  FLOWER_TEMPLATES,
} from './plant-data.js';

// ── Pot ────────────────────────────────────────────────────────────

function drawPot(ctx, size, palette, rng, potElement, potLevel = 0, plantSeed = 0) {
  const elePalette = potElement && ELEMENTAL_POT_PALETTES[potElement];
  const potColors = elePalette ? elePalette.pot : palette.pot;
  const soilColors = elePalette ? elePalette.soil : palette.soil;
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
      const c = rng.chance(0.35) ? soilColors[0] : soilColors[1];
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

  // Elemental rim decoration
  if (elePalette) {
    const rimTopY = potTop + 1;
    const eleRimW = rimW - 2;
    const eleRimLeft = cx - Math.floor(eleRimW / 2);

    if (potElement === 'fire') {
      // Flickering orange/red pixels along rim top
      for (let x = eleRimLeft; x < eleRimLeft + eleRimW; x++) {
        if (rng.chance(0.6)) {
          const fc = rng.chance(0.5) ? '#e06020' : '#f0a030';
          setPixel(ctx, x, rimTopY - 1, fc);
          if (rng.chance(0.4)) setPixel(ctx, x, rimTopY - 2, '#f0c040');
        }
      }
    } else if (potElement === 'ice') {
      // Cyan/white crystal protrusions hanging from rim
      for (let x = eleRimLeft; x < eleRimLeft + eleRimW; x += 3) {
        const ic = rng.chance(0.5) ? '#80d0f0' : '#a0e0ff';
        setPixel(ctx, x, rimTopY - 1, ic);
        if (rng.chance(0.6)) {
          setPixel(ctx, x, rimTopY - 2, '#e0f4ff');
          if (rng.chance(0.4)) setPixel(ctx, x + 1, rimTopY - 1, '#60c0e0');
        }
      }
    } else if (potElement === 'earth') {
      // Small brown/amber rock bumps on rim
      for (let x = eleRimLeft + 1; x < eleRimLeft + eleRimW - 1; x += 4) {
        const rc = rng.chance(0.5) ? '#c09040' : '#7a6040';
        setPixel(ctx, x, rimTopY - 1, rc);
        setPixel(ctx, x + 1, rimTopY - 1, rc);
        if (rng.chance(0.5)) setPixel(ctx, x, rimTopY - 2, '#a08860');
      }
    } else if (potElement === 'wind') {
      // Teal swirl lines along rim
      for (let x = eleRimLeft; x < eleRimLeft + eleRimW; x++) {
        if ((x + rng.int(0, 2)) % 3 === 0) {
          const wc = rng.chance(0.5) ? '#70d0c0' : '#3a9a8a';
          setPixel(ctx, x, rimTopY - 1, wc);
        }
      }
    }

    // ── Pot level evolution decorations ──
    if (potLevel >= 1) {
      // Use isolated RNG so level decorations don't affect existing appearance
      const potLevelRng = createRng((plantSeed + 7777) >>> 0);
      const bodyH = potHeight - rimHeight;
      const bodyTopY = potBottom - bodyH + 1;

      // Helper: get pot body width at a given row (0 = bottom of body)
      function bodyWidthAt(row) {
        const t = row / (bodyH || 1);
        return Math.round(bottomW + (topW - bottomW) * t);
      }

      if (potElement === 'fire') {
        // ── Fire Level 1: 80% rim coverage, embers above rim, glow line ──
        if (potLevel >= 1) {
          // Extended rim coverage
          for (let x = eleRimLeft; x < eleRimLeft + eleRimW; x++) {
            if (potLevelRng.chance(0.8)) {
              const fc = potLevelRng.chance(0.5) ? '#e06020' : '#f0a030';
              setPixel(ctx, x, rimTopY - 1, fc);
              // Embers 3px above rim
              if (potLevelRng.chance(0.3)) setPixel(ctx, x, rimTopY - 3, '#f0c040');
            }
          }
          // Warm glow line at pot midpoint
          const glowY = bodyTopY + Math.floor(bodyH / 2);
          const glowW = bodyWidthAt(Math.floor(bodyH / 2)) - 4;
          const glowLeft = cx - Math.floor(glowW / 2);
          for (let x = glowLeft; x < glowLeft + glowW; x++) {
            if (potLevelRng.chance(0.5)) setPixel(ctx, x, glowY, '#c04020');
          }
        }

        // ── Fire Level 2: flames above rim, embers on body, lava crack ──
        if (potLevel >= 2) {
          // Flames 4-5px above rim
          for (let x = eleRimLeft; x < eleRimLeft + eleRimW; x++) {
            if (potLevelRng.chance(0.5)) {
              const fh = potLevelRng.int(4, 5);
              for (let dy = 1; dy <= fh; dy++) {
                const t = dy / fh;
                const fc = t < 0.4 ? '#e04020' : t < 0.7 ? '#f08030' : '#f0c040';
                if (potLevelRng.chance(0.7 - t * 0.3)) setPixel(ctx, x, rimTopY - 1 - dy, fc);
              }
            }
          }
          // Ember pixels on pot body (~15% density)
          for (let row = 0; row < bodyH; row++) {
            const w = bodyWidthAt(row);
            const left = cx - Math.floor(w / 2);
            for (let x = left + 1; x < left + w - 1; x++) {
              if (potLevelRng.chance(0.15)) {
                setPixel(ctx, x, potBottom - row, potLevelRng.chance(0.5) ? '#c04020' : '#e06030');
              }
            }
          }
          // Lava crack — RNG-positioned vertical line
          const crackX = cx + potLevelRng.int(-Math.floor(bottomW / 4), Math.floor(bottomW / 4));
          for (let row = 1; row < bodyH - 1; row++) {
            if (potLevelRng.chance(0.7)) {
              setPixel(ctx, crackX + potLevelRng.int(-1, 1), potBottom - row, '#f04020');
            }
          }
        }

        // ── Fire Level 3: full flame crown, glowing veins, ember soil, underglow ──
        if (potLevel >= 3) {
          // Full flame crown 6-7px
          for (let x = eleRimLeft; x < eleRimLeft + eleRimW; x++) {
            const fh = potLevelRng.int(6, 7);
            for (let dy = 1; dy <= fh; dy++) {
              const t = dy / fh;
              const fc = t < 0.3 ? '#c02010' : t < 0.6 ? '#e05020' : t < 0.8 ? '#f0a030' : '#f0d050';
              if (potLevelRng.chance(0.8 - t * 0.3)) setPixel(ctx, x, rimTopY - 1 - dy, fc);
            }
          }
          // Glowing vein cracks on pot body
          for (let v = 0; v < 3; v++) {
            let vx = cx + potLevelRng.int(-Math.floor(bottomW / 3), Math.floor(bottomW / 3));
            for (let row = 0; row < bodyH; row++) {
              vx += potLevelRng.int(-1, 1);
              if (potLevelRng.chance(0.6)) setPixel(ctx, vx, potBottom - row, '#f06030');
            }
          }
          // Ember-dotted soil
          const soilY2 = potTop + rimHeight - 1;
          const soilW2 = topW - 2;
          const soilLeft2 = cx - Math.floor(soilW2 / 2);
          for (let x = soilLeft2; x < soilLeft2 + soilW2; x++) {
            if (potLevelRng.chance(0.3)) setPixel(ctx, x, soilY2, '#c04020');
            if (potLevelRng.chance(0.2)) setPixel(ctx, x, soilY2 - 1, '#e06030');
          }
          // Faint glow below pot
          const glowBelowW = bottomW - 2;
          const glowBelowLeft = cx - Math.floor(glowBelowW / 2);
          for (let x = glowBelowLeft; x < glowBelowLeft + glowBelowW; x++) {
            if (potLevelRng.chance(0.4)) setPixel(ctx, x, potBottom + 1, '#80200080');
          }
        }
      } else if (potElement === 'ice') {
        // ── Ice Level 1: denser crystals, frost line ──
        if (potLevel >= 1) {
          for (let x = eleRimLeft; x < eleRimLeft + eleRimW; x += 2) {
            const ic = potLevelRng.chance(0.5) ? '#80d0f0' : '#a0e0ff';
            setPixel(ctx, x, rimTopY - 1, ic);
            if (potLevelRng.chance(0.5)) setPixel(ctx, x, rimTopY - 3, '#e0f4ff');
          }
          // Frost line at pot midpoint
          const frostY = bodyTopY + Math.floor(bodyH / 2);
          const frostW = bodyWidthAt(Math.floor(bodyH / 2)) - 4;
          const frostLeft = cx - Math.floor(frostW / 2);
          for (let x = frostLeft; x < frostLeft + frostW; x++) {
            if (potLevelRng.chance(0.5)) setPixel(ctx, x, frostY, '#80d0f0');
          }
        }

        // ── Ice Level 2: tall crystal spires, frost body, icicles ──
        if (potLevel >= 2) {
          // 2-3 tall crystal spires
          const spireCount = potLevelRng.int(2, 3);
          for (let s = 0; s < spireCount; s++) {
            const sx = eleRimLeft + potLevelRng.int(2, eleRimW - 3);
            for (let dy = 1; dy <= potLevelRng.int(5, 6); dy++) {
              const c = dy <= 2 ? '#60c0e0' : dy <= 4 ? '#a0e0ff' : '#e0f4ff';
              setPixel(ctx, sx, rimTopY - 1 - dy, c);
              if (dy <= 3) setPixel(ctx, sx + 1, rimTopY - 1 - dy, '#80d0f0');
            }
          }
          // Frost texture on pot body (~20%)
          for (let row = 0; row < bodyH; row++) {
            const w = bodyWidthAt(row);
            const left = cx - Math.floor(w / 2);
            for (let x = left + 1; x < left + w - 1; x++) {
              if (potLevelRng.chance(0.20)) setPixel(ctx, x, potBottom - row, '#80d0f080');
            }
          }
          // Small icicles from pot bottom
          for (let x = cx - Math.floor(bottomW / 2) + 1; x < cx + Math.floor(bottomW / 2); x += potLevelRng.int(3, 5)) {
            const icicleLen = potLevelRng.int(2, 3);
            for (let dy = 0; dy < icicleLen; dy++) {
              setPixel(ctx, x, potBottom + 1 + dy, dy === 0 ? '#80d0f0' : '#a0e0ff');
            }
          }
        }

        // ── Ice Level 3: continuous crystal crown, heavy frost, large icicles, frozen soil ──
        if (potLevel >= 3) {
          // Continuous crystal crown
          for (let x = eleRimLeft; x < eleRimLeft + eleRimW; x++) {
            const ch = potLevelRng.int(4, 6);
            for (let dy = 1; dy <= ch; dy++) {
              const c = dy <= 2 ? '#60b0d0' : dy <= 4 ? '#80d0f0' : '#e0f4ff';
              if (potLevelRng.chance(0.8)) setPixel(ctx, x, rimTopY - 1 - dy, c);
            }
          }
          // Heavy frost (40% of body)
          for (let row = 0; row < bodyH; row++) {
            const w = bodyWidthAt(row);
            const left = cx - Math.floor(w / 2);
            for (let x = left + 1; x < left + w - 1; x++) {
              if (potLevelRng.chance(0.40)) setPixel(ctx, x, potBottom - row, '#a0e0ff60');
            }
          }
          // Large icicle formations
          for (let x = cx - Math.floor(bottomW / 2) + 1; x < cx + Math.floor(bottomW / 2); x += potLevelRng.int(2, 4)) {
            const icicleLen = potLevelRng.int(3, 5);
            for (let dy = 0; dy < icicleLen; dy++) {
              const c = dy === 0 ? '#60b0d0' : dy < icicleLen - 1 ? '#80d0f0' : '#e0f4ff';
              setPixel(ctx, x, potBottom + 1 + dy, c);
            }
          }
          // Frozen soil
          const soilY2 = potTop + rimHeight - 1;
          const soilW2 = topW - 2;
          const soilLeft2 = cx - Math.floor(soilW2 / 2);
          for (let x = soilLeft2; x < soilLeft2 + soilW2; x++) {
            if (potLevelRng.chance(0.5)) setPixel(ctx, x, soilY2, '#80d0f0');
            if (potLevelRng.chance(0.3)) setPixel(ctx, x, soilY2 - 1, '#a0e0ff');
          }
        }
      } else if (potElement === 'earth') {
        // ── Earth Level 1: denser rock bumps, stone band, pebbles ──
        if (potLevel >= 1) {
          for (let x = eleRimLeft + 1; x < eleRimLeft + eleRimW - 1; x += 3) {
            const rc = potLevelRng.chance(0.5) ? '#c09040' : '#a08860';
            setPixel(ctx, x, rimTopY - 1, rc);
            setPixel(ctx, x + 1, rimTopY - 1, rc);
            if (potLevelRng.chance(0.5)) setPixel(ctx, x, rimTopY - 2, rc);
          }
          // Stone band at pot midpoint
          const bandY = bodyTopY + Math.floor(bodyH / 2);
          const bandW = bodyWidthAt(Math.floor(bodyH / 2)) - 2;
          const bandLeft = cx - Math.floor(bandW / 2);
          for (let x = bandLeft; x < bandLeft + bandW; x++) {
            if (potLevelRng.chance(0.6)) setPixel(ctx, x, bandY, potLevelRng.chance(0.5) ? '#8a7040' : '#a08860');
          }
          // Scattered pebbles on body
          for (let row = 0; row < bodyH; row++) {
            const w = bodyWidthAt(row);
            const left = cx - Math.floor(w / 2);
            for (let x = left + 1; x < left + w - 1; x++) {
              if (potLevelRng.chance(0.08)) setPixel(ctx, x, potBottom - row, '#c09040');
            }
          }
        }

        // ── Earth Level 2: boulder formations, mortar texture, moss patches ──
        if (potLevel >= 2) {
          // 2-3 boulder formations on rim
          const boulderCount = potLevelRng.int(2, 3);
          for (let b = 0; b < boulderCount; b++) {
            const bx = eleRimLeft + potLevelRng.int(2, eleRimW - 4);
            for (let dy = 0; dy < 3; dy++) {
              for (let dx = 0; dx < 3; dx++) {
                if (potLevelRng.chance(0.7)) {
                  const bc = potLevelRng.chance(0.5) ? '#8a7040' : '#a08860';
                  setPixel(ctx, bx + dx, rimTopY - 1 - dy, bc);
                }
              }
            }
          }
          // Stone mortar texture on body
          for (let row = 0; row < bodyH; row++) {
            const w = bodyWidthAt(row);
            const left = cx - Math.floor(w / 2);
            for (let x = left + 1; x < left + w - 1; x++) {
              if (potLevelRng.chance(0.12)) setPixel(ctx, x, potBottom - row, '#6a5030');
            }
          }
          // Moss patches (green pixel clusters)
          for (let m = 0; m < 3; m++) {
            const mx = cx + potLevelRng.int(-Math.floor(bottomW / 3), Math.floor(bottomW / 3));
            const my = potBottom - potLevelRng.int(1, bodyH - 2);
            for (let dx = -1; dx <= 1; dx++) {
              for (let dy = -1; dy <= 0; dy++) {
                if (potLevelRng.chance(0.6)) setPixel(ctx, mx + dx, my + dy, potLevelRng.chance(0.5) ? '#4a8a30' : '#3a7020');
              }
            }
          }
        }

        // ── Earth Level 3: jagged ridge, stone-shifted colors, geode crack, thick moss ──
        if (potLevel >= 3) {
          // Jagged mountain ridge across entire rim
          for (let x = eleRimLeft; x < eleRimLeft + eleRimW; x++) {
            const rh = potLevelRng.int(5, 8);
            for (let dy = 0; dy < rh; dy++) {
              const t = dy / rh;
              const c = t < 0.3 ? '#6a5030' : t < 0.6 ? '#8a7040' : t < 0.8 ? '#a08860' : '#c0a870';
              if (potLevelRng.chance(0.7)) setPixel(ctx, x, rimTopY - 1 - dy, c);
            }
          }
          // Crystal geode cracking through one side
          const geodeSide = potLevelRng.chance(0.5) ? -1 : 1;
          const geodeX = cx + geodeSide * Math.floor(bottomW / 4);
          for (let row = Math.floor(bodyH * 0.2); row < Math.floor(bodyH * 0.7); row++) {
            const gx = geodeX + potLevelRng.int(-1, 1);
            setPixel(ctx, gx, potBottom - row, potLevelRng.chance(0.5) ? '#c070d0' : '#a050b0');
            if (potLevelRng.chance(0.4)) setPixel(ctx, gx + geodeSide, potBottom - row, '#d0a0e0');
          }
          // Thick moss at base
          for (let x = cx - Math.floor(bottomW / 2); x < cx + Math.floor(bottomW / 2); x++) {
            if (potLevelRng.chance(0.5)) {
              setPixel(ctx, x, potBottom, potLevelRng.chance(0.5) ? '#4a8a30' : '#3a7020');
              if (potLevelRng.chance(0.3)) setPixel(ctx, x, potBottom - 1, '#5a9a40');
            }
          }
        }
      } else if (potElement === 'wind') {
        // ── Wind Level 1: denser swirls, wind streaks, body swirl ──
        if (potLevel >= 1) {
          for (let x = eleRimLeft; x < eleRimLeft + eleRimW; x += 2) {
            const wc = potLevelRng.chance(0.5) ? '#70d0c0' : '#3a9a8a';
            setPixel(ctx, x, rimTopY - 1, wc);
          }
          // 2-3 wind streaks above rim
          const streakCount = potLevelRng.int(2, 3);
          for (let s = 0; s < streakCount; s++) {
            const sx = eleRimLeft + potLevelRng.int(2, eleRimW - 4);
            const sLen = potLevelRng.int(2, 3);
            for (let dx = 0; dx < sLen; dx++) {
              setPixel(ctx, sx + dx, rimTopY - 2 - potLevelRng.int(0, 1), '#70d0c0');
            }
          }
          // Single swirl on pot body
          const swX = cx + potLevelRng.int(-3, 3);
          const swY = bodyTopY + Math.floor(bodyH / 2);
          setPixel(ctx, swX, swY, '#70d0c0');
          setPixel(ctx, swX + 1, swY - 1, '#3a9a8a');
          setPixel(ctx, swX + 2, swY, '#70d0c0');
        }

        // ── Wind Level 2: wind trails, spiral body patterns, floating debris ──
        if (potLevel >= 2) {
          // 3-4 wind trails above rim
          const trailCount = potLevelRng.int(3, 4);
          for (let t = 0; t < trailCount; t++) {
            const tx = eleRimLeft + potLevelRng.int(1, eleRimW - 3);
            const tLen = potLevelRng.int(3, 5);
            const ty = rimTopY - potLevelRng.int(3, 5);
            for (let dx = 0; dx < tLen; dx++) {
              const c = potLevelRng.chance(0.5) ? '#70d0c0' : '#a0e8e0';
              setPixel(ctx, tx + dx, ty + (dx % 2 === 0 ? 0 : -1), c);
            }
          }
          // Spiral patterns on pot body
          for (let sp = 0; sp < 2; sp++) {
            let spx = cx + potLevelRng.int(-Math.floor(bottomW / 3), Math.floor(bottomW / 3));
            let spy = bodyTopY + potLevelRng.int(2, bodyH - 3);
            for (let i = 0; i < 5; i++) {
              setPixel(ctx, spx, spy, '#70d0c080');
              spx += potLevelRng.int(-1, 1);
              spy += potLevelRng.int(-1, 0);
            }
          }
          // Floating debris pixels above rim
          for (let d = 0; d < 4; d++) {
            const dx = eleRimLeft + potLevelRng.int(0, eleRimW);
            const dy = rimTopY - potLevelRng.int(3, 6);
            setPixel(ctx, dx, dy, potLevelRng.chance(0.5) ? '#a0e8e0' : '#70d0c0');
          }
        }

        // ── Wind Level 3: vortex above rim, wind lines wrapping body, cloud wisps, lightning ──
        if (potLevel >= 3) {
          // Vortex shape above rim
          for (let x = eleRimLeft; x < eleRimLeft + eleRimW; x++) {
            const distFromCenter = Math.abs(x - cx);
            const vh = Math.max(2, 8 - distFromCenter);
            for (let dy = 1; dy <= vh; dy++) {
              const c = dy <= 3 ? '#3a9a8a' : dy <= 5 ? '#70d0c0' : '#a0e8e0';
              if (potLevelRng.chance(0.6)) setPixel(ctx, x, rimTopY - 1 - dy, c);
            }
          }
          // Wind lines wrapping around pot body
          for (let row = 0; row < bodyH; row += 2) {
            const w = bodyWidthAt(row);
            const left = cx - Math.floor(w / 2);
            if (potLevelRng.chance(0.4)) {
              for (let x = left; x < left + w; x++) {
                if (potLevelRng.chance(0.25)) setPixel(ctx, x, potBottom - row, '#70d0c060');
              }
            }
          }
          // Cloud wisps flanking pot
          for (let side = -1; side <= 1; side += 2) {
            const wispX = cx + side * Math.floor(rimW / 2 + 2);
            for (let dy = 0; dy < 3; dy++) {
              setPixel(ctx, wispX, bodyTopY + potLevelRng.int(1, bodyH - 2) + dy, '#a0e8e040');
              setPixel(ctx, wispX + side, bodyTopY + potLevelRng.int(1, bodyH - 2) + dy, '#70d0c040');
            }
          }
          // Lightning spark
          let lx = cx + potLevelRng.int(-2, 2);
          let ly = rimTopY - potLevelRng.int(4, 7);
          for (let i = 0; i < 4; i++) {
            setPixel(ctx, lx, ly, '#ffffa0');
            lx += potLevelRng.int(-1, 1);
            ly += 1;
          }
        }
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
      // Cylindrical highlight — lighter on one consistent side
      const isHighlight = t === Math.floor(thick / 2) - 1 && thick >= 2;
      setPixel(ctx, px + t, y, isEdge ? stemDark : (isHighlight ? green[2] : stemMid));
    }

    // Node joints every 3-4px — slight bulge
    if ((soilY - y) % 4 === 0 && thick >= 2 && progress > 0.1 && progress < 0.85) {
      setPixel(ctx, px - Math.floor(thick / 2) - 1, y, stemDark);
      setPixel(ctx, px + Math.floor(thick / 2) + 1, y, stemDark);
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
      // Better upward growth bias — stronger at start, weakens toward tip
      const localUpBias = upBias + (1 - j / branchLen) * 0.15;
      if (rng.chance(localUpBias)) by -= 1;
      else if (rng.chance(0.1)) by += 1;

      // Branch thickness tapers toward tips
      const branchProgress = j / branchLen;
      const thick = branchProgress < 0.25 && complexity >= 3 ? 2 : 1;
      for (let t = 0; t < thick; t++) {
        // Lighter color toward tips
        const shade = branchProgress > 0.7 ? 1 : (rng.chance(0.4) ? 0 : 1);
        setPixel(ctx, bx, by - t, green[shade]);
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
  // Subtle center vein — draw a darker line along the leaf midrib
  const midPixels = pixels.filter(([dx]) => dx === 0);
  if (midPixels.length > 1) {
    for (const [, dy] of midPixels) {
      setPixel(ctx, x, y + dy, colors[0]);
    }
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

function drawFlowers(ctx, points, palette, rng, growthStage, complexity, size, flowerTemplate) {
  const flowerColors = palette.flowers;
  const templateKey = flowerTemplate && FLOWER_TEMPLATES[flowerTemplate] ? flowerTemplate : rng.pick(Object.keys(FLOWER_TEMPLATES));
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
    // Stamen/pistil dots at flower center
    if (bloom > 0.5) {
      setPixel(ctx, best.x, best.y, '#e8d860');
      if (template.center.length > 3) {
        setPixel(ctx, best.x + 1, best.y, '#d0c050');
        setPixel(ctx, best.x - 1, best.y, '#d0c050');
      }
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

  // Pinkish stress-coloring at petal tips + highlight dots
  const stressColor = hsl(rng.int(340, 355), rng.int(30, 50), 65);
  for (let i = 0; i < layers; i++) {
    const angle = i * 0.75 + rng.float(0, 0.6);
    const y = baseY - i * Math.max(1, Math.floor(size * 0.04));
    const radius = Math.max(2, Math.floor(maxRadius * (1 - (i / Math.max(1, layers - 1)) * 0.45)));
    const numPetals = i < 2 ? 6 : 5;
    for (let a = 0; a < numPetals; a++) {
      const dir = (a * Math.PI * 2) / numPetals + angle;
      const tipX = Math.round(cx + Math.cos(dir) * (radius - 1));
      const tipY = Math.round(y + Math.sin(dir) * (radius - 1) * 0.55);
      // Stress coloring at tips
      setPixel(ctx, tipX, tipY, rng.chance(0.6) ? stressColor : green[3]);
      // Fleshy thickness highlight one pixel inward
      const innerX = Math.round(cx + Math.cos(dir) * (radius - 2));
      const innerY = Math.round(y + Math.sin(dir) * (radius - 2) * 0.55);
      if (radius > 3) setPixel(ctx, innerX, innerY, green[3]);
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

    // Canopy underside shadow
    for (let dx = -Math.floor(radius * 0.8); dx <= Math.floor(radius * 0.8); dx++) {
      if (rng.chance(0.4)) {
        setPixel(ctx, pt.x + dx, pt.y + Math.floor(radius * 0.3), green[0]);
      }
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

  // Deeper rib shadows between ribs
  for (let y = bodyTop + 1; y < soilY - 1; y++) {
    const progress = (soilY - y) / height;
    let w = bodyW;
    if (progress > 0.85) {
      const roundT = (progress - 0.85) / 0.15;
      w = Math.max(1, Math.round(bodyW * (1 - roundT * 0.7)));
    }
    const left = cx - Math.floor(w / 2);
    for (let x = left + 1; x < left + w - 1; x++) {
      if ((x - left) % 2 === 1 && w > 3) {
        // Rib valley shadow
        setPixel(ctx, x, y, green[0]);
      }
    }
  }

  // Areoles with radiating spine clusters
  for (let y = bodyTop + 2; y < soilY - 2; y += 3) {
    if (rng.chance(0.7)) {
      const left = cx - Math.floor(bodyW / 2);
      // Areole dot (small fuzzy spot)
      setPixel(ctx, left, y, '#c8c090');
      // Radiating spines
      setPixel(ctx, left - 1, y, '#d4c8a0');
      setPixel(ctx, left - 2, y - 1, '#d4c8a0');
      setPixel(ctx, left - 1, y - 1, '#d4c8a0');
      if (rng.chance(0.5)) setPixel(ctx, left - 2, y, '#d4c8a0');
    }
    if (rng.chance(0.7)) {
      const right = cx + Math.floor(bodyW / 2);
      setPixel(ctx, right, y, '#c8c090');
      setPixel(ctx, right + 1, y, '#d4c8a0');
      setPixel(ctx, right + 2, y - 1, '#d4c8a0');
      setPixel(ctx, right + 1, y - 1, '#d4c8a0');
      if (rng.chance(0.5)) setPixel(ctx, right + 2, y, '#d4c8a0');
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
  // Force white/cream palette for Moon Lily
  const petalLight = '#f8f4e8';
  const petalMid = '#e8e0d0';
  const petalEdge = '#d0c8b8';
  const centerGlow = '#fffbe6';
  const stamenColor = '#c8b060';

  const topPoints = [...points].sort((a, b) => a.y - b.y).slice(0, 5);
  const numFlowers = rng.int(1, 3);
  const placed = [];

  for (let i = 0; i < numFlowers; i++) {
    const pt = rng.pick(topPoints);
    const tooClose = placed.some(p => Math.abs(p.x - pt.x) + Math.abs(p.y - pt.y) < 6);
    if (tooClose && i > 0) continue;
    placed.push(pt);

    const bloom = Math.min(1, (growthStage - 0.7) / 0.25);
    const petalLen = Math.max(3, Math.floor(size * 0.12 * bloom));
    const numPetals = 6;

    for (let p = 0; p < numPetals; p++) {
      const angle = (p * Math.PI * 2) / numPetals + rng.float(0, 0.3);
      for (let r = 0; r < petalLen; r++) {
        const rt = r / petalLen;
        const px = Math.round(pt.x + Math.cos(angle) * r);
        const py = Math.round(pt.y + Math.sin(angle) * r * 0.7);
        // Elongated pointed petal — widens then tapers to point
        const width = Math.max(1, Math.round(Math.sin(rt * Math.PI * 0.8) * 2.5));
        const perp = angle + Math.PI / 2;
        for (let w = -Math.floor(width / 2); w <= Math.floor(width / 2); w++) {
          const wx = Math.round(px + Math.cos(perp) * w);
          const wy = Math.round(py + Math.sin(perp) * w * 0.7);
          const isEdge = Math.abs(w) === Math.floor(width / 2);
          setPixel(ctx, wx, wy, isEdge ? petalEdge : (rt > 0.7 ? petalLight : petalMid));
        }
        // Recurved tips — curl back at the end
        if (rt > 0.85) {
          const tipX = Math.round(px + Math.cos(angle + 0.3) * 1);
          const tipY = Math.round(py + Math.sin(angle + 0.3) * 0.7);
          setPixel(ctx, tipX, tipY, petalLight);
        }
      }
    }

    // Visible stamens radiating from center
    for (let s = 0; s < 5; s++) {
      const sAngle = (s * Math.PI * 2) / 5 + 0.3;
      const sLen = Math.max(1, Math.floor(petalLen * 0.4));
      for (let r = 1; r <= sLen; r++) {
        const sx = Math.round(pt.x + Math.cos(sAngle) * r);
        const sy = Math.round(pt.y + Math.sin(sAngle) * r * 0.7);
        setPixel(ctx, sx, sy, stamenColor);
      }
      // Anther dot at tip
      const ax = Math.round(pt.x + Math.cos(sAngle) * sLen);
      const ay = Math.round(pt.y + Math.sin(sAngle) * sLen * 0.7);
      setPixel(ctx, ax, ay, '#e0c040');
    }

    // Glowing center
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (Math.abs(dx) + Math.abs(dy) <= 1) {
          setPixel(ctx, pt.x + dx, pt.y + dy, centerGlow);
        }
      }
    }
    setPixel(ctx, pt.x, pt.y, '#ffffff');
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
  const baseThick = 4;

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
  const numBranches = rng.int(15, 30);

  for (let i = 0; i < numBranches; i++) {
    const idx = rng.int(
      Math.floor(stemPoints.length * 0.25),
      Math.floor(stemPoints.length * 0.9)
    );
    const start = stemPoints[idx];
    if (!start) continue;

    const dir = (i % 2 === 0) ? -1 : 1;
    const branchLen = rng.int(6, Math.max(12, Math.floor(size * 0.28)));
    let bx = start.x;
    let by = start.y;

    for (let j = 0; j < branchLen; j++) {
      bx += dir;
      if (rng.chance(0.2)) by -= 1;
      else if (rng.chance(0.15)) by += 1;
      const shade = j < 2 ? 0 : j > branchLen - 2 ? 2 : 1;
      setPixel(ctx, bx, by, branchColors[shade]);
      if (j < branchLen * 0.4) {
        setPixel(ctx, bx, by + 1, branchColors[0]);
      }
      branchPoints.push({ x: bx, y: by });

      // Sub-branches for canopy density
      if (j > branchLen * 0.4 && rng.chance(0.3)) {
        const subDir = rng.chance(0.6) ? dir : -dir;
        let sx = bx, sy = by;
        const subLen = rng.int(3, 5);
        for (let s = 0; s < subLen; s++) {
          sx += subDir;
          if (rng.chance(0.25)) sy -= 1;
          else if (rng.chance(0.2)) sy += 1;
          setPixel(ctx, sx, sy, branchColors[2]);
          branchPoints.push({ x: sx, y: sy });
        }
      }
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
  const numLarge = Math.min(25, Math.max(3, Math.floor(growthStage * 25)));
  const placed = [];

  for (let i = 0; i < numLarge; i++) {
    const pt = rng.pick(topPoints);
    const tooClose = placed.some(p => Math.abs(p.x - pt.x) + Math.abs(p.y - pt.y) < 3);
    if (tooClose && i > 2) continue;
    placed.push(pt);

    const h = rng.int(5, Math.max(7, Math.floor(size * 0.18)));
    const w = rng.int(2, Math.max(3, Math.floor(h * 0.5)));
    const angle = rng.float(-0.5, 0.5);
    drawCrystalFormation(ctx, pt.x, pt.y, h, w, angle, crystalColors, accentColors, rng);
  }

  // Medium crystals scattered around
  const numMedium = Math.min(40, Math.floor(growthStage * 40));
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
    potElement: plant.potElement,
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

// ── Clover Patch — low ground cover with multiple 3-leaf clovers ──

function drawCloverPatch(ctx, cx, soilY, palette, rng, growthStage, size) {
  const green = palette.greens;
  const numClovers = Math.max(2, Math.floor(growthStage * 12));
  const baseY = soilY - 2;

  // Helper: draw a single clover leaf (3 lobes, fan arrangement on thin petiole)
  function drawCloverLeaf(ox, oy, lobeCount) {
    const petioleLen = rng.int(2, 4);
    // Thin petiole
    for (let s = 1; s <= petioleLen; s++) {
      setPixel(ctx, ox, oy + s, green[0]);
    }
    // 3 (or 4) lobes arranged in fan
    const angles = lobeCount === 4
      ? [-0.7, -0.2, 0.2, 0.7]
      : [-0.6, 0, 0.6];
    for (const a of angles) {
      const lx = Math.round(ox + Math.sin(a) * 2.5);
      const ly = Math.round(oy - Math.cos(a) * 1.5);
      // Each lobe is 2-3px heart-ish shape
      setPixel(ctx, lx, ly, green[2]);
      setPixel(ctx, lx - 1, ly, green[1]);
      setPixel(ctx, lx + 1, ly, green[1]);
      setPixel(ctx, lx, ly - 1, green[2]);
      // Inner notch for heart shape
      setPixel(ctx, lx, ly + 1, green[0]);
    }
    // Center junction
    setPixel(ctx, ox, oy, green[1]);
  }

  // Dense carpet-like ground cover
  for (let i = 0; i < numClovers; i++) {
    const ox = cx + rng.int(-Math.floor(size * 0.35), Math.floor(size * 0.35));
    const oy = baseY - rng.int(1, Math.max(2, Math.floor(size * 0.3 * growthStage)));
    // ~5% chance of 4-leaf clover
    const lobeCount = rng.chance(0.05) ? 4 : 3;
    drawCloverLeaf(ox, oy, lobeCount);
  }

  // Ground fill — small green dots for carpet effect
  if (growthStage > 0.3) {
    const fillDensity = Math.floor(growthStage * 15);
    for (let i = 0; i < fillDensity; i++) {
      const fx = cx + rng.int(-Math.floor(size * 0.3), Math.floor(size * 0.3));
      const fy = baseY - rng.int(0, Math.max(1, Math.floor(size * 0.15 * growthStage)));
      setPixel(ctx, fx, fy, green[rng.int(1, 2)]);
    }
  }

  // Tiny white/pink clover flower heads at high growth
  if (growthStage > 0.7) {
    const bloom = Math.min(1, (growthStage - 0.7) / 0.25);
    const numFlowerHeads = Math.max(1, Math.floor(bloom * 4));
    for (let f = 0; f < numFlowerHeads; f++) {
      const fx = cx + rng.int(-Math.floor(size * 0.25), Math.floor(size * 0.25));
      const fy = baseY - rng.int(3, Math.max(4, Math.floor(size * 0.25)));
      // Tiny pom-pom flower head
      const flowerColor = rng.chance(0.5) ? '#f0d0d8' : '#ffffff';
      setPixel(ctx, fx, fy, flowerColor);
      setPixel(ctx, fx - 1, fy, flowerColor);
      setPixel(ctx, fx + 1, fy, flowerColor);
      setPixel(ctx, fx, fy - 1, flowerColor);
      // Short stem to flower
      setPixel(ctx, fx, fy + 1, green[0]);
      setPixel(ctx, fx, fy + 2, green[0]);
    }
  }
}

// ── Pitcher Plant — carnivorous tube shapes ──

function drawPitcherPlant(ctx, cx, soilY, height, palette, rng, growthStage, size) {
  const green = palette.greens;
  const numPitchers = Math.max(1, Math.floor(growthStage * 3));
  const stemProgress = Math.min(1, growthStage / 0.7);
  const veinColor = hsl(rng.int(340, 360), 40, 35); // Red/purple veining
  const darkInterior = hsl(rng.int(340, 360), 30, 20);

  for (let i = 0; i < numPitchers; i++) {
    const offsetX = i === 0 ? 0 : rng.int(-4, 4);
    const pitcherH = Math.max(4, Math.floor(height * 0.7 * stemProgress));
    const baseX = cx + offsetX;
    const baseY = soilY - 2;

    // Stem going up (slightly curved)
    let drift = 0;
    for (let y = 0; y < Math.floor(pitcherH * 0.3); y++) {
      drift += (rng.random() - 0.5) * 0.15;
      setPixel(ctx, Math.round(baseX + drift), baseY - y, green[0]);
    }

    // Pitcher tube — swelling at base, narrowing at waist, opening at mouth
    const tubeTop = baseY - pitcherH;
    const tubeH = Math.max(4, Math.floor(pitcherH * 0.65));
    const tubeBottom = tubeTop + tubeH;
    for (let y = 0; y < tubeH; y++) {
      const t = y / tubeH;
      // Slight swelling at base (wider at bottom third)
      let w;
      if (t < 0.35) {
        w = Math.max(1, Math.round(Math.sin(t / 0.35 * Math.PI * 0.5) * 3.5));
      } else if (t < 0.6) {
        w = Math.max(1, Math.round(2.5 - (t - 0.35) * 4)); // waist narrows
      } else {
        w = Math.max(1, Math.round(2 + (t - 0.6) * 5)); // mouth widens
      }

      for (let dx = -w; dx <= w; dx++) {
        const isEdge = Math.abs(dx) === w;
        let c;
        if (isEdge) {
          c = green[0];
        } else if (t > 0.75) {
          // Darker interior near mouth
          c = darkInterior;
        } else {
          c = green[1];
        }
        setPixel(ctx, baseX + dx, tubeTop + y, c);

        // Red/purple veining on tube walls
        if (!isEdge && Math.abs(dx) >= w - 2 && rng.chance(0.3)) {
          setPixel(ctx, baseX + dx, tubeTop + y, veinColor);
        }
      }

      // Highlight on one side for cylindrical look
      if (w >= 2) {
        setPixel(ctx, baseX - w + 1, tubeTop + y, green[2]);
      }
    }

    // Hood-shaped lid overhanging opening
    if (growthStage > 0.5) {
      const mouthW = Math.max(2, Math.round(2 + (1.0 - 0.6) * 5));
      const hoodDir = rng.chance(0.5) ? -1 : 1;
      // Hood extends out one side and curves over
      for (let row = 0; row < 3; row++) {
        const hw = mouthW + 1 - row;
        for (let dx = -hw; dx <= hw + hoodDir * 2; dx++) {
          const isEdge = Math.abs(dx) >= hw;
          setPixel(ctx, baseX + dx, tubeTop - 1 - row, isEdge ? green[1] : green[2]);
        }
      }
      // Hood tip highlight
      setPixel(ctx, baseX + hoodDir * (mouthW + 2), tubeTop - 1, green[3]);

      // Peristome (bright rim around mouth)
      const rimY = tubeTop + Math.floor(tubeH * 0.85);
      const rimW = Math.max(2, Math.round(2 + 0.4 * 5));
      for (let dx = -rimW; dx <= rimW; dx++) {
        setPixel(ctx, baseX + dx, rimY, veinColor);
      }
    }
  }
}

// ── Glowing Nightshade — dark stems with glowing berries ──

function drawNightshadeBerries(ctx, points, rng, growthStage, size) {
  if (growthStage < 0.5) return;
  const berryProgress = Math.min(1, (growthStage - 0.5) / 0.4);
  const numBerries = Math.max(1, Math.floor(berryProgress * 8));
  const topPoints = [...points].sort((a, b) => a.y - b.y).slice(0, Math.max(5, Math.floor(points.length * 0.4)));

  const berryColors = ['#4a1a5a', '#6a2a8a', '#8a3ab0'];
  const glowColor = '#c070f0';

  for (let i = 0; i < numBerries; i++) {
    const pt = rng.pick(topPoints);
    const bx = pt.x + rng.int(-1, 1);
    const by = pt.y + rng.int(-1, 1);

    // Glow pixel (behind berry)
    if (berryProgress > 0.5) {
      setPixel(ctx, bx - 1, by, glowColor);
      setPixel(ctx, bx + 1, by, glowColor);
      setPixel(ctx, bx, by - 1, glowColor);
      setPixel(ctx, bx, by + 1, glowColor);
    }
    // Berry
    setPixel(ctx, bx, by, rng.pick(berryColors));
    if (rng.chance(0.5)) setPixel(ctx, bx + 1, by, berryColors[1]);
  }
}

// ── Stormvine — twisting vine with lightning crackle pixels ──

function drawStormvine(ctx, cx, soilY, height, palette, rng, growthStage, size) {
  const green = palette.greens;
  const stemProgress = Math.min(1, growthStage / 0.7);
  const vineH = Math.max(3, Math.floor(height * stemProgress));
  const points = [];

  // Two intertwining vines
  for (let v = 0; v < 2; v++) {
    let vx = cx + (v === 0 ? -1 : 1);
    for (let y = 0; y < vineH; y++) {
      const wave = Math.sin(y * 0.4 + v * Math.PI) * 2;
      const px = Math.round(vx + wave);
      const py = soilY - 2 - y;
      setPixel(ctx, px, py, green[v]);
      points.push({ x: px, y: py });
      // Tendril offshoots
      if (y % 4 === 0 && growthStage > 0.3) {
        const dir = rng.chance(0.5) ? -1 : 1;
        for (let t = 1; t <= 2; t++) {
          setPixel(ctx, px + dir * t, py - t, green[2]);
          points.push({ x: px + dir * t, y: py - t });
        }
      }
    }
  }

  // Lightning crackle pixels (at higher growth)
  if (growthStage > 0.6) {
    const numBolts = Math.floor((growthStage - 0.6) * 8);
    const boltColors = ['#a0d0ff', '#ffffff', '#70b0e0'];
    for (let i = 0; i < numBolts; i++) {
      const pt = rng.pick(points);
      setPixel(ctx, pt.x + rng.int(-1, 1), pt.y + rng.int(-1, 1), rng.pick(boltColors));
    }
  }

  return points;
}

// ── Golden Lotus — metallic gold flower that opens/closes ──

function drawGoldenLotusPetals(ctx, points, rng, growthStage, size) {
  if (growthStage < 0.7) return;
  const bloom = Math.min(1, (growthStage - 0.7) / 0.25);
  const goldColors = ['#8a6a10', '#c49a1a', '#e0b830', '#f0d050', '#fff0a0'];
  const padColor = '#2a7a3a';
  const padLight = '#3a9a4a';
  const topPt = [...points].sort((a, b) => a.y - b.y)[0];
  if (!topPt) return;

  // Lily-pad base (flat ellipse below flower)
  const padW = Math.max(3, Math.floor(size * 0.15));
  const padH = Math.max(1, Math.floor(padW * 0.35));
  for (let dy = -padH; dy <= padH; dy++) {
    const rowW = Math.round(padW * Math.cos((dy / padH) * Math.PI * 0.5));
    for (let dx = -rowW; dx <= rowW; dx++) {
      const isEdge = Math.abs(dx) >= rowW - 1 || Math.abs(dy) >= padH;
      setPixel(ctx, topPt.x + dx, topPt.y + 3 + dy, isEdge ? padColor : padLight);
    }
  }
  // Pad notch (V-cut)
  setPixel(ctx, topPt.x, topPt.y + 3 + padH, 'rgba(0,0,0,0)');

  // Nested petal layers (outer longer, inner shorter)
  const layers = [
    { petals: 8, len: Math.max(3, Math.floor(size * 0.13 * bloom)), offset: 0 },
    { petals: 6, len: Math.max(2, Math.floor(size * 0.09 * bloom)), offset: 0.25 },
    { petals: 5, len: Math.max(1, Math.floor(size * 0.05 * bloom)), offset: 0.5 },
  ];

  for (const layer of layers) {
    for (let p = 0; p < layer.petals; p++) {
      const angle = (p * Math.PI * 2) / layer.petals + layer.offset;
      for (let r = 0; r < layer.len; r++) {
        const rt = r / layer.len;
        const px = Math.round(topPt.x + Math.cos(angle) * r);
        const py = Math.round(topPt.y + Math.sin(angle) * r * 0.6);
        const w = Math.max(1, Math.round(Math.sin(rt * Math.PI) * 2));
        const perp = angle + Math.PI / 2;
        for (let ww = -Math.floor(w / 2); ww <= Math.floor(w / 2); ww++) {
          const wx = Math.round(px + Math.cos(perp) * ww);
          const wy = Math.round(py + Math.sin(perp) * ww * 0.6);
          const ci = Math.abs(ww) === Math.floor(w / 2) ? 1 : (rt < 0.5 ? 3 : 4);
          setPixel(ctx, wx, wy, goldColors[ci]);
        }
      }
    }
  }

  // Seed pod center (darker golden nub)
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (Math.abs(dx) + Math.abs(dy) <= 1) {
        setPixel(ctx, topPt.x + dx, topPt.y + dy, goldColors[0]);
      }
    }
  }
  setPixel(ctx, topPt.x, topPt.y, goldColors[1]);
}

// ── Emberthorn — dark thorny stem with glowing ember core ──

function drawEmberthornCore(ctx, points, rng, growthStage, size) {
  // Prominent curved thorns along stem (visible even before bloom)
  if (growthStage > 0.2) {
    for (let i = 2; i < points.length - 2; i += 3) {
      const p = points[i];
      if (rng.chance(0.5)) {
        const dir = rng.chance(0.5) ? -1 : 1;
        // Curved thorn — base, mid, tip
        setPixel(ctx, p.x + dir, p.y, '#6a4a30');
        setPixel(ctx, p.x + dir * 2, p.y - 1, '#5a3a2a');
        setPixel(ctx, p.x + dir * 3, p.y - 2, '#4a2a1a');
        // Thorn highlight
        setPixel(ctx, p.x + dir * 2, p.y - 2, '#7a5a40');
      }
    }
  }

  if (growthStage < 0.6) return;
  const emberProgress = Math.min(1, (growthStage - 0.6) / 0.3);
  const emberColors = ['#8a2a0a', '#c04010', '#e06020', '#f0a040', '#fff0a0'];
  const topPoints = [...points].sort((a, b) => a.y - b.y).slice(0, 5);

  // Ember flower with actual petal shapes around core
  const pt = topPoints[0];
  if (!pt) return;
  const r = Math.max(2, Math.floor(4 * emberProgress));

  // Petal shapes radiating from center
  const numPetals = 5;
  for (let p = 0; p < numPetals; p++) {
    const angle = (p * Math.PI * 2) / numPetals + rng.float(0, 0.3);
    for (let d = 1; d <= r; d++) {
      const px = Math.round(pt.x + Math.cos(angle) * d);
      const py = Math.round(pt.y + Math.sin(angle) * d * 0.7);
      const ci = Math.min(4, d);
      setPixel(ctx, px, py, emberColors[ci]);
      // Petal width
      if (d < r - 1) {
        const perp = angle + Math.PI / 2;
        setPixel(ctx, Math.round(px + Math.cos(perp)), Math.round(py + Math.sin(perp) * 0.7), emberColors[ci - 1 >= 0 ? ci - 1 : 0]);
      }
    }
  }

  // Glowing ember core
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (Math.abs(dx) + Math.abs(dy) <= 1) {
        setPixel(ctx, pt.x + dx, pt.y + dy, emberColors[4]);
      }
    }
  }
  setPixel(ctx, pt.x, pt.y, '#ffffff');

  // Spark particles
  if (emberProgress > 0.5) {
    const numSparks = Math.floor(emberProgress * 5);
    for (let i = 0; i < numSparks; i++) {
      const sx = pt.x + rng.int(-4, 4);
      const sy = pt.y + rng.int(-5, 1);
      setPixel(ctx, sx, sy, rng.pick(['#f0a040', '#fff0a0', '#e06020']));
    }
  }
}

// ── Marigold — bushy plant with round pom-pom flower clusters ──

function drawMarigold(ctx, cx, soilY, height, palette, rng, growthStage, size) {
  const green = palette.greens;
  const stemProgress = Math.min(1, growthStage / 0.7);
  const stemH = Math.max(3, Math.floor(height * 0.6 * stemProgress));
  const points = [];

  // Short thick central stem
  let drift = 0;
  for (let y = 0; y < stemH; y++) {
    drift += (rng.random() - 0.5) * 0.15;
    const px = Math.round(cx + drift);
    const py = soilY - 2 - y;
    setPixel(ctx, px, py, green[1]);
    setPixel(ctx, px - 1, py, green[0]);
    points.push({ x: px, y: py });
  }

  // Bushy side branches that fan out wide
  if (growthStage > 0.2) {
    const numSideShoots = Math.max(2, Math.floor(growthStage * 6));
    for (let i = 0; i < numSideShoots; i++) {
      const idx = rng.int(Math.floor(points.length * 0.3), points.length - 1);
      const start = points[idx];
      if (!start) continue;
      const dir = (i % 2 === 0) ? -1 : 1;
      const len = rng.int(3, 5);
      let bx = start.x, by = start.y;
      for (let j = 0; j < len; j++) {
        bx += dir;
        if (rng.chance(0.6)) by -= 1;
        setPixel(ctx, bx, by, green[rng.chance(0.5) ? 0 : 1]);
        points.push({ x: bx, y: by });
      }
    }
  }

  // Round bushy leaves
  if (growthStage > 0.15) {
    const leafPts = [...points].sort((a, b) => a.y - b.y).slice(0, Math.floor(points.length * 0.6));
    for (const pt of leafPts) {
      if (rng.chance(0.5)) {
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            if (Math.abs(dx) + Math.abs(dy) <= 1 && rng.chance(0.7)) {
              setPixel(ctx, pt.x + dx, pt.y + dy, green[rng.int(1, 2)]);
            }
          }
        }
      }
    }
  }

  // Pom-pom flowers — round clustered balls in warm orange/yellow
  if (growthStage > 0.7) {
    const bloom = Math.min(1, (growthStage - 0.7) / 0.25);
    const numFlowers = Math.max(2, Math.floor(bloom * 5));
    const pomColors = ['#c06010', '#d88020', '#e8a030', '#f0c040', '#f8e060'];
    const topPts = [...points].sort((a, b) => a.y - b.y).slice(0, 12);
    const placed = [];

    for (let i = 0; i < numFlowers; i++) {
      let best = null;
      for (let attempt = 0; attempt < 6; attempt++) {
        const pt = rng.pick(topPts);
        const tooClose = placed.some(p => Math.abs(p.x - pt.x) + Math.abs(p.y - pt.y) < 4);
        if (!tooClose) { best = pt; break; }
        if (!best) best = pt;
      }
      if (!best) continue;
      placed.push(best);

      // Irregular pom-pom: concentric circles with ragged edges
      const r = Math.max(1, Math.floor(bloom * 2.5));
      for (let dy = -r - 1; dy <= r + 1; dy++) {
        for (let dx = -r - 1; dx <= r + 1; dx++) {
          const dist = dx * dx + dy * dy;
          // Irregular edge — some pixels extend, some don't
          const edgeThresh = r * r + (rng.chance(0.4) ? r : 0);
          if (dist <= edgeThresh) {
            const ci = Math.min(4, Math.floor(dist / (r * r) * 4));
            setPixel(ctx, best.x + dx, best.y + dy, pomColors[Math.min(ci, 4)]);
          }
        }
      }
      // Bright center
      setPixel(ctx, best.x, best.y, pomColors[4]);
      // Inner petal texture dots
      for (let d = 0; d < r; d++) {
        const tx = best.x + rng.int(-r + 1, r - 1);
        const ty = best.y + rng.int(-r + 1, r - 1);
        setPixel(ctx, tx, ty, pomColors[rng.int(3, 4)]);
      }
    }
  }

  return points;
}

// ── Lavender — tall thin stems with purple flower spikes ──

function drawLavender(ctx, cx, soilY, height, palette, rng, growthStage, size) {
  const green = palette.greens;
  const stemProgress = Math.min(1, growthStage / 0.7);
  const fullH = Math.max(3, Math.floor(height * stemProgress));
  const points = [];

  // Multiple tall thin stems fanning out
  const numStems = rng.int(4, 6);
  const spikeStems = [];

  for (let s = 0; s < numStems; s++) {
    const spread = (s - (numStems - 1) / 2) * 1.8;
    let sx = cx + Math.round(spread);
    let drift = 0;
    const stemH = Math.max(3, Math.floor(fullH * rng.float(0.8, 1.0)));
    const stemPts = [];

    for (let y = 0; y < stemH; y++) {
      drift += spread * 0.02 + (rng.random() - 0.5) * 0.1;
      const px = Math.round(sx + drift);
      const py = soilY - 2 - y;
      setPixel(ctx, px, py, green[1]);
      const pt = { x: px, y: py };
      points.push(pt);
      stemPts.push(pt);
    }

    // Narrow silvery leaves along stem (paired, opposite)
    if (growthStage > 0.2 && stemPts.length > 4) {
      for (let l = 2; l < stemPts.length - 2; l += 3) {
        const lp = stemPts[l];
        for (let side = -1; side <= 1; side += 2) {
          // Narrow pointed leaf
          setPixel(ctx, lp.x + side, lp.y, green[2]);
          setPixel(ctx, lp.x + side * 2, lp.y, green[3]); // silvery highlight
          setPixel(ctx, lp.x + side * 3, lp.y + (side > 0 ? -1 : 0), green[2]);
        }
      }
    }

    spikeStems.push(stemPts);
  }

  // Purple flower spikes at the top of each stem
  if (growthStage > 0.7) {
    const bloom = Math.min(1, (growthStage - 0.7) / 0.25);
    const spikeColors = ['#4a2080', '#6a30a0', '#8a40c0', '#a060d0', '#c080e0'];

    for (const stemPts of spikeStems) {
      if (stemPts.length < 3) continue;
      const spikeLen = Math.max(2, Math.floor(stemPts.length * 0.35 * bloom));

      for (let i = 0; i < spikeLen; i++) {
        const idx = stemPts.length - 1 - i;
        if (idx < 0) break;
        const pt = stemPts[idx];
        const t = i / spikeLen;
        // More tapered spike — wider at base, very narrow at tip
        const w = Math.max(0, Math.round((1 - t * t) * 1.8));
        for (let dx = -w; dx <= w; dx++) {
          const ci = Math.min(4, Math.abs(dx) + Math.floor(t * 2));
          setPixel(ctx, pt.x + dx, pt.y, spikeColors[ci]);
        }
        // Tiny bud whorls alternating sides
        if (i % 2 === 0 && w > 0) {
          setPixel(ctx, pt.x - w - 1, pt.y, spikeColors[3]);
          setPixel(ctx, pt.x + w + 1, pt.y, spikeColors[3]);
        }
      }
    }
  }

  return points;
}

// ── Starfall Magnolia — silver tree with star-petal blossoms ──

function drawStarfallMagnolia(ctx, cx, soilY, height, rng, growthStage, size) {
  const stemProgress = Math.min(1, growthStage / 0.7);
  const trunkH = Math.max(3, Math.floor(height * stemProgress));
  const trunkColors = ['#4a4a5a', '#6a6a7a', '#8a8a9a', '#b0b0c0'];
  const points = [];

  // Silver trunk — thick and tapering
  let drift = 0;
  for (let y = 0; y < trunkH; y++) {
    drift += (rng.random() - 0.5) * 0.25;
    const px = Math.round(cx + drift);
    const py = soilY - 2 - y;
    const progress = y / trunkH;
    const thick = Math.max(2, Math.round(4 * (1 - progress * 0.5)));
    for (let t = -Math.floor(thick / 2); t <= Math.floor(thick / 2); t++) {
      const isEdge = Math.abs(t) === Math.floor(thick / 2);
      setPixel(ctx, px + t, py, isEdge ? trunkColors[0] : trunkColors[1]);
    }
    points.push({ x: px, y: py });
  }

  // Major branches that spread wide like a real tree
  if (growthStage > 0.25) {
    const numBranches = Math.max(15, Math.floor(growthStage * 40));
    for (let i = 0; i < numBranches; i++) {
      const idx = rng.int(Math.floor(points.length * 0.3), points.length - 1);
      const start = points[idx];
      if (!start) continue;
      const dir = (i % 2 === 0) ? -1 : 1;
      const len = rng.int(6, Math.max(12, Math.floor(size * 0.3)));
      let bx = start.x, by = start.y;
      const upBias = rng.float(0.15, 0.35);
      for (let b = 0; b < len; b++) {
        bx += dir;
        if (rng.chance(upBias)) by -= 1;
        else if (rng.chance(0.15)) by += 1;
        const thick = b < len * 0.3 ? 2 : 1;
        for (let t = 0; t < thick; t++) {
          setPixel(ctx, bx, by - t, trunkColors[b < 2 ? 1 : 2]);
        }
        points.push({ x: bx, y: by });

        // Sub-branches for canopy spread
        if (b > len * 0.4 && rng.chance(0.4)) {
          const subDir = rng.chance(0.6) ? dir : -dir;
          let sx = bx, sy = by;
          const subLen = rng.int(3, 6);
          for (let s = 0; s < subLen; s++) {
            sx += subDir;
            if (rng.chance(0.3)) sy -= 1;
            else if (rng.chance(0.2)) sy += 1;
            setPixel(ctx, sx, sy, trunkColors[2]);
            points.push({ x: sx, y: sy });
          }
        }
      }
    }
  }

  // Star-petal blossoms — dense canopy coverage
  if (growthStage > 0.7) {
    const bloom = Math.min(1, (growthStage - 0.7) / 0.25);
    const numBlossoms = Math.max(10, Math.floor(bloom * 50));
    const topPts = [...points].sort((a, b) => a.y - b.y).slice(0, 80);
    const petalColors = ['#c0c0d0', '#d0d0e0', '#e8e8f0', '#ffffff'];

    for (let i = 0; i < numBlossoms; i++) {
      const pt = rng.pick(topPts);
      const r = rng.int(2, 3);
      for (let d = 0; d < r; d++) {
        const c = petalColors[Math.min(d, 3)];
        setPixel(ctx, pt.x + d, pt.y, c);
        setPixel(ctx, pt.x - d, pt.y, c);
        setPixel(ctx, pt.x, pt.y + d, c);
        setPixel(ctx, pt.x, pt.y - d, c);
      }
      setPixel(ctx, pt.x, pt.y, '#fffbe6');
    }
  }

  return points;
}

// ── Celestia Bloom — radiant white flower with halo center ──

function drawCelestiaBloom(ctx, cx, soilY, height, palette, rng, growthStage, size) {
  const stemProgress = Math.min(1, growthStage / 0.7);
  const trunkH = Math.max(3, Math.floor(height * stemProgress));
  const points = [];

  // Pale silvery-green trunk
  const trunkColors = ['#4a6a5a', '#6a9a7a', '#8abfa0', '#b0dac0'];
  let drift = 0;
  for (let y = 0; y < trunkH; y++) {
    drift += (rng.random() - 0.5) * 0.2;
    const px = Math.round(cx + drift);
    const py = soilY - 2 - y;
    const progress = y / trunkH;
    const thick = Math.max(2, Math.round(3 * (1 - progress * 0.4)));
    for (let t = -Math.floor(thick / 2); t <= Math.floor(thick / 2); t++) {
      const isEdge = Math.abs(t) === Math.floor(thick / 2);
      setPixel(ctx, px + t, py, isEdge ? trunkColors[0] : trunkColors[1]);
    }
    // Pale glow streak
    if (y % 4 === 0) setPixel(ctx, px, py, trunkColors[3]);
    points.push({ x: px, y: py });
  }

  // Spreading branches that arc gracefully outward
  if (growthStage > 0.25) {
    const numBranches = Math.max(15, Math.floor(growthStage * 35));
    for (let i = 0; i < numBranches; i++) {
      const idx = rng.int(Math.floor(points.length * 0.3), points.length - 1);
      const start = points[idx];
      if (!start) continue;
      const dir = (i % 2 === 0) ? -1 : 1;
      const len = rng.int(6, Math.max(12, Math.floor(size * 0.28)));
      let bx = start.x, by = start.y;
      for (let b = 0; b < len; b++) {
        bx += dir;
        if (rng.chance(0.25)) by -= 1;
        else if (rng.chance(0.15)) by += 1;
        setPixel(ctx, bx, by, trunkColors[b < 2 ? 1 : 2]);
        points.push({ x: bx, y: by });

        // Smaller sub-branches
        if (b > len * 0.4 && rng.chance(0.35)) {
          let sx = bx, sy = by;
          const subLen = rng.int(3, 5);
          for (let s = 0; s < subLen; s++) {
            sx += rng.chance(0.5) ? dir : -dir;
            if (rng.chance(0.3)) sy -= 1;
            else if (rng.chance(0.2)) sy += 1;
            setPixel(ctx, sx, sy, trunkColors[2]);
            points.push({ x: sx, y: sy });
          }
        }
      }
    }
  }

  // Translucent layered petals at branch tips
  if (growthStage > 0.7) {
    const bloom = Math.min(1, (growthStage - 0.7) / 0.25);
    const tipPts = [...points].sort((a, b) => a.y - b.y).slice(0, 50);
    const petalColors = ['#e0e0f0', '#e8e8ff', '#f0f0ff', '#ffffff'];
    const numBlooms = Math.max(10, Math.floor(bloom * 30));
    const placed = [];

    for (let i = 0; i < numBlooms; i++) {
      let best = null;
      for (let attempt = 0; attempt < 8; attempt++) {
        const pt = rng.pick(tipPts);
        const tooClose = placed.some(p => Math.abs(p.x - pt.x) + Math.abs(p.y - pt.y) < 3);
        if (!tooClose) { best = pt; break; }
        if (!best) best = pt;
      }
      if (!best) continue;
      placed.push(best);

      const numPetals = 8;
      const petalLen = Math.max(2, Math.floor(size * 0.08 * bloom));
      for (let p = 0; p < numPetals; p++) {
        const angle = (p * Math.PI * 2) / numPetals;
        for (let r = 1; r < petalLen; r++) {
          const px = Math.round(best.x + Math.cos(angle) * r);
          const py = Math.round(best.y + Math.sin(angle) * r * 0.7);
          const ci = Math.min(3, Math.floor(r / petalLen * 4));
          setPixel(ctx, px, py, petalColors[ci]);
        }
      }
      // Halo center
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (Math.abs(dx) + Math.abs(dy) <= 1) setPixel(ctx, best.x + dx, best.y + dy, '#fffbe6');
        }
      }
      setPixel(ctx, best.x, best.y, '#ffffff');
    }

    // Light ray shimmer
    if (bloom > 0.5) {
      const rayColors = ['#fffbe6', '#fff5cc'];
      for (let r = 0; r < 25; r++) {
        const angle = rng.float(0, Math.PI * 2);
        const dist = rng.int(4, Math.floor(size * 0.25));
        const rx = Math.round(cx + Math.cos(angle) * dist);
        const ry = Math.round((soilY - trunkH) + Math.sin(angle) * dist);
        setPixel(ctx, rx, ry, rng.pick(rayColors));
      }
    }
  }

  return points;
}

// ── Dragonroot Arbor — massive twisted trunk with scaled fronds ──

function drawDragonrootArbor(ctx, cx, soilY, height, palette, rng, growthStage, size) {
  const stemProgress = Math.min(1, growthStage / 0.7);
  const trunkH = Math.max(3, Math.floor(height * stemProgress));
  const trunkColors = ['#3a2a1a', '#5a4030', '#6a5040', '#8a7060'];
  const scaleColors = ['#2a4a2a', '#3a6a3a', '#4a8a4a', '#5aaa5a'];
  const points = [];

  // Thick twisted trunk — wider base
  let drift = 0;
  for (let y = 0; y < trunkH; y++) {
    const t = y / trunkH;
    drift += Math.sin(y * 0.3) * 0.5;
    const px = Math.round(cx + drift);
    const py = soilY - 2 - y;
    const thick = Math.max(2, Math.round(5 * (1 - t * 0.45)));

    for (let dx = -Math.floor(thick / 2); dx <= Math.floor(thick / 2); dx++) {
      const isEdge = Math.abs(dx) === Math.floor(thick / 2);
      const isScale = (y + dx) % 3 === 0;
      let c = isEdge ? trunkColors[0] : trunkColors[1];
      if (isScale && !isEdge) c = trunkColors[2];
      setPixel(ctx, px + dx, py, c);
    }
    points.push({ x: px, y: py });
  }

  // Heavy branches that spread wide — tree canopy shape
  if (growthStage > 0.2) {
    const numBranches = Math.max(15, Math.floor(growthStage * 40));
    for (let i = 0; i < numBranches; i++) {
      const idx = rng.int(Math.floor(points.length * 0.3), points.length - 1);
      const start = points[idx];
      if (!start) continue;
      const dir = (i % 2 === 0) ? -1 : 1;
      const len = rng.int(6, Math.max(12, Math.floor(size * 0.28)));
      let bx = start.x, by = start.y;
      const upBias = rng.float(0.1, 0.3);
      for (let b = 0; b < len; b++) {
        bx += dir;
        if (rng.chance(upBias)) by -= 1;
        else if (rng.chance(0.2)) by += 1;
        const thick = b < len * 0.3 ? 2 : 1;
        for (let t = 0; t < thick; t++) {
          const isScale = (b + t) % 3 === 0;
          setPixel(ctx, bx, by - t, isScale ? trunkColors[2] : trunkColors[1]);
        }
        points.push({ x: bx, y: by });

        // Sub-branches with fronds
        if (b > len * 0.4 && rng.chance(0.3)) {
          const subDir = rng.chance(0.7) ? dir : -dir;
          let sx = bx, sy = by;
          const subLen = rng.int(3, 6);
          for (let s = 0; s < subLen; s++) {
            sx += subDir;
            if (rng.chance(0.25)) sy -= 1;
            else if (rng.chance(0.2)) sy += 1;
            setPixel(ctx, sx, sy, trunkColors[2]);
            points.push({ x: sx, y: sy });
          }
        }
      }
    }
  }

  // Scaled frond leaves at branch tips
  if (growthStage > 0.35) {
    const tipPts = [...points].sort((a, b) => a.y - b.y).slice(0, Math.floor(points.length * 0.3));
    const numFronds = Math.max(10, Math.floor(growthStage * 40));
    for (let i = 0; i < numFronds; i++) {
      const start = rng.pick(tipPts);
      if (!start) continue;
      const dir = rng.chance(0.5) ? -1 : 1;
      const len = rng.int(3, 6);
      for (let f = 0; f < len; f++) {
        const fx = start.x + dir * f;
        const fy = start.y - Math.floor(f * 0.3);
        setPixel(ctx, fx, fy, scaleColors[1]);
        if (f % 2 === 0) {
          setPixel(ctx, fx, fy - 1, scaleColors[2]);
          setPixel(ctx, fx, fy + 1, scaleColors[0]);
        }
        points.push({ x: fx, y: fy });
      }
    }
  }

  // Glowing mist from bark knots
  if (growthStage > 0.7) {
    const numMist = Math.floor((growthStage - 0.7) * 75);
    const mistColors = ['#5aaa5a', '#80cc80', '#a0e0a0'];
    for (let i = 0; i < numMist; i++) {
      const pt = rng.pick(points);
      const mx = pt.x + rng.int(-2, 2);
      const my = pt.y + rng.int(-2, 0);
      setPixel(ctx, mx, my, rng.pick(mistColors));
    }
  }

  return points;
}

// ── Prismheart Tree — crystal tree variant with RGB cycling ──

function drawPrismheartTree(ctx, cx, soilY, height, rng, growthStage, size, frameOffset) {
  const stemProgress = Math.min(1, growthStage / 0.7);
  const trunkH = Math.max(3, Math.floor(height * stemProgress));
  const baseHue = (frameOffset * 3) % 360;
  const trunkColors = [
    hsl(baseHue, 20, 30),
    hsl(baseHue, 25, 45),
    hsl(baseHue, 15, 60),
    hsl(baseHue, 10, 75),
  ];
  const points = [];

  // Prismatic trunk — thicker base
  let drift = 0;
  for (let y = 0; y < trunkH; y++) {
    drift += (rng.random() - 0.5) * 0.25;
    const px = Math.round(cx + drift);
    const py = soilY - 2 - y;
    const progress = y / trunkH;
    const thick = Math.max(2, Math.round(4 * (1 - progress * 0.45)));

    for (let t = -Math.floor(thick / 2); t <= Math.floor(thick / 2); t++) {
      const isEdge = Math.abs(t) === Math.floor(thick / 2);
      setPixel(ctx, px + t, py, isEdge ? trunkColors[0] : trunkColors[1]);
    }
    if (y % 3 === 0) setPixel(ctx, px, py, trunkColors[3]);
    points.push({ x: px, y: py });
  }

  // Wide spreading crystal branches
  if (growthStage > 0.25) {
    const numBranches = Math.max(15, Math.floor(growthStage * 40));
    for (let i = 0; i < numBranches; i++) {
      const idx = rng.int(Math.floor(points.length * 0.3), points.length - 1);
      const start = points[idx];
      if (!start) continue;
      const dir = (i % 2 === 0) ? -1 : 1;
      const len = rng.int(6, Math.max(12, Math.floor(size * 0.25)));
      const branchHue = (baseHue + rng.int(30, 120)) % 360;
      const branchColors = [
        hsl(branchHue, 30, 35),
        hsl(branchHue, 40, 50),
        hsl(branchHue, 50, 65),
      ];
      let bx = start.x, by = start.y;
      for (let b = 0; b < len; b++) {
        bx += dir;
        if (rng.chance(0.2)) by -= 1;
        else if (rng.chance(0.15)) by += 1;
        const thick = b < len * 0.3 ? 2 : 1;
        for (let t = 0; t < thick; t++) {
          setPixel(ctx, bx, by - t, branchColors[b < 2 ? 0 : 1]);
        }
        points.push({ x: bx, y: by });

        // Crystal shard sub-branches
        if (b > len * 0.4 && rng.chance(0.35)) {
          const subDir = rng.chance(0.6) ? dir : -dir;
          let sx = bx, sy = by;
          const shardHue = (baseHue + rng.int(60, 240)) % 360;
          const subLen = rng.int(3, 5);
          for (let s = 0; s < subLen; s++) {
            sx += subDir;
            if (rng.chance(0.25)) sy -= 1;
            else if (rng.chance(0.2)) sy += 1;
            setPixel(ctx, sx, sy, hsl(shardHue, 50, 60));
            if (s === subLen - 1) setPixel(ctx, sx, sy, hsl(shardHue, 60, 80));
            points.push({ x: sx, y: sy });
          }
        }
      }
    }
  }

  // Floating prism fragments at maturity
  if (growthStage >= 0.9) {
    const numFrags = 30;
    for (let i = 0; i < numFrags; i++) {
      const fragHue = (baseHue + i * 12) % 360;
      const fx = cx + rng.int(-Math.floor(size * 0.35), Math.floor(size * 0.35));
      const fy = rng.int(4, Math.floor(soilY * 0.6));
      setPixel(ctx, fx, fy, hsl(fragHue, 70, 70));
      setPixel(ctx, fx + 1, fy, hsl(fragHue, 60, 80));
      setPixel(ctx, fx, fy + 1, hsl(fragHue, 60, 80));
    }
  }

  return points;
}

// ── Black Dahlia — override flower colors to deep crimson/black ──

function drawBlackDahliaFlowers(ctx, points, rng, growthStage, complexity, size) {
  if (growthStage < 0.7) return;
  const bloom = Math.min(1, (growthStage - 0.7) / 0.25);
  const petalColors = ['#1a0a0a', '#3a1018', '#5a1a28', '#2a0a10'];
  const centerColor = '#800020';
  const topPoints = [...points].sort((a, b) => a.y - b.y).slice(0, 8);
  const numFlowers = Math.max(1, Math.floor(complexity * 0.6));

  for (let i = 0; i < numFlowers; i++) {
    const pt = rng.pick(topPoints);
    const r = Math.max(2, Math.floor(3 * bloom));
    // Layered circular petals
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= r) {
          const ci = Math.min(3, Math.floor(dist));
          setPixel(ctx, pt.x + dx, pt.y + dy, petalColors[ci]);
        }
      }
    }
    setPixel(ctx, pt.x, pt.y, centerColor);
    setPixel(ctx, pt.x - 1, pt.y, centerColor);
    setPixel(ctx, pt.x + 1, pt.y, centerColor);
  }
}

// ── Blue Fire Poppy — electric blue with flicker ──

function drawBlueFirePoppyFlowers(ctx, points, rng, growthStage, complexity, size, frameOffset) {
  if (growthStage < 0.7) return;
  const bloom = Math.min(1, (growthStage - 0.7) / 0.25);
  const blueColors = ['#1a3a8a', '#2a5aba', '#4a8aee', '#7ab4ff', '#c0e0ff'];
  const topPoints = [...points].sort((a, b) => a.y - b.y).slice(0, 8);
  const numFlowers = Math.max(1, Math.floor(complexity * 0.5));

  for (let i = 0; i < numFlowers; i++) {
    const pt = rng.pick(topPoints);
    const r = Math.max(2, Math.floor(3 * bloom));
    const numPetals = 5;
    for (let p = 0; p < numPetals; p++) {
      const angle = (p * Math.PI * 2) / numPetals + ((frameOffset || 0) * 0.05);
      for (let d = 1; d <= r; d++) {
        const px = Math.round(pt.x + Math.cos(angle) * d);
        const py = Math.round(pt.y + Math.sin(angle) * d * 0.7);
        const ci = Math.min(4, d);
        setPixel(ctx, px, py, blueColors[ci]);
      }
    }
    // Bright center
    setPixel(ctx, pt.x, pt.y, '#ffffff');
    // Flicker spark
    if (rng.chance(0.5)) {
      const fx = pt.x + rng.int(-2, 2);
      const fy = pt.y + rng.int(-2, 2);
      setPixel(ctx, fx, fy, '#c0e0ff');
    }
  }
}

// ── Daisy — low rosette with wiry stems and composite flowers ──

function drawDaisy(ctx, cx, soilY, height, palette, rng, growthStage, size) {
  const green = palette.greens;
  const stemProgress = Math.min(1, growthStage / 0.7);
  const points = [];
  const baseY = soilY - 2;

  // Basal rosette of spatula-shaped leaves spreading outward from soil
  const numLeaves = Math.max(2, Math.floor(growthStage * 5));
  for (let i = 0; i < numLeaves; i++) {
    const angle = (i / numLeaves) * Math.PI - Math.PI * 0.1 + rng.float(-0.15, 0.15);
    const leafLen = Math.max(3, Math.floor(size * 0.22 * stemProgress));
    for (let r = 0; r < leafLen; r++) {
      const t = r / leafLen;
      // Leaves arch outward and slightly down
      const lx = Math.round(cx + Math.cos(angle) * r * 1.3);
      const ly = Math.round(baseY - Math.sin(angle) * r * 0.5 + t * 1.5);
      // Wider at tip, narrow at base
      const w = t < 0.3 ? 0 : (t > 0.7 ? 1 : Math.round(t * 1.5));
      setPixel(ctx, lx, ly, green[t > 0.7 ? 2 : 1]);
      if (w > 0) {
        setPixel(ctx, lx, ly - 1, green[2]);
        setPixel(ctx, lx, ly + 1, green[0]);
      }
      points.push({ x: lx, y: ly });
    }
  }

  // Thin wiry flower stems (1px wide, no branching)
  if (growthStage > 0.3) {
    const numStems = Math.max(1, Math.min(3, Math.floor(growthStage * 3)));
    const flowerPts = [];
    for (let s = 0; s < numStems; s++) {
      const stemH = Math.max(4, Math.floor(height * 0.75 * stemProgress));
      const spread = (s - (numStems - 1) / 2) * rng.float(1.5, 2.5);
      let sx = cx + Math.round(spread);
      let drift = 0;
      for (let y = 0; y < stemH; y++) {
        drift += spread * 0.015 + (rng.random() - 0.5) * 0.15;
        const px = Math.round(sx + drift);
        const py = baseY - y;
        setPixel(ctx, px, py, green[0]);
        points.push({ x: px, y: py });
        if (y === stemH - 1) flowerPts.push({ x: px, y: py });
      }
    }

    // Daisy composite flowers at stem tips
    if (growthStage > 0.7) {
      const bloom = Math.min(1, (growthStage - 0.7) / 0.25);
      const flowerColors = palette.flowers;
      for (const pt of flowerPts) {
        // White ray petals in 8 directions
        const petalLen = Math.max(2, Math.floor(3 * bloom));
        const dirs = [
          [0, -1], [1, -1], [1, 0], [1, 1],
          [0, 1], [-1, 1], [-1, 0], [-1, -1],
        ];
        for (const [dx, dy] of dirs) {
          for (let r = 1; r <= petalLen; r++) {
            setPixel(ctx, pt.x + dx * r, pt.y + dy * r, flowerColors[2]); // white
          }
          // Petal width
          if (petalLen >= 2) {
            const perp = dy === 0 ? [0, 1] : dx === 0 ? [1, 0] : [0, 0];
            if (perp[0] || perp[1]) {
              setPixel(ctx, pt.x + dx + perp[0], pt.y + dy + perp[1], flowerColors[1]);
            }
          }
        }
        // Yellow disc center
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (Math.abs(dx) + Math.abs(dy) <= 1) {
              setPixel(ctx, pt.x + dx, pt.y + dy, flowerColors[0]);
            }
          }
        }
      }
    }
  }

  return points;
}

// ── Tulip — single erect stem with cup-shaped flower ──

function drawTulip(ctx, cx, soilY, height, palette, rng, growthStage, size) {
  const green = palette.greens;
  const stemProgress = Math.min(1, growthStage / 0.7);
  const stemH = Math.max(3, Math.floor(height * 0.85 * stemProgress));
  const points = [];
  const baseY = soilY - 2;

  // Single thick erect stem (2px wide, minimal curve)
  let drift = 0;
  for (let y = 0; y < stemH; y++) {
    drift += (rng.random() - 0.5) * 0.05;
    const px = Math.round(cx + drift);
    const py = baseY - y;
    setPixel(ctx, px, py, green[1]);
    setPixel(ctx, px + 1, py, green[0]);
    points.push({ x: px, y: py });
  }

  // 2-3 long pointed leaves clasping stem base, arching outward
  if (growthStage > 0.1) {
    const numLeaves = rng.int(2, 3);
    for (let i = 0; i < numLeaves; i++) {
      const dir = (i % 2 === 0) ? -1 : 1;
      const leafLen = Math.max(4, Math.floor(stemH * 0.6));
      const startY = baseY - rng.int(0, 2);
      for (let l = 0; l < leafLen; l++) {
        const t = l / leafLen;
        // Leaves arch outward from stem base
        const lx = Math.round(cx + dir * l * 0.6 + dir * Math.sin(t * Math.PI * 0.5) * 2);
        const ly = Math.round(startY - l + Math.sin(t * Math.PI) * 1);
        // Narrowing toward tip
        const w = t < 0.2 ? 2 : t < 0.7 ? 1 : 0;
        setPixel(ctx, lx, ly, green[1]);
        if (w >= 1) setPixel(ctx, lx + dir, ly, green[2]);
        if (w >= 2) setPixel(ctx, lx - dir, ly, green[0]);
        points.push({ x: lx, y: ly });
      }
    }
  }

  // Cup-shaped flower at top
  if (growthStage > 0.7 && stemH > 3) {
    const bloom = Math.min(1, (growthStage - 0.7) / 0.25);
    const flowerColors = palette.flowers;
    const topPt = points[stemH - 1] || { x: cx, y: baseY - stemH + 1 };
    const cupH = Math.max(3, Math.floor(4 * bloom));
    const cupW = Math.max(2, Math.floor(3 * bloom));

    // U-shaped cup: 3 visible petals
    for (let row = 0; row < cupH; row++) {
      const t = row / cupH;
      // Width expands toward top (opening of cup)
      const w = Math.max(1, Math.round(cupW * (0.5 + t * 0.5)));
      for (let dx = -w; dx <= w; dx++) {
        const isEdge = Math.abs(dx) >= w - 1;
        const py = topPt.y - row;
        // Bottom rows are darker (interior), top rows lighter
        const ci = isEdge ? 0 : (t < 0.4 ? 0 : 1);
        setPixel(ctx, topPt.x + dx, py, flowerColors[ci]);
      }
    }
    // Petal tips curving slightly outward at top
    const topY = topPt.y - cupH + 1;
    setPixel(ctx, topPt.x - cupW - 1, topY, flowerColors[2]);
    setPixel(ctx, topPt.x + cupW + 1, topY, flowerColors[2]);
    setPixel(ctx, topPt.x, topY - 1, flowerColors[2]);
    // Interior shading
    for (let dx = -1; dx <= 1; dx++) {
      setPixel(ctx, topPt.x + dx, topPt.y, flowerColors[0]);
    }
  }

  return points;
}

// ── Fern — arching fronds radiating from crown at soil level ──

function drawFern(ctx, cx, soilY, height, palette, rng, growthStage, size) {
  const green = palette.greens;
  const stemProgress = Math.min(1, growthStage / 0.7);
  const points = [];
  const baseY = soilY - 2;

  // No central stem — fronds radiate from crown at soil level
  const numFronds = Math.max(2, Math.floor(growthStage * 7));
  const maxFrondLen = Math.max(5, Math.floor(height * 0.85 * stemProgress));

  for (let f = 0; f < numFronds; f++) {
    // Spread fronds in a fountain pattern
    const spread = (f / (numFronds - 1 || 1)) * Math.PI * 0.85 + Math.PI * 0.075;
    const frondLen = Math.max(3, Math.floor(maxFrondLen * rng.float(0.7, 1.0)));
    const curlTight = rng.float(0.02, 0.06);
    let fx = cx;
    let fy = baseY;
    let angle = -spread; // Upward arc

    for (let r = 0; r < frondLen; r++) {
      const t = r / frondLen;
      // Curved rachis (main stem of frond)
      angle += curlTight; // Frond curls outward
      fx += Math.cos(angle + Math.PI / 2) * 0.9;
      fy += Math.sin(angle + Math.PI / 2) * 0.9;
      const px = Math.round(fx);
      const py = Math.round(fy);

      setPixel(ctx, px, py, green[0]);
      points.push({ x: px, y: py });

      // Early growth: coiled fiddlehead tips
      if (growthStage < 0.4 && t > 0.7) {
        // Curl inward at tip
        const curlX = Math.round(px + Math.cos(angle) * 1.5);
        const curlY = Math.round(py + Math.sin(angle) * 1.5);
        setPixel(ctx, curlX, curlY, green[1]);
        break; // Stop frond early — fiddlehead
      }

      // Alternating small pinnae on both sides
      if (r > 1 && r % 2 === 0 && t < 0.9) {
        const perpAngle = angle + Math.PI / 2;
        for (let side = -1; side <= 1; side += 2) {
          const pinnaeLen = Math.max(1, Math.floor((1 - t) * 2.5));
          for (let p = 1; p <= pinnaeLen; p++) {
            const pinX = Math.round(px + Math.cos(perpAngle) * side * p);
            const pinY = Math.round(py + Math.sin(perpAngle) * side * p);
            setPixel(ctx, pinX, pinY, green[p === pinnaeLen ? 2 : 1]);
          }
        }
      }
    }
  }

  return points;
}

// ── Violet — low rosette with heart-shaped leaves and bilateral flowers ──

function drawViolet(ctx, cx, soilY, height, palette, rng, growthStage, size) {
  const green = palette.greens;
  const stemProgress = Math.min(1, growthStage / 0.7);
  const points = [];
  const baseY = soilY - 2;

  // Dense low rosette of 5-8 heart-shaped leaves close to ground
  const numLeaves = Math.max(3, Math.floor(growthStage * 8));
  for (let i = 0; i < numLeaves; i++) {
    const angle = (i / numLeaves) * Math.PI * 2 + rng.float(-0.2, 0.2);
    const leafLen = Math.max(2, Math.floor(size * 0.15 * stemProgress));
    const dir = Math.cos(angle) > 0 ? 1 : -1;
    for (let r = 0; r < leafLen; r++) {
      const t = r / leafLen;
      const lx = Math.round(cx + Math.cos(angle) * r * 1.2);
      const ly = Math.round(baseY - Math.sin(angle) * r * 0.4 - (1 - t) * 1);
      // Heart-shaped: wider in middle
      const w = Math.round(Math.sin(t * Math.PI) * 2);
      for (let dx = -w; dx <= w; dx++) {
        const shade = Math.abs(dx) === w ? 0 : (t > 0.6 ? 2 : 1);
        setPixel(ctx, lx + dx, ly, green[shade]);
      }
      // Center vein
      setPixel(ctx, lx, ly, green[0]);
      points.push({ x: lx, y: ly });
    }
  }

  // Thin flower stalks rising above rosette
  if (growthStage > 0.5) {
    const numStalks = Math.max(1, Math.min(4, Math.floor(growthStage * 4)));
    const flowerPts = [];
    for (let s = 0; s < numStalks; s++) {
      const stalkH = Math.max(3, Math.floor(height * 0.55 * stemProgress));
      const spread = (s - (numStalks - 1) / 2) * rng.float(1.0, 2.0);
      let sx = cx + Math.round(spread);
      let drift = 0;
      for (let y = 0; y < stalkH; y++) {
        drift += spread * 0.02 + (rng.random() - 0.5) * 0.1;
        const px = Math.round(sx + drift);
        const py = baseY - y - 2;
        setPixel(ctx, px, py, green[0]);
        points.push({ x: px, y: py });
        if (y === stalkH - 1) flowerPts.push({ x: px, y: py });
      }
    }

    // Bilateral 5-petaled violet flowers
    if (growthStage > 0.7) {
      const bloom = Math.min(1, (growthStage - 0.7) / 0.25);
      const flowerColors = palette.flowers;
      for (const pt of flowerPts) {
        const r = Math.max(1, Math.floor(2.5 * bloom));
        // 2 upper petals
        setPixel(ctx, pt.x - 1, pt.y - r, flowerColors[2]);
        setPixel(ctx, pt.x + 1, pt.y - r, flowerColors[2]);
        if (r > 1) {
          setPixel(ctx, pt.x - 2, pt.y - r + 1, flowerColors[1]);
          setPixel(ctx, pt.x + 2, pt.y - r + 1, flowerColors[1]);
        }
        // 2 side petals
        setPixel(ctx, pt.x - r, pt.y, flowerColors[2]);
        setPixel(ctx, pt.x + r, pt.y, flowerColors[2]);
        if (r > 1) {
          setPixel(ctx, pt.x - r, pt.y - 1, flowerColors[1]);
          setPixel(ctx, pt.x + r, pt.y - 1, flowerColors[1]);
        }
        // 1 lower petal (slightly larger, with spur)
        setPixel(ctx, pt.x, pt.y + r, flowerColors[1]);
        if (r > 1) {
          setPixel(ctx, pt.x - 1, pt.y + r, flowerColors[2]);
          setPixel(ctx, pt.x + 1, pt.y + r, flowerColors[2]);
          setPixel(ctx, pt.x, pt.y + r + 1, flowerColors[0]); // spur
        }
        // Center dot
        setPixel(ctx, pt.x, pt.y, flowerColors[0]);
      }
    }
  }

  return points;
}

// ── Snapdragon — stiff stem with lance leaves and vertical flower spike ──

function drawSnapdragon(ctx, cx, soilY, height, palette, rng, growthStage, size) {
  const green = palette.greens;
  const stemProgress = Math.min(1, growthStage / 0.7);
  const stemH = Math.max(3, Math.floor(height * 0.9 * stemProgress));
  const points = [];
  const baseY = soilY - 2;

  // Stiff straight central stem (2px wide)
  let drift = 0;
  for (let y = 0; y < stemH; y++) {
    drift += (rng.random() - 0.5) * 0.02;
    const px = Math.round(cx + drift);
    const py = baseY - y;
    setPixel(ctx, px, py, green[1]);
    setPixel(ctx, px + 1, py, green[0]);
    points.push({ x: px, y: py });
  }

  // Lance-shaped opposite leaves in mirrored pairs every 3-4px
  if (growthStage > 0.15) {
    const leafSpacing = rng.int(3, 4);
    for (let y = 2; y < stemH - 3; y += leafSpacing) {
      const stemPt = points[y];
      if (!stemPt) continue;
      for (let side = -1; side <= 1; side += 2) {
        const leafLen = Math.max(2, Math.floor(3 * stemProgress));
        for (let l = 1; l <= leafLen; l++) {
          const t = l / leafLen;
          const lx = stemPt.x + side * l;
          const ly = stemPt.y - Math.floor(l * 0.3);
          // Narrow lance shape
          setPixel(ctx, lx, ly, green[t < 0.5 ? 1 : 2]);
          if (t < 0.6) setPixel(ctx, lx, ly + 1, green[0]); // lower edge
        }
      }
    }
  }

  // Vertical flower spike (raceme) at top — dense stack of tubular flowers
  if (growthStage > 0.7 && stemH > 5) {
    const bloom = Math.min(1, (growthStage - 0.7) / 0.25);
    const flowerColors = palette.flowers;
    const spikeLen = Math.max(3, Math.floor(stemH * 0.4 * bloom));
    const spikeStartIdx = stemH - 1;

    for (let i = 0; i < spikeLen; i++) {
      const idx = spikeStartIdx - i;
      if (idx < 0) break;
      const pt = points[idx];
      if (!pt) continue;
      const t = i / spikeLen;
      // Flowers open from bottom up
      const open = i < spikeLen * bloom;

      if (open) {
        // Two-lipped tubular flower
        const w = Math.max(1, Math.round(2 * (1 - t * 0.5)));
        // Upper lip
        for (let dx = -w; dx <= w; dx++) {
          setPixel(ctx, pt.x + dx, pt.y - 1, flowerColors[2]);
        }
        // Lower lip (slightly wider)
        for (let dx = -(w + 1); dx <= w + 1; dx++) {
          setPixel(ctx, pt.x + dx, pt.y, flowerColors[1]);
        }
        // Throat
        setPixel(ctx, pt.x, pt.y, flowerColors[0]);
      } else {
        // Closed bud
        setPixel(ctx, pt.x, pt.y, flowerColors[0]);
        setPixel(ctx, pt.x - 1, pt.y, green[2]);
        setPixel(ctx, pt.x + 1, pt.y, green[2]);
      }
    }
  }

  return points;
}

// ── Orchid — short thick stem, strap leaves, arching flower spike ──

function drawOrchid(ctx, cx, soilY, height, palette, rng, growthStage, size) {
  const green = palette.greens;
  const stemProgress = Math.min(1, growthStage / 0.7);
  const points = [];
  const baseY = soilY - 2;

  // Short thick stem (30-40% of total height)
  const stemH = Math.max(3, Math.floor(height * 0.35 * stemProgress));
  for (let y = 0; y < stemH; y++) {
    const px = cx;
    const py = baseY - y;
    setPixel(ctx, px - 1, py, green[0]);
    setPixel(ctx, px, py, green[1]);
    setPixel(ctx, px + 1, py, green[0]);
    points.push({ x: px, y: py });
  }

  // 3-5 large strap-shaped leaves drooping from base
  if (growthStage > 0.1) {
    const numLeaves = Math.max(2, Math.min(5, Math.floor(growthStage * 5)));
    for (let i = 0; i < numLeaves; i++) {
      const dir = (i % 2 === 0) ? -1 : 1;
      const leafLen = Math.max(4, Math.floor(size * 0.3 * stemProgress));
      const droop = rng.float(0.03, 0.06);
      const startY = baseY - rng.int(0, Math.max(0, stemH - 2));
      let lx = cx;
      let ly = startY;
      for (let l = 0; l < leafLen; l++) {
        const t = l / leafLen;
        lx += dir * 0.8;
        ly += droop * l; // Increasing droop
        const px = Math.round(lx);
        const py = Math.round(ly);
        // Wide strap leaves
        const w = t < 0.1 ? 1 : (t > 0.85 ? 0 : 1);
        setPixel(ctx, px, py, green[1]);
        if (w > 0) {
          setPixel(ctx, px, py - 1, green[2]);
          setPixel(ctx, px, py + 1, green[0]);
        }
        // Center vein highlight
        if (t > 0.2 && t < 0.8) setPixel(ctx, px, py, green[2]);
        points.push({ x: px, y: py });
      }
    }
  }

  // Gracefully arching flower spike curving to one side
  if (growthStage > 0.4) {
    const spikeDir = rng.chance(0.5) ? -1 : 1;
    const spikeLen = Math.max(5, Math.floor(height * 0.7 * stemProgress));
    const spikeStartY = baseY - stemH;
    const spikePts = [];
    let sx = cx;
    let sy = spikeStartY;

    for (let s = 0; s < spikeLen; s++) {
      const t = s / spikeLen;
      // Arching curve
      sx += spikeDir * 0.3 + spikeDir * t * 0.2;
      sy -= 0.8 - t * 0.3; // Slowing rise as it arches
      const px = Math.round(sx);
      const py = Math.round(sy);
      setPixel(ctx, px, py, green[0]);
      spikePts.push({ x: px, y: py });
      points.push({ x: px, y: py });
    }

    // 3-5 large orchid flowers along the spike
    if (growthStage > 0.7 && spikePts.length > 3) {
      const bloom = Math.min(1, (growthStage - 0.7) / 0.25);
      const flowerColors = palette.flowers;
      const numFlowers = Math.max(2, Math.min(5, Math.floor(bloom * 5)));
      const spacing = Math.max(2, Math.floor(spikePts.length / numFlowers));

      for (let f = 0; f < numFlowers; f++) {
        const idx = Math.min(spikePts.length - 1, Math.floor((f + 0.5) * spacing));
        const pt = spikePts[idx];
        if (!pt) continue;
        const fr = Math.max(2, Math.floor(3 * bloom)); // flower radius

        // 3 outer sepals (triangular points)
        setPixel(ctx, pt.x, pt.y - fr - 1, flowerColors[1]);
        setPixel(ctx, pt.x - fr, pt.y + 1, flowerColors[1]);
        setPixel(ctx, pt.x + fr, pt.y + 1, flowerColors[1]);

        // 2 inner petals (wider, flanking)
        for (let dx = -1; dx <= 1; dx++) {
          setPixel(ctx, pt.x - fr + 1 + dx, pt.y - 1, flowerColors[2]);
          setPixel(ctx, pt.x + fr - 1 + dx, pt.y - 1, flowerColors[2]);
        }

        // Central labellum (contrasting darker color, larger)
        const labColor = flowerColors[0];
        setPixel(ctx, pt.x, pt.y, labColor);
        setPixel(ctx, pt.x - 1, pt.y, labColor);
        setPixel(ctx, pt.x + 1, pt.y, labColor);
        setPixel(ctx, pt.x, pt.y + 1, labColor);
        // Labellum detail
        setPixel(ctx, pt.x, pt.y + 2, flowerColors[1]);

        // Fill body of flower
        for (let dy = -fr; dy <= 0; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            setPixel(ctx, pt.x + dx, pt.y + dy, flowerColors[2]);
          }
        }
        // Re-draw labellum on top
        setPixel(ctx, pt.x, pt.y, labColor);
        setPixel(ctx, pt.x - 1, pt.y, labColor);
        setPixel(ctx, pt.x + 1, pt.y, labColor);
      }
    }
  }

  return points;
}

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
  const palette = generatePalette(rng, plant.species);
  const species = plant.species;
  const complexity = plant.complexity || 2;

  clearCanvas(ctx, size, size);

  // Always draw pot
  const { soilY, cx } = drawPot(ctx, size, palette, rng, plant.potElement, plant.potLevel || 0, plant.seed);

  if (growthStage < 0.05) {
    return canvas;
  }

  // Calculate stem height based on growth
  const maxStemHeight = Math.floor((soilY - 4) * 0.78);
  const stemProgress = Math.min(1, growthStage / 0.7);
  const stemHeight = Math.max(3, Math.floor(maxStemHeight * stemProgress));

  // Helper: completion sparkles
  function finishWithSparkles() {
    if (growthStage >= 1.0) {
      const sparkRng = createRng(plant.seed + 999);
      drawSparkles(ctx, size, sparkRng, frameOffset);
    }
    return canvas;
  }

  // ── Succulent ──
  if (species === 'Succulent') {
    drawSucculent(ctx, cx, soilY, stemHeight, palette, rng, growthStage, size);
    return finishWithSparkles();
  }

  // ── Cactus Rose ──
  if (species === 'Cactus Rose') {
    const cactusPoints = drawCactusBody(ctx, cx, soilY, stemHeight, palette, rng, growthStage, size);
    if (growthStage > 0.7 && plant.hasFlowers) {
      drawFlowers(ctx, cactusPoints, palette, rng, growthStage, complexity, size, plant.flowerTemplate);
    }
    return finishWithSparkles();
  }

  // ── Crystal Tree ──
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
    return finishWithSparkles();
  }

  // ── Clover Patch ──
  if (species === 'Clover Patch') {
    drawCloverPatch(ctx, cx, soilY, palette, rng, growthStage, size);
    return finishWithSparkles();
  }

  // ── Pitcher Plant ──
  if (species === 'Pitcher Plant') {
    drawPitcherPlant(ctx, cx, soilY, stemHeight, palette, rng, growthStage, size);
    return finishWithSparkles();
  }

  // ── Marigold ──
  if (species === 'Marigold') {
    drawMarigold(ctx, cx, soilY, stemHeight, palette, rng, growthStage, size);
    return finishWithSparkles();
  }

  // ── Lavender ──
  if (species === 'Lavender') {
    drawLavender(ctx, cx, soilY, stemHeight, palette, rng, growthStage, size);
    return finishWithSparkles();
  }

  // ── Stormvine ──
  if (species === 'Stormvine') {
    const stormPts = drawStormvine(ctx, cx, soilY, stemHeight, palette, rng, growthStage, size);
    if (growthStage > 0.15) {
      const leafGrowth = Math.min(1, (growthStage - 0.15) / 0.55);
      drawLeaves(ctx, stormPts, palette, rng, plant.leafType || 'fern', leafGrowth, complexity, size);
    }
    return finishWithSparkles();
  }

  // ── Starfall Magnolia ──
  if (species === 'Starfall Magnolia') {
    drawStarfallMagnolia(ctx, cx, soilY, stemHeight, rng, growthStage, size);
    return finishWithSparkles();
  }

  // ── Celestia Bloom ──
  if (species === 'Celestia Bloom') {
    drawCelestiaBloom(ctx, cx, soilY, stemHeight, palette, rng, growthStage, size);
    return finishWithSparkles();
  }

  // ── Dragonroot Arbor ──
  if (species === 'Dragonroot Arbor') {
    drawDragonrootArbor(ctx, cx, soilY, stemHeight, palette, rng, growthStage, size);
    return finishWithSparkles();
  }

  // ── Prismheart Tree ──
  if (species === 'Prismheart Tree') {
    drawPrismheartTree(ctx, cx, soilY, stemHeight, rng, growthStage, size, frameOffset);
    return finishWithSparkles();
  }

  // ── Daisy ──
  if (species === 'Daisy') {
    drawDaisy(ctx, cx, soilY, stemHeight, palette, rng, growthStage, size);
    return finishWithSparkles();
  }

  // ── Tulip ──
  if (species === 'Tulip') {
    drawTulip(ctx, cx, soilY, stemHeight, palette, rng, growthStage, size);
    return finishWithSparkles();
  }

  // ── Fern ──
  if (species === 'Fern') {
    drawFern(ctx, cx, soilY, stemHeight, palette, rng, growthStage, size);
    return finishWithSparkles();
  }

  // ── Violet ──
  if (species === 'Violet') {
    drawViolet(ctx, cx, soilY, stemHeight, palette, rng, growthStage, size);
    return finishWithSparkles();
  }

  // ── Snapdragon ──
  if (species === 'Snapdragon') {
    drawSnapdragon(ctx, cx, soilY, stemHeight, palette, rng, growthStage, size);
    return finishWithSparkles();
  }

  // ── Orchid ──
  if (species === 'Orchid') {
    drawOrchid(ctx, cx, soilY, stemHeight, palette, rng, growthStage, size);
    return finishWithSparkles();
  }

  // ── Standard stem-based plants ──
  const stemPoints = drawStem(ctx, cx, soilY, stemHeight, palette, rng, complexity, size);
  let allPoints = [...stemPoints];

  // Branches at growth > 0.25 for complexity >= 2
  if (growthStage > 0.25 && complexity >= 2) {
    const branchPoints = drawBranches(ctx, stemPoints, palette, rng, complexity, growthStage, size);
    allPoints = [...allPoints, ...branchPoints];
  }

  // Bonsai canopy + nebari roots
  if (species === 'Bonsai' && growthStage > 0.25) {
    drawBonsaiCanopy(ctx, allPoints, palette, rng, growthStage, size);
    // Nebari — visible surface roots at soil line
    const numRoots = rng.int(2, 4);
    for (let r = 0; r < numRoots; r++) {
      const dir = (r % 2 === 0) ? -1 : 1;
      const rootLen = rng.int(2, 4);
      let rx = cx;
      for (let j = 0; j < rootLen; j++) {
        rx += dir;
        setPixel(ctx, rx, soilY - 1, palette.stem || palette.greens[0]);
        if (rng.chance(0.4)) setPixel(ctx, rx, soilY - 2, palette.stem || palette.greens[0]);
      }
    }
  }

  // Leaves at growth > 0.15
  if (growthStage > 0.15) {
    const leafGrowth = Math.min(1, (growthStage - 0.15) / 0.55);
    drawLeaves(ctx, allPoints, palette, rng, plant.leafType || 'round', leafGrowth, complexity, size);
  }

  // Species-specific flowers
  if (species === 'Moon Lily' && growthStage > 0.7) {
    drawMoonLilyPetals(ctx, allPoints, palette, rng, growthStage, size);
  } else if (species === 'Golden Lotus' && growthStage > 0.7) {
    drawGoldenLotusPetals(ctx, allPoints, rng, growthStage, size);
  } else if (species === 'Black Dahlia') {
    drawBlackDahliaFlowers(ctx, allPoints, rng, growthStage, complexity, size);
  } else if (species === 'Blue Fire Poppy') {
    drawBlueFirePoppyFlowers(ctx, allPoints, rng, growthStage, complexity, size, frameOffset);
  } else if (species === 'Glowing Nightshade') {
    drawNightshadeBerries(ctx, allPoints, rng, growthStage, size);
  } else if (species === 'Emberthorn Blossom') {
    drawEmberthornCore(ctx, allPoints, rng, growthStage, size);
  } else if (growthStage > 0.7 && plant.hasFlowers) {
    // Standard flowers for remaining generic-pipeline species
    drawFlowers(ctx, allPoints, palette, rng, growthStage, complexity, size, plant.flowerTemplate);
  }

  return finishWithSparkles();
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
