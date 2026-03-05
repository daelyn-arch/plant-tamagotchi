// Inventory screen — shows items, allows usage

import { loadState, saveState } from './state.js';
import { RARITY_COLORS, RARITY } from './plant-data.js';
import {
  ITEM_TYPES, RARITY_ORDER,
  useBoostItem, useAutoWater, useArtReroll, useGardenUpgrade, combinePlants,
  useAnimate, useSunglasses, usePotElement, removeItem,
} from './items.js';
import { PlantAnimator, stopAllAnimators } from './animation.js';
import { renderPlantScaled } from './plant-generator.js';
import { renderGardenPicker } from './garden.js';
import { showScreen } from './ui.js';
import { renderItemIcon } from './item-renderer.js';
import { generatePlantFromSeed } from './growth.js';
import { createRng } from './rng.js';

// Callbacks set by main.js
let _onItemUsed = null;
let _onBack = null;
export function setOnItemUsed(cb) { _onItemUsed = cb; }
export function setOnInventoryBack(cb) { _onBack = cb; }

export function renderInventoryView(container) {
  stopAllAnimators();

  const state = loadState();
  const items = state.items || [];
  container.innerHTML = '';

  // Header
  const header = document.createElement('div');
  header.className = 'garden-header';
  header.innerHTML = `
    <h2>Inventory</h2>
    <div class="header-actions">
      <button class="btn btn-sm" id="itemGalleryBtn">Item Gallery</button>
      <button class="btn btn-back" id="inventoryBackBtn">Back to Plant</button>
    </div>
  `;
  container.appendChild(header);

  // Wire back button directly so it survives re-renders
  header.querySelector('#inventoryBackBtn').addEventListener('click', () => {
    if (_onBack) _onBack();
  });

  // Active boosts display
  if (state.activeBoosts && state.activeBoosts.length > 0) {
    const boostsEl = document.createElement('div');
    boostsEl.className = 'active-boosts-section';
    boostsEl.innerHTML = `
      <h3 class="inventory-section-heading">Active Boosts</h3>
      <div class="active-boosts-list">
        ${state.activeBoosts.map(b => `
          <div class="active-boost-card">
            <span class="boost-name">${b.itemName}</span>
            <span class="boost-detail">${b.type === 'watering_boost' ? 'Watering' : 'Consecutive Day'} +${b.value}</span>
            <span class="boost-remaining">${b.remainingPlants} plant${b.remainingPlants !== 1 ? 's' : ''} left</span>
          </div>
        `).join('')}
      </div>
    `;
    container.appendChild(boostsEl);
  }

  // Item count
  const countEl = document.createElement('p');
  countEl.className = 'gallery-intro';
  countEl.textContent = items.length === 0
    ? 'No items yet! Complete plants to find items.'
    : `${items.length} item${items.length !== 1 ? 's' : ''} in inventory`;
  container.appendChild(countEl);

  if (items.length === 0) return;

  // Item grid
  const grid = document.createElement('div');
  grid.className = 'inventory-grid';

  for (const item of items) {
    const card = document.createElement('div');
    card.className = 'inventory-card';
    card.style.borderColor = RARITY_COLORS[item.rarity] || '#6b7b3a';

    const iconWrap = document.createElement('div');
    iconWrap.className = 'item-icon';
    iconWrap.appendChild(renderItemIcon(item.type, item.rarity, 4));

    const info = document.createElement('div');
    info.className = 'item-card-info';
    info.innerHTML = `
      <span class="item-card-name" style="color:${RARITY_COLORS[item.rarity] || '#6b7b3a'}">${item.name}</span>
      <span class="item-card-rarity">${item.rarity}</span>
      <span class="item-card-desc">${item.description}</span>
    `;

    card.appendChild(iconWrap);
    card.appendChild(info);
    card.addEventListener('click', () => showItemDetail(container, item));
    grid.appendChild(card);
  }

  container.appendChild(grid);
}

