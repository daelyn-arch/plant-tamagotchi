// DOM helpers, animations, screen transitions

import { renderPlantScaled } from './plant-generator.js';
import { RARITY_COLORS } from './plant-data.js';
import {
  streakBonus, wateringBonusCap, dayBonusCap, legendaryPassiveCap,
  WATERING_BONUS_VALUES, DAY_BONUS_VALUES,
  currentDayBonus,
} from './growth.js';
import { todayStr } from './state.js';
import { PlantAnimator } from './animation.js';

// Active animator instance
let activeAnimator = null;

// Update the plant view with current state
export function updatePlantView(state) {
  const plant = state.currentPlant;
  if (!plant) return;

  // Stop any existing animation
  stopAnimator();

  // Start animated plant renderer
  const canvasWrap = document.getElementById('plantCanvasWrap');
  canvasWrap.innerHTML = '';
  const scale = getPlantScale(plant);

  activeAnimator = new PlantAnimator(canvasWrap, plant, scale);
  activeAnimator.start();

  // Plant info
  document.getElementById('plantName').textContent = plant.species;
  document.getElementById('plantName').style.color = RARITY_COLORS[plant.rarity];
  document.getElementById('plantRarity').textContent = plant.rarity;
  document.getElementById('plantRarity').style.color = RARITY_COLORS[plant.rarity];

  // Progress bar
  const pct = Math.floor(plant.growthStage * 100);
  document.getElementById('progressFill').style.width = `${pct}%`;
  document.getElementById('progressText').textContent = `${pct}%`;
  document.getElementById('growthInfo').textContent =
    `Day ${plant.daysGrown} / ${plant.totalDaysRequired}`;

  // Streak
  const streak = state.stats.currentStreak;
  const wBonus = streakBonus(streak, state.garden);
  const wCap = wateringBonusCap(state.garden);
  const dBonus = currentDayBonus(state.garden);
  const dCap = dayBonusCap(state.garden);
  const passiveCap = legendaryPassiveCap(state.garden);
  document.getElementById('streakCount').textContent = `${streak} day${streak !== 1 ? 's' : ''}`;
  const bonusEl = document.getElementById('streakBonus');
  const parts = [];
  if (wBonus > 0 || wCap > 0) {
    parts.push(`watering: +${wBonus}/${wCap}`);
  }
  if (dBonus > 0 || dCap > 0) {
    parts.push(`day: +${dBonus}`);
  }
  if (passiveCap > 0) {
    parts.push(`passive: +${passiveCap}/day`);
  }
  if (parts.length > 0) {
    bonusEl.textContent = parts.join(' | ');
    bonusEl.style.display = '';
  } else {
    bonusEl.style.display = 'none';
  }

  // Water button state
  updateWaterButton(state);
}

function getPlantScale(plant) {
  const vw = window.innerWidth;
  if (vw < 400) return 4;
  if (vw < 600) return 5;
  return 6;
}

export function updateWaterButton(state) {
  const btn = document.getElementById('waterBtn');
  const today = todayStr();

  if (state.currentPlant && state.currentPlant.growthStage >= 1.0) {
    btn.textContent = 'Move to Garden';
    btn.disabled = false;
    btn.className = 'btn btn-water btn-complete';
  } else if (state.stats.lastVisitDate === today) {
    btn.textContent = 'Come back tomorrow!';
    btn.disabled = true;
    btn.className = 'btn btn-water btn-disabled';
  } else {
    btn.textContent = 'Water Your Plant';
    btn.disabled = false;
    btn.className = 'btn btn-water';
  }
}

