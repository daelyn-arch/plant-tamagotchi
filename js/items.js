// Item definitions, drop logic, and item utility functions

import { RARITY } from './plant-data.js';
import { WATERING_BONUS_VALUES, DAY_BONUS_VALUES } from './growth.js';

// Duration scaling: how many plants a consumable lasts based on item rarity
const DURATION_BY_RARITY = {
  [RARITY.COMMON]: 1,
  [RARITY.UNCOMMON]: 2,
  [RARITY.RARE]: 3,
  [RARITY.EPIC]: 5,
  [RARITY.LEGENDARY]: 8,
};

// Rarity gate for combining: max input rarity allowed
const COMBINE_RARITY_GATE = {
  [RARITY.COMMON]: RARITY.COMMON,
  [RARITY.UNCOMMON]: RARITY.UNCOMMON,
  [RARITY.RARE]: RARITY.RARE,
  [RARITY.EPIC]: RARITY.EPIC,
  [RARITY.LEGENDARY]: RARITY.LEGENDARY,
};

export const RARITY_ORDER = [RARITY.COMMON, RARITY.UNCOMMON, RARITY.RARE, RARITY.EPIC, RARITY.LEGENDARY];

function rarityIndex(r) {
  return RARITY_ORDER.indexOf(r);
}

// Item type definitions
export const ITEM_TYPES = {
  watering_boost: {
    name: 'Growth Surge',
    icon: '~',
    description: 'Boosts watering growth for your current plant.',
    getDescription(rarity) {
      const dur = DURATION_BY_RARITY[rarity];
      return `+2 watering bonus for ${dur} plant${dur > 1 ? 's' : ''}`;
    },
    value: 2,
  },
  day_boost: {
    name: 'Sun Stone',
    icon: '*',
    description: 'Boosts daily growth bonus for your current plant.',
    getDescription(rarity) {
      const dur = DURATION_BY_RARITY[rarity];
      return `+2 day bonus for ${dur} plant${dur > 1 ? 's' : ''}`;
    },
    value: 2,
  },
  auto_water: {
    name: 'Rain Charm',
    icon: '%',
    description: 'Auto-waters your plant on missed days with full bonuses. Consumed on plant completion.',
    getDescription() {
      return 'Auto-waters on missed days (full growth). Consumed when plant completes.';
    },
    value: 1,
  },
  art_reroll: {
    name: 'Prism Shard',
    icon: '#',
    description: 'Reroll a plant\'s visual seed to change its appearance.',
    getDescription() {
      return 'Changes a plant\'s appearance (keeps species/rarity).';
    },
    value: 1,
  },
  garden_upgrade: {
    name: 'Fertile Soil',
    icon: '+',
    description: 'Permanently increases a garden plant\'s bonus contribution by 50%.',
    getDescription() {
      return 'Upgrade a garden plant: +50% bonus contribution (permanent).';
    },
    value: 1.5,
  },
  plant_combine: {
    name: 'Fusion Seed',
    icon: '&',
    description: 'Combine two garden plants into a Unique plant.',
    getDescription(rarity) {
      return `Combine two plants (up to ${rarity} rarity) into a Unique plant.`;
    },
    value: 1,
  },
  animate: {
    name: 'Life Spark',
    icon: '@',
    description: 'Brings a plant to life with a charming face!',
    getDescription() {
      return 'Permanently gives a plant a cute face (cosmetic).';
    },
    value: 1,
  },
};

// Create an item instance
export function createItem(type, rarity) {
  const def = ITEM_TYPES[type];
  if (!def) return null;

  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    type,
    name: def.name,
    icon: def.icon,
    rarity,
    description: def.getDescription ? def.getDescription(rarity) : def.description,
    value: def.value,
    duration: DURATION_BY_RARITY[rarity],
    combineGate: type === 'plant_combine' ? COMBINE_RARITY_GATE[rarity] : undefined,
  };
}

