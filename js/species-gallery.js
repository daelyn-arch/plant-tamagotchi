// Species gallery — shows example plants, undiscovered ones as silhouettes

import { SPECIES, RARITY_COLORS, RARITY } from './plant-data.js';
import { renderPlant } from './plant-generator.js';
import { loadState } from './state.js';
import { PlantAnimator, stopAllAnimators } from './animation.js';
import { getCanvasSize } from './plant-data.js';

// Fixed seeds for gallery examples
const EXAMPLE_SEEDS = {
  'Daisy': 137,
  'Tulip': 256,
  'Fern': 314,
  'Succulent': 501,
  'Violet': 777,
  'Bonsai': 1024,
  'Orchid': 1331,
  'Cactus Rose': 1597,
  'Moon Lily': 2048,
  'Crystal Tree': 4096,
};

const RARITY_ORDER = [RARITY.COMMON, RARITY.UNCOMMON, RARITY.RARE, RARITY.EPIC, RARITY.LEGENDARY];

function buildExamplePlant(species) {
  return {
    id: `gallery-${species.name}`,
    seed: EXAMPLE_SEEDS[species.name] || 42,
    species: species.name,
    rarity: species.rarity,
    complexity: species.complexity,
    hasFlowers: species.hasFlowers,
    leafType: species.leafType,
    name: species.name,
    totalDaysRequired: species.maxDays,
    daysGrown: species.maxDays,
    growthStage: 1.0,
    daysVisited: [],
    dateReceived: '',
  };
}

// Get discovery status for each species
// "completed" = in garden → fully revealed with animation
// Species only count as discovered once moved to the garden
function getSpeciesStatus() {
  const state = loadState();
  const completed = new Set();
  for (const plant of state.garden) {
    completed.add(plant.species);
  }
  return { completed };
}

// Convert a rendered plant canvas to a silhouette
function makeSilhouette(sourceCanvas, rarity) {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sourceCanvas, 0, 0);

  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  // Pick silhouette color based on rarity
  const silColors = {
    [RARITY.COMMON]:    { r: 80, g: 75, b: 65 },
    [RARITY.UNCOMMON]:  { r: 55, g: 75, b: 60 },
    [RARITY.RARE]:      { r: 50, g: 65, b: 85 },
    [RARITY.EPIC]:      { r: 65, g: 50, b: 80 },
    [RARITY.LEGENDARY]: { r: 85, g: 70, b: 40 },
  };
  const sc = silColors[rarity] || silColors[RARITY.COMMON];

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 0) {
      // Non-transparent pixel — turn to silhouette color with slight variation
      const brightness = (data[i] + data[i + 1] + data[i + 2]) / 765; // 0-1
      const shade = 0.6 + brightness * 0.25;
      data[i]     = Math.round(sc.r * shade);
      data[i + 1] = Math.round(sc.g * shade);
      data[i + 2] = Math.round(sc.b * shade);
      data[i + 3] = 180; // slightly transparent
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

// Scale a canvas up with pixelated rendering
function scaleCanvas(src, scale) {
  const canvas = document.createElement('canvas');
  canvas.width = src.width * scale;
  canvas.height = src.height * scale;
  canvas.style.imageRendering = 'pixelated';
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function renderSpeciesGallery(container) {
  // Clean up any previous animators
  stopAllAnimators();

  container.innerHTML = '';
  const { completed } = getSpeciesStatus();
  const totalDiscovered = SPECIES.filter(s => completed.has(s.name)).length;

  // Header
  const header = document.createElement('div');
  header.className = 'garden-header';
  header.innerHTML = `
    <h2>Species Gallery</h2>
    <button class="btn btn-back" id="galleryBackBtn">Back to Plant</button>
  `;
  container.appendChild(header);

  // Discovery counter
  const intro = document.createElement('p');
  intro.className = 'gallery-intro';
  intro.textContent = `Discovered: ${totalDiscovered} / ${SPECIES.length} species. Grow a plant to reveal it!`;
  container.appendChild(intro);

  // Group by rarity
  for (const rarity of RARITY_ORDER) {
    const group = SPECIES.filter((s) => s.rarity === rarity);
    if (group.length === 0) continue;

    const section = document.createElement('div');
    section.className = 'gallery-section';

    const heading = document.createElement('h3');
    heading.className = 'gallery-rarity-heading';
    heading.style.color = RARITY_COLORS[rarity];
    heading.textContent = rarity;
    section.appendChild(heading);

    const grid = document.createElement('div');
    grid.className = 'gallery-grid';

    for (const species of group) {
      const card = document.createElement('div');
      card.className = 'gallery-card';
      card.style.borderColor = RARITY_COLORS[rarity];

      const isCompleted = completed.has(species.name);
      const plant = buildExamplePlant(species);
      const scale = rarity === RARITY.LEGENDARY ? 4 :
                    rarity === RARITY.RARE || rarity === RARITY.EPIC ? 4 : 5;

      const canvasWrap = document.createElement('div');
      canvasWrap.className = 'gallery-canvas-wrap';

      if (isCompleted) {
        // Fully revealed — animated preview
        const animator = new PlantAnimator(canvasWrap, plant, scale, { mini: true });
        animator.start();
      } else {
        // Silhouette — for both "known" and completely unknown
        const baseCanvas = renderPlant(plant, 1.0);
        const silCanvas = makeSilhouette(baseCanvas, rarity);
        const scaled = scaleCanvas(silCanvas, scale);
        scaled.className = 'gallery-canvas gallery-silhouette';
        canvasWrap.appendChild(scaled);
        card.classList.add('gallery-card-locked');
      }

      const info = document.createElement('div');
      info.className = 'gallery-card-info';

      const daysRange = species.minDays === species.maxDays
        ? `${species.minDays} days`
        : `${species.minDays}-${species.maxDays} days`;

      // Name: only shown once plant has been completed and moved to garden
      let nameDisplay;
      if (isCompleted) {
        nameDisplay = `<span class="gallery-card-name" style="color:${RARITY_COLORS[rarity]}">${species.name}</span>`;
      } else {
        nameDisplay = `<span class="gallery-card-name gallery-name-locked">???</span>`;
      }

      info.innerHTML = `
        ${nameDisplay}
        <span class="gallery-card-detail">${daysRange}</span>
        <span class="gallery-card-detail">${species.hasFlowers ? 'Flowers' : 'Foliage only'}</span>
      `;

      card.appendChild(canvasWrap);
      card.appendChild(info);
      grid.appendChild(card);
    }

    section.appendChild(grid);
    container.appendChild(section);
  }
}
