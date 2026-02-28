// Garden collection view

import { loadState } from './state.js';
import { RARITY, RARITY_COLORS, getCanvasSize } from './plant-data.js';
import { PlantAnimator, GrowthReplayAnimator, stopAllAnimators } from './animation.js';
import { WATERING_BONUS_VALUES, DAY_BONUS_VALUES, wateringBonusCapRaw, dayBonusCapRaw, legendaryPassiveCap } from './growth.js';
import { POT_LEVEL_THRESHOLDS, potLevelFromExp } from './canvas-utils.js';

const SORT_MODES = ['date', 'rarity', 'species'];

function gardenMiniScale(plant) {
  const cs = getCanvasSize(plant.rarity);
  if (cs >= 96) return 2;
  return 3;
}
const RARITY_ORDER = [RARITY.COMMON, RARITY.UNCOMMON, RARITY.RARE, RARITY.EPIC, RARITY.LEGENDARY];

export function getGardenData() {
  const state = loadState();
  return {
    plants: state.garden,
    stats: state.stats,
  };
}

export function sortGarden(plants, mode) {
  const sorted = [...plants];
  switch (mode) {
    case 'date':
      sorted.sort((a, b) => (b.dateCompleted || '').localeCompare(a.dateCompleted || ''));
      break;
    case 'rarity':
      sorted.sort(
        (a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity)
      );
      break;
    case 'species':
      sorted.sort((a, b) => a.species.localeCompare(b.species));
      break;
  }
  return sorted;
}

export function getRarityCounts(plants) {
  const counts = {};
  for (const r of RARITY_ORDER) counts[r] = 0;
  for (const p of plants) {
    counts[p.rarity] = (counts[p.rarity] || 0) + 1;
  }
  return counts;
}

