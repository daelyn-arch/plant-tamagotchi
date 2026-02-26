// Plant animation system — particles, sway, effects by rarity

import { createCanvas, setPixel, clearCanvas, hsl } from './canvas-utils.js';
import { renderPlant } from './plant-generator.js';
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
  constructor(config, canvasSize, rng) {
    this.alive = true;
    this.config = config;
    this.canvasSize = canvasSize;

    // Spawn around the plant (upper 70% of canvas, centered horizontally)
    this.x = canvasSize * 0.2 + rng() * canvasSize * 0.6;
    this.y = canvasSize * 0.1 + rng() * canvasSize * 0.55;
    this.size = config.sizes[Math.floor(rng() * config.sizes.length)];
    this.color = config.palette[Math.floor(rng() * config.palette.length)];

    this.life = 0;
    this.maxLife = config.minLife + Math.floor(rng() * (config.maxLife - config.minLife));

    // Velocity — primarily upward with some drift
    this.vx = (rng() - 0.5) * config.drift * 2;
    this.vy = -config.speed * (0.5 + rng() * 0.5);

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

    // Gentle wind drift
    this.vx += (Math.random() - 0.5) * this.config.drift * 0.3;
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
      setPixel(ctx, px, py, color);
      return;
    }

    switch (style) {
      case 'dot':
        setPixel(ctx, px, py, color);
        break;

      case 'leaf':
        // Tiny 2-3 pixel leaf
        setPixel(ctx, px, py, color);
        if (this.size >= 2) {
          setPixel(ctx, px + 1, py, color);
          setPixel(ctx, px, py - 1, this.config.palette[Math.min(1, this.config.palette.length - 1)]);
        }
        break;

      case 'sparkle':
        // Cross shape that twinkles
        setPixel(ctx, px, py, color);
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
        setPixel(ctx, px, py, this.config.palette[Math.min(3, this.config.palette.length - 1)]);
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
        setPixel(ctx, px, py, color);
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

    const size = getCanvasSize(plant.rarity);
    this.pixelSize = size;
    this.displayW = size * scale;
    this.displayH = size * scale;

    // Cache the base plant render
    this.basePlant = renderPlant(plant, plant.growthStage);

    // Particle config — reduce for mini mode
    const base = PARTICLE_CONFIGS[plant.rarity] || PARTICLE_CONFIGS[RARITY.COMMON];
    if (this.mini) {
      this.particleConfig = {
        ...base,
        count: Math.max(1, Math.ceil(base.count * 0.4)),
        spawnRate: base.spawnRate * 0.5,
      };
    } else {
      this.particleConfig = base;
    }

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

    // Frame interval: mini runs at ~15fps, full at ~30fps
    this.frameInterval = this.mini ? 66 : 33;
  }

  start() {
    this.container.appendChild(this.displayCanvas);
    _activeAnimators.add(this);
    this.running = true;
    this.lastTime = performance.now();
    this.tick(this.lastTime);
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
          new Particle(this.particleConfig, this.pixelSize, this.rng)
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
    // Clear compositing canvas
    this.compCtx.clearRect(0, 0, this.pixelSize, this.pixelSize);

    // Draw base plant
    this.compCtx.drawImage(this.basePlant, 0, 0);

    // Draw particles on top at pixel scale
    for (const p of this.particles) {
      p.draw(this.compCtx);
    }

    // Scale up to display canvas
    this.displayCtx.clearRect(0, 0, this.displayW, this.displayH);
    this.displayCtx.drawImage(this.compCanvas, 0, 0, this.displayW, this.displayH);
  }
}
