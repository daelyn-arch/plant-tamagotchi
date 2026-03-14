// Plant animation system — particles, sway, effects by rarity

import { createCanvas, setPixel, clearCanvas, hsl } from './canvas-utils.js';
import { renderPlant, renderPlantLayers } from './plant-generator.js';
import { getCanvasSize, RARITY } from './plant-data.js';

// ── Particle configs by rarity ─────────────────────────────────────

const PARTICLE_CONFIGS = {
  [RARITY.COMMON]: {
    count: 4,
    spawnRate: 0.03,
    palette: ['#c8b878', '#b8a868', '#d4c890'],
    minLife: 60,
    maxLife: 120,
    speed: 0.12,
    drift: 0.02,
    sizes: [1],
    style: 'dot',       // simple pixel dot
    glow: false,
    orbit: false,
    trail: false,
  },
  [RARITY.UNCOMMON]: {
    count: 6,
    spawnRate: 0.04,
    palette: ['#5a9a3a', '#7ab85a', '#4a8a2a', '#90c870'],
    minLife: 80,
    maxLife: 150,
    speed: 0.15,
    drift: 0.03,
    sizes: [1, 2],
    style: 'leaf',       // tiny leaf shape
    glow: false,
    orbit: false,
    trail: false,
  },
  [RARITY.RARE]: {
    count: 10,
    spawnRate: 0.05,
    palette: ['#4a9ade', '#6ab4f0', '#8acaff', '#ffffff'],
    minLife: 60,
    maxLife: 130,
    speed: 0.18,
    drift: 0.04,
    sizes: [1, 1, 2],
    style: 'sparkle',    // cross/star shape that twinkles
    glow: true,
    orbit: false,
    trail: false,
  },
  [RARITY.EPIC]: {
    count: 14,
    spawnRate: 0.06,
    palette: ['#9a5ac8', '#b87ae8', '#d09aff', '#e8c0ff'],
    minLife: 80,
    maxLife: 160,
    speed: 0.2,
    drift: 0.05,
    sizes: [1, 2, 2],
    style: 'orb',        // glowing orb with fade
    glow: true,
    orbit: true,
    trail: true,
  },
  [RARITY.LEGENDARY]: {
    count: 20,
    spawnRate: 0.08,
    palette: ['#f0d060', '#f8e080', '#fff0a0', '#ffffff', '#f0c030'],
    minLife: 100,
    maxLife: 200,
    speed: 0.22,
    drift: 0.06,
    sizes: [1, 2, 2, 3],
    style: 'star',       // multi-point star with rainbow shift
    glow: true,
    orbit: true,
    trail: true,
    rainbow: true,
  },
};

// ── Species-specific legendary particle overrides ─────────────────
// Each legendary gets a unique particle style matching its vibe

const LEGENDARY_SPECIES_PARTICLES = {
  'Crystal Tree': {
    count: 24,
    spawnRate: 0.1,
    palette: ['#80d0ff', '#a0e0ff', '#c0f0ff', '#ffffff', '#90b0ff'],
    minLife: 80,
    maxLife: 180,
    speed: 0.15,
    drift: 0.04,
    sizes: [1, 2, 2, 3],
    style: 'crystal',
    glow: true,
    orbit: false,
    trail: true,
    rainbow: false,
  },
  'Starfall Magnolia': {
    count: 28,
    spawnRate: 0.1,
    palette: ['#c0c0e0', '#d0d0f0', '#e8e8ff', '#ffffff', '#fffbe6'],
    minLife: 100,
    maxLife: 220,
    speed: 0.08,
    drift: 0.06,
    sizes: [1, 1, 2, 3],
    style: 'falling_star',
    glow: true,
    orbit: false,
    trail: true,
    rainbow: false,
  },
  'Celestia Bloom': {
    count: 26,
    spawnRate: 0.09,
    palette: ['#fffbe6', '#fff5cc', '#ffffff', '#e8e8ff', '#f0f0ff'],
    minLife: 90,
    maxLife: 200,
    speed: 0.05,
    drift: 0.08,
    sizes: [1, 2, 2, 3],
    style: 'light_mote',
    glow: true,
    orbit: true,
    trail: false,
    rainbow: false,
  },
  'Dragonroot Arbor': {
    count: 22,
    spawnRate: 0.08,
    palette: ['#2a6a2a', '#40aa40', '#60cc60', '#90ee90', '#c0ffc0'],
    minLife: 80,
    maxLife: 160,
    speed: 0.1,
    drift: 0.03,
    sizes: [1, 2, 2],
    style: 'mist',
    glow: true,
    orbit: false,
    trail: true,
    rainbow: false,
  },
  'Prismheart Tree': {
    count: 30,
    spawnRate: 0.12,
    palette: ['#ff6080', '#60ff80', '#6080ff', '#ffff60', '#ff60ff'],
    minLife: 90,
    maxLife: 180,
    speed: 0.18,
    drift: 0.05,
    sizes: [1, 2, 2, 3],
    style: 'prism',
    glow: true,
    orbit: true,
    trail: true,
    rainbow: true,
  },
};