function showItemDetail(container, item) {
  const overlay = document.createElement('div');
  overlay.className = 'detail-overlay';

  const state = loadState();
  const canUse = getUseLabel(item, state);

  const card = document.createElement('div');
  card.className = 'detail-card item-detail-card';

  const iconWrap = document.createElement('div');
  iconWrap.className = 'item-detail-icon';
  iconWrap.appendChild(renderItemIcon(item.type, item.rarity, 6));
  card.appendChild(iconWrap);

  const rest = document.createElement('div');
  rest.innerHTML = `
    <h3 style="color:${RARITY_COLORS[item.rarity] || '#6b7b3a'}">${item.name}</h3>
    <p class="detail-rarity">${item.rarity}</p>
    <p class="item-detail-desc">${item.description}</p>
    ${canUse ? `<button class="btn btn-water item-use-btn" id="itemUseBtn">${item.type === 'seed' ? 'Plant Seed' : 'Use'}</button>` : ''}
    <button class="btn btn-close-detail">Close</button>
  `;
  while (rest.firstChild) card.appendChild(rest.firstChild);

  overlay.appendChild(card);
  container.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector('.btn-close-detail').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  const useBtn = overlay.querySelector('#itemUseBtn');
  if (useBtn) {
    useBtn.addEventListener('click', () => {
      close();
      handleItemUse(container, item);
    });
  }
}

function getUseLabel(item, state) {
  switch (item.type) {
    case 'watering_boost':
    case 'day_boost':
      return 'Activate Boost';
    case 'auto_water':
      return state.currentPlant ? 'Apply to Current Plant' : null;
    case 'art_reroll':
      return 'Reroll Appearance';
    case 'garden_upgrade':
      return state.garden.length > 0 ? 'Upgrade a Plant' : null;
    case 'plant_combine':
      return state.garden.length >= 2 ? 'Combine Plants' : null;
    case 'animate':
      return 'Animate Plant';
    case 'sunglasses':
      return 'Equip Sunglasses';
    case 'pot_fire':
    case 'pot_ice':
    case 'pot_earth':
    case 'pot_wind':
      return 'Apply to Plant';
    case 'seed':
      return 'Plant Seed';
    default:
      return null;
  }
}

function handleItemUse(container, item) {
  const state = loadState();

  switch (item.type) {
    case 'watering_boost':
    case 'day_boost': {
      if (useBoostItem(state, item.id)) {
        saveState(state);
        showItemToast(`${item.name} activated! +${item.value} ${item.type === 'watering_boost' ? 'watering' : 'consecutive day'} bonus for ${item.duration} plant${item.duration > 1 ? 's' : ''}.`);
        renderInventoryView(container);
        if (_onItemUsed) _onItemUsed();
      }
      break;
    }
    case 'auto_water': {
      if (useAutoWater(state, item.id)) {
        saveState(state);
        showItemToast('Rain Charm applied! Your plant will be auto-watered on missed days.');
        renderInventoryView(container);
        if (_onItemUsed) _onItemUsed();
      }
      break;
    }
    case 'art_reroll': {
      showPlantPicker(container, item, state, 'reroll');
      break;
    }
    case 'animate': {
      showPlantPicker(container, item, state, 'animate');
      break;
    }
    case 'sunglasses': {
      showPlantPicker(container, item, state, 'sunglasses');
      break;
    }
    case 'pot_fire':
    case 'pot_ice':
    case 'pot_earth':
    case 'pot_wind': {
      showPlantPicker(container, item, state, 'pot_element');
      break;
    }
    case 'garden_upgrade': {
      showPlantPicker(container, item, state, 'upgrade');
      break;
    }
    case 'plant_combine': {
      showCombinePicker(container, item, state);
      break;
    }
    case 'seed': {
      handleSeedUse(container, item, state);
      break;
    }
  }
}

