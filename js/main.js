// Entry point — screen routing, event wiring

import { loadState, saveState, todayStr } from './state.js';
import { ensurePlant, processVisit, completePlant, devAdvanceDays, applyPassiveGrowth } from './growth.js';
import {
  updatePlantView,
  animateGrowthTransition,
  showToast,
  playWaterAnimation,
  showScreen,
  showCompletionOverlay,
  hideCompletionOverlay,
  showTriviaOverlay,
  stopSparkle,
} from './ui.js';
import { pickTriviaQuestion, checkAnswer } from './trivia.js';
import { renderGardenView } from './garden.js';
import { renderSpeciesGallery } from './species-gallery.js';
import { renderInventoryView, setOnItemUsed, setOnInventoryBack } from './inventory-ui.js';
import { stopAllAnimators } from './animation.js';
import { ITEM_TYPES, createItem, SEED_TIER_MAP } from './items.js';
import { renderItemGallery, setOnItemGalleryBack } from './item-gallery.js';
import { renderInfoPanel, setOnInfoBack } from './info-panel.js';
import { SPECIES, RARITY } from './plant-data.js';
import { startMinigame, stopMinigame } from './minigame.js';
import { potLevelFromExp } from './canvas-utils.js';

let currentScreen = 'plant';
let devUnlimitedWater = false;

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

  // Gallery and Item Gallery buttons are wired dynamically
  // in switchToGarden() and switchToInventory() since they
  // live inside those screens now.

  // Info button
  document.getElementById('infoBtn').addEventListener('click', () => {
    switchToInfo();
  });

  // Minigame button
  document.getElementById('minigameBtn').addEventListener('click', () => {
    switchToMinigame();
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
    switchToInventory();
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

  // If unlimited water is on, clear today's visit so processVisit allows re-watering
  if (devUnlimitedWater) {
    state.stats.lastVisitDate = null;
    saveState(state);
  }

  // Capture old growth stage before processing
  const oldGrowthStage = state.currentPlant ? state.currentPlant.growthStage : 0;

  const { state: newState, result } = processVisit();

  switch (result.type) {
    case 'already_visited':
      showToast(result.message, 'info');
      updatePlantView(newState);
      break;
    case 'new_plant':
      showToast(result.message, 'success');
      updatePlantView(newState);
      break;
    case 'watered':
      playWaterAnimation(document.getElementById('plantCanvasWrap'));
      showToast(result.message, 'success');
      animateGrowthTransition(oldGrowthStage, newState, 3000);
      setTimeout(() => showTrivia(newState), 3200);
      break;
    case 'completed':
      playWaterAnimation(document.getElementById('plantCanvasWrap'));
      showToast('Your plant is fully grown! Tap water again to collect.', 'success');
      animateGrowthTransition(oldGrowthStage, newState, 3000);
      break;
  }
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
      // Show trivia for the new plant
      setTimeout(() => showTrivia(state), 500);
    };
  } else {
    hideCompletionOverlay();
    stopSparkle(document.getElementById('plantCanvasWrap'));
    showToast(result.message, 'success');
    updatePlantView(state);
    // Show trivia for the new plant
    setTimeout(() => showTrivia(state), 500);
  }
}

function showTrivia(stateAfterWater) {
  let state = loadState();
  const { question, updatedRecent } = pickTriviaQuestion(state.triviaRecentIds);

  // Save recent IDs immediately
  state.triviaRecentIds = updatedRecent;
  saveState(state);

  let answered = false;
  let wasCorrect = false;

  showTriviaOverlay(
    question,
    // onAnswer
    (selectedIndex) => {
      wasCorrect = checkAnswer(question, selectedIndex);
      answered = true;

      if (wasCorrect) {
        // Apply +1 bonus growth day
        state = loadState();
        const plant = state.currentPlant;
        if (plant && plant.growthStage < 1.0) {
          const oldStage = plant.growthStage;
          plant.daysGrown += 1;
          if (plant.daysGrown >= plant.totalDaysRequired) {
            plant.daysGrown = plant.totalDaysRequired;
            plant.growthStage = 1.0;
          } else {
            plant.growthStage = plant.daysGrown / plant.totalDaysRequired;
          }
          saveState(state);
        }
      }
    },
    // onContinue
    () => {
      state = loadState();
      if (wasCorrect) {
        showToast('Correct! +1 bonus growth day', 'success');
        // Animate the bonus growth
        const oldStage = stateAfterWater.currentPlant.growthStage;
        animateGrowthTransition(oldStage, state, 1000);

        // Check if bonus pushed plant to completion
        if (state.currentPlant && state.currentPlant.growthStage >= 1.0) {
          setTimeout(() => {
            updatePlantView(state);
          }, 1100);
        }
      } else {
        updatePlantView(state);
      }
    },
  );
}