// ── Sway CSS class by rarity ───────────────────────────────────────

const SWAY_CLASS = {
  [RARITY.COMMON]: 'sway-gentle',
  [RARITY.UNCOMMON]: 'sway-mild',
  [RARITY.RARE]: 'sway-moderate',
  [RARITY.EPIC]: 'sway-lush',
  [RARITY.LEGENDARY]: 'sway-majestic',
};

// ── Particle class ─────────────────────────────────────────────────

class Particle {
  constructor(config, canvasSize, rng, pxScale) {
    this.alive = true;
    this.config = config;
    this.canvasSize = canvasSize;
    this.pxScale = pxScale || 1;

    // Spawn around the plant (upper 70% of canvas, centered horizontally)
    this.x = canvasSize * 0.2 + rng() * canvasSize * 0.6;
    this.y = canvasSize * 0.1 + rng() * canvasSize * 0.55;
    this.size = config.sizes[Math.floor(rng() * config.sizes.length)];
    this.color = config.palette[Math.floor(rng() * config.palette.length)];

    this.life = 0;
    this.maxLife = config.minLife + Math.floor(rng() * (config.maxLife - config.minLife));

    // Velocity — primarily upward, or downward for falling styles
    this.vx = (rng() - 0.5) * config.drift * 2;
    if (config.style === 'falling_star') {
      // Stars fall down slowly at a diagonal
      this.vy = config.speed * (0.3 + rng() * 0.5);
      this.vx = (rng() - 0.5) * config.speed * 0.6;
      // Spawn from higher up
      this.y = canvasSize * 0.05 + rng() * canvasSize * 0.35;
    } else if (config.style === 'mist') {
      // Mist rises slowly and drifts sideways
      this.vy = -config.speed * (0.2 + rng() * 0.3);
      this.vx = (rng() - 0.5) * config.drift * 4;
    } else if (config.style === 'light_mote') {
      // Light motes float gently in all directions
      this.vy = (rng() - 0.5) * config.speed * 0.6;
      this.vx = (rng() - 0.5) * config.speed * 0.6;
    } else {
      this.vy = -config.speed * (0.5 + rng() * 0.5);
    }

    // Orbit params for epic/legendary
    if (config.orbit) {
      this.orbitRadius = 1 + rng() * 3;
      this.orbitSpeed = 0.02 + rng() * 0.04;
      this.orbitPhase = rng() * Math.PI * 2;
    }

    // Trail for epic/legendary
    if (config.trail) {
      this.trail = [];
      this.maxTrail = 3 + Math.floor(rng() * 3);
    }

    // Rainbow hue for legendary
    if (config.rainbow) {
      this.hueOffset = rng() * 360;
    }

    // Twinkle phase for sparkles
    this.twinklePhase = rng() * Math.PI * 2;
    this.twinkleSpeed = 0.05 + rng() * 0.08;
  }

  update() {
    this.life++;
    if (this.life >= this.maxLife) {
      this.alive = false;
      return;
    }

    // Store trail position before moving
    if (this.trail) {
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > this.maxTrail) this.trail.shift();
    }