// Show a toast message
export function showToast(message, type = 'info') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  toast.offsetHeight;
  toast.classList.add('toast-visible');

  setTimeout(() => {
    toast.classList.remove('toast-visible');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// Watering animation
export function playWaterAnimation(canvasWrap) {
  const drops = document.createElement('div');
  drops.className = 'water-drops';
  for (let i = 0; i < 5; i++) {
    const drop = document.createElement('div');
    drop.className = 'water-drop';
    drop.style.left = `${20 + Math.random() * 60}%`;
    drop.style.animationDelay = `${i * 0.1}s`;
    drops.appendChild(drop);
  }
  canvasWrap.appendChild(drops);
  setTimeout(() => drops.remove(), 1000);
}

// Stop the active animator
export function stopAnimator() {
  if (activeAnimator) {
    activeAnimator.stop();
    activeAnimator = null;
  }
}

// Legacy alias
export function stopSparkle(canvasWrap) {
  stopAnimator();
}

// Show/hide screens
export function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach((s) => {
    s.classList.remove('screen-active');
  });
  const screen = document.getElementById(screenId);
  if (screen) {
    screen.classList.add('screen-active');
  }

  // Pause animation when leaving plant screen
  if (screenId !== 'plantScreen' && activeAnimator) {
    activeAnimator.stop();
  }
}

// Show completion overlay
export function showCompletionOverlay(plant, stats, droppedItems) {
  const overlay = document.getElementById('completionOverlay');
  overlay.classList.add('overlay-visible');

  const canvasWrap = document.getElementById('completionCanvasWrap');
  canvasWrap.innerHTML = '';

  // Animated plant in completion overlay too
  const completionAnimator = new PlantAnimator(canvasWrap, plant, 5);
  completionAnimator.start();

  // Store so we can clean up
  canvasWrap._animator = completionAnimator;

  const displayRarity = plant.unique ? `Unique ${plant.uniqueBase || plant.rarity}` : plant.rarity;
  const displayColor = plant.unique ? '#c0c8d4' : RARITY_COLORS[plant.rarity];

  document.getElementById('completionName').textContent = plant.species;
  document.getElementById('completionName').style.color = displayColor;
  document.getElementById('completionRarity').textContent = displayRarity;
  document.getElementById('completionRarity').style.color = displayColor;

  const daysVisited = plant.daysVisited ? plant.daysVisited.length : plant.daysGrown;
  const wBonusValue = WATERING_BONUS_VALUES[plant.rarity] || 0;
  const dBonusValue = DAY_BONUS_VALUES[plant.rarity] || 0;
  const isLegendary = plant.rarity === 'Legendary';

  let bonusBoxes = `
    <div class="completion-stat-bonus">
      <span class="stat-label">Watering Bonus</span>
      <span class="stat-value" style="color:${RARITY_COLORS[plant.rarity]}">+${wBonusValue}</span>
    </div>
  `;
  if (dBonusValue > 0) {
    bonusBoxes += `
      <div class="completion-stat-bonus">
        <span class="stat-label">Day Bonus${isLegendary ? ' <span class="passive-tag">PASSIVE</span>' : ''}</span>
        <span class="stat-value" style="color:${RARITY_COLORS[plant.rarity]}">+${dBonusValue}</span>
      </div>
    `;
  }

  let itemDropsHtml = '';
  if (droppedItems && droppedItems.length > 0) {
    itemDropsHtml = `
      <div class="completion-item-drops">
        <div class="drops-heading">Items Found!</div>
        ${droppedItems.map(item => `
          <div class="dropped-item" style="border-color:${RARITY_COLORS[item.rarity] || '#6b7b3a'}">
            <span class="dropped-item-name" style="color:${RARITY_COLORS[item.rarity] || '#6b7b3a'}">${item.name}</span>
            <span class="dropped-item-desc">${item.description}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  document.getElementById('completionStats').innerHTML = `
    ${bonusBoxes}
    <div class="completion-stat-lines">
      <p>Days visited: <strong>${daysVisited}</strong></p>
      <p>Growth days applied: <strong>${plant.daysGrown}</strong></p>
      <p>Required: <strong>${plant.totalDaysRequired}</strong></p>
    </div>
    ${itemDropsHtml}
  `;
}

export function hideCompletionOverlay() {
  const overlay = document.getElementById('completionOverlay');
  overlay.classList.remove('overlay-visible');

  // Clean up completion animator
  const canvasWrap = document.getElementById('completionCanvasWrap');
  if (canvasWrap._animator) {
    canvasWrap._animator.stop();
    canvasWrap._animator = null;
  }
}