export function renderGardenView(container) {
  // Clean up any previous animators
  stopAllAnimators();

  const { plants, stats } = getGardenData();
  container.innerHTML = '';

  // Header
  const header = document.createElement('div');
  header.className = 'garden-header';
  header.innerHTML = `
    <h2>Your Garden</h2>
    <div class="header-actions">
      <button class="btn btn-sm" id="galleryBtn">Species Gallery</button>
      <button class="btn btn-back" id="gardenBackBtn">Back to Plant</button>
    </div>
  `;
  container.appendChild(header);

  // Stats
  const statsEl = document.createElement('div');
  statsEl.className = 'garden-stats';
  const rarityCounts = getRarityCounts(plants);
  const rawWCap = wateringBonusCapRaw(plants);
  const effectiveWCap = Math.floor(rawWCap);
  const rawDCap = dayBonusCapRaw(plants);
  const effectiveDCap = Math.floor(rawDCap);
  const passiveCap = legendaryPassiveCap(plants);
  statsEl.innerHTML = `
    <div class="stat-row">
      <span>Total Plants: <strong>${stats.totalPlantsGrown}</strong></span>
      <span>Longest Streak: <strong>${stats.longestStreak} days</strong></span>
      <span>Total Visits: <strong>${stats.totalVisits}</strong></span>
    </div>
    <div class="garden-bonus-indicators">
      <div class="garden-bonus-indicator">
        <span class="bonus-label">Watering Cap:</span>
        <span class="bonus-value">${rawWCap % 1 === 0 ? rawWCap : rawWCap.toFixed(2)}</span>
        ${rawWCap !== effectiveWCap ? `<span class="bonus-effective">(${effectiveWCap} eff.)</span>` : ''}
      </div>
      <div class="garden-bonus-indicator">
        <span class="bonus-label">Day Cap:</span>
        <span class="bonus-value">${rawDCap % 1 === 0 ? rawDCap : rawDCap.toFixed(2)}</span>
        ${rawDCap !== effectiveDCap ? `<span class="bonus-effective">(${effectiveDCap} eff.)</span>` : ''}
      </div>
      ${passiveCap > 0 ? `
      <div class="garden-bonus-indicator garden-bonus-passive">
        <span class="bonus-label">Passive:</span>
        <span class="bonus-value">${passiveCap}/day</span>
        <span class="bonus-effective">(Legendary)</span>
      </div>
      ` : ''}
    </div>
    <div class="rarity-counts">
      ${RARITY_ORDER.map(
        (r) =>
          `<span class="rarity-badge" style="color:${RARITY_COLORS[r]}">${r}: ${rarityCounts[r]}</span>`
      ).join(' ')}
    </div>
  `;
  container.appendChild(statsEl);

  if (plants.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'garden-empty';
    empty.textContent = 'No plants yet! Grow your first plant to fill your garden.';
    container.appendChild(empty);
    return;
  }

  // Sort controls + bonus toggle + replay toggle
  const sortBar = document.createElement('div');
  sortBar.className = 'sort-bar';
  sortBar.innerHTML = `
    <div class="sort-row">
      <span class="sort-label">Sort by:</span>
      ${SORT_MODES.map(
        (m) =>
          `<button class="btn btn-sm sort-btn" data-sort="${m}">${m.charAt(0).toUpperCase() + m.slice(1)}</button>`
      ).join('')}
    </div>
    <div class="sort-row sort-toggles">
      <button class="btn btn-sm bonus-toggle-btn" id="bonusToggle">Show Bonuses</button>
      <button class="btn btn-sm replay-toggle-btn" id="replayToggle">Replay Growth</button>
    </div>
  `;
  container.appendChild(sortBar);

  let showBonuses = false;
  let replayMode = false;

  // Grid
  const grid = document.createElement('div');
  grid.className = 'garden-grid';
  container.appendChild(grid);

  let currentSort = 'date';

  function renderGrid() {
    // Stop previous animators before re-rendering
    stopAllAnimators();
    grid.innerHTML = '';

    const sorted = sortGarden(plants, currentSort);

    for (const plant of sorted) {
      const card = document.createElement('div');
      card.className = 'garden-card';
      card.dataset.plantId = plant.id;

      const canvasWrap = document.createElement('div');
      canvasWrap.className = 'garden-canvas-wrap';

      if (replayMode) {
        const animator = new GrowthReplayAnimator(canvasWrap, plant, gardenMiniScale(plant), { durationMs: 4000 });
        animator.start();
      } else {
        const animator = new PlantAnimator(canvasWrap, plant, gardenMiniScale(plant), { mini: true });
        animator.start();
      }

      // Unique plant styling
      if (plant.unique) {
        card.classList.add('garden-card-unique');
        card.style.borderColor = '#c0c8d4';
      }

      const info = document.createElement('div');
      info.className = 'garden-card-info';
      const displayRarity = plant.unique ? `Unique ${plant.uniqueBase || plant.rarity}` : plant.rarity;
      const displayColor = plant.unique ? '#c0c8d4' : RARITY_COLORS[plant.rarity];
      const potLvl = plant.potElement ? (plant.potLevel || 0) : 0;
      info.innerHTML = `
        <span class="garden-card-name" style="color:${displayColor}">${plant.species}</span>
        <span class="garden-card-rarity">${displayRarity}</span>
        ${plant.unique ? '<span class="unique-badge">Unique</span>' : ''}
        ${plant.upgradeMultiplier && plant.upgradeMultiplier > 1 ? '<span class="upgraded-badge">Upgraded</span>' : ''}
        ${potLvl > 0 ? `<span class="pot-level-badge pot-level-${plant.potElement}">Lv.${potLvl}</span>` : ''}
      `;

      // Bonus overlay
      const mult = plant.upgradeMultiplier || 1;
      const wBase = plant.bonusWatering != null ? plant.bonusWatering : (WATERING_BONUS_VALUES[plant.rarity] || 0);
      const dBase = plant.bonusDay != null ? plant.bonusDay : (DAY_BONUS_VALUES[plant.rarity] || 0);
      const wVal = wBase * mult;
      const dVal = dBase * mult;
      const isLeg = plant.rarity === RARITY.LEGENDARY || plant.bonusPassive;

      const bonusEl = document.createElement('div');
      bonusEl.className = 'garden-card-bonus';
      if (!showBonuses) bonusEl.style.display = 'none';

      let bonusLines = [];
      const fmt = v => v % 1 === 0 ? v : v.toFixed(2);
      if (wVal > 0) bonusLines.push(`<span class="gcb-water">Watering +${fmt(wVal)}</span>`);
      if (dVal > 0) bonusLines.push(`<span class="gcb-day">Day +${fmt(dVal)}</span>`);
      if (isLeg) bonusLines.push(`<span class="gcb-passive">Passive +${fmt(dVal)}/day</span>`);
      if (mult > 1) bonusLines.push(`<span class="gcb-mult">Upgraded ${mult.toFixed(1)}x</span>`);
      if (bonusLines.length === 0) bonusLines.push(`<span class="gcb-none">No bonus</span>`);
      bonusEl.innerHTML = bonusLines.join('');

      card.appendChild(canvasWrap);
      card.appendChild(info);
      card.appendChild(bonusEl);

      // Click for details
      card.addEventListener('click', () => showPlantDetail(container, plant, replayMode));

      grid.appendChild(card);
    }
  }

  renderGrid();

  // Sort button listeners
  sortBar.querySelectorAll('.sort-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentSort = btn.dataset.sort;
      sortBar.querySelectorAll('.sort-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      renderGrid();
    });
  });
  // Default active
  sortBar.querySelector('[data-sort="date"]').classList.add('active');

  // Bonus toggle
  const bonusToggle = sortBar.querySelector('#bonusToggle');
  bonusToggle.addEventListener('click', () => {
    showBonuses = !showBonuses;
    bonusToggle.textContent = showBonuses ? 'Hide Bonuses' : 'Show Bonuses';
    bonusToggle.classList.toggle('active', showBonuses);
    grid.querySelectorAll('.garden-card-bonus').forEach(el => {
      el.style.display = showBonuses ? '' : 'none';
    });
  });

  // Replay growth toggle
  const replayToggle = sortBar.querySelector('#replayToggle');
  replayToggle.addEventListener('click', () => {
    replayMode = !replayMode;
    replayToggle.textContent = replayMode ? 'Stop Replay' : 'Replay Growth';
    replayToggle.classList.toggle('active', replayMode);
    renderGrid();
  });
}

