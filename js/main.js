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
import { startTowerDefense, stopTowerDefense } from './tower-defense.js';
import { startCitadel, stopCitadel } from './citadel.js';
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

  // Show plant screen first so layout is computed before rendering
  showScreen('plantScreen');

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

  // Games menu — replaces actions area content
  document.getElementById('gamesBtn').addEventListener('click', () => {
    closeAllPopups();
    showGamesMenu();
  });

  document.getElementById('gamesBackBtn').addEventListener('click', () => {
    hideGamesMenu();
  });

  // Bonuses popup
  document.getElementById('bonusesBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    const popup = document.getElementById('bonusesPopup');
    const wasOpen = popup.style.display !== 'none';
    closeAllPopups();
    if (!wasOpen) popup.style.display = '';
  });

  // Close popups on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.popup-menu') && !e.target.closest('#bonusesBtn')) {
      closeAllPopups();
    }
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
    const s = loadState();
    updatePlantView(s);
    updateTdButton(s);
  });
  setOnItemGalleryBack(() => {
    switchToInventory();
  });
  setOnInfoBack(() => {
    currentScreen = 'plant';
    showScreen('plantScreen');
    const s = loadState();
    updatePlantView(s);
    updateTdButton(s);
  });

  // Dev controls
  setupDevControls();

  // Show/hide TD button
  updateTdButton(state);
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
        const s = loadState();
        updatePlantView(s);
        updateTdButton(s);
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
    // Defer so browser reflows layout before reading container width for scale
    requestAnimationFrame(() => {
      const s = loadState();
      updatePlantView(s);
      updateTdButton(s);
    });
  });
}

function switchToTowerDefense() {
  const state = loadState();
  if (!state.stats.tdUnlocked) return;

  const eligiblePlants = state.garden.filter(p => p.animated);
  if (eligiblePlants.length === 0) return;

  stopAllAnimators();
  currentScreen = 'towerDefense';
  showScreen('towerDefenseScreen');
  startTowerDefense(eligiblePlants, () => {
    stopTowerDefense();
    currentScreen = 'plant';
    showScreen('plantScreen');
    requestAnimationFrame(() => {
      const s = loadState();
      updatePlantView(s);
      updateTdButton(s);
    });
  });
}

function switchToCitadel() {
  const state = loadState();
  if (!state.stats.citadelUnlocked) return;

  const eligiblePlants = state.garden.filter(p => p.animated);
  if (eligiblePlants.length === 0) return;

  stopAllAnimators();
  currentScreen = 'citadel';
  showScreen('citadelScreen');
  startCitadel(eligiblePlants, () => {
    stopCitadel();
    currentScreen = 'plant';
    showScreen('plantScreen');
    requestAnimationFrame(() => {
      const s = loadState();
      updatePlantView(s);
      updateTdButton(s);
    });
  });
}

function updateTdButton(state) {
  // No-op: TD visibility is now handled by showGamesMenu()
}

function showGamesMenu() {
  const state = loadState();
  const actionsMain = document.getElementById('actionsMain');
  const gamesMenu = document.getElementById('gamesMenu');
  const grid = document.getElementById('gamesMenuGrid');

  actionsMain.style.display = 'none';
  gamesMenu.style.display = '';

  // Determine game states
  const hasAnimated = state.garden && state.garden.some(p => p.animated);
  const tdUnlocked = state.stats.tdUnlocked && hasAnimated;

  const runnerUnlocked = hasAnimated;
  const games = [
    { id: 'runner', name: 'Plant Runner', unlocked: runnerUnlocked, launch: switchToMinigame },
    { id: 'td', name: 'Stop the Bugs', unlocked: tdUnlocked, launch: switchToTowerDefense },
    { id: 'citadel', name: 'Dark Citadel', unlocked: state.stats.citadelUnlocked && hasAnimated, launch: switchToCitadel },
  ];

  const anyUnlocked = games.some(g => g.unlocked);

  grid.innerHTML = '';

  if (!anyUnlocked) {
    const msg = document.createElement('div');
    msg.className = 'games-menu-locked-msg';
    msg.textContent = 'Seek the Life Spark...';
    grid.appendChild(msg);
  }

  for (const game of games) {
    const card = document.createElement('div');
    card.className = 'game-card' + (game.unlocked ? '' : ' game-card-locked');

    if (game.unlocked) {
      card.innerHTML = `<div class="game-card-name">${game.name}</div>`;
      card.addEventListener('click', () => {
        hideGamesMenu();
        game.launch();
      });
    } else {
      // Entire card is a locked chest
      card.innerHTML = `<canvas class="game-card-chest"></canvas>`;
      setTimeout(() => {
        const canvas = card.querySelector('.game-card-chest');
        if (canvas) {
          const w = card.clientWidth;
          const h = card.clientHeight;
          canvas.width = w;
          canvas.height = h;
          drawLockedChest(canvas, w, h);
        }
      }, 0);
    }

    grid.appendChild(card);
  }
}

function hideGamesMenu() {
  document.getElementById('actionsMain').style.display = '';
  document.getElementById('gamesMenu').style.display = 'none';
}

