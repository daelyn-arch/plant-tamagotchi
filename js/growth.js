// Daily visit processing, streak logic, plant completion

import { loadState, saveState, todayStr, isYesterday, daysBetween } from './state.js';
import { pickSpecies, RARITY } from './plant-data.js';
import { createRng } from './rng.js';

// Watering bonus values — applied when user waters, driven by streak
export const WATERING_BONUS_VALUES = {
  [RARITY.COMMON]: 0.25,
  [RARITY.UNCOMMON]: 0.5,
  [RARITY.RARE]: 0.5,
  [RARITY.EPIC]: 1,
  [RARITY.LEGENDARY]: 2,
};

// Day bonus values — applied on water days (Rare/Epic) or passively every day (Legendary)
export const DAY_BONUS_VALUES = {
  [RARITY.COMMON]: 0,
  [RARITY.UNCOMMON]: 0,
  [RARITY.RARE]: 0.5,
  [RARITY.EPIC]: 2,
  [RARITY.LEGENDARY]: 4,
};

// Watering bonus cap (floored) — sum of WATERING_BONUS_VALUES for all garden plants
export function wateringBonusCap(garden) {
  return Math.floor(wateringBonusCapRaw(garden));
}

export function wateringBonusCapRaw(garden) {
  let cap = 0;
  for (const plant of garden) {
    const mult = plant.upgradeMultiplier || 1;
    cap += (WATERING_BONUS_VALUES[plant.rarity] || 0) * mult;
  }
  return cap;
}

// Day bonus cap (floored) — sum of DAY_BONUS_VALUES for all garden plants
export function dayBonusCap(garden) {
  return Math.floor(dayBonusCapRaw(garden));
}

export function dayBonusCapRaw(garden) {
  let cap = 0;
  for (const plant of garden) {
    const mult = plant.upgradeMultiplier || 1;
    cap += (DAY_BONUS_VALUES[plant.rarity] || 0) * mult;
  }
  return cap;
}

// Legendary passive cap — sum of DAY_BONUS_VALUES for Legendary plants only (floored)
export function legendaryPassiveCap(garden) {
  let cap = 0;
  for (const plant of garden) {
    if (plant.rarity === RARITY.LEGENDARY) {
      const mult = plant.upgradeMultiplier || 1;
      cap += (DAY_BONUS_VALUES[plant.rarity] || 0) * mult;
    }
  }
  return Math.floor(cap);
}

// Backward compat aliases
export const RARITY_CAP_VALUES = WATERING_BONUS_VALUES;
export function gardenBonusCap(garden) { return wateringBonusCap(garden); }
export function gardenBonusCapRaw(garden) { return wateringBonusCapRaw(garden); }

// Calculate watering bonus: equals streak count, capped by watering bonus cap
export function streakBonus(streak, garden) {
  if (!garden || garden.length === 0) return 0;
  const cap = wateringBonusCap(garden);
  if (cap <= 0) return 0;
  return Math.min(streak, cap);
}

// Calculate day bonus for the current garden (floored, for watering days)
export function currentDayBonus(garden) {
  return dayBonusCap(garden);
}

// Generate a new plant
export function generateNewPlant(rng) {
  const species = pickSpecies(rng);
  const seed = rng.int(1, 2147483647);
  const totalDays = rng.int(species.minDays, species.maxDays);

  return {
    id: Date.now().toString(36) + seed.toString(36),
    seed,
    species: species.name,
    rarity: species.rarity,
    complexity: species.complexity,
    hasFlowers: species.hasFlowers,
    leafType: species.leafType,
    name: species.name,
    totalDaysRequired: totalDays,
    daysGrown: 0,
    growthStage: 0,
    daysVisited: [],
    dateReceived: todayStr(),
    autoWater: false,
  };
}

