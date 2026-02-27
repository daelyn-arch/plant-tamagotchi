// Entry point — screen routing, event wiring

import { loadState, saveState, todayStr } from './state.js';
import { ensurePlant, processVisit, completePlant, devAdvanceDays, applyPassiveGrowth } from './growth.js';
import {
  updatePlantView,
  showToast,
  playWaterAnimation,
  showScreen,
  showCompletionOverlay,
  hideCompletionOverlay,
  stopSparkle,
} from './ui.js';
import { renderGardenView } from './garden.js';
import { renderSpeciesGallery } from './species-gallery.js';
import { renderInventoryView, setOnItemUsed, setOnInventoryBack } from './inventory-ui.js';
import { stopAllAnimators } from './animation.js';
import { ITEM_TYPES, createItem } from './items.js';
import { renderItemGallery, setOnItemGalleryBack } from './item-gallery.js';
import { renderInfoPanel, setOnInfoBack } from './info-panel.js';
import { SPECIES, RARITY } from './plant-data.js';

let currentScreen = 'plant';

function init() {
  // Ensure we have a plant
  let state = ensurePlant();

  // Apply legendary passive growth for any missed days on load
  const passiveDays = applyPassiveGrowth(state);
  if (passiveDays > 0) {
    saveState(state);
    state = loadState();
    showToast(`Legendary passive growth: +${passiveDays} days while away!`, 'success');
  }

  // Render initial plant view
  updatePlantView(state);

  // Water button
  document.getElementById('waterBtn').addEventListener('click', handleWater);

  // Garden button
  document.getElementById('gardenBtn').addEventListener('click', () => {
    switchToGarden();
  });

  // Inventory button
  document.getElementById('inventoryBtn').addEventListener('click', () => {
    switchToInventory();
  });

  // Gallery button
  document.getElementById('galleryBtn').addEventListener('click', () => {
    switchToGallery();
  });

  // Item Gallery button
  document.getElementById('itemGalleryBtn').addEventListener('click', () => {
    switchToItemGallery();
  });

  // Info button
  document.getElementById('infoBtn').addEventListener('click', () => {
    switchToInfo();
  });

  // Completion overlay "Move to Garden" button
  document.getElementById('moveToGardenBtn').addEventListener('click', handleMoveToGarden);

  // Set up inventory callbacks
  setOnItemUsed(() => {
    if (currentScreen === 'plant') {
      updatePlantView(loadState());
    }
  });
  setOnInventoryBack(() => {
    stopAllAnimators();
    currentScreen = 'plant';
    showScreen('plantScreen');
    updatePlantView(loadState());
  });
  setOnItemGalleryBack(() => {
    currentScreen = 'plant';
    showScreen('plantScreen');
    updatePlantView(loadState());
  });
  setOnInfoBack(() => {
    currentScreen = 'plant';
    showScreen('plantScreen');
    updatePlantView(loadState());
  });

  // Dev controls
  setupDevControls();

  showScreen('plantScreen');
}

function handleWater() {
  const state = loadState();

  // If plant is complete, show completion overlay
  if (state.currentPlant && state.currentPlant.growthStage >= 1.0) {
    showCompletionOverlay(state.currentPlant, state.stats, null);
    return;
  }

  const { state: newState, result } = processVisit();

  switch (result.type) {
    case 'already_visited':
      showToast(result.message, 'info');
      break;
    case 'new_plant':
      showToast(result.message, 'success');
      break;
    case 'watered':
      playWaterAnimation(document.getElementById('plantCanvasWrap'));
      showToast(result.message, 'success');
      break;
    case 'completed':
      playWaterAnimation(document.getElementById('plantCanvasWrap'));
      showToast('Your plant is fully grown!', 'success');
      // Short delay then show completion
      setTimeout(() => {
        showCompletionOverlay(newState.currentPlant, newState.stats, null);
      }, 800);
      break;
  }

  updatePlantView(newState);
}

function handleMoveToGarden() {
  const { state, result } = completePlant();

  if (result.droppedItems && result.droppedItems.length > 0 && result.completedPlant) {
    // Re-show completion overlay with item drops
    showCompletionOverlay(result.completedPlant, state.stats, result.droppedItems);
    // Replace the "Move to Garden" button with "Continue"
    const moveBtn = document.getElementById('moveToGardenBtn');
    moveBtn.textContent = 'Continue';
    moveBtn.onclick = () => {
      moveBtn.onclick = null;
      moveBtn.textContent = 'Move to Garden';
      // Re-wire the original handler
      moveBtn.addEventListener('click', handleMoveToGarden);
      hideCompletionOverlay();
      stopSparkle(document.getElementById('plantCanvasWrap'));
      showToast(result.message, 'success');
      updatePlantView(state);
    };
  } else {
    hideCompletionOverlay();
    stopSparkle(document.getElementById('plantCanvasWrap'));
    showToast(result.message, 'success');
    updatePlantView(state);
  }
}