function drawLockedChest(canvas, w, h) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);

  // Pixel size — scale to card
  const px = Math.max(2, Math.floor(Math.min(w, h) / 20));

  function rect(x, y, rw, rh, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, rw, rh);
  }

  // Chest dimensions — wide rectangle filling most of the card
  const chestW = Math.floor(w * 0.8);
  const chestH = Math.floor(h * 0.5);
  const lidH = Math.floor(chestH * 0.3);
  const bodyH = chestH - lidH;
  const chestX = cx - Math.floor(chestW / 2);
  const chestY = cy - Math.floor(chestH / 2) + Math.floor(px * 1.5);

  // Chest lid — lighter metal
  rect(chestX, chestY, chestW, lidH, '#6a6a7a');
  // Lid top highlight
  rect(chestX, chestY, chestW, px, '#8a8a9a');
  // Lid bottom edge
  rect(chestX, chestY + lidH - px, chestW, px, '#4a4a5a');

  // Chest body — darker metal
  rect(chestX, chestY + lidH, chestW, bodyH, '#5a5a6a');
  // Body bottom shadow
  rect(chestX, chestY + chestH - px, chestW, px, '#3a3a4a');
  // Metal band across body
  const bandY = chestY + lidH + Math.floor(bodyH * 0.45);
  rect(chestX, bandY, chestW, px, '#4a4a5a');

  // Rivets on band
  const rivetInset = Math.floor(chestW * 0.1);
  rect(chestX + rivetInset, bandY, px, px, '#9a9aaa');
  rect(chestX + chestW - rivetInset - px, bandY, px, px, '#9a9aaa');
  // Rivets on lid edge
  rect(chestX + rivetInset, chestY + lidH - px, px, px, '#9a9aaa');
  rect(chestX + chestW - rivetInset - px, chestY + lidH - px, px, px, '#9a9aaa');

  // Lock — gold padlock centered
  const lockW = px * 4;
  const lockH = px * 3;
  const lockX = cx - Math.floor(lockW / 2);
  const lockY = chestY + lidH + Math.floor((bodyH - lockH) / 2) - px;
  // Shackle (arch above lock body)
  rect(lockX + px, lockY - px * 2, lockW - px * 2, px, '#c09020');
  rect(lockX, lockY - px, px, px * 2, '#c09020');
  rect(lockX + lockW - px, lockY - px, px, px * 2, '#c09020');
  // Lock body
  rect(lockX, lockY + px, lockW, lockH, '#d4a830');
  // Lock body shadow
  rect(lockX, lockY + px + lockH - px, lockW, px, '#b08820');
  // Keyhole
  rect(cx - Math.floor(px / 2), lockY + px + Math.floor(lockH * 0.3), px, px, '#2a2a20');

  // Vines growing over the chest
  const vine = '#3a7a3a';
  const vineDk = '#2a6a2a';
  const leaf = '#4a9a40';
  const leafLt = '#5aaa4a';

  // Left vine — climbing up from bottom-left
  const vlx = chestX - px * 2;
  for (let i = 0; i < 7; i++) {
    rect(vlx + (i % 2) * px, chestY + chestH - i * px * 1.5, px, px * 2, vine);
  }
  // Left leaves
  rect(vlx - px, chestY + chestH - px * 3, px * 2, px, leaf);
  rect(vlx - px * 2, chestY + chestH - px * 6, px * 2, px, leafLt);
  rect(vlx + px, chestY + chestH - px * 8, px * 2, px, leaf);
  // Vine creeping onto chest top
  rect(chestX, chestY - px, px * 3, px, vine);
  rect(chestX + px * 2, chestY - px * 2, px * 2, px, vineDk);
  rect(chestX - px, chestY, px, px * 2, vine);
  // Top leaves
  rect(chestX + px * 3, chestY - px * 2, px * 2, px, leaf);
  rect(chestX - px, chestY - px, px * 2, px, leafLt);

  // Right vine — climbing from bottom-right
  const vrx = chestX + chestW + px;
  for (let i = 0; i < 6; i++) {
    rect(vrx - (i % 2) * px, chestY + chestH - i * px * 1.6, px, px * 2, vine);
  }
  // Right leaves
  rect(vrx + px, chestY + chestH - px * 4, px * 2, px, leaf);
  rect(vrx, chestY + chestH - px * 7, px * 2, px, leafLt);
  // Vine onto chest top-right
  rect(chestX + chestW - px * 3, chestY - px, px * 3, px, vine);
  rect(chestX + chestW + px, chestY, px, px * 2, vine);
  // Top-right leaves
  rect(chestX + chestW - px * 4, chestY - px * 2, px * 2, px, leaf);
  rect(chestX + chestW + px, chestY - px, px * 2, px, leafLt);

}

