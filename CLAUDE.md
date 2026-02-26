# Plant Tamagotchi

A daily plant-growing game built as a vanilla JavaScript single-page app with procedural pixel art.

## Architecture

- **No framework** — vanilla JS with ES modules, no build step
- **State**: localStorage via `js/state.js` (`plant_tamagotchi_state` key)
- **Rendering**: Procedural pixel art on `<canvas>` using a seeded PRNG (`js/rng.js`, Mulberry32)
- **Screens**: Three screens (plant, garden, gallery) toggled via CSS class `screen-active`

## Key Files

| File | Purpose |
|---|---|
| `index.html` | Single HTML page with all three screens + completion overlay |
| `css/style.css` | All styles and animations |
| `js/main.js` | Entry point — screen routing, event wiring, dev controls |
| `js/state.js` | localStorage persistence: `loadState()`, `saveState()`, `resetState()` |
| `js/growth.js` | Game logic: `processVisit()`, `completePlant()`, streak/bonus math |
| `js/plant-data.js` | 10 species definitions, rarity tiers, leaf/flower templates |
| `js/plant-generator.js` | Procedural pixel art rendering (`renderPlant()`) |
| `js/animation.js` | `PlantAnimator` class — sway, particles, animation loop |
| `js/species-gallery.js` | Species gallery: shows completed plants animated, others as silhouettes |
| `js/garden.js` | Garden collection view with sorting (date/rarity/species) |
| `js/ui.js` | DOM updates, toasts, water animation, completion overlay |
| `js/rng.js` | Seeded PRNG with helpers (int, float, pick, weighted, shuffle) |
| `js/canvas-utils.js` | Canvas drawing utilities |

## Data Flow

1. `ensurePlant()` guarantees `state.currentPlant` exists
2. `processVisit()` adds growth days (1 base + streak bonus), updates streak
3. When `growthStage >= 1.0`, completion overlay appears
4. `completePlant()` moves plant to `state.garden[]` with `dateCompleted`, generates new plant
5. Species gallery reveals a species only after it exists in `state.garden`

## Plant Lifecycle

`generateNewPlant()` → daily `processVisit()` watering → `growthStage` reaches 1.0 → user clicks "Move to Garden" → `completePlant()` → new plant generated

## State Shape

```js
{
  currentPlant: { id, seed, species, rarity, complexity, hasFlowers, leafType, totalDaysRequired, daysGrown, growthStage, daysVisited[], dateReceived },
  garden: [ { ...plant, dateCompleted } ],
  stats: { totalPlantsGrown, currentStreak, longestStreak, lastVisitDate, totalVisits }
}
```

## Conventions

- All rendering is deterministic via seeded PRNG — same `seed` = same plant appearance
- Gallery uses fixed seeds (`EXAMPLE_SEEDS`) so preview plants look consistent
- Rarity tiers: Common, Uncommon, Rare, Epic, Legendary — affect canvas size, growth time, visual complexity
- Dev controls exist at bottom of page (toggle with DEV button) for testing growth/completion
- No test framework currently set up
