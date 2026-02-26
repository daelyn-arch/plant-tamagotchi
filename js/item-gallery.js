// Item gallery — shows all item types, click for rarity-specific descriptions

import { RARITY_COLORS } from './plant-data.js';
import { ITEM_TYPES, RARITY_ORDER } from './items.js';

let _onBack = null;
export function setOnItemGalleryBack(cb) { _onBack = cb; }

export function renderItemGallery(container) {
  container.innerHTML = '';

  // Header
  const header = document.createElement('div');
  header.className = 'garden-header';
  header.innerHTML = `
    <h2>Item Gallery</h2>
    <button class="btn btn-back" id="itemGalleryBackBtn">Back to Plant</button>
  `;
  container.appendChild(header);

  header.querySelector('#itemGalleryBackBtn').addEventListener('click', () => {
    if (_onBack) _onBack();
  });

  // Intro
  const intro = document.createElement('p');
  intro.className = 'gallery-intro';
  intro.textContent = 'All item types and what they do at each rarity.';
  container.appendChild(intro);

  // Item grid
  const grid = document.createElement('div');
  grid.className = 'item-gallery-grid';

  const types = Object.keys(ITEM_TYPES);
  for (const type of types) {
    const def = ITEM_TYPES[type];
    const card = document.createElement('div');
    card.className = 'item-gallery-card';

    card.innerHTML = `
      <div class="item-gallery-icon">${def.icon}</div>
      <div class="item-gallery-name">${def.name}</div>
      <div class="item-gallery-desc">${def.description}</div>
    `;

    card.addEventListener('click', () => showItemRarityDetail(container, type, def));
    grid.appendChild(card);
  }

  container.appendChild(grid);
}

function showItemRarityDetail(container, type, def) {
  const overlay = document.createElement('div');
  overlay.className = 'detail-overlay';

  let rarityRows = '';
  for (const rarity of RARITY_ORDER) {
    const color = RARITY_COLORS[rarity];
    const desc = def.getDescription ? def.getDescription(rarity) : def.description;
    rarityRows += `
      <div class="ig-rarity-row" style="border-left: 3px solid ${color}">
        <span class="ig-rarity-label" style="color:${color}">${rarity}</span>
        <span class="ig-rarity-desc">${desc}</span>
      </div>
    `;
  }

  overlay.innerHTML = `
    <div class="detail-card ig-detail-card">
      <div class="item-detail-icon">${def.icon}</div>
      <h3>${def.name}</h3>
      <p class="ig-base-desc">${def.description}</p>
      <div class="ig-rarity-list">
        ${rarityRows}
      </div>
      <button class="btn btn-close-detail">Close</button>
    </div>
  `;

  container.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector('.btn-close-detail').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
}