    // Movement
    if (this.config.orbit) {
      const orbitX = Math.cos(this.life * this.orbitSpeed + this.orbitPhase) * this.orbitRadius;
      this.x += this.vx + orbitX * 0.05;
    } else {
      this.x += this.vx;
    }
    this.y += this.vy;

    // Coherent wind drift (sine-based Perlin approximation)
    const windT = (this.life * 0.01 + this.x * 0.05);
    this.vx += (Math.sin(windT) * 0.5 + Math.sin(windT * 2.3) * 0.3) * this.config.drift * 0.3;
    // Clamp drift
    if (Math.abs(this.vx) > this.config.drift * 3) this.vx *= 0.9;

    // Update twinkle
    this.twinklePhase += this.twinkleSpeed;
  }

  getAlpha() {
    const t = this.life / this.maxLife;
    // Fade in quickly, fade out slowly
    if (t < 0.1) return t / 0.1;
    if (t > 0.7) return 1 - (t - 0.7) / 0.3;
    return 1;
  }

  sp(ctx, x, y, color) {
    const s = this.pxScale;
    if (s <= 1) { setPixel(ctx, x, y, color); return; }
    ctx.fillStyle = color;
    ctx.fillRect(Math.floor(x), Math.floor(y), s, s);
  }

  draw(ctx) {
    const alpha = this.getAlpha();
    if (alpha <= 0) return;

    const px = Math.round(this.x);
    const py = Math.round(this.y);

    // Out of bounds check
    if (px < 0 || px >= this.canvasSize || py < 0 || py >= this.canvasSize) return;

    let color = this.color;

    // Rainbow color cycling for legendary
    if (this.config.rainbow) {
      const hue = (this.hueOffset + this.life * 2) % 360;
      color = hsl(hue, 80, 70);
    }

    const style = this.config.style;

    // Draw trail first (behind particle)
    if (this.trail && this.trail.length > 0) {
      for (let i = 0; i < this.trail.length; i++) {
        const t = this.trail[i];
        const trailAlpha = (i / this.trail.length) * alpha * 0.4;
        if (trailAlpha > 0.15) {
          // Use a dimmer version of the color
          const trailColor = this.config.rainbow
            ? hsl((this.hueOffset + (this.life - (this.trail.length - i) * 2) * 2) % 360, 60, 55)
            : this.config.palette[0];
          setPixel(ctx, Math.round(t.x), Math.round(t.y), trailColor);
        }
      }
    }

    // Twinkle: skip drawing on some frames for sparkle style
    if (style === 'sparkle') {
      const twinkle = Math.sin(this.twinklePhase);
      if (twinkle < -0.3) return; // invisible phase
    }

    if (alpha < 0.4 && style !== 'star') {
      // Low alpha — just a dot
      this.sp(ctx, px, py, color);
      return;
    }

    switch (style) {
      case 'dot':
        this.sp(ctx, px, py, color);
        break;

      case 'leaf':
        // Tiny 2-3 pixel leaf
        this.sp(ctx, px, py, color);
        if (this.size >= 2) {
          setPixel(ctx, px + 1, py, color);
          setPixel(ctx, px, py - 1, this.config.palette[Math.min(1, this.config.palette.length - 1)]);
        }
        break;

      case 'sparkle':
        // Cross shape that twinkles
        this.sp(ctx, px, py, color);
        if (Math.sin(this.twinklePhase) > 0.2) {
          setPixel(ctx, px - 1, py, color);
          setPixel(ctx, px + 1, py, color);
        }
        if (Math.sin(this.twinklePhase) > 0.5) {
          setPixel(ctx, px, py - 1, color);
          setPixel(ctx, px, py + 1, color);
        }
        break;

      case 'orb':
        // Glowing orb — bright center, dimmer edges
        this.sp(ctx, px, py, this.config.palette[Math.min(3, this.config.palette.length - 1)]);
        if (this.size >= 2) {
          const dimColor = this.config.palette[Math.min(1, this.config.palette.length - 1)];
          setPixel(ctx, px - 1, py, dimColor);
          setPixel(ctx, px + 1, py, dimColor);
          setPixel(ctx, px, py - 1, dimColor);
          setPixel(ctx, px, py + 1, dimColor);
        }
        break;

      case 'star':
        // Multi-point star
        this.sp(ctx, px, py, color);
        // 4-point
        setPixel(ctx, px - 1, py, color);
        setPixel(ctx, px + 1, py, color);
        setPixel(ctx, px, py - 1, color);
        setPixel(ctx, px, py + 1, color);
        // Pulsing diagonals
        if (Math.sin(this.twinklePhase) > 0) {
          const dimColor = this.config.palette[0];
          setPixel(ctx, px - 1, py - 1, dimColor);
          setPixel(ctx, px + 1, py - 1, dimColor);
          setPixel(ctx, px - 1, py + 1, dimColor);
          setPixel(ctx, px + 1, py + 1, dimColor);
        }
        break;

      case 'crystal': {
        // Diamond-shaped shard that rotates/twinkles
        const phase = Math.sin(this.twinklePhase);
        this.sp(ctx, px, py, color);
        if (phase > -0.3) {
          setPixel(ctx, px, py - 1, this.config.palette[2]);
          setPixel(ctx, px, py + 1, this.config.palette[0]);
        }
        if (phase > 0.2) {
          setPixel(ctx, px - 1, py, this.config.palette[1]);
          setPixel(ctx, px + 1, py, this.config.palette[1]);
          setPixel(ctx, px, py - 2, this.config.palette[3]);
        }
        if (this.size >= 3 && phase > 0.5) {
          setPixel(ctx, px - 1, py - 1, this.config.palette[4]);
          setPixel(ctx, px + 1, py - 1, this.config.palette[4]);
        }
        break;
      }

      case 'falling_star': {
        // Falling star — bright head with diagonal trail
        const bright = this.config.palette[3];
        const dim = this.config.palette[0];
        this.sp(ctx, px, py, bright);
        // Tail going up-right
        setPixel(ctx, px + 1, py - 1, this.config.palette[2]);
        if (this.size >= 2) {
          setPixel(ctx, px + 2, py - 2, this.config.palette[1]);
          setPixel(ctx, px + 3, py - 3, dim);
        }
        // Twinkle burst
        if (Math.sin(this.twinklePhase) > 0.6) {
          setPixel(ctx, px - 1, py, this.config.palette[4]);
          setPixel(ctx, px, py + 1, this.config.palette[4]);
        }
        break;
      }

      case 'light_mote': {
        // Soft floating light orb — pulses size
        const pulse = (Math.sin(this.twinklePhase) + 1) / 2;
        const r = Math.max(1, Math.round(pulse * this.size));
        const bright = this.config.palette[2];
        const outer = this.config.palette[0];
        this.sp(ctx, px, py, bright);
        if (r >= 1) {
          setPixel(ctx, px - 1, py, outer);
          setPixel(ctx, px + 1, py, outer);
          setPixel(ctx, px, py - 1, outer);
          setPixel(ctx, px, py + 1, outer);
        }
        if (r >= 2) {
          setPixel(ctx, px - 1, py - 1, this.config.palette[3]);
          setPixel(ctx, px + 1, py + 1, this.config.palette[3]);
        }
        break;
      }

      case 'mist': {
        // Wispy mist particle — horizontal stretch that drifts
        const stretch = Math.sin(this.twinklePhase) > 0 ? 2 : 1;
        const c1 = this.config.palette[Math.min(2, this.config.palette.length - 1)];
        const c2 = this.config.palette[Math.min(4, this.config.palette.length - 1)];
        this.sp(ctx, px, py, c2);
        for (let dx = -stretch; dx <= stretch; dx++) {
          if (dx !== 0) setPixel(ctx, px + dx, py, c1);
        }
        if (this.size >= 2) {
          setPixel(ctx, px - 1, py - 1, c1);
          setPixel(ctx, px + 1, py - 1, c1);
        }
        break;
      }

      case 'prism': {
        // Prismatic shard — cycles through RGB with geometric shape
        const hue = (this.hueOffset + this.life * 4) % 360;
        const pc = hsl(hue, 80, 65);
        const pc2 = hsl((hue + 120) % 360, 70, 75);
        const pc3 = hsl((hue + 240) % 360, 70, 75);
        this.sp(ctx, px, py, '#ffffff');
        // Triangle shape
        setPixel(ctx, px - 1, py + 1, pc);
        setPixel(ctx, px + 1, py + 1, pc2);
        setPixel(ctx, px, py - 1, pc3);
        if (this.size >= 2) {
          setPixel(ctx, px - 2, py + 2, pc);
          setPixel(ctx, px + 2, py + 2, pc2);
          setPixel(ctx, px - 1, py - 1, pc3);
          setPixel(ctx, px + 1, py - 1, pc3);
        }
        if (this.size >= 3 && Math.sin(this.twinklePhase) > 0.3) {
          setPixel(ctx, px, py + 2, hsl((hue + 60) % 360, 80, 80));
        }
        break;
      }
    }

    // Glow halo for rare+
    if (this.config.glow && this.size >= 2 && alpha > 0.6) {
      const glowColor = this.config.palette[this.config.palette.length - 1];
      // Subtle single-pixel glow ring
      if (Math.sin(this.twinklePhase * 0.7) > 0.3) {
        setPixel(ctx, px - 2, py, glowColor);
        setPixel(ctx, px + 2, py, glowColor);
        setPixel(ctx, px, py - 2, glowColor);
        setPixel(ctx, px, py + 2, glowColor);
      }
    }
  }
}