function switchToGarden() {
  currentScreen = 'garden';
  showScreen('gardenScreen');
  const container = document.getElementById('gardenContainer');
  renderGardenView(container);

  // Back button (rendered by garden view)
  setTimeout(() => {
    const backBtn = document.getElementById('gardenBackBtn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        stopAllAnimators();
        currentScreen = 'plant';
        showScreen('plantScreen');
        updatePlantView(loadState());
      });
    }
  }, 0);
}

function switchToInventory() {
  currentScreen = 'inventory';
  showScreen('inventoryScreen');
  const container = document.getElementById('inventoryContainer');
  renderInventoryView(container);
}

function switchToItemGallery() {
  currentScreen = 'itemGallery';
  showScreen('itemGalleryScreen');
  const container = document.getElementById('itemGalleryContainer');
  renderItemGallery(container);
}

function switchToInfo() {
  currentScreen = 'info';
  showScreen('infoScreen');
  const container = document.getElementById('infoContainer');
  renderInfoPanel(container);
}

function switchToGallery() {
  currentScreen = 'gallery';
  showScreen('galleryScreen');
  const container = document.getElementById('galleryContainer');
  renderSpeciesGallery(container);

  setTimeout(() => {
    const backBtn = document.getElementById('galleryBackBtn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        stopAllAnimators();
        currentScreen = 'plant';
        showScreen('plantScreen');
        updatePlantView(loadState());
      });
    }
  }, 0);
}

function setupDevControls() {
  const devToggle = document.getElementById('devToggle');
  const devPanel = document.getElementById('devPanel');
  if (!devToggle || !devPanel) return;

  devToggle.addEventListener('click', () => {
    devPanel.classList.toggle('dev-open');
  });

  document.getElementById('devAdvance1')?.addEventListener('click', () => {
    const state = devAdvanceDays(1);
    updatePlantView(state);
    showToast('DEV: Advanced 1 day', 'info');
  });

  document.getElementById('devAdvance7')?.addEventListener('click', () => {
    const state = devAdvanceDays(7);
    updatePlantView(state);
    showToast('DEV: Advanced 7 days', 'info');
  });

  document.getElementById('devComplete')?.addEventListener('click', () => {
    const state = devAdvanceDays(200);
    updatePlantView(state);
    showToast('DEV: Plant completed', 'success');
  });

  document.getElementById('devNewPlant')?.addEventListener('click', () => {
    const state = loadState();
    state.currentPlant = null;
    saveState(state);
    const newState = ensurePlant();
    updatePlantView(newState);
    showToast('DEV: New plant generated', 'info');
  });

  document.getElementById('devAllItems')?.addEventListener('click', () => {
    const state = loadState();
    if (!state.items) state.items = [];
    const types = Object.keys(ITEM_TYPES);
    for (const type of types) {
      state.items.push(createItem(type, RARITY.LEGENDARY));
    }
    saveState(state);
    showToast(`DEV: Added ${types.length} items (1 of each type)`, 'info');
  });

  document.getElementById('devAllPlants')?.addEventListener('click', () => {
    const state = loadState();
    const today = todayStr();
    for (const species of SPECIES) {
      const seed = (Date.now() + Math.floor(Math.random() * 1000000)) & 0x7fffffff;
      state.garden.push({
        id: Date.now().toString(36) + seed.toString(36),
        seed,
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
        dateReceived: today,
        dateCompleted: today,
        autoWater: false,
      });
      state.stats.totalPlantsGrown++;
    }
    saveState(state);
    updatePlantView(loadState());
    showToast(`DEV: Added ${SPECIES.length} plants (1 of each species)`, 'info');
  });

  document.getElementById('devReset')?.addEventListener('click', () => {
    if (confirm('Reset all data?')) {
      localStorage.removeItem('plant_tamagotchi_state');
      const state = ensurePlant();
      updatePlantView(state);
      showToast('DEV: State reset', 'info');
    }
  });
}

// Boot
document.addEventListener('DOMContentLoaded', init);