// Item drop tables by plant rarity
const DROP_TABLES = {
  [RARITY.COMMON]: {
    chance: 0.10,
    secondChance: 0,
    maxItemRarity: 0, // Common only
    weights: { watering_boost: 30, day_boost: 10, art_reroll: 20, auto_water: 5, garden_upgrade: 3, plant_combine: 2, animate: 3 },
  },
  [RARITY.UNCOMMON]: {
    chance: 0.25,
    secondChance: 0,
    maxItemRarity: 1, // Up to Uncommon
    weights: { watering_boost: 25, day_boost: 15, art_reroll: 20, auto_water: 10, garden_upgrade: 5, plant_combine: 5, animate: 5 },
  },
  [RARITY.RARE]: {
    chance: 0.50,
    secondChance: 0,
    maxItemRarity: 2, // Up to Rare
    weights: { watering_boost: 20, day_boost: 20, art_reroll: 15, auto_water: 15, garden_upgrade: 10, plant_combine: 10, animate: 5 },
  },
  [RARITY.EPIC]: {
    chance: 0.75,
    secondChance: 0.25,
    maxItemRarity: 3, // Up to Epic
    weights: { watering_boost: 15, day_boost: 20, art_reroll: 10, auto_water: 15, garden_upgrade: 15, plant_combine: 15, animate: 5 },
  },
  [RARITY.LEGENDARY]: {
    chance: 1.0,
    secondChance: 0.50,
    maxItemRarity: 4, // Any rarity
    weights: { watering_boost: 10, day_boost: 15, art_reroll: 10, auto_water: 15, garden_upgrade: 20, plant_combine: 20, animate: 5 },
  },
};

// Pick a random item rarity up to maxIndex
function pickItemRarity(rng, maxIndex) {
  // Weight toward lower rarities
  const weights = [40, 25, 18, 12, 5];
  let total = 0;
  for (let i = 0; i <= maxIndex; i++) total += weights[i];
  let r = rng.random() * total;
  for (let i = 0; i <= maxIndex; i++) {
    r -= weights[i];
    if (r <= 0) return RARITY_ORDER[i];
  }
  return RARITY_ORDER[maxIndex];
}

// Pick a random item type from the weighted table
function pickItemType(rng, weights) {
  const types = Object.keys(weights);
  const total = types.reduce((s, t) => s + weights[t], 0);
  let r = rng.random() * total;
  for (const t of types) {
    r -= weights[t];
    if (r <= 0) return t;
  }
  return types[types.length - 1];
}

// Roll for item drops on plant completion
export function rollItemDrop(plantRarity, rng) {
  const table = DROP_TABLES[plantRarity];
  if (!table) return [];

  const items = [];

  // First drop
  if (rng.random() < table.chance) {
    const itemType = pickItemType(rng, table.weights);
    const itemRarity = pickItemRarity(rng, table.maxItemRarity);
    items.push(createItem(itemType, itemRarity));
  }

  // Second drop chance (Epic/Legendary)
  if (table.secondChance > 0 && rng.random() < table.secondChance) {
    const itemType = pickItemType(rng, table.weights);
    const itemRarity = pickItemRarity(rng, table.maxItemRarity);
    items.push(createItem(itemType, itemRarity));
  }

  return items;
}

// Remove an item from inventory by ID
export function removeItem(state, itemId) {
  if (!state.items) return;
  state.items = state.items.filter(i => i.id !== itemId);
}

// Use a boost item (watering_boost or day_boost) — adds to activeBoosts
export function useBoostItem(state, itemId) {
  const item = state.items.find(i => i.id === itemId);
  if (!item || (item.type !== 'watering_boost' && item.type !== 'day_boost')) return false;

  if (!state.activeBoosts) state.activeBoosts = [];
  state.activeBoosts.push({
    type: item.type,
    value: item.value,
    remainingPlants: item.duration,
    itemName: item.name,
    itemRarity: item.rarity,
  });

  removeItem(state, itemId);
  return true;
}

// Use auto-water item — sets flag on current plant
export function useAutoWater(state, itemId) {
  if (!state.currentPlant) return false;
  const item = state.items.find(i => i.id === itemId && i.type === 'auto_water');
  if (!item) return false;

  state.currentPlant.autoWater = true;
  removeItem(state, itemId);
  return true;
}

// Use animate item — gives a plant a face
export function useAnimate(state, itemId, plantId) {
  const item = state.items.find(i => i.id === itemId && i.type === 'animate');
  if (!item) return false;

  let target = null;
  if (state.currentPlant && state.currentPlant.id === plantId) {
    target = state.currentPlant;
  } else {
    target = state.garden.find(p => p.id === plantId);
  }
  if (!target) return false;
  if (target.animated) return false; // already animated

  target.animated = true;
  removeItem(state, itemId);
  return true;
}

// Use art reroll on a plant (current or garden)
export function useArtReroll(state, itemId, plantId) {
  const item = state.items.find(i => i.id === itemId && i.type === 'art_reroll');
  if (!item) return false;

  // Find plant (current or garden)
  let target = null;
  if (state.currentPlant && state.currentPlant.id === plantId) {
    target = state.currentPlant;
  } else {
    target = state.garden.find(p => p.id === plantId);
  }
  if (!target) return false;

  // Reroll seed — changes appearance
  target.seed = (Date.now() + Math.floor(Math.random() * 1000000)) & 0x7fffffff;
  removeItem(state, itemId);
  return true;
}