// ── PlantAnimator ──────────────────────────────────────────────────

// Track all active animators so screens can clean them up
const _activeAnimators = new Set();

export function stopAllAnimators() {
  for (const a of _activeAnimators) {
    a.stop();
  }
  _activeAnimators.clear();
}

export class GrowthReplayAnimator {
  /**
   * Replays a plant's growth from stage 0 to 1.0 over a duration.
   * @param {HTMLElement} container
   * @param {object} plant
   * @param {number} scale
   * @param {object} [opts] — { durationMs: 4000 }
   */
  constructor(container, plant, scale, opts = {}) {
    this.container = container;
    this.plant = plant;
    this.scale = scale;
    this.durationMs = opts.durationMs || 4000;
    this.running = false;
    this.animFrameId = null;
    this.growthStage = 0;

    // Determine canvas size from a test render
    const testCanvas = renderPlant(plant, 1.0);
    const size = testCanvas.width;
    this.pixelSize = size;
    this.displayW = size * scale;
    this.displayH = size * scale;

    // Display canvas
    this.displayCanvas = document.createElement('canvas');
    this.displayCanvas.width = this.displayW;
    this.displayCanvas.height = this.displayH;
    this.displayCanvas.style.imageRendering = 'pixelated';
    this.displayCanvas.className = 'plant-canvas ' + (SWAY_CLASS[plant.rarity] || 'sway-gentle') + ' sway-mini';
    this.displayCtx = this.displayCanvas.getContext('2d');
    this.displayCtx.imageSmoothingEnabled = false;

    // Re-render interval (~10fps to keep cost low)
    this.renderInterval = 100;
  }

