// Info panel — shows all game probabilities and mechanics in one place

import { SPECIES, RARITY } from './plant-data.js';
import { WATERING_BONUS_VALUES, DAY_BONUS_VALUES } from './growth.js';
import { ITEM_TYPES, RARITY_ORDER } from './items.js';

const DROP_TABLES = {
  [RARITY.COMMON]:    { chance: '10%', second: '0%',  maxRarity: 'Common',    weights: { watering_boost: 30, day_boost: 10, art_reroll: 20, auto_water: 5, garden_upgrade: 3, plant_combine: 2, animate: 3 } },
  [RARITY.UNCOMMON]:  { chance: '25%', second: '0%',  maxRarity: 'Uncommon',  weights: { watering_boost: 25, day_boost: 15, art_reroll: 20, auto_water: 10, garden_upgrade: 5, plant_combine: 5, animate: 5 } },
  [RARITY.RARE]:      { chance: '50%', second: '0%',  maxRarity: 'Rare',      weights: { watering_boost: 20, day_boost: 20, art_reroll: 15, auto_water: 15, garden_upgrade: 10, plant_combine: 10, animate: 5 } },
  [RARITY.EPIC]:      { chance: '75%', second: '25%', maxRarity: 'Epic',      weights: { watering_boost: 15, day_boost: 20, art_reroll: 10, auto_water: 15, garden_upgrade: 15, plant_combine: 15, animate: 5 } },
  [RARITY.LEGENDARY]: { chance: '100%', second: '50%', maxRarity: 'Legendary', weights: { watering_boost: 10, day_boost: 15, art_reroll: 10, auto_water: 15, garden_upgrade: 20, plant_combine: 20, animate: 5 } },
};

const ITEM_RARITY_WEIGHTS = [
  { rarity: 'Common', weight: 40 },
  { rarity: 'Uncommon', weight: 25 },
  { rarity: 'Rare', weight: 18 },
  { rarity: 'Epic', weight: 12 },
  { rarity: 'Legendary', weight: 5 },
];

const DURATION_BY_RARITY = {
  Common: 1, Uncommon: 2, Rare: 3, Epic: 5, Legendary: 8,
};

function pct(w, total) {
  return (w / total * 100).toFixed(1) + '%';
}

function makeSection(title, content) {
  return `<div class="info-section"><h3>${title}</h3>${content}</div>`;
}

