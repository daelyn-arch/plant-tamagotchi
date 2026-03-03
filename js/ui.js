// DOM helpers, animations, screen transitions

import { renderPlantScaled } from './plant-generator.js';
import { RARITY_COLORS, getCanvasSize } from './plant-data.js';
import {
  streakBonus, wateringBonusCap, dayBonusCap, legendaryPassiveCap,
  WATERING_BONUS_VALUES, DAY_BONUS_VALUES,
  currentDayBonus,
} from './growth.js';
import { todayStr } from './state.js';
import { renderItemIcon } from './item-renderer.js';
import { PlantAnimator } from './animation.js';

// Active animator instance
let activeAnimator = null;

// Countdown timer interval
let countdownInterval = null;

// Active growth animation (cancel if a new one starts)
let growthAnimId = null;

// Update the plant view with current state
export function updatePlantView(state) {
  const plant = state.currentPlant;
  if (!plant) return;

  // Cancel any running growth animation
  if (growthAnimId) {
    cancelAnimationFrame(growthAnimId);
    growthAnimId = null;
  }

  const canvasWrap = document.getElementById('plantCanvasWrap');
  const scale = getPlantScale(plant);

  // Reuse existing animator if same plant — avoids blink and preserves sway phase
  if (activeAnimator && activeAnimator.running && activeAnimator.plant.id === plant.id && activeAnimator.scale === scale) {
    activeAnimator.updatePlant(plant);
  } else {
    // Different plant or no animator — full rebuild
    stopAnimator();
    canvasWrap.innerHTML = '';
    activeAnimator = new PlantAnimator(canvasWrap, plant, scale);
    activeAnimator.start();
  }

  // Plant info
  document.getElementById('plantName').textContent = plant.species;
  document.getElementById('plantName').style.color = RARITY_COLORS[plant.rarity];
  document.getElementById('plantRarity').textContent = plant.rarity;
  document.getElementById('plantRarity').style.color = RARITY_COLORS[plant.rarity];

  // Progress bar
  const pct = Math.min(Math.floor(plant.growthStage * 100), 100);
  const fill = document.getElementById('progressFill');
  fill.style.width = `${pct}%`;
  if (pct >= 100) {
    fill.classList.add('progress-fill-complete');
  } else {
    fill.classList.remove('progress-fill-complete');
  }
  document.getElementById('progressText').textContent = `${pct}%`;
  const daysDisplay = Number.isInteger(plant.daysGrown) ? plant.daysGrown : plant.daysGrown.toFixed(2).replace(/\.?0+$/, '');
  document.getElementById('growthInfo').textContent =
    `Day ${daysDisplay} / ${plant.totalDaysRequired}`;

  // Streak
  const streak = state.stats.currentStreak;
  const wBonus = streakBonus(streak, state.garden);
  const wCap = wateringBonusCap(state.garden);
  const dCap = dayBonusCap(state.garden);
  const dBonus = currentDayBonus(state.garden, streak);
  const passiveCap = legendaryPassiveCap(state.garden);
  document.getElementById('streakCount').textContent = `${streak} day${streak !== 1 ? 's' : ''}`;

  // Bonuses button — show when any bonus values > 0
  const bonusesBtn = document.getElementById('bonusesBtn');
  const hasBonuses = wBonus > 0 || wCap > 0 || dBonus > 0 || dCap > 0 || passiveCap > 0;
  if (bonusesBtn) {
    bonusesBtn.style.display = hasBonuses ? '' : 'none';
  }

  // Bonuses popup content
  const bonusesList = document.getElementById('bonusesList');
  if (bonusesList && hasBonuses) {
    const fmt = v => Number.isInteger(v) ? v : +v.toFixed(2);
    let html = '';
    if (wBonus > 0 || wCap > 0) {
      html += `<div class="bonus-row"><span class="bonus-label">Watering</span><span class="bonus-value">+${fmt(wBonus)}</span></div>`;
    }
    if (dBonus > 0 || dCap > 0) {
      html += `<div class="bonus-row"><span class="bonus-label">Consecutive</span><span class="bonus-value">+${fmt(dBonus)} (+${fmt(dCap)}/day)</span></div>`;
    }
    if (passiveCap > 0) {
      html += `<div class="bonus-row"><span class="bonus-label">Passive</span><span class="bonus-value">+${fmt(passiveCap)}/day</span></div>`;
    }
    bonusesList.innerHTML = html;
  }

  // Games button visibility — show when any animated plant exists
  const gamesBtn = document.getElementById('gamesBtn');
  if (gamesBtn) {
    const anyAnimated = (state.currentPlant && state.currentPlant.animated)
      || state.garden.some(p => p.animated);
    gamesBtn.style.display = anyAnimated ? '' : 'none';
  }

  // Water button state
  updateWaterButton(state);
}