function closeAllPopups() {
  document.getElementById('bonusesPopup').style.display = 'none';
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
    const fixedRarityTypes = ['animate', 'auto_water', 'art_reroll', 'sunglasses'];
    const elementalTypes = ['pot_fire', 'pot_ice', 'pot_earth', 'pot_wind'];
    const elementalRarities = [RARITY.UNCOMMON, RARITY.RARE, RARITY.EPIC, RARITY.LEGENDARY];
    let count = 0;
    for (const type of types) {
      if (fixedRarityTypes.includes(type)) {
        state.items.push(createItem(type, RARITY.COMMON));
        count++;
      } else if (elementalTypes.includes(type)) {
        for (const rarity of elementalRarities) {
          state.items.push(createItem(type, rarity));
          count++;
        }
      } else {
        for (const rarity of rarities) {
          state.items.push(createItem(type, rarity));
          count++;
        }
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

  function devEnsureGamePlant(state) {
    // Add a fully leveled animated Common plant if none exists
    const hasAnimated = state.garden && state.garden.some(p => p.animated);
    if (hasAnimated) return;
    if (!state.garden) state.garden = [];
    const today = todayStr();
    state.garden.push({
      id: Date.now().toString(36) + 'dev',
      seed: 42,
      species: 'Daisy',
      rarity: RARITY.COMMON,
      complexity: 2,
      hasFlowers: true,
      leafType: 'spatula',
      flowerTemplate: 'daisy',
      name: 'Daisy',
      totalDaysRequired: 3,
      daysGrown: 3,
      growthStage: 1.0,
      daysVisited: [],
      dateReceived: today,
      dateCompleted: today,
      autoWater: false,
      animated: true,
      potElement: 'fire',
      potLevel: 3,
      potExp: 300,
    });
    state.stats.totalPlantsGrown = (state.stats.totalPlantsGrown || 0) + 1;
  }

  document.getElementById('devUnlockPR')?.addEventListener('click', () => {
    const state = loadState();
    devEnsureGamePlant(state);
    saveState(state);
    updatePlantView(loadState());
    showToast('DEV: Plant Runner unlocked (animated plant added)', 'info');
  });

  document.getElementById('devUnlockTD')?.addEventListener('click', () => {
    const state = loadState();
    state.stats.tdUnlocked = true;
    state.stats.bugKillsTotal = Math.max(state.stats.bugKillsTotal || 0, 10);
    devEnsureGamePlant(state);
    saveState(state);
    updateTdButton(state);
    showToast('DEV: Tower Defense unlocked (animated plant added)', 'info');
  });

  document.getElementById('devUnlockCitadel')?.addEventListener('click', () => {
    const state = loadState();
    state.stats.citadelUnlocked = true;
    state.stats.tdUnlocked = true;
    if (!state.garden) state.garden = [];
    const today = todayStr();
    const elements = [
      { elem: 'fire',  species: 'Snapdragon', seed: 101 },
      { elem: 'ice',   species: 'Violet',     seed: 202 },
      { elem: 'earth', species: 'Fern',       seed: 303 },
      { elem: 'wind',  species: 'Lavender',   seed: 404 },
    ];
    for (const { elem, species, seed } of elements) {
      state.garden.push({
        id: Date.now().toString(36) + elem,
        seed,
        species,
        rarity: RARITY.UNCOMMON,
        complexity: 3,
        hasFlowers: true,
        leafType: 'spatula',
        flowerTemplate: 'daisy',
        name: species,
        totalDaysRequired: 5,
        daysGrown: 5,
        growthStage: 1.0,
        daysVisited: [],
        dateReceived: today,
        dateCompleted: today,
        autoWater: false,
        animated: true,
        potElement: elem,
        potLevel: 3,
        potExp: 300,
      });
    }
    state.stats.totalPlantsGrown = (state.stats.totalPlantsGrown || 0) + 4;
    saveState(state);
    updateTdButton(state);
    showToast('DEV: Citadel unlocked + 4 elemental plants added', 'info');
  });

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
function updateTimeOfDay() {
  const hour = new Date().getHours();
  let period;
  if (hour >= 6 && hour < 10) period = 'morning';
  else if (hour >= 10 && hour < 17) period = 'day';
  else if (hour >= 17 && hour < 20) period = 'evening';
  else period = 'night';
  document.documentElement.setAttribute('data-time', period);
}

function initSeasonalEffects() {
  const month = new Date().getMonth();
  let type = null;
  if (month >= 2 && month <= 4) type = 'cherry';
  else if (month >= 11 || month <= 1) type = 'snow';
  if (!type) return;
  const overlay = document.createElement('div');
  overlay.className = 'seasonal-overlay';
  document.body.appendChild(overlay);
  function spawnParticle() {
    if (overlay.children.length > 12) return;
    const el = document.createElement('div');
    el.className = 'seasonal-particle seasonal-' + type;
    el.style.left = Math.random() * 100 + '%';
    const fallTime = 6 + Math.random() * 8;
    el.style.setProperty('--fall-time', fallTime + 's');
    overlay.appendChild(el);
    setTimeout(() => el.remove(), fallTime * 1000);
  }
  setInterval(spawnParticle, 2000);
  for (let i = 0; i < 4; i++) setTimeout(spawnParticle, i * 500);
}

document.addEventListener('DOMContentLoaded', () => {
  init();
  updateTimeOfDay();
  setInterval(updateTimeOfDay, 60000);
  initSeasonalEffects();
});