function showPlantPicker(container, item, state, mode) {
  const gardenContainer = document.getElementById('gardenContainer');
  const plants = (mode === 'reroll' || mode === 'animate' || mode === 'sunglasses' || mode === 'pot_element')
    ? [...state.garden, ...(state.currentPlant ? [state.currentPlant] : [])]
    : state.garden;

  const title = mode === 'reroll' ? 'Reroll Appearance'
    : mode === 'animate' ? 'Animate Plant'
    : mode === 'sunglasses' ? 'Equip Sunglasses'
    : mode === 'pot_element' ? 'Apply Elemental Pot'
    : 'Upgrade Plant';
  const hint = mode === 'reroll'
    ? 'Select a plant to change its appearance.'
    : mode === 'animate'
    ? 'Select a plant to bring to life!'
    : mode === 'sunglasses'
    ? 'Select an animated plant to give sunglasses.'
    : mode === 'pot_element'
    ? 'Select a plant to transform its pot.'
    : 'Select a plant to permanently boost its bonus by 50%.';

  showScreen('gardenScreen');

  renderGardenPicker(gardenContainer, {
    title,
    hint,
    plants,
    maxSelections: 1,
    eligible: (p) => mode === 'animate' ? !p.animated
      : mode === 'sunglasses' ? (p.animated && !p.sunglasses)
      : true,
    onConfirm: (ids) => {
      const freshState = loadState();
      let success = false;
      if (mode === 'reroll') {
        success = useArtReroll(freshState, item.id, ids[0]);
      } else if (mode === 'animate') {
        success = useAnimate(freshState, item.id, ids[0]);
      } else if (mode === 'sunglasses') {
        success = useSunglasses(freshState, item.id, ids[0]);
      } else if (mode === 'pot_element') {
        success = usePotElement(freshState, item.id, ids[0]);
      } else {
        success = useGardenUpgrade(freshState, item.id, ids[0]);
      }
      if (success) {
        saveState(freshState);
        if (_onItemUsed) _onItemUsed();
        // Find the updated plant to display
        const updatedState = loadState();
        const resultPlant = updatedState.garden.find(p => p.id === ids[0])
          || (updatedState.currentPlant && updatedState.currentPlant.id === ids[0] ? updatedState.currentPlant : null);
        if (resultPlant && (mode === 'reroll' || mode === 'animate' || mode === 'sunglasses' || mode === 'pot_element')) {
          const heading = mode === 'animate' ? 'Plant Awakened!'
            : mode === 'sunglasses' ? 'Looking Cool!'
            : mode === 'pot_element' ? 'Pot Transformed!'
            : 'New Appearance';
          showResultPlant(gardenContainer, resultPlant, heading, () => {
            showScreen('inventoryScreen');
            renderInventoryView(container);
          });
          return;
        }
      }
      showScreen('inventoryScreen');
      renderInventoryView(container);
    },
    onCancel: () => {
      showScreen('inventoryScreen');
      renderInventoryView(container);
    },
  });
}

function showCombinePicker(container, item, state) {
  const gateIdx = RARITY_ORDER.indexOf(item.combineGate || item.rarity);
  const allPlants = state.garden;
  const isEligible = (p) => RARITY_ORDER.indexOf(p.rarity) <= gateIdx;

  if (allPlants.filter(isEligible).length < 2) {
    showItemToast('Not enough eligible plants to combine.');
    return;
  }

  const gardenContainer = document.getElementById('gardenContainer');
  showScreen('gardenScreen');

  renderGardenPicker(gardenContainer, {
    title: 'Combine Plants',
    hint: `Select 2 plants to fuse (max rarity: ${item.combineGate || item.rarity}). Both will be consumed.`,
    plants: allPlants,
    maxSelections: 2,
    eligible: isEligible,
    onConfirm: (ids) => {
      const freshState = loadState();
      // Capture source plants before they're consumed
      const src1 = freshState.garden.find(p => p.id === ids[0]);
      const src2 = freshState.garden.find(p => p.id === ids[1]);
      const sourcePlants = [src1, src2].filter(Boolean).map(p => ({ ...p }));
      const result = combinePlants(freshState, item.id, ids[0], ids[1]);
      if (result) {
        saveState(freshState);
        if (_onItemUsed) _onItemUsed();
        showFusionSequence(gardenContainer, sourcePlants, result, () => {
          showScreen('inventoryScreen');
          renderInventoryView(container);
        });
        return;
      }
      showScreen('inventoryScreen');
      renderInventoryView(container);
    },
    onCancel: () => {
      showScreen('inventoryScreen');
      renderInventoryView(container);
    },
  });
}