/**
 * Animate plant growth from oldGrowthStage to newState's growthStage.
 * The plant visually grows through each intermediate phase and the progress bar fills smoothly.
 * @param {number} oldGrowthStage — growth stage before watering (0–1)
 * @param {object} newState — full state after watering
 * @param {number} durationMs — animation duration in ms
 */
export function animateGrowthTransition(oldGrowthStage, newState, durationMs = 1500) {
  const plant = newState.currentPlant;
  if (!plant) return;

  const targetStage = plant.growthStage;
  const oldDaysGrown = oldGrowthStage * plant.totalDaysRequired;

  // If no actual change, just snap
  if (Math.abs(targetStage - oldGrowthStage) < 0.001) {
    updatePlantView(newState);
    return;
  }

  // Cancel any prior animation
  if (growthAnimId) {
    cancelAnimationFrame(growthAnimId);
    growthAnimId = null;
  }

  // Ensure animator exists for this plant
  const canvasWrap = document.getElementById('plantCanvasWrap');
  const scale = getPlantScale(plant);
  if (!activeAnimator || !activeAnimator.running || activeAnimator.plant.id !== plant.id) {
    stopAnimator();
    canvasWrap.innerHTML = '';
    activeAnimator = new PlantAnimator(canvasWrap, { ...plant, growthStage: oldGrowthStage }, scale);
    activeAnimator.start();
  }

  // Update static text elements immediately
  document.getElementById('plantName').textContent = plant.species;
  document.getElementById('plantName').style.color = RARITY_COLORS[plant.rarity];
  document.getElementById('plantRarity').textContent = plant.rarity;
  document.getElementById('plantRarity').style.color = RARITY_COLORS[plant.rarity];
  updateWaterButton(newState);

  // Update streak info immediately
  const streak = newState.stats.currentStreak;
  const wBonus = streakBonus(streak, newState.garden);
  const wCap = wateringBonusCap(newState.garden);
  const dCap = dayBonusCap(newState.garden);
  const dBonus = currentDayBonus(newState.garden, streak);
  const passiveCap = legendaryPassiveCap(newState.garden);
  document.getElementById('streakCount').textContent = `${streak} day${streak !== 1 ? 's' : ''}`;

  // Update bonuses button + popup content
  const bonusesBtn = document.getElementById('bonusesBtn');
  const hasBonuses = wBonus > 0 || wCap > 0 || dBonus > 0 || dCap > 0 || passiveCap > 0;
  if (bonusesBtn) bonusesBtn.style.display = hasBonuses ? '' : 'none';
  const bonusesList = document.getElementById('bonusesList');
  if (bonusesList && hasBonuses) {
    const fmt = v => Number.isInteger(v) ? v : +v.toFixed(2);
    let html = '';
    if (wBonus > 0 || wCap > 0) html += `<div class="bonus-row"><span class="bonus-label">Watering</span><span class="bonus-value">+${fmt(wBonus)}</span></div>`;
    if (dBonus > 0 || dCap > 0) html += `<div class="bonus-row"><span class="bonus-label">Consecutive</span><span class="bonus-value">+${fmt(dBonus)} (+${fmt(dCap)}/day)</span></div>`;
    if (passiveCap > 0) html += `<div class="bonus-row"><span class="bonus-label">Passive</span><span class="bonus-value">+${fmt(passiveCap)}/day</span></div>`;
    bonusesList.innerHTML = html;
  }

  const fill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  const growthInfo = document.getElementById('growthInfo');
  const startTime = performance.now();

  function tick(now) {
    const elapsed = now - startTime;
    const t = Math.min(1, elapsed / durationMs);
    // Ease-out curve for natural deceleration
    const eased = 1 - (1 - t) * (1 - t);

    const currentStage = oldGrowthStage + (targetStage - oldGrowthStage) * eased;
    const currentDays = oldDaysGrown + (plant.daysGrown - oldDaysGrown) * eased;
    const pct = Math.min(Math.floor(currentStage * 100), 100);

    // Update progress bar
    fill.style.width = `${pct}%`;
    if (pct >= 100) {
      fill.classList.add('progress-fill-complete');
    } else {
      fill.classList.remove('progress-fill-complete');
    }
    progressText.textContent = `${pct}%`;
    const daysDisplay = Math.floor(currentDays * 100) / 100;
    const daysStr = Number.isInteger(daysDisplay) ? daysDisplay : daysDisplay.toFixed(2).replace(/\.?0+$/, '');
    growthInfo.textContent = `Day ${daysStr} / ${plant.totalDaysRequired}`;

    // Update plant visual at intermediate growth stage
    if (activeAnimator && activeAnimator.running) {
      const tempPlant = { ...plant, growthStage: currentStage };
      activeAnimator.updatePlant(tempPlant);
    }

    if (t < 1) {
      growthAnimId = requestAnimationFrame(tick);
    } else {
      growthAnimId = null;
      // Snap to final state
      if (activeAnimator && activeAnimator.running) {
        activeAnimator.updatePlant(plant);
      }
    }
  }

  growthAnimId = requestAnimationFrame(tick);
}