// Use garden upgrade on a garden plant — increases bonus contribution
export function useGardenUpgrade(state, itemId, plantId) {
  const item = state.items.find(i => i.id === itemId && i.type === 'garden_upgrade');
  if (!item) return false;

  const target = state.garden.find(p => p.id === plantId);
  if (!target) return false;

  target.upgradeMultiplier = (target.upgradeMultiplier || 1) * item.value;
  removeItem(state, itemId);
  return true;
}

// Combine two garden plants into a Unique plant
export function combinePlants(state, itemId, plantId1, plantId2) {
  const item = state.items.find(i => i.id === itemId && i.type === 'plant_combine');
  if (!item) return null;

  const p1 = state.garden.find(p => p.id === plantId1);
  const p2 = state.garden.find(p => p.id === plantId2);
  if (!p1 || !p2 || p1.id === p2.id) return null;

  // Check rarity gate
  const gateIdx = rarityIndex(item.combineGate || item.rarity);
  if (rarityIndex(p1.rarity) > gateIdx || rarityIndex(p2.rarity) > gateIdx) return null;

  // Base rarity = highest of the two source plants
  const baseRarity = rarityIndex(p1.rarity) >= rarityIndex(p2.rarity) ? p1.rarity : p2.rarity;

  // Pick species from the higher rarity tier
  const higherPlant = rarityIndex(p1.rarity) >= rarityIndex(p2.rarity) ? p1 : p2;

  // Combine bonuses from both source plants
  const getW = p => (p.bonusWatering != null ? p.bonusWatering : (WATERING_BONUS_VALUES[p.rarity] || 0)) * (p.upgradeMultiplier || 1);
  const getD = p => (p.bonusDay != null ? p.bonusDay : (DAY_BONUS_VALUES[p.rarity] || 0)) * (p.upgradeMultiplier || 1);
  const combinedWatering = getW(p1) + getW(p2);
  const combinedDay = getD(p1) + getD(p2);
  const hasPassive = p1.rarity === RARITY.LEGENDARY || p2.rarity === RARITY.LEGENDARY || p1.bonusPassive || p2.bonusPassive;

  // Derive hybrid seed from both parents — deterministic combination
  const newSeed = ((p1.seed * 2654435761) ^ (p2.seed * 1597334677) ^ (Date.now() & 0xffff)) & 0x7fffffff;

  // Store fusion parent traits for hybrid rendering
  const fusionParents = [
    { species: p1.species, rarity: p1.rarity, leafType: p1.leafType, hasFlowers: p1.hasFlowers, complexity: p1.complexity, seed: p1.seed, wasUnique: !!p1.unique },
    { species: p2.species, rarity: p2.rarity, leafType: p2.leafType, hasFlowers: p2.hasFlowers, complexity: p2.complexity, seed: p2.seed, wasUnique: !!p2.unique },
  ];

  // Generate unique plant
  const uniquePlant = {
    id: Date.now().toString(36) + newSeed.toString(36),
    seed: newSeed,
    species: higherPlant.species,
    rarity: baseRarity,
    complexity: Math.max(p1.complexity || 2, p2.complexity || 2),
    hasFlowers: p1.hasFlowers || p2.hasFlowers,
    leafType: higherPlant.leafType,
    name: higherPlant.species,
    totalDaysRequired: higherPlant.totalDaysRequired,
    daysGrown: higherPlant.totalDaysRequired,
    growthStage: 1.0,
    daysVisited: [],
    dateReceived: p1.dateReceived,
    dateCompleted: new Date().toISOString().slice(0, 10),
    unique: true,
    uniqueBase: baseRarity,
    fusionParents,
    bonusWatering: combinedWatering,
    bonusDay: combinedDay,
    bonusPassive: hasPassive,
    animated: !!(p1.animated || p2.animated),
    autoWater: false,
  };

  // Remove source plants
  state.garden = state.garden.filter(p => p.id !== plantId1 && p.id !== plantId2);

  // Add unique plant
  state.garden.push(uniquePlant);

  // Consume item
  removeItem(state, itemId);

  return uniquePlant;
}

// Register rollItemDrop globally so growth.js can access it without circular imports
window.__rollItemDrop = rollItemDrop;