function showFusionSequence(container, sourcePlants, resultPlant, onDismiss) {
  stopAllAnimators();
  container.innerHTML = '';

  const stage = document.createElement('div');
  stage.className = 'fusion-stage';
  container.appendChild(stage);

  // -- Particle canvas (behind everything) --
  const particleCanvas = document.createElement('canvas');
  particleCanvas.className = 'fusion-particles';
  particleCanvas.width = 400;
  particleCanvas.height = 400;
  stage.appendChild(particleCanvas);
  const pctx = particleCanvas.getContext('2d');
  let particles = [];
  let particleRAF = null;

  function spawnParticles(cx, cy, count, color, speed, life) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const v = speed * (0.5 + Math.random());
      particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        life, maxLife: life,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  function spawnConvergeParticles(cx, cy, count, color) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 80 + Math.random() * 120;
      particles.push({
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        vx: -Math.cos(angle) * 1.5,
        vy: -Math.sin(angle) * 1.5,
        life: 60, maxLife: 60,
        color,
        size: 1.5 + Math.random() * 2.5,
      });
    }
  }

  function animateParticles() {
    pctx.clearRect(0, 0, 400, 400);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      const alpha = p.life / p.maxLife;
      pctx.globalAlpha = alpha;
      pctx.fillStyle = p.color;
      pctx.beginPath();
      pctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      pctx.fill();
    }
    pctx.globalAlpha = 1;
    particleRAF = requestAnimationFrame(animateParticles);
  }
  animateParticles();

  // -- Source plants (left and right) --
  const leftPlant = document.createElement('div');
  leftPlant.className = 'fusion-source fusion-source-left';
  const leftCanvas = document.createElement('div');
  leftCanvas.className = 'fusion-source-canvas';
  leftPlant.appendChild(leftCanvas);
  stage.appendChild(leftPlant);

  const rightPlant = document.createElement('div');
  rightPlant.className = 'fusion-source fusion-source-right';
  const rightCanvas = document.createElement('div');
  rightCanvas.className = 'fusion-source-canvas';
  rightPlant.appendChild(rightCanvas);
  stage.appendChild(rightPlant);

  // -- Flash overlay --
  const flash = document.createElement('div');
  flash.className = 'fusion-flash';
  stage.appendChild(flash);

  // -- Result container (hidden initially) --
  const resultWrap = document.createElement('div');
  resultWrap.className = 'fusion-result';
  const resultCanvas = document.createElement('div');
  resultCanvas.className = 'fusion-result-canvas';
  resultWrap.appendChild(resultCanvas);

  const displayRarity = resultPlant.unique ? `Unique ${resultPlant.uniqueBase || resultPlant.rarity}` : resultPlant.rarity;
  const displayColor = resultPlant.unique ? '#c0c8d4' : RARITY_COLORS[resultPlant.rarity];

  const resultInfo = document.createElement('div');
  resultInfo.className = 'fusion-result-info';
  resultInfo.innerHTML = `
    <span class="fusion-result-name" style="color:${displayColor}">${resultPlant.species}</span>
    <span class="fusion-result-rarity">${displayRarity}</span>
    ${resultPlant.unique ? '<span class="unique-badge">Unique</span>' : ''}
  `;
  resultWrap.appendChild(resultInfo);

  const btn = document.createElement('button');
  btn.className = 'btn btn-water fusion-continue-btn';
  btn.textContent = 'Continue';
  btn.addEventListener('click', () => {
    cancelAnimationFrame(particleRAF);
    stopAllAnimators();
    onDismiss();
  });
  resultWrap.appendChild(btn);
  stage.appendChild(resultWrap);

  // -- Glow ring behind result --
  const glowRing = document.createElement('div');
  glowRing.className = 'fusion-glow-ring';
  stage.appendChild(glowRing);

  // -- Sequence timing --
  const animators = [];

  // STAGE 1 (0ms): Source plants slide in
  if (sourcePlants[0]) {
    const a1 = new PlantAnimator(leftCanvas, sourcePlants[0], 3, { mini: true });
    a1.start();
    animators.push(a1);
  }
  if (sourcePlants[1]) {
    const a2 = new PlantAnimator(rightCanvas, sourcePlants[1], 3, { mini: true });
    a2.start();
    animators.push(a2);
  }

  // STAGE 2 (800ms): Plants converge, energy particles
  setTimeout(() => {
    leftPlant.classList.add('fusion-converge');
    rightPlant.classList.add('fusion-converge');
    // Spawn swirling energy particles
    const colors = ['#c0c8d4', '#9ab4cc', '#d4c8b0', '#ffffff', '#e8d070'];
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        spawnConvergeParticles(200, 180, 12, colors[i % colors.length]);
      }, i * 150);
    }
  }, 800);

  // STAGE 3 (2200ms): Plants shrink and fade, energy intensifies
  setTimeout(() => {
    leftPlant.classList.add('fusion-dissolve');
    rightPlant.classList.add('fusion-dissolve');
    // Burst of particles at center
    const burstColors = ['#ffffff', '#c0c8d4', '#e8d070', '#9ab4cc', '#f0e0a0'];
    for (const c of burstColors) {
      spawnParticles(200, 180, 15, c, 2.5, 40);
    }
  }, 2200);

  // STAGE 4 (3000ms): Flash
  setTimeout(() => {
    flash.classList.add('fusion-flash-active');
    // Massive particle burst
    spawnParticles(200, 180, 60, '#ffffff', 4, 50);
    spawnParticles(200, 180, 40, '#e8d070', 3, 60);
    spawnParticles(200, 180, 30, '#c0c8d4', 2, 70);
  }, 3000);

  // STAGE 5 (3500ms): Flash fades, result regrows from seed
  setTimeout(() => {
    flash.classList.remove('fusion-flash-active');
    flash.classList.add('fusion-flash-fade');

    // Hide source plants
    leftPlant.style.display = 'none';
    rightPlant.style.display = 'none';
    for (const a of animators) a.stop();

    // Show result container
    glowRing.classList.add('fusion-glow-active');
    resultWrap.classList.add('fusion-result-reveal');

    // Rapid growth animation — plant regrows from seed
    const growthStages = [0.05, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1.0];
    let stageIdx = 0;
    const growthScale = 5;

    function renderGrowthFrame() {
      const gs = growthStages[stageIdx];
      // Clear previous frame
      resultCanvas.innerHTML = '';
      const frame = renderPlantScaled(resultPlant, gs, growthScale);
      frame.className = 'plant-canvas';
      frame.style.imageRendering = 'pixelated';
      resultCanvas.appendChild(frame);
      stageIdx++;
    }

    // Show first frame (seed/pot)
    renderGrowthFrame();

    // Animate through remaining stages
    const growthTimer = setInterval(() => {
      if (stageIdx >= growthStages.length) {
        clearInterval(growthTimer);
        // Switch to animated PlantAnimator at full growth
        resultCanvas.innerHTML = '';
        const resultAnimator = new PlantAnimator(resultCanvas, resultPlant, growthScale);
        resultAnimator.start();
        return;
      }
      renderGrowthFrame();

      // Spawn particles on each growth tick
      const colors = ['#c0c8d4', '#9ab4cc', '#d4dce8', '#e8e0f0'];
      spawnParticles(200, 180, 5, colors[stageIdx % colors.length], 1.2, 35);
    }, 250);

    // Celebration particles once fully grown
    setTimeout(() => {
      const celebInterval = setInterval(() => {
        const colors = ['#c0c8d4', '#e8d070', '#9ab4cc', '#ffffff', '#d4b870'];
        spawnParticles(200, 180, 8, colors[Math.floor(Math.random() * colors.length)], 1.5, 50);
      }, 200);
      setTimeout(() => clearInterval(celebInterval), 3000);
    }, growthStages.length * 250 + 200);
  }, 3500);
}