function getPlantScale(plant) {
  const canvasSize = getCanvasSize(plant.rarity);
  // Use the plant-display container (stable dimensions from aspect-ratio)
  // rather than the wrap (whose size depends on canvas content)
  const display = document.querySelector('.plant-display');
  if (display && display.clientWidth > 0) {
    // Estimate available space: display inner area minus ~200px for text/buttons
    const padding = 40; // approximate horizontal padding + border
    const availWidth = display.clientWidth - padding;
    const textHeight = 200; // approximate height of info, progress, streak
    const availHeight = display.clientHeight - textHeight;
    let maxScale = Math.floor(availWidth / canvasSize);
    if (availHeight > 0) {
      maxScale = Math.min(maxScale, Math.floor(availHeight / canvasSize));
    }
    return Math.max(2, Math.min(maxScale, 12));
  }
  // Fallback before layout is computed
  const vw = window.innerWidth;
  if (vw < 400) return 6;
  if (vw < 600) return 7;
  return 8;
}

export function updateWaterButton(state) {
  const btn = document.getElementById('waterBtn');
  const today = todayStr();
  const alreadyWatered = state.stats.lastVisitDate === today;

  if (state.currentPlant && state.currentPlant.growthStage >= 1.0) {
    btn.textContent = 'Move to Garden';
    btn.disabled = false;
    btn.className = 'btn btn-water btn-complete';
    stopCountdown();
  } else if (alreadyWatered) {
    btn.textContent = 'Come back tomorrow!';
    btn.disabled = true;
    btn.className = 'btn btn-water btn-disabled';
    startCountdown(state);
  } else {
    btn.textContent = 'Water Your Plant';
    btn.disabled = false;
    btn.className = 'btn btn-water';
    stopCountdown();
  }
}

function startCountdown(state) {
  const wrap = document.getElementById('countdownWrap');
  const timeEl = document.getElementById('countdownTime');
  if (!wrap || !timeEl) return;

  wrap.style.display = '';
  updateCountdownDisplay(timeEl, state);

  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    updateCountdownDisplay(timeEl, state);
  }, 1000);
}

