// Species definitions, rarity tiers, trait tables

export const RARITY = {
  COMMON: 'Common',
  UNCOMMON: 'Uncommon',
  RARE: 'Rare',
  EPIC: 'Epic',
  LEGENDARY: 'Legendary',
};

export const RARITY_COLORS = {
  [RARITY.COMMON]: '#6b7b3a',
  [RARITY.UNCOMMON]: '#2d8a4e',
  [RARITY.RARE]: '#2d6fba',
  [RARITY.EPIC]: '#7b3fa0',
  [RARITY.LEGENDARY]: '#c49a1a',
};

export const UNIQUE_COLOR = '#c0c8d4';

export const RARITY_ORDER = [RARITY.COMMON, RARITY.UNCOMMON, RARITY.RARE, RARITY.EPIC, RARITY.LEGENDARY];

export const SPECIES = [
  // Common — 3-7 days, complexity 2
  {
    name: 'Daisy',
    rarity: RARITY.COMMON,
    minDays: 4,
    maxDays: 6,
    complexity: 2,
    weight: 30,
    hasFlowers: true,
    leafType: 'round',
  },
  {
    name: 'Tulip',
    rarity: RARITY.COMMON,
    minDays: 5,
    maxDays: 7,
    complexity: 2,
    weight: 28,
    hasFlowers: true,
    leafType: 'pointed',
  },

  // Uncommon — 7-14 days, complexity 3
  {
    name: 'Fern',
    rarity: RARITY.UNCOMMON,
    minDays: 7,
    maxDays: 12,
    complexity: 3,
    weight: 12,
    hasFlowers: false,
    leafType: 'fern',
  },
  {
    name: 'Succulent',
    rarity: RARITY.UNCOMMON,
    minDays: 8,
    maxDays: 14,
    complexity: 3,
    weight: 10,
    hasFlowers: false,
    leafType: 'round',
  },
  {
    name: 'Violet',
    rarity: RARITY.UNCOMMON,
    minDays: 7,
    maxDays: 11,
    complexity: 3,
    weight: 11,
    hasFlowers: true,
    leafType: 'round',
  },

  // Rare — 14-28 days, complexity 4
  {
    name: 'Bonsai',
    rarity: RARITY.RARE,
    minDays: 18,
    maxDays: 28,
    complexity: 4,
    weight: 5,
    hasFlowers: false,
    leafType: 'tiny',
  },
  {
    name: 'Orchid',
    rarity: RARITY.RARE,
    minDays: 14,
    maxDays: 24,
    complexity: 4,
    weight: 4,
    hasFlowers: true,
    leafType: 'long',
  },

  // Epic — 28-50 days, complexity 5
  {
    name: 'Cactus Rose',
    rarity: RARITY.EPIC,
    minDays: 28,
    maxDays: 42,
    complexity: 5,
    weight: 2,
    hasFlowers: true,
    leafType: 'pointed',
  },
  {
    name: 'Moon Lily',
    rarity: RARITY.EPIC,
    minDays: 35,
    maxDays: 50,
    complexity: 5,
    weight: 1.5,
    hasFlowers: true,
    leafType: 'long',
  },

  // Legendary — 50-90 days, complexity 5
  {
    name: 'Crystal Tree',
    rarity: RARITY.LEGENDARY,
    minDays: 50,
    maxDays: 90,
    complexity: 5,
    weight: 0.5,
    hasFlowers: true,
    leafType: 'tiny',
  },
];

// Canvas size by rarity
export function getCanvasSize(rarity) {
  switch (rarity) {
    case RARITY.COMMON:
    case RARITY.UNCOMMON:
      return 32;
    case RARITY.RARE:
    case RARITY.EPIC:
      return 48;
    case RARITY.LEGENDARY:
      return 64;
    default:
      return 32;
  }
}

// Pick a species using weighted random
export function pickSpecies(rng) {
  const items = SPECIES.map((s) => ({ value: s, weight: s.weight }));
  return rng.weighted(items);
}

// Leaf templates — larger, more detailed pixel shapes
// Each template is an array of [dx, dy] offsets
export const LEAF_TEMPLATES = {
  round: [
    // 5-wide rounded leaf with interior shading
    [0, -2],
    [-1, -1], [0, -1], [1, -1],
    [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0],
    [-1, 1], [0, 1], [1, 1],
    [0, 2],
  ],
  pointed: [
    // long pointed leaf with spine
    [0, -3], [0, -2],
    [-1, -1], [0, -1], [1, -1],
    [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0],
    [-1, 1], [0, 1], [1, 1],
    [0, 2], [0, 3],
  ],
  long: [
    // graceful drooping leaf
    [0, 0], [1, 0],
    [2, 0], [2, 1],
    [3, 1], [3, 2],
    [4, 2], [4, 3],
    [5, 3],
    // width
    [1, -1], [2, -1], [3, 0], [4, 1],
  ],
  fern: [
    // fern frond with alternating leaflets
    [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0],
    // leaflets left
    [1, -1], [1, -2],
    [3, -1], [3, -2],
    [5, -1],
    // leaflets right
    [2, 1], [2, 2],
    [4, 1], [4, 2],
    [6, 1],
  ],
  tiny: [
    // small cluster leaf for bonsai / crystal tree
    [-1, -1], [0, -1], [1, -1],
    [-1, 0], [0, 0], [1, 0],
    [0, 1],
  ],
};

// Flower templates — bigger, more petal detail
export const FLOWER_TEMPLATES = {
  simple: [
    {
      petals: [
        [0, -2], [-1, -1], [1, -1],
        [-2, 0], [2, 0],
        [-1, 1], [1, 1], [0, 2],
      ],
      center: [[0, -1], [0, 0], [0, 1], [-1, 0], [1, 0]],
    },
  ],
  daisy: [
    {
      petals: [
        // top
        [0, -3], [-1, -3], [1, -3], [0, -2],
        // sides
        [-3, 0], [-3, -1], [-3, 1], [-2, 0],
        [3, 0], [3, -1], [3, 1], [2, 0],
        // bottom
        [0, 3], [-1, 3], [1, 3], [0, 2],
        // diags
        [-2, -2], [2, -2], [-2, 2], [2, 2],
      ],
      center: [[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]],
    },
  ],
  tulip: [
    {
      petals: [
        [-1, -3], [0, -3], [1, -3],
        [-2, -2], [-1, -2], [0, -2], [1, -2], [2, -2],
        [-2, -1], [-1, -1], [0, -1], [1, -1], [2, -1],
        [-1, 0], [0, 0], [1, 0],
      ],
      center: [[-1, -2], [0, -2], [1, -2]],
    },
  ],
  star: [
    {
      petals: [
        [0, -3], [0, -2],
        [-2, -2], [2, -2],
        [-3, 0], [-2, 0], [2, 0], [3, 0],
        [-2, 2], [2, 2],
        [0, 2], [0, 3],
        [-1, -1], [1, -1], [-1, 1], [1, 1],
      ],
      center: [[-1, 0], [0, 0], [1, 0], [0, -1], [0, 1]],
    },
  ],
};