// Apply passive growth for missed days:
// - Legendary garden plants contribute passive day bonus every missed day
// - Auto-water gives full growth (1 + watering + day bonuses) every missed day
// Does NOT reset streak, does NOT add to daysVisited
export function applyPassiveGrowth(state) {
  if (!state.currentPlant || state.currentPlant.growthStage >= 1.0) return 0;
  if (!state.stats.lastVisitDate) return 0;

  const today = todayStr();
  const missed = daysBetween(state.stats.lastVisitDate, today) - 1; // days between last visit and today, exclusive
  if (missed <= 0) return 0;

  const passiveCap = legendaryPassiveCap(state.garden);
  const hasAutoWater = !!state.currentPlant.autoWater;

  if (passiveCap <= 0 && !hasAutoWater) return 0;

  let perDay;
  if (hasAutoWater) {
    // Auto-water gives full growth including all bonuses
    const wBonus = wateringBonusCap(state.garden);
    const dBonus = dayBonusCap(state.garden);
    perDay = 1 + wBonus + dBonus;
  } else {
    perDay = passiveCap;
  }

  if (perDay <= 0) return 0;

  const totalPassive = perDay * missed;
  state.currentPlant.daysGrown += totalPassive;

  if (state.currentPlant.daysGrown >= state.currentPlant.totalDaysRequired) {
    state.currentPlant.daysGrown = state.currentPlant.totalDaysRequired;
    state.currentPlant.growthStage = 1.0;
  } else {
    state.currentPlant.growthStage =
      state.currentPlant.daysGrown / state.currentPlant.totalDaysRequired;
  }

  return totalPassive;
}

// Process a daily visit ("water" action)
// Returns { state, result } where result describes what happened
export function processVisit() {
  const state = loadState();
  const today = todayStr();

  // Already visited today?
  if (state.stats.lastVisitDate === today) {
    return {
      state,
      result: {
        type: 'already_visited',
        message: 'You already watered today! Come back tomorrow.',
      },
    };
  }

  // No plant? Generate one
  if (!state.currentPlant) {
    const rng = createRng(Date.now());
    state.currentPlant = generateNewPlant(rng);
    saveState(state);
    return {
      state,
      result: {
        type: 'new_plant',
        message: `A new ${state.currentPlant.rarity} ${state.currentPlant.species} appeared!`,
        plant: state.currentPlant,
      },
    };
  }

  // Apply passive legendary growth for missed days before processing watering
  const passiveDays = applyPassiveGrowth(state);

  // Check if passive growth already completed the plant
  if (state.currentPlant.growthStage >= 1.0) {
    state.stats.lastVisitDate = today;
    state.stats.totalVisits++;
    state.stats.currentStreak = 1;
    saveState(state);
    return {
      state,
      result: {
        type: 'completed',
        message: `Your ${state.currentPlant.species} grew while you were away and is fully grown!`,
        plant: state.currentPlant,
        wateringBonus: 0,
        dayBonus: 0,
        passiveDays,
        streak: state.stats.currentStreak,
      },
    };
  }

  // Update streak
  if (state.stats.lastVisitDate === null || isYesterday(state.stats.lastVisitDate)) {
    state.stats.currentStreak++;
  } else if (state.stats.lastVisitDate !== today) {
    // Missed a day — reset streak
    state.stats.currentStreak = 1;
  }

  if (state.stats.currentStreak > state.stats.longestStreak) {
    state.stats.longestStreak = state.stats.currentStreak;
  }

  state.stats.lastVisitDate = today;
  state.stats.totalVisits++;

  // Apply growth — dual bonus system
  const wBonus = streakBonus(state.stats.currentStreak, state.garden);
  const dBonus = currentDayBonus(state.garden);

  // Calculate active boost contributions
  let boostWatering = 0;
  let boostDay = 0;
  if (state.activeBoosts) {
    for (const boost of state.activeBoosts) {
      if (boost.type === 'watering_boost') boostWatering += boost.value;
      if (boost.type === 'day_boost') boostDay += boost.value;
    }
  }

  const totalWatering = wBonus + boostWatering;
  const totalDay = dBonus + boostDay;
  const growthDays = 1 + totalWatering + totalDay;
  state.currentPlant.daysGrown += growthDays;
  state.currentPlant.daysVisited.push(today);

  // Clamp
  if (state.currentPlant.daysGrown > state.currentPlant.totalDaysRequired) {
    state.currentPlant.daysGrown = state.currentPlant.totalDaysRequired;
  }

  state.currentPlant.growthStage =
    state.currentPlant.daysGrown / state.currentPlant.totalDaysRequired;

  // Check completion
  if (state.currentPlant.growthStage >= 1.0) {
    state.currentPlant.growthStage = 1.0;
    saveState(state);
    return {
      state,
      result: {
        type: 'completed',
        message: `Your ${state.currentPlant.species} is fully grown!`,
        plant: state.currentPlant,
        wateringBonus: totalWatering,
        dayBonus: totalDay,
        passiveDays,
        streak: state.stats.currentStreak,
        growthDays,
      },
    };
  }

  saveState(state);

  const wCap = wateringBonusCap(state.garden);
  const totalBonus = totalWatering + totalDay;
  return {
    state,
    result: {
      type: 'watered',
      message: totalBonus > 0
        ? `Watered! +${growthDays} growth days (watering: +${totalWatering}, day: +${totalDay})`
        : wCap === 0
          ? 'Watered! +1 growth day (grow plants to unlock bonuses!)'
          : 'Watered! +1 growth day',
      wateringBonus: totalWatering,
      dayBonus: totalDay,
      passiveDays,
      streak: state.stats.currentStreak,
      growthDays,
    },
  };
}

