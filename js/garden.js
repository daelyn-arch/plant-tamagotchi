// Garden collection view

import { loadState } from './state.js';
import { RARITY, RARITY_COLORS } from './plant-data.js';
import { PlantAnimator, stopAllAnimators } from './animation.js';
import { wateringBonusCapRaw, dayBonusCapRaw, legendaryPassiveCap } from './growth.js';

const SORT_MODES = ['date', 'rarity', 'species'];
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
    <button class="btn btn-back" id="gardenBackBtn">Back to Plant</button>
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

  // Sort controls
  const sortBar = document.createElement('div');
  sortBar.className = 'sort-bar';
  sortBar.innerHTML = `
    <span>Sort by:</span>
    ${SORT_MODES.map(
      (m) =>
        `<button class="btn btn-sm sort-btn" data-sort="${m}">${m.charAt(0).toUpperCase() + m.slice(1)}</button>`
    ).join('')}
  `;
  container.appendChild(sortBar);

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

      // Animated thumbnail
      const animator = new PlantAnimator(canvasWrap, plant, 3, { mini: true });
      animator.start();

      // Unique plant styling
      if (plant.unique) {
        card.classList.add('garden-card-unique');
        card.style.borderColor = '#c0c8d4';
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

      // Click for details
      card.addEventListener('click', () => showPlantDetail(container, plant));

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
}

function showPlantDetail(container, plant) {
  const overlay = document.createElement('div');
  overlay.className = 'detail-overlay';

  const displayRarity = plant.unique ? `Unique ${plant.uniqueBase || plant.rarity}` : plant.rarity;
  const displayColor = plant.unique ? '#c0c8d4' : RARITY_COLORS[plant.rarity];
  const upgradeLine = plant.upgradeMultiplier && plant.upgradeMultiplier > 1
    ? `<p>Bonus multiplier: <strong>${plant.upgradeMultiplier.toFixed(1)}x</strong></p>` : '';

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
      </div>
      <button class="btn btn-close-detail">Close</button>
    </div>
  `;

  container.appendChild(overlay);

  // Animated detail view
  const detailWrap = overlay.querySelector('.detail-canvas-wrap');
  const animator = new PlantAnimator(detailWrap, plant, 5);
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