function showResultPlant(container, plant, heading, onDismiss) {
  stopAllAnimators();
  container.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'result-plant-screen';

  const title = document.createElement('h2');
  title.className = 'result-plant-title';
  title.textContent = heading;
  wrap.appendChild(title);

  const canvasWrap = document.createElement('div');
  canvasWrap.className = 'result-plant-canvas';
  wrap.appendChild(canvasWrap);

  const displayRarity = plant.unique ? `Unique ${plant.uniqueBase || plant.rarity}` : plant.rarity;
  const displayColor = plant.unique ? '#c0c8d4' : RARITY_COLORS[plant.rarity];

  const info = document.createElement('div');
  info.className = 'result-plant-info';
  info.innerHTML = `
    <span class="result-plant-name" style="color:${displayColor}">${plant.species}</span>
    <span class="result-plant-rarity">${displayRarity}</span>
    ${plant.unique ? '<span class="unique-badge">Unique</span>' : ''}
  `;
  wrap.appendChild(info);

  // Adventure prompt after Life Spark
  if (heading === 'Plant Awakened!') {
    const adventureMsg = document.createElement('div');
    adventureMsg.className = 'result-adventure-msg';
    adventureMsg.textContent = 'Your plant seeks treasure! Help guide them on their adventure.';
    wrap.appendChild(adventureMsg);
  }

  const btn = document.createElement('button');
  btn.className = 'btn btn-water';
  btn.textContent = 'Continue';
  btn.addEventListener('click', onDismiss);
  wrap.appendChild(btn);

  container.appendChild(wrap);

  const animator = new PlantAnimator(canvasWrap, plant, 5);
  animator.start();
}