// ── Garden Picker Mode ──────────────────────────────────────────
// Renders the garden grid in selection mode for item use (reroll, upgrade, combine)

export function renderGardenPicker(container, opts) {
  // opts: { title, hint, plants, maxSelections, eligible(plant)->bool, onConfirm([ids]), onCancel }
  stopAllAnimators();
  container.innerHTML = '';

  const { title, hint, plants, maxSelections, eligible, onConfirm, onCancel } = opts;
  let selectedIds = [];

  // Header banner
  const banner = document.createElement('div');
  banner.className = 'picker-banner';
  container.appendChild(banner);

  // Grid
  const grid = document.createElement('div');
  grid.className = 'garden-grid';
  container.appendChild(grid);

  function updateBanner() {
    const countText = maxSelections > 1
      ? `(${selectedIds.length}/${maxSelections} selected)`
      : '';
    banner.innerHTML = `
      <h2>${title}</h2>
      <p class="picker-banner-hint">${hint} ${countText}</p>
      <div class="picker-banner-actions">
        <button class="btn" id="pickerCancel">Cancel</button>
      </div>
    `;
    banner.querySelector('#pickerCancel').addEventListener('click', onCancel);
  }

  function checkSelectionComplete() {
    if (selectedIds.length === maxSelections) {
      const selectedPlants = selectedIds.map(id => plants.find(p => p.id === id)).filter(Boolean);
      showPickerConfirmOverlay(container, selectedPlants, title, () => {
        onConfirm(selectedIds);
      }, () => {
        // On "Go Back" — deselect the last picked plant and re-render
        selectedIds.pop();
        updateBanner();
        renderPickerGrid();
      });
    }
  }

  function renderPickerGrid() {
    stopAllAnimators();
    grid.innerHTML = '';

    for (const plant of plants) {
      const isEligible = eligible ? eligible(plant) : true;
      const isSelected = selectedIds.includes(plant.id);

      const card = document.createElement('div');
      card.className = 'garden-card';
      card.dataset.plantId = plant.id;
      if (isSelected) card.classList.add('picker-card-selected');
      if (!isEligible) card.classList.add('picker-card-disabled');

      const canvasWrap = document.createElement('div');
      canvasWrap.className = 'garden-canvas-wrap';
      const animator = new PlantAnimator(canvasWrap, plant, gardenMiniScale(plant), { mini: true });
      animator.start();

      if (plant.unique) {
        card.classList.add('garden-card-unique');
        card.style.borderColor = isSelected ? '#5a9a3a' : '#c0c8d4';
      }

      const info = document.createElement('div');
      info.className = 'garden-card-info';
      const displayRarity = plant.unique ? `Unique ${plant.uniqueBase || plant.rarity}` : plant.rarity;
      const displayColor = plant.unique ? '#c0c8d4' : RARITY_COLORS[plant.rarity];
      info.innerHTML = `
        <span class="garden-card-name" style="color:${displayColor}">${plant.species}</span>
        <span class="garden-card-rarity">${displayRarity}</span>
        ${plant.unique ? '<span class="unique-badge">Unique</span>' : ''}
        ${plant.upgradeMultiplier && plant.upgradeMultiplier > 1 ? '<span class="upgraded-badge">Upgraded</span>' : ''}
      `;

      card.appendChild(canvasWrap);
      card.appendChild(info);

      if (isEligible) {
        card.addEventListener('click', () => {
          if (isSelected) {
            selectedIds = selectedIds.filter(id => id !== plant.id);
          } else if (selectedIds.length < maxSelections) {
            selectedIds.push(plant.id);
          }
          updateBanner();
          renderPickerGrid();
          checkSelectionComplete();
        });
      }

      grid.appendChild(card);
    }
  }

  updateBanner();
  renderPickerGrid();
}