function updateCountdownDisplay(timeEl, state) {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);

  const diff = midnight - now;
  if (diff <= 0) {
    // Midnight passed — refresh water button state
    stopCountdown();
    updateWaterButton(state);
    return;
  }

  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  timeEl.textContent =
    `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function stopCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  const wrap = document.getElementById('countdownWrap');
  if (wrap) wrap.style.display = 'none';
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
        <span class="stat-label">Consecutive Bonus${isLegendary ? ' <span class="passive-tag">PASSIVE</span>' : ''}</span>
        <span class="stat-value" style="color:${RARITY_COLORS[plant.rarity]}">+${dBonusValue}/day</span>
      </div>
    `;
  }

  const statsEl = document.getElementById('completionStats');
  statsEl.innerHTML = `
    ${bonusBoxes}
    <div class="completion-stat-lines">
      <p>Days visited: <strong>${daysVisited}</strong></p>
      <p>Growth days applied: <strong>${plant.daysGrown}</strong></p>
      <p>Required: <strong>${plant.totalDaysRequired}</strong></p>
    </div>
  `;

  if (droppedItems && droppedItems.length > 0) {
    const dropsWrap = document.createElement('div');
    dropsWrap.className = 'completion-item-drops';
    dropsWrap.innerHTML = '<div class="drops-heading">Items Found!</div>';

    for (const item of droppedItems) {
      const dropEl = document.createElement('div');
      dropEl.className = 'dropped-item';
      dropEl.style.borderColor = RARITY_COLORS[item.rarity] || '#6b7b3a';

      const iconEl = document.createElement('div');
      iconEl.className = 'dropped-item-icon';
      iconEl.appendChild(renderItemIcon(item.type, item.rarity, 3));

      const textWrap = document.createElement('div');
      textWrap.className = 'dropped-item-text';
      textWrap.innerHTML = `
        <span class="dropped-item-name" style="color:${RARITY_COLORS[item.rarity] || '#6b7b3a'}">${item.name}</span>
        <span class="dropped-item-desc">${item.description}</span>
      `;

      dropEl.appendChild(iconEl);
      dropEl.appendChild(textWrap);
      dropsWrap.appendChild(dropEl);
    }

    statsEl.appendChild(dropsWrap);
  }
}

// Show trivia overlay with a question
// onAnswer(selectedIndex) is called when user picks a choice
// onContinue() is called when user clicks Continue
export function showTriviaOverlay(question, onAnswer, onContinue) {
  const overlay = document.getElementById('triviaOverlay');
  const questionEl = document.getElementById('triviaQuestion');
  const choicesEl = document.getElementById('triviaChoices');
  const resultEl = document.getElementById('triviaResult');
  const factEl = document.getElementById('triviaFact');
  const continueBtn = document.getElementById('triviaContinueBtn');

  // Reset state
  questionEl.textContent = question.question;
  choicesEl.innerHTML = '';
  resultEl.style.display = 'none';

  // Build choice buttons
  question.choices.forEach((choice, i) => {
    const btn = document.createElement('button');
    btn.className = 'trivia-choice-btn';
    btn.textContent = choice;
    btn.addEventListener('click', () => {
      // Disable all buttons
      const allBtns = choicesEl.querySelectorAll('.trivia-choice-btn');
      allBtns.forEach(b => { b.disabled = true; });

      const correct = i === question.correctIndex;

      // Highlight correct answer
      allBtns[question.correctIndex].classList.add('trivia-choice-correct');

      if (!correct) {
        btn.classList.add('trivia-choice-wrong');
      }

      // Dim other buttons
      allBtns.forEach((b, idx) => {
        if (idx !== question.correctIndex && idx !== i) {
          b.classList.add('trivia-choice-dimmed');
        }
      });

      // Show result
      const bonusText = correct ? '<span class="trivia-bonus-label">+1 BONUS GROWTH DAY</span><br>' : '';
      factEl.innerHTML = bonusText + question.fact;
      resultEl.style.display = '';

      onAnswer(i);
    });
    choicesEl.appendChild(btn);
  });

  // Continue button
  continueBtn.onclick = () => {
    hideTriviaOverlay();
    onContinue();
  };

  overlay.classList.add('overlay-visible');
}

export function hideTriviaOverlay() {
  const overlay = document.getElementById('triviaOverlay');
  overlay.classList.remove('overlay-visible');
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
