// Item gallery — shows all item types, click for rarity-specific descriptions

import { RARITY_COLORS, RARITY } from './plant-data.js';
import { ITEM_TYPES, RARITY_ORDER } from './items.js';
import { renderItemIcon } from './item-renderer.js';

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

    const iconWrap = document.createElement('div');
    iconWrap.className = 'item-gallery-icon';
    iconWrap.appendChild(renderItemIcon(type, RARITY.RARE, 5));

    const nameEl = document.createElement('div');
    nameEl.className = 'item-gallery-name';
    nameEl.textContent = def.name;

    const descEl = document.createElement('div');
    descEl.className = 'item-gallery-desc';
    descEl.textContent = def.description;

    card.appendChild(iconWrap);
    card.appendChild(nameEl);
    card.appendChild(descEl);

    card.addEventListener('click', () => showItemRarityDetail(container, type, def));
    grid.appendChild(card);
  }

  container.appendChild(grid);
}

function showItemRarityDetail(container, type, def) {
  const overlay = document.createElement('div');
  overlay.className = 'detail-overlay';

  const card = document.createElement('div');
  card.className = 'detail-card ig-detail-card';

  const iconWrap = document.createElement('div');
  iconWrap.className = 'item-detail-icon';
  iconWrap.appendChild(renderItemIcon(type, RARITY.LEGENDARY, 6));
  card.appendChild(iconWrap);

  const title = document.createElement('h3');
  title.textContent = def.name;
  card.appendChild(title);

  const baseDesc = document.createElement('p');
  baseDesc.className = 'ig-base-desc';
  baseDesc.textContent = def.description;
  card.appendChild(baseDesc);

  const rarityList = document.createElement('div');
  rarityList.className = 'ig-rarity-list';

  for (const rarity of RARITY_ORDER) {
    const color = RARITY_COLORS[rarity];
    const desc = def.getDescription ? def.getDescription(rarity) : def.description;

    const row = document.createElement('div');
    row.className = 'ig-rarity-row';
    row.style.borderLeft = `3px solid ${color}`;

    const iconCell = document.createElement('div');
    iconCell.className = 'ig-rarity-icon';
    iconCell.appendChild(renderItemIcon(type, rarity, 3));

    const label = document.createElement('span');
    label.className = 'ig-rarity-label';
    label.style.color = color;
    label.textContent = rarity;

    const descEl = document.createElement('span');
    descEl.className = 'ig-rarity-desc';
    descEl.textContent = desc;

    row.appendChild(iconCell);
    row.appendChild(label);
    row.appendChild(descEl);
    rarityList.appendChild(row);
  }

  card.appendChild(rarityList);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn btn-close-detail';
  closeBtn.textContent = 'Close';
  card.appendChild(closeBtn);

  overlay.appendChild(card);
  container.appendChild(overlay);

  const close = () => overlay.remove();
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
}