// Move completed plant to garden and generate a new one
export function completePlant() {
  // Import lazily to avoid circular dependency
  let rollItemDrop;
  try {
    // Dynamic import not available synchronously, so we use a flag
    rollItemDrop = window.__rollItemDrop;
  } catch (e) {
    rollItemDrop = null;
  }

  const state = loadState();
  if (!state.currentPlant || state.currentPlant.growthStage < 1.0) {
    return { state, result: { type: 'error', message: 'No completed plant to move.' } };
  }

  const completedPlant = { ...state.currentPlant, dateCompleted: todayStr() };
  state.garden.push(completedPlant);
  state.stats.totalPlantsGrown++;

  // Roll for item drops
  let droppedItems = [];
  if (rollItemDrop) {
    const dropRng = createRng(Date.now() + state.stats.totalPlantsGrown);
    droppedItems = rollItemDrop(completedPlant.rarity, dropRng);
    if (!state.items) state.items = [];
    for (const item of droppedItems) {
      state.items.push(item);
    }
  }

  // Consume active boosts — decrement remaining uses
  if (state.activeBoosts && state.activeBoosts.length > 0) {
    state.activeBoosts = state.activeBoosts.filter(b => {
      b.remainingPlants--;
      return b.remainingPlants > 0;
    });
  }

  // Clear auto-water flag (consumed on completion)
  // Auto-water is tied to the plant, not carried over

  // Generate new plant
  const rng = createRng(Date.now() + state.stats.totalPlantsGrown + 1);
  state.currentPlant = generateNewPlant(rng);

  saveState(state);
  return {
    state,
    result: {
      type: 'moved_to_garden',
      message: `Plant added to garden! A new ${state.currentPlant.rarity} ${state.currentPlant.species} appeared!`,
      newPlant: state.currentPlant,
      completedPlant,
      droppedItems,
    },
  };
}

// Ensure there's a current plant
export function ensurePlant() {
  const state = loadState();
  if (!state.currentPlant) {
    const rng = createRng(Date.now());
    state.currentPlant = generateNewPlant(rng);
    saveState(state);
  }
  return loadState();
}

// DEV: advance days for testing
export function devAdvanceDays(numDays) {
  const state = loadState();
  if (!state.currentPlant) return state;

  for (let i = 0; i < numDays; i++) {
    state.stats.currentStreak++;
    if (state.stats.currentStreak > state.stats.longestStreak) {
      state.stats.longestStreak = state.stats.currentStreak;
    }
    state.stats.totalVisits++;

    const wBonus = streakBonus(state.stats.currentStreak, state.garden);
    const dBonus = currentDayBonus(state.garden);

    // Include active boosts
    let boostW = 0, boostD = 0;
    if (state.activeBoosts) {
      for (const b of state.activeBoosts) {
        if (b.type === 'watering_boost') boostW += b.value;
        if (b.type === 'day_boost') boostD += b.value;
      }
    }

    state.currentPlant.daysGrown += 1 + wBonus + boostW + dBonus + boostD;
    if (state.currentPlant.daysGrown >= state.currentPlant.totalDaysRequired) {
      state.currentPlant.daysGrown = state.currentPlant.totalDaysRequired;
      state.currentPlant.growthStage = 1.0;
      break;
    }
    state.currentPlant.growthStage =
      state.currentPlant.daysGrown / state.currentPlant.totalDaysRequired;
  }

  // Mark today as visited so UI can update
  state.stats.lastVisitDate = null; // allow watering again for dev
  saveState(state);
  return state;
}