function handleSeedUse(container, item, state) {
  // Show confirmation dialog
  const overlay = document.createElement('div');
  overlay.className = 'detail-overlay';

  const card = document.createElement('div');
  card.className = 'detail-card item-detail-card';

  const iconWrap = document.createElement('div');
  iconWrap.className = 'item-detail-icon';
  iconWrap.appendChild(renderItemIcon(item.type, item.rarity, 6));
  card.appendChild(iconWrap);

  card.innerHTML += `
    <h3 style="color:${RARITY_COLORS[item.rarity] || '#6b7b3a'}">Plant Seed?</h3>
    <p class="item-detail-desc">This will replace your current plant with a new <strong>${item.seedTier}</strong> plant. Your current plant's progress will be lost.</p>
    <p class="item-detail-desc">${item.description}</p>
    <button class="btn btn-water" id="seedConfirmBtn">Plant Seed</button>
    <button class="btn btn-close-detail" id="seedCancelBtn">Cancel</button>
  `;

  overlay.appendChild(card);
  container.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector('#seedCancelBtn').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  overlay.querySelector('#seedConfirmBtn').addEventListener('click', () => {
    close();
    const freshState = loadState();
    const rng = createRng(Date.now() + parseInt(item.id, 36));
    const newPlant = generatePlantFromSeed(item, rng);
    if (!newPlant) {
      showItemToast('Failed to generate plant from seed.');
      return;
    }

    freshState.currentPlant = newPlant;
    removeItem(freshState, item.id);
    saveState(freshState);

    // Switch to plant screen and play planting animation
    showScreen('plantScreen');
    const canvasWrap = document.getElementById('plantCanvasWrap');
    showPlantingSequence(canvasWrap, item.rarity, () => {
      if (_onItemUsed) _onItemUsed();
      showItemToast(`Planted a ${newPlant.rarity} ${newPlant.species}!`);
    });
  });
}