function buildHTML() {
  let html = '';

  // ─── Species ───
  const totalWeight = SPECIES.reduce((s, sp) => s + sp.weight, 0);
  let speciesRows = SPECIES.map(sp => {
    const p = pct(sp.weight, totalWeight);
    return `<tr>
      <td>${sp.name}</td>
      <td class="rarity-${sp.rarity.toLowerCase()}">${sp.rarity}</td>
      <td>${sp.minDays}–${sp.maxDays}</td>
      <td>${sp.hasFlowers ? 'Yes' : 'No'}</td>
      <td>${sp.weight}</td>
      <td>${p}</td>
    </tr>`;
  }).join('');

  html += makeSection('Species Spawn Rates',
    `<p class="info-note">When a new plant is generated, species is picked by weighted random. Total weight: ${totalWeight}</p>
    <table>
      <tr><th>Species</th><th>Rarity</th><th>Days</th><th>Flowers</th><th>Weight</th><th>Chance</th></tr>
      ${speciesRows}
    </table>`
  );

  // ─── Garden Bonus Values ───
  let bonusRows = RARITY_ORDER.map(r => `<tr>
    <td class="rarity-${r.toLowerCase()}">${r}</td>
    <td>${WATERING_BONUS_VALUES[r]}</td>
    <td>${DAY_BONUS_VALUES[r]}</td>
  </tr>`).join('');

  html += makeSection('Garden Bonus Values (per plant)',
    `<p class="info-note">Each completed garden plant contributes to your bonus caps. <b>Watering Bonus</b> = min(streak, cap). <b>Day Bonus</b> = added on every water day. <b>Legendary Passive</b> = Day Bonus from Legendary plants applies every missed day too.</p>
    <table>
      <tr><th>Plant Rarity</th><th>Watering Bonus</th><th>Day Bonus</th></tr>
      ${bonusRows}
    </table>
    <p class="info-note">Fertile Soil upgrade multiplies a plant's contribution by 1.5x (stacks multiplicatively).</p>`
  );

  // ─── Growth Formula ───
  html += makeSection('Growth Formula',
    `<p class="info-note">Each day you water:</p>
    <div class="info-formula">growth = 1 + wateringBonus + dayBonus + boostWatering + boostDay</div>
    <ul>
      <li><b>wateringBonus</b> = min(currentStreak, floor(sum of garden watering values))</li>
      <li><b>dayBonus</b> = floor(sum of garden day values) — Rare+ plants contribute</li>
      <li><b>boostWatering / boostDay</b> = +2 each from active Growth Surge / Sun Stone items</li>
      <li><b>Passive growth</b> (missed days): Legendary plants contribute their Day Bonus per missed day</li>
      <li><b>Auto-water</b> (Rain Charm): missed days get full formula (1 + all bonuses)</li>
    </ul>
    <p class="info-note">Streak resets to 1 if you miss a day. Streak increments if you water on consecutive days.</p>`
  );

  // ─── Item Drop Rates ───
  let dropRows = RARITY_ORDER.map(r => {
    const t = DROP_TABLES[r];
    const totalW = Object.values(t.weights).reduce((s, v) => s + v, 0);
    const itemCols = Object.keys(t.weights).map(type => {
      return `<td>${pct(t.weights[type], totalW)}</td>`;
    }).join('');
    return `<tr>
      <td class="rarity-${r.toLowerCase()}">${r}</td>
      <td>${t.chance}</td>
      <td>${t.second}</td>
      <td>${t.maxRarity}</td>
      ${itemCols}
    </tr>`;
  }).join('');

  const itemHeaders = Object.keys(ITEM_TYPES).map(type => {
    const abbr = ITEM_TYPES[type].name.split(' ').map(w => w[0]).join('');
    return `<th title="${ITEM_TYPES[type].name}">${abbr}</th>`;
  }).join('');

  html += makeSection('Item Drop Tables',
    `<p class="info-note">Items drop when a plant is completed. Drop chance, second drop chance, max item rarity, and type weights depend on the <b>completed plant's rarity</b>.</p>
    <table class="info-table-wide">
      <tr><th>Plant Rarity</th><th>Drop%</th><th>2nd Drop%</th><th>Max Item Rarity</th>${itemHeaders}</tr>
      ${dropRows}
    </table>
    <p class="info-note">Item type legend: GS=Growth Surge, SS=Sun Stone, RC=Rain Charm, PS=Prism Shard, FS=Fertile Soil, FS₂=Fusion Seed, LS=Life Spark</p>`
  );

  // ─── Item Rarity Weights ───
  let irRows = ITEM_RARITY_WEIGHTS.map(r => {
    const total = ITEM_RARITY_WEIGHTS.reduce((s, x) => s + x.weight, 0);
    return `<tr>
      <td class="rarity-${r.rarity.toLowerCase()}">${r.rarity}</td>
      <td>${r.weight}</td>
      <td>${pct(r.weight, total)}</td>
    </tr>`;
  }).join('');

  html += makeSection('Item Rarity Weights',
    `<p class="info-note">When an item drops, its rarity is rolled from this table (capped by the plant's max item rarity).</p>
    <table>
      <tr><th>Item Rarity</th><th>Weight</th><th>% (if all available)</th></tr>
      ${irRows}
    </table>`
  );

  // ─── Item Duration ───
  let durRows = RARITY_ORDER.map(r => `<tr>
    <td class="rarity-${r.toLowerCase()}">${r}</td>
    <td>${DURATION_BY_RARITY[r]} plant${DURATION_BY_RARITY[r] > 1 ? 's' : ''}</td>
  </tr>`).join('');

  html += makeSection('Item Duration (Boost Items)',
    `<p class="info-note">Growth Surge and Sun Stone last for N plant completions based on the <b>item's rarity</b>.</p>
    <table>
      <tr><th>Item Rarity</th><th>Duration</th></tr>
      ${durRows}
    </table>`
  );

  // ─── Item Effects ───
  let itemEffectRows = Object.entries(ITEM_TYPES).map(([type, def]) => {
    return `<tr>
      <td><span class="info-item-icon">${def.icon}</span> ${def.name}</td>
      <td>${def.description}</td>
    </tr>`;
  }).join('');

  html += makeSection('Item Effects',
    `<table>
      <tr><th>Item</th><th>Effect</th></tr>
      ${itemEffectRows}
    </table>`
  );

  // ─── Combine / Unique Plants ───
  html += makeSection('Plant Combining (Fusion Seed)',
    `<ul>
      <li>Consumes 2 garden plants → creates 1 Unique plant</li>
      <li>Unique plant inherits the species of the higher-rarity input</li>
      <li>Unique plant's rarity = highest of the two inputs</li>
      <li><b>Bonuses are combined</b> — the Unique plant's watering and day bonus equal the sum of both source plants' contributions (including any upgrades)</li>
      <li>If either source is Legendary (or has passive), the Unique plant inherits passive growth</li>
      <li>Fusion Seed rarity gates the max input rarity (e.g. Common Fusion Seed can only combine Common plants)</li>
      <li>Unique plants have a silver color tint and "Unique" badge</li>
    </ul>`
  );

  // ─── Canvas Size ───
  html += makeSection('Canvas Size by Rarity',
    `<table>
      <tr><th>Rarity</th><th>Pixel Size</th></tr>
      <tr><td>Common / Uncommon</td><td>32×32</td></tr>
      <tr><td>Rare / Epic</td><td>48×48</td></tr>
      <tr><td>Legendary</td><td>64×64</td></tr>
    </table>`
  );

  return html;
}

let onInfoBack = null;
export function setOnInfoBack(cb) { onInfoBack = cb; }

export function renderInfoPanel(container) {
  container.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'info-header';
  header.innerHTML = `<h2>Game Info</h2>`;

  const backBtn = document.createElement('button');
  backBtn.className = 'btn';
  backBtn.textContent = 'Back to Plant';
  backBtn.addEventListener('click', () => { if (onInfoBack) onInfoBack(); });
  header.querySelector('h2').after(backBtn);

  const body = document.createElement('div');
  body.className = 'info-body';
  body.innerHTML = buildHTML();

  container.appendChild(header);
  container.appendChild(body);
}
