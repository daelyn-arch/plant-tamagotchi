// Inventory screen — shows items, allows usage

import { loadState, saveState } from './state.js';
import { RARITY_COLORS, RARITY } from './plant-data.js';
import {
  ITEM_TYPES, RARITY_ORDER,
  useBoostItem, useAutoWater, useArtReroll, useGardenUpgrade, combinePlants,
  removeItem,
} from './items.js';
import { stopAllAnimators } from './animation.js';

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
    <button class="btn btn-back" id="inventoryBackBtn">Back to Plant</button>
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
            <span class="boost-detail">${b.type === 'watering_boost' ? 'Watering' : 'Day'} +${b.value}</span>
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

    card.innerHTML = `
      <div class="item-icon" style="color:${RARITY_COLORS[item.rarity] || '#6b7b3a'}">${item.icon || '?'}</div>
      <div class="item-card-info">
        <span class="item-card-name" style="color:${RARITY_COLORS[item.rarity] || '#6b7b3a'}">${item.name}</span>
        <span class="item-card-rarity">${item.rarity}</span>
        <span class="item-card-desc">${item.description}</span>
      </div>
    `;

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

  overlay.innerHTML = `
    <div class="detail-card item-detail-card">
      <div class="item-detail-icon" style="color:${RARITY_COLORS[item.rarity] || '#6b7b3a'}">${item.icon || '?'}</div>
      <h3 style="color:${RARITY_COLORS[item.rarity] || '#6b7b3a'}">${item.name}</h3>
      <p class="detail-rarity">${item.rarity}</p>
      <p class="item-detail-desc">${item.description}</p>
      ${canUse ? `<button class="btn btn-water item-use-btn" id="itemUseBtn">Use</button>` : ''}
      <button class="btn btn-close-detail">Close</button>
    </div>
  `;

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
        showItemToast(`${item.name} activated! +${item.value} ${item.type === 'watering_boost' ? 'watering' : 'day'} bonus for ${item.duration} plant${item.duration > 1 ? 's' : ''}.`);
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
    case 'garden_upgrade': {
      showPlantPicker(container, item, state, 'upgrade');
      break;
    }
    case 'plant_combine': {
      showCombinePicker(container, item, state);
      break;
    }
  }
}

function showPlantPicker(container, item, state, mode) {
  const overlay = document.createElement('div');
  overlay.className = 'detail-overlay';

  const plants = mode === 'reroll'
    ? [
        ...(state.currentPlant ? [{ ...state.currentPlant, _isCurrent: true }] : []),
        ...state.garden,
      ]
    : state.garden;

  const title = mode === 'reroll' ? 'Choose plant to reroll' : 'Choose plant to upgrade';

  let html = `<div class="detail-card picker-card">
    <h3>${title}</h3>
    <div class="picker-grid">`;

  for (const p of plants) {
    const label = p._isCurrent ? `${p.species} (Current)` : p.species;
    const color = p.unique ? '#c0c8d4' : (RARITY_COLORS[p.rarity] || '#6b7b3a');
    html += `
      <div class="picker-item" data-plant-id="${p.id}" data-is-current="${!!p._isCurrent}">
        <span class="picker-item-name" style="color:${color}">${label}</span>
        <span class="picker-item-rarity">${p.rarity}</span>
      </div>
    `;
  }

  html += `</div>
    <button class="btn btn-close-detail">Cancel</button>
  </div>`;

  overlay.innerHTML = html;
  container.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector('.btn-close-detail').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  overlay.querySelectorAll('.picker-item').forEach(el => {
    el.addEventListener('click', () => {
      const plantId = el.dataset.plantId;
      const freshState = loadState();

      if (mode === 'reroll') {
        if (useArtReroll(freshState, item.id, plantId)) {
          saveState(freshState);
          showItemToast('Appearance rerolled!');
          close();
          renderInventoryView(container);
          if (_onItemUsed) _onItemUsed();
        }
      } else if (mode === 'upgrade') {
        if (useGardenUpgrade(freshState, item.id, plantId)) {
          saveState(freshState);
          showItemToast('Plant upgraded! +50% bonus contribution.');
          close();
          renderInventoryView(container);
          if (_onItemUsed) _onItemUsed();
        }
      }
    });
  });
}

function showCombinePicker(container, item, state) {
  const overlay = document.createElement('div');
  overlay.className = 'detail-overlay';

  // Filter plants by rarity gate
  const gateIdx = RARITY_ORDER.indexOf(item.combineGate || item.rarity);
  const eligible = state.garden.filter(p => RARITY_ORDER.indexOf(p.rarity) <= gateIdx);

  if (eligible.length < 2) {
    showItemToast('Not enough eligible plants to combine.');
    return;
  }

  let selectedIds = [];

  function renderPicker() {
    let html = `<div class="detail-card picker-card">
      <h3>Select 2 plants to combine</h3>
      <p class="picker-hint">Max rarity: ${item.combineGate || item.rarity}. Both plants will be consumed.</p>
      <div class="picker-grid">`;

    for (const p of eligible) {
      const selected = selectedIds.includes(p.id);
      const color = p.unique ? '#c0c8d4' : (RARITY_COLORS[p.rarity] || '#6b7b3a');
      html += `
        <div class="picker-item ${selected ? 'picker-item-selected' : ''}" data-plant-id="${p.id}">
          <span class="picker-item-name" style="color:${color}">${p.species}</span>
          <span class="picker-item-rarity">${p.rarity}</span>
        </div>
      `;
    }

    html += `</div>
      ${selectedIds.length === 2 ? '<button class="btn btn-water" id="confirmCombine">Combine!</button>' : ''}
      <button class="btn btn-close-detail">Cancel</button>
    </div>`;

    overlay.innerHTML = html;

    // Wire events
    overlay.querySelector('.btn-close-detail').addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    overlay.querySelectorAll('.picker-item').forEach(el => {
      el.addEventListener('click', () => {
        const pid = el.dataset.plantId;
        if (selectedIds.includes(pid)) {
          selectedIds = selectedIds.filter(id => id !== pid);
        } else if (selectedIds.length < 2) {
          selectedIds.push(pid);
        }
        renderPicker();
      });
    });

    const confirmBtn = overlay.querySelector('#confirmCombine');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        if (!confirm('Both source plants will be removed. Continue?')) return;
        const freshState = loadState();
        const result = combinePlants(freshState, item.id, selectedIds[0], selectedIds[1]);
        if (result) {
          saveState(freshState);
          showItemToast(`Created Unique ${result.uniqueBase} ${result.species}!`);
          close();
          renderInventoryView(container);
          if (_onItemUsed) _onItemUsed();
        }
      });
    }
  }

  const close = () => overlay.remove();
  container.appendChild(overlay);
  renderPicker();
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