  start() {
    this.container.appendChild(this.displayCanvas);
    _activeAnimators.add(this);
    this.running = true;
    this.startTime = performance.now();
    this.lastRenderTime = 0;
    this.tick(this.startTime);
  }

  stop() {
    this.running = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    _activeAnimators.delete(this);
  }

  tick(now) {
    if (!this.running) return;

    if (now - this.lastRenderTime >= this.renderInterval) {
      this.lastRenderTime = now;
      const elapsed = now - this.startTime;
      this.growthStage = Math.min(1.0, elapsed / this.durationMs);
      this.render();

      // Loop: restart after a pause at full growth
      if (this.growthStage >= 1.0 && elapsed > this.durationMs + 1500) {
        this.startTime = now;
        this.growthStage = 0;
      }
    }

    this.animFrameId = requestAnimationFrame((t) => this.tick(t));
  }

  render() {
    const frame = renderPlant(this.plant, this.growthStage);
    this.displayCtx.clearRect(0, 0, this.displayW, this.displayH);
    this.displayCtx.drawImage(frame, 0, 0, this.displayW, this.displayH);
  }
}

export class PlantAnimator {
  /**
   * @param {HTMLElement} container
   * @param {object} plant
   * @param {number} scale
   * @param {object} [opts] — { mini: true } for thumbnail mode
   */
  constructor(container, plant, scale, opts = {}) {
    this.container = container;
    this.plant = plant;
    this.scale = scale;
    this.mini = !!opts.mini;
    this.running = false;
    this.animFrameId = null;

    // Render plant as layers for parallax compositing
    this._renderLayers(plant);

    const size = this.pixelSize;

    // Particle config — species-specific for legendaries, reduce for mini mode
    const speciesOverride = LEGENDARY_SPECIES_PARTICLES[plant.species];
    const base = speciesOverride || PARTICLE_CONFIGS[plant.rarity] || PARTICLE_CONFIGS[RARITY.COMMON];
    if (this.mini) {
      this.particleConfig = {
        ...base,
        count: Math.max(1, Math.ceil(base.count * 0.4)),
        spawnRate: base.spawnRate * 0.5,
      };
    } else {
      this.particleConfig = base;
    }

    this.pxScale = Math.max(1, Math.round(size / 40));

    this.particles = [];
    this.frameCount = 0;

    // Simple RNG for particle spawning (doesn't need to be seeded)
    this.rng = Math.random;

    // Create display canvas
    this.displayCanvas = document.createElement('canvas');
    this.displayCanvas.width = this.displayW;
    this.displayCanvas.height = this.displayH;
    this.displayCanvas.style.imageRendering = 'pixelated';
    this.displayCanvas.className = 'plant-canvas ' + (SWAY_CLASS[plant.rarity] || 'sway-gentle');
    if (this.mini) this.displayCanvas.classList.add('sway-mini');
    this.displayCtx = this.displayCanvas.getContext('2d');
    this.displayCtx.imageSmoothingEnabled = false;

    // Create pixel-scale compositing canvas
    this.compCanvas = document.createElement('canvas');
    this.compCanvas.width = size;
    this.compCanvas.height = size;
    this.compCtx = this.compCanvas.getContext('2d');
    this.compCtx.imageSmoothingEnabled = false;

    // Layer parallax animation parameters (pixels of offset per layer)
    // base: almost static, foliage: gentle shift, bloom: most movement
    this.layerMotion = {
      base:    { ampX: 0.0, ampY: 0.0, freqX: 0,    freqY: 0 },
      foliage: { ampX: 0.6, ampY: 0.3, freqX: 0.02, freqY: 0.015 },
      bloom:   { ampX: 0.9, ampY: 0.5, freqX: 0.025, freqY: 0.018 },
    };

    // Frame interval: mini runs at ~15fps, full at ~30fps
    this.frameInterval = this.mini ? 66 : 33;

    // Interactivity — click/tap jiggle + particle burst (full mode only)
    if (!this.mini) {
      this._onInteract = (e) => {
        e.preventDefault();
        this._handleInteract(e);
      };
    }
  }

