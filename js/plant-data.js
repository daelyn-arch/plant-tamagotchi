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
  // ── Common — 2-4 days, complexity 2 ──
  {
    name: 'Daisy',
    rarity: RARITY.COMMON,
    minDays: 2,
    maxDays: 3,
    complexity: 2,
    weight: 30,
    hasFlowers: true,
    leafType: 'spatula',
    flowerTemplate: 'daisy',
  },
  {
    name: 'Tulip',
    rarity: RARITY.COMMON,
    minDays: 3,
    maxDays: 4,
    complexity: 2,
    weight: 28,
    hasFlowers: true,
    leafType: 'lance',
    flowerTemplate: 'tulip',
  },
  {
    name: 'Marigold',
    rarity: RARITY.COMMON,
    minDays: 2,
    maxDays: 3,
    complexity: 2,
    weight: 26,
    hasFlowers: true,
    leafType: 'round',
    flowerTemplate: 'daisy',
  },
  {
    name: 'Lavender',
    rarity: RARITY.COMMON,
    minDays: 2,
    maxDays: 4,
    complexity: 2,
    weight: 24,
    hasFlowers: true,
    leafType: 'pointed',
  },
  {
    name: 'Clover Patch',
    rarity: RARITY.COMMON,
    minDays: 2,
    maxDays: 3,
    complexity: 2,
    weight: 22,
    hasFlowers: false,
    leafType: 'clover',
  },

  // ── Uncommon — 4-7 days, complexity 3 ──
  {
    name: 'Fern',
    rarity: RARITY.UNCOMMON,
    minDays: 4,
    maxDays: 6,
    complexity: 3,
    weight: 12,
    hasFlowers: false,
    leafType: 'pinnae',
  },
  {
    name: 'Succulent',
    rarity: RARITY.UNCOMMON,
    minDays: 4,
    maxDays: 7,
    complexity: 3,
    weight: 10,
    hasFlowers: false,
    leafType: 'round',
  },
  {
    name: 'Violet',
    rarity: RARITY.UNCOMMON,
    minDays: 4,
    maxDays: 6,
    complexity: 3,
    weight: 11,
    hasFlowers: true,
    leafType: 'heart',
    flowerTemplate: 'simple',
  },
  {
    name: 'Snapdragon',
    rarity: RARITY.UNCOMMON,
    minDays: 5,
    maxDays: 7,
    complexity: 3,
    weight: 9,
    hasFlowers: true,
    leafType: 'lance',
    flowerTemplate: 'star',
  },
  {
    name: 'Pitcher Plant',
    rarity: RARITY.UNCOMMON,
    minDays: 5,
    maxDays: 7,
    complexity: 3,
    weight: 8,
    hasFlowers: false,
    leafType: 'long',
  },

  // ── Rare — 7-14 days, complexity 4 ──
  {
    name: 'Bonsai',
    rarity: RARITY.RARE,
    minDays: 9,
    maxDays: 14,
    complexity: 4,
    weight: 5,
    hasFlowers: false,
    leafType: 'tiny',
  },
  {
    name: 'Orchid',
    rarity: RARITY.RARE,
    minDays: 7,
    maxDays: 12,
    complexity: 4,
    weight: 4,
    hasFlowers: true,
    leafType: 'strap',
    flowerTemplate: 'simple',
  },
  {
    name: 'Black Dahlia',
    rarity: RARITY.RARE,
    minDays: 8,
    maxDays: 13,
    complexity: 4,
    weight: 4,
    hasFlowers: true,
    leafType: 'pointed',
  },
  {
    name: 'Glowing Nightshade',
    rarity: RARITY.RARE,
    minDays: 9,
    maxDays: 14,
    complexity: 4,
    weight: 3,
    hasFlowers: false,
    leafType: 'pointed',
  },
  {
    name: 'Blue Fire Poppy',
    rarity: RARITY.RARE,
    minDays: 7,
    maxDays: 12,
    complexity: 4,
    weight: 3,
    hasFlowers: true,
    leafType: 'round',
  },

  // ── Epic — 14-25 days, complexity 5 ──
  {
    name: 'Cactus Rose',
    rarity: RARITY.EPIC,
    minDays: 14,
    maxDays: 21,
    complexity: 5,
    weight: 2,
    hasFlowers: true,
    leafType: 'pointed',
  },
  {
    name: 'Moon Lily',
    rarity: RARITY.EPIC,
    minDays: 18,
    maxDays: 25,
    complexity: 5,
    weight: 1.5,
    hasFlowers: true,
    leafType: 'long',
  },
  {
    name: 'Stormvine',
    rarity: RARITY.EPIC,
    minDays: 16,
    maxDays: 23,
    complexity: 5,
    weight: 1.5,
    hasFlowers: false,
    leafType: 'fern',
  },
  {
    name: 'Golden Lotus',
    rarity: RARITY.EPIC,
    minDays: 15,
    maxDays: 22,
    complexity: 5,
    weight: 1.5,
    hasFlowers: true,
    leafType: 'round',
  },
  {
    name: 'Emberthorn Blossom',
    rarity: RARITY.EPIC,
    minDays: 17,
    maxDays: 24,
    complexity: 5,
    weight: 1.5,
    hasFlowers: true,
    leafType: 'pointed',
  },

  // ── Legendary — 25-45 days, complexity 5 ──
  {
    name: 'Crystal Tree',
    rarity: RARITY.LEGENDARY,
    minDays: 25,
    maxDays: 45,
    complexity: 5,
    weight: 0.5,
    hasFlowers: true,
    leafType: 'tiny',
  },
  {
    name: 'Starfall Magnolia',
    rarity: RARITY.LEGENDARY,
    minDays: 30,
    maxDays: 45,
    complexity: 5,
    weight: 0.4,
    hasFlowers: true,
    leafType: 'round',
  },
  {
    name: 'Celestia Bloom',
    rarity: RARITY.LEGENDARY,
    minDays: 28,
    maxDays: 42,
    complexity: 5,
    weight: 0.4,
    hasFlowers: true,
    leafType: 'round',
  },
  {
    name: 'Dragonroot Arbor',
    rarity: RARITY.LEGENDARY,
    minDays: 32,
    maxDays: 45,
    complexity: 5,
    weight: 0.3,
    hasFlowers: false,
    leafType: 'fern',
  },
  {
    name: 'Prismheart Tree',
    rarity: RARITY.LEGENDARY,
    minDays: 30,
    maxDays: 45,
    complexity: 5,
    weight: 0.4,
    hasFlowers: true,
    leafType: 'tiny',
  },
];