function switchToGarden() {
  currentScreen = 'garden';
  showScreen('gardenScreen');
  const container = document.getElementById('gardenContainer');
  renderGardenView(container);

  // Wire buttons rendered by garden view
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
    const galleryBtn = document.getElementById('galleryBtn');
    if (galleryBtn) {
      galleryBtn.addEventListener('click', () => {
        switchToGallery();
      });
    }
  }, 0);
}

function switchToInventory() {
  currentScreen = 'inventory';
  showScreen('inventoryScreen');
  const container = document.getElementById('inventoryContainer');
  renderInventoryView(container);

  // Wire item gallery button rendered by inventory view
  setTimeout(() => {
    const itemGalleryBtn = document.getElementById('itemGalleryBtn');
    if (itemGalleryBtn) {
      itemGalleryBtn.addEventListener('click', () => {
        switchToItemGallery();
      });
    }
  }, 0);
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

function switchToMinigame() {
  const state = loadState();

  // Only animated (Life Spark) garden plants are eligible — not the currently growing plant
  const eligiblePlants = state.garden.filter(p => p.animated);

  if (eligiblePlants.length === 0) return;

  stopAllAnimators();
  currentScreen = 'minigame';
  showScreen('minigameScreen');
  startMinigame(eligiblePlants, () => {
    stopMinigame();
    currentScreen = 'plant';
    showScreen('plantScreen');
    updatePlantView(loadState());
  });
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
        switchToGarden();
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
    const rarities = [RARITY.COMMON, RARITY.UNCOMMON, RARITY.RARE, RARITY.EPIC, RARITY.LEGENDARY];
    let count = 0;
    for (const type of types) {
      for (const rarity of rarities) {
        state.items.push(createItem(type, rarity));
        count++;
      }
    }
    saveState(state);
    showToast(`DEV: Added ${count} items (1 of each rarity per type)`, 'info');
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

  const unlimitedBtn = document.getElementById('devUnlimitedWater');
  if (unlimitedBtn) {
    unlimitedBtn.addEventListener('click', () => {
      devUnlimitedWater = !devUnlimitedWater;
      unlimitedBtn.style.background = devUnlimitedWater ? '#4a8a2a' : '';
      unlimitedBtn.style.color = devUnlimitedWater ? '#fff' : '';
      showToast(`DEV: Unlimited water ${devUnlimitedWater ? 'ON' : 'OFF'}`, 'info');
      if (devUnlimitedWater) {
        // Re-enable the water button immediately
        const state = loadState();
        state.stats.lastVisitDate = null;
        saveState(state);
        updatePlantView(loadState());
      }
    });
  }

  const inspectBtn = document.getElementById('devInspector');
  if (inspectBtn) {
    inspectBtn.addEventListener('click', () => {
      const active = window.__devInspectorToggle();
      inspectBtn.style.background = active ? '#4a8a2a' : '';
      inspectBtn.style.color = active ? '#fff' : '';
      showToast(`DEV: Inspector ${active ? 'ON' : 'OFF'}`, 'info');
    });
  }

  document.getElementById('devPotExp')?.addEventListener('click', () => {
    const state = loadState();
    let count = 0;
    for (const plant of state.garden) {
      if (plant.potElement) {
        plant.potExp = (plant.potExp || 0) + 100;
        plant.potLevel = potLevelFromExp(plant.potExp);
        count++;
      }
    }
    if (count > 0) {
      saveState(state);
      showToast(`DEV: +100 Pot EXP to ${count} elemental plant${count > 1 ? 's' : ''}`, 'info');
    } else {
      showToast('DEV: No elemental plants in garden', 'info');
    }
  });
}

// Boot
document.addEventListener('DOMContentLoaded', init);