  _handleInteract(e) {
    // CSS jiggle animation
    this.displayCanvas.classList.remove('plant-jiggle');
    void this.displayCanvas.offsetWidth;
    this.displayCanvas.classList.add('plant-jiggle');
    setTimeout(() => this.displayCanvas.classList.remove('plant-jiggle'), 400);

    // Particle burst at interaction point
    const rect = this.displayCanvas.getBoundingClientRect();
    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    const px = ((clientX - rect.left) / rect.width) * this.pixelSize;
    const py = ((clientY - rect.top) / rect.height) * this.pixelSize;

    const burstCount = 8 + Math.floor(Math.random() * 5);
    for (let i = 0; i < burstCount; i++) {
      const angle = (i / burstCount) * Math.PI * 2;
      const speed = 0.3 + Math.random() * 0.4;
      const p = new Particle(this.particleConfig, this.pixelSize, this.rng, this.pxScale);
      p.x = px;
      p.y = py;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.maxLife = 30 + Math.floor(Math.random() * 30);
      this.particles.push(p);
    }
  }

  /** Render or re-render the plant into 3 layer canvases */
  _renderLayers(plant) {
    if (this.mini) {
      // Mini mode: single layer for performance
      this.basePlant = renderPlant(plant, plant.growthStage);
      this.layers = null;
    } else {
      this.layers = renderPlantLayers(plant, plant.growthStage);
      // Use base layer width as pixel size (all layers same size)
      this.basePlant = this.layers.base; // fallback reference
    }
    const size = this.basePlant.width;
    this.pixelSize = size;
    this.displayW = size * this.scale;
    this.displayH = size * this.scale;
  }