// Canvas size by rarity
export function getCanvasSize(rarity) {
  switch (rarity) {
    case RARITY.COMMON:
    case RARITY.UNCOMMON:
      return 40;
    case RARITY.RARE:
    case RARITY.EPIC:
      return 56;
    case RARITY.LEGENDARY:
      return 112;
    default:
      return 40;
  }
}

// Pick a wild species — only Common and Uncommon appear in the wild
export function pickSpecies(rng) {
  const wildSpecies = SPECIES.filter(s => s.rarity === RARITY.COMMON || s.rarity === RARITY.UNCOMMON);
  const items = wildSpecies.map((s) => ({ value: s, weight: s.weight }));
  return rng.weighted(items);
}

// Pick a species from a specific rarity tier
export function pickSpeciesByRarity(rng, rarity) {
  const tierSpecies = SPECIES.filter(s => s.rarity === rarity);
  if (tierSpecies.length === 0) return null;
  const items = tierSpecies.map((s) => ({ value: s, weight: s.weight }));
  return rng.weighted(items);
}

// Leaf templates — large detailed pixel shapes with filled interiors
// Each template is an array of [dx, dy] offsets
export const LEAF_TEMPLATES = {
  round: [
    // ~28px filled round leaf
    [0, -3],
    [-1, -2], [0, -2], [1, -2],
    [-2, -1], [-1, -1], [0, -1], [1, -1], [2, -1],
    [-3, 0], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [3, 0],
    [-2, 1], [-1, 1], [0, 1], [1, 1], [2, 1],
    [-1, 2], [0, 2], [1, 2],
    [0, 3],
  ],
  pointed: [
    // ~32px pointed leaf with filled body
    [0, -5], [0, -4],
    [-1, -3], [0, -3], [1, -3],
    [-1, -2], [0, -2], [1, -2],
    [-2, -1], [-1, -1], [0, -1], [1, -1], [2, -1],
    [-3, 0], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [3, 0],
    [-2, 1], [-1, 1], [0, 1], [1, 1], [2, 1],
    [-1, 2], [0, 2], [1, 2],
    [0, 3], [0, 4], [0, 5],
  ],
  long: [
    // ~26px graceful drooping leaf with width
    [0, 0], [1, 0], [0, -1], [1, -1],
    [2, 0], [2, 1], [1, 1],
    [3, 1], [3, 2], [2, 2],
    [4, 2], [4, 3], [3, 3],
    [5, 3], [5, 4], [4, 4],
    [6, 4], [6, 5],
    [7, 5], [7, 6],
    [8, 6],
    // upper edge width
    [1, -2], [2, -1], [3, 0], [4, 1], [5, 2], [6, 3],
  ],
  fern: [
    // ~30px fern frond with thicker rachis and wider leaflets
    [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0], [9, 0],
    // leaflets left — wider
    [1, -1], [1, -2], [1, -3], [2, -1],
    [3, -1], [3, -2], [3, -3], [4, -1],
    [5, -1], [5, -2], [6, -1],
    [7, -1], [8, -1],
    // leaflets right — wider
    [2, 1], [2, 2], [2, 3], [1, 1],
    [4, 1], [4, 2], [4, 3], [3, 1],
    [6, 1], [6, 2], [5, 1],
    [8, 1], [7, 1],
  ],
  tiny: [
    // ~15px cluster leaf for bonsai / crystal tree
    [0, -2],
    [-1, -1], [0, -1], [1, -1],
    [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0],
    [-1, 1], [0, 1], [1, 1],
    [0, 2],
    [-2, -1], [2, -1],
  ],
  clover: [
    // ~22px 3-leaf clover with filled lobes
    [0, -3], [-1, -3], [1, -3],
    [0, -2], [-1, -2], [1, -2],
    [-2, -1], [-1, -1], [1, -1], [2, -1],
    [-3, 0], [-2, 0], [-1, 0], [1, 0], [2, 0], [3, 0],
    [-2, 1], [-1, 1], [1, 1], [2, 1],
    [-1, 2], [0, 2], [1, 2],
    [0, 3],
  ],
  spatula: [
    // ~30px Daisy basal leaf — wider at tip, narrow at base
    [0, 4], [0, 3],
    [-1, 2], [0, 2], [1, 2],
    [-1, 1], [0, 1], [1, 1],
    [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0],
    [-3, -1], [-2, -1], [-1, -1], [0, -1], [1, -1], [2, -1], [3, -1],
    [-3, -2], [-2, -2], [-1, -2], [0, -2], [1, -2], [2, -2], [3, -2],
    [-2, -3], [-1, -3], [0, -3], [1, -3], [2, -3],
    [-1, -4], [0, -4], [1, -4],
  ],
  heart: [
    // ~28px heart-shaped leaf with filled interior
    [-2, -3], [-1, -3], [1, -3], [2, -3],
    [-3, -2], [-2, -2], [-1, -2], [0, -2], [1, -2], [2, -2], [3, -2],
    [-3, -1], [-2, -1], [-1, -1], [0, -1], [1, -1], [2, -1], [3, -1],
    [-3, 0], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [3, 0],
    [-2, 1], [-1, 1], [0, 1], [1, 1], [2, 1],
    [-1, 2], [0, 2], [1, 2],
    [0, 3],
  ],
  lance: [
    // ~28px narrow pointed leaf with filled body
    [0, -6], [0, -5],
    [-1, -4], [0, -4], [1, -4],
    [-1, -3], [0, -3], [1, -3],
    [-2, -2], [-1, -2], [0, -2], [1, -2], [2, -2],
    [-2, -1], [-1, -1], [0, -1], [1, -1], [2, -1],
    [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0],
    [-1, 1], [0, 1], [1, 1],
    [0, 2], [0, 3], [0, 4], [0, 5],
  ],
  strap: [
    // ~28px Orchid long wide drooping leaf
    [-1, 0], [0, 0], [1, 0],
    [-1, 1], [0, 1], [1, 1],
    [0, 2], [1, 2], [2, 2],
    [1, 3], [2, 3], [3, 3],
    [2, 4], [3, 4], [4, 4],
    [3, 5], [4, 5], [5, 5],
    [4, 6], [5, 6], [6, 6],
    [5, 7], [6, 7],
    [6, 8], [7, 8],
    [7, 9],
    // upper edge
    [0, -1], [1, -1], [2, 1], [3, 2], [4, 3], [5, 4], [6, 5],
  ],
  pinnae: [
    // ~12px fern leaflet — wider and more filled
    [-1, -1], [0, -1], [1, -1],
    [-1, 0], [0, 0], [1, 0], [2, 0],
    [-1, 1], [0, 1], [1, 1],
    [0, 2], [1, 2],
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
