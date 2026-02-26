// Game state — localStorage I/O

const STORAGE_KEY = 'plant_tamagotchi_state';

function defaultState() {
  return {
    currentPlant: null,
    garden: [],
    items: [],
    activeBoosts: [],
    stats: {
      totalPlantsGrown: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastVisitDate: null,
      totalVisits: 0,
    },
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Merge with defaults to handle missing fields on upgrade
      const state = defaultState();
      if (parsed.currentPlant) state.currentPlant = parsed.currentPlant;
      if (parsed.garden) state.garden = parsed.garden;
      if (parsed.items) state.items = parsed.items;
      if (parsed.activeBoosts) state.activeBoosts = parsed.activeBoosts;
      if (parsed.stats) state.stats = { ...state.stats, ...parsed.stats };
      return state;
    }
  } catch (e) {
    console.warn('Failed to load state, resetting:', e);
  }
  return defaultState();
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save state:', e);
  }
}

export function resetState() {
  localStorage.removeItem(STORAGE_KEY);
  return defaultState();
}

// Get today as YYYY-MM-DD
export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Check if a date string is yesterday
export function isYesterday(dateStr) {
  if (!dateStr) return false;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
  return dateStr === yStr;
}

// Count days between two YYYY-MM-DD date strings (absolute value)
export function daysBetween(dateStr1, dateStr2) {
  if (!dateStr1 || !dateStr2) return 0;
  const d1 = new Date(dateStr1 + 'T00:00:00');
  const d2 = new Date(dateStr2 + 'T00:00:00');
  const diff = Math.abs(d2 - d1);
  return Math.round(diff / (1000 * 60 * 60 * 24));
}