function showPickerConfirmOverlay(container, selectedPlants, actionTitle, onConfirm, onGoBack) {
  const overlay = document.createElement('div');
  overlay.className = 'detail-overlay';

  const card = document.createElement('div');
  card.className = 'detail-card picker-confirm-card';

  // Title
  const heading = document.createElement('h3');
  heading.className = 'picker-confirm-title';
  heading.textContent = `Confirm: ${actionTitle}`;
  card.appendChild(heading);

  // Plant previews
  const previewRow = document.createElement('div');
  previewRow.className = 'picker-confirm-plants';

  const animators = [];
  for (const plant of selectedPlants) {
    const plantEl = document.createElement('div');
    plantEl.className = 'picker-confirm-plant';

    const canvasWrap = document.createElement('div');
    canvasWrap.className = 'picker-confirm-canvas';
    const animator = new PlantAnimator(canvasWrap, plant, 4, { mini: false });
    animators.push(animator);

    const displayRarity = plant.unique ? `Unique ${plant.uniqueBase || plant.rarity}` : plant.rarity;
    const displayColor = plant.unique ? '#c0c8d4' : RARITY_COLORS[plant.rarity];

    const info = document.createElement('div');
    info.className = 'picker-confirm-plant-info';
    info.innerHTML = `
      <span class="picker-confirm-plant-name" style="color:${displayColor}">${plant.species}</span>
      <span class="picker-confirm-plant-rarity">${displayRarity}</span>
    `;

    plantEl.appendChild(canvasWrap);
    plantEl.appendChild(info);
    previewRow.appendChild(plantEl);
  }

  card.appendChild(previewRow);

  // Warning for combine (2 plants)
  if (selectedPlants.length === 2) {
    const warn = document.createElement('p');
    warn.className = 'picker-confirm-warning';
    warn.textContent = 'Both source plants will be removed.';
    card.appendChild(warn);
  }

  // Buttons
  const actions = document.createElement('div');
  actions.className = 'picker-confirm-actions';
  actions.innerHTML = `
    <button class="btn btn-water" id="pickerConfirmYes">Confirm</button>
    <button class="btn" id="pickerConfirmNo">Go Back</button>
  `;
  card.appendChild(actions);

  overlay.appendChild(card);
  container.appendChild(overlay);

  // Start animators after DOM insertion
  for (const a of animators) a.start();

  const close = () => {
    for (const a of animators) a.stop();
    overlay.remove();
  };

  actions.querySelector('#pickerConfirmYes').addEventListener('click', () => {
    close();
    onConfirm();
  });
  const goBack = () => {
    close();
    if (onGoBack) onGoBack();
  };
  actions.querySelector('#pickerConfirmNo').addEventListener('click', goBack);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) goBack();
  });
}