function showPlantingSequence(canvasWrap, seedRarity, callback) {
  const RARITY_ANIM_COLORS = {
    Common:    { seed: '#7a8a4a', seedDark: '#4a5a2a', particle: '#6b7b3a', particleAlt: '#8a9b5a', flash: 'rgba(140, 170, 80, 0.6)', flashCenter: 'rgba(180, 210, 120, 0.95)' },
    Uncommon:  { seed: '#3aaa6e', seedDark: '#1a6a3e', particle: '#2d8a4e', particleAlt: '#4aba6e', flash: 'rgba(60, 180, 100, 0.6)', flashCenter: 'rgba(100, 220, 140, 0.95)' },
    Rare:      { seed: '#4a8ada', seedDark: '#1a4a8a', particle: '#2d6fba', particleAlt: '#5a9aea', flash: 'rgba(60, 130, 220, 0.6)', flashCenter: 'rgba(100, 170, 255, 0.95)' },
    Epic:      { seed: '#9a5ac8', seedDark: '#5a2a7a', particle: '#7b3fa0', particleAlt: '#b87ae8', flash: 'rgba(140, 80, 200, 0.6)', flashCenter: 'rgba(180, 120, 240, 0.95)' },
    Legendary: { seed: '#e0b830', seedDark: '#8a6a10', particle: '#c49a1a', particleAlt: '#f0d060', flash: 'rgba(220, 180, 50, 0.6)', flashCenter: 'rgba(255, 230, 100, 0.95)' },
  };
  const colors = RARITY_ANIM_COLORS[seedRarity] || RARITY_ANIM_COLORS.Common;

  // Create planting overlay covering the canvas area
  const overlay = document.createElement('div');
  overlay.className = 'planting-overlay';
  canvasWrap.appendChild(overlay);

  // Stage 1 (0-400ms): Seed drops from top — use pixel art seed icon
  const seedCanvas = renderItemIcon('seed', seedRarity, 6);
  seedCanvas.className = 'planting-seed';
  seedCanvas.style.background = 'none';
  overlay.appendChild(seedCanvas);

  // Stage 2 (400-800ms): Particles burst outward
  setTimeout(() => {
    const burst = document.createElement('div');
    burst.className = 'planting-burst';
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const dist = 25 + Math.random() * 20;
      const particle = document.createElement('div');
      particle.className = 'planting-particle';
      particle.style.background = i % 2 === 0 ? colors.particle : colors.particleAlt;
      particle.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
      particle.style.setProperty('--dy', `${Math.sin(angle) * dist - 20}px`);
      particle.style.animationDelay = `${Math.random() * 0.1}s`;
      burst.appendChild(particle);
    }
    overlay.appendChild(burst);
  }, 400);

  // Stage 3 (800-1200ms): Flash of light
  setTimeout(() => {
    const flash = document.createElement('div');
    flash.className = 'planting-flash';
    flash.style.background = `radial-gradient(circle, ${colors.flashCenter}, ${colors.flash} 35%, transparent 65%)`;
    overlay.appendChild(flash);
  }, 800);

  // Stage 4 (1200ms+): Remove overlay, render new plant
  setTimeout(() => {
    overlay.remove();
    if (callback) callback();
  }, 1200);
}

function showItemToast(message) {
  // Reuse toast from ui.js pattern
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast toast-success';
  toast.textContent = message;
  document.body.appendChild(toast);

  toast.offsetHeight;
  toast.classList.add('toast-visible');

  setTimeout(() => {
    toast.classList.remove('toast-visible');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}