  start() {
    this.container.appendChild(this.displayCanvas);
    _activeAnimators.add(this);
    this.running = true;
    this.lastTime = performance.now();
    if (this._onInteract) {
      this.displayCanvas.addEventListener('click', this._onInteract);
      this.displayCanvas.addEventListener('touchstart', this._onInteract, { passive: false });
    }
    this.tick(this.lastTime);
  }

  stop() {
    this.running = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this._onInteract && this.displayCanvas) {
      this.displayCanvas.removeEventListener('click', this._onInteract);
      this.displayCanvas.removeEventListener('touchstart', this._onInteract);
    }
    _activeAnimators.delete(this);
  }

  /** Update the plant data in-place without recreating the canvas element.
   *  Preserves particles, sway animation phase, and avoids any blink. */
  updatePlant(plant) {
    this.plant = plant;
    this._renderLayers(plant);
    const newSize = this.pixelSize;

    // If pixel size changed (rarity upgrade), resize canvases
    if (this.compCanvas.width !== newSize) {
      this.displayW = newSize * this.scale;
      this.displayH = newSize * this.scale;
      this.displayCanvas.width = this.displayW;
      this.displayCanvas.height = this.displayH;
      this.displayCtx.imageSmoothingEnabled = false;
      this.compCanvas.width = newSize;
      this.compCanvas.height = newSize;
      this.compCtx.imageSmoothingEnabled = false;
    }
  }

  tick(now) {
    if (!this.running) return;

    this.frameCount++;

    if (now - this.lastTime >= this.frameInterval) {
      this.lastTime = now;
      this.update();
      this.render();
    }

    this.animFrameId = requestAnimationFrame((t) => this.tick(t));
  }

  update() {
    // Spawn new particles
    if (this.particles.length < this.particleConfig.count) {
      if (Math.random() < this.particleConfig.spawnRate) {
        this.particles.push(
          new Particle(this.particleConfig, this.pixelSize, this.rng, this.pxScale)
        );
      }
    }

    // Update existing particles
    for (const p of this.particles) {
      p.update();
    }

    // Remove dead particles
    this.particles = this.particles.filter((p) => p.alive);
  }

  render() {
    const sz = this.pixelSize;
    this.compCtx.clearRect(0, 0, sz, sz);

    if (this.layers) {
      // ── Layered parallax compositing ──
      const f = this.frameCount;

      // Base layer: static (pot, stem, branches)
      this.compCtx.drawImage(this.layers.base, 0, 0);

      // Foliage layer: gentle independent sway
      const fm = this.layerMotion.foliage;
      const fox = Math.sin(f * fm.freqX) * fm.ampX;
      const foy = Math.sin(f * fm.freqY + 0.7) * fm.ampY;
      this.compCtx.drawImage(this.layers.foliage, Math.round(fox), Math.round(foy));

      // Bloom layer: slightly more movement, different phase
      const bm = this.layerMotion.bloom;
      const box = Math.sin(f * bm.freqX + 1.5) * bm.ampX;
      const boy = Math.sin(f * bm.freqY + 2.2) * bm.ampY;
      this.compCtx.drawImage(this.layers.bloom, Math.round(box), Math.round(boy));
    } else {
      // Mini mode: flat compositing
      this.compCtx.drawImage(this.basePlant, 0, 0);
    }

    // Draw particles on top at pixel scale
    for (const p of this.particles) {
      p.draw(this.compCtx);
    }

    // Scale up to display canvas
    this.displayCtx.clearRect(0, 0, this.displayW, this.displayH);
    this.displayCtx.drawImage(this.compCanvas, 0, 0, this.displayW, this.displayH);
  }
}