function showPlantDetail(container, plant, replayMode) {
  const overlay = document.createElement('div');
  overlay.className = 'detail-overlay';

  const displayRarity = plant.unique ? `Unique ${plant.uniqueBase || plant.rarity}` : plant.rarity;
  const displayColor = plant.unique ? '#c0c8d4' : RARITY_COLORS[plant.rarity];
  const upgradeLine = plant.upgradeMultiplier && plant.upgradeMultiplier > 1
    ? `<p>Bonus multiplier: <strong>${plant.upgradeMultiplier.toFixed(1)}x</strong></p>` : '';

  // Pot EXP/level info
  let potExpLine = '';
  if (plant.potElement) {
    const pExp = plant.potExp || 0;
    const pLvl = plant.potLevel || 0;
    const elementNames = { fire: 'Fire', ice: 'Ice', earth: 'Earth', wind: 'Wind' };
    const eleName = elementNames[plant.potElement] || plant.potElement;
    const nextThreshold = pLvl < 3 ? POT_LEVEL_THRESHOLDS[pLvl + 1] : null;
    const prevThreshold = POT_LEVEL_THRESHOLDS[pLvl];
    let progressBar = '';
    if (nextThreshold !== null) {
      const pct = Math.min(100, Math.round(((pExp - prevThreshold) / (nextThreshold - prevThreshold)) * 100));
      progressBar = `<div class="detail-exp-bar"><div class="detail-exp-bar-fill detail-exp-fill-${plant.potElement}" style="width:${pct}%"></div></div>
        <span class="detail-exp-numbers">${pExp} / ${nextThreshold} EXP</span>`;
    } else {
      progressBar = `<span class="detail-exp-numbers">${pExp} EXP (MAX)</span>`;
    }
    potExpLine = `<div class="detail-pot-exp">
      <p>${eleName} Pot — <strong>Lv.${pLvl}</strong></p>
      ${progressBar}
    </div>`;
  }

  overlay.innerHTML = `
    <div class="detail-card">
      <div class="detail-canvas-wrap"></div>
      <h3 style="color:${displayColor}">${plant.species}</h3>
      <p class="detail-rarity">${displayRarity}</p>
      ${plant.unique ? '<span class="unique-badge">Unique</span>' : ''}
      <div class="detail-stats">
        <p>Received: ${plant.dateReceived || '?'}</p>
        <p>Completed: ${plant.dateCompleted || '?'}</p>
        <p>Days visited: ${plant.daysVisited ? plant.daysVisited.length : '?'}</p>
        <p>Growth days needed: ${plant.totalDaysRequired}</p>
        ${upgradeLine}
        ${potExpLine}
      </div>
      <button class="btn btn-close-detail">Close</button>
    </div>
  `;

  container.appendChild(overlay);

  // Animated detail view — use growth replay if replay mode is active
  const detailWrap = overlay.querySelector('.detail-canvas-wrap');
  const detailScale = getCanvasSize(plant.rarity) >= 96 ? 4 : 5;
  const animator = replayMode
    ? new GrowthReplayAnimator(detailWrap, plant, detailScale, { durationMs: 4000 })
    : new PlantAnimator(detailWrap, plant, detailScale);
  animator.start();

  const close = () => {
    animator.stop();
    overlay.remove();
  };
  overlay.querySelector('.btn-close-detail').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
}
