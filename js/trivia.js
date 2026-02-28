// Plant trivia question bank and selection logic

const TRIVIA_QUESTIONS = [
  {
    id: 1,
    question: 'What process do plants use to convert sunlight into energy?',
    choices: ['Respiration', 'Photosynthesis', 'Fermentation', 'Oxidation'],
    correctIndex: 1,
    fact: 'Photosynthesis converts CO2 and water into glucose and oxygen using sunlight — it produces most of the oxygen we breathe!',
  },
  {
    id: 2,
    question: 'What gas do plants absorb from the atmosphere?',
    choices: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'],
    correctIndex: 2,
    fact: 'Plants absorb CO2 through tiny pores called stomata on their leaves and use it to build sugars.',
  },
  {
    id: 3,
    question: 'What is the green pigment in plants called?',
    choices: ['Carotene', 'Chlorophyll', 'Melanin', 'Xanthophyll'],
    correctIndex: 1,
    fact: 'Chlorophyll absorbs red and blue light but reflects green, which is why most plants look green to us.',
  },
  {
    id: 4,
    question: 'Which part of the plant absorbs water from the soil?',
    choices: ['Stem', 'Leaves', 'Roots', 'Flowers'],
    correctIndex: 2,
    fact: 'Root hairs massively increase the surface area for water absorption — a single rye plant can have over 14 billion root hairs!',
  },
  {
    id: 5,
    question: 'What is the tallest species of tree in the world?',
    choices: ['Giant Sequoia', 'Coast Redwood', 'Douglas Fir', 'Eucalyptus'],
    correctIndex: 1,
    fact: 'Coast Redwoods (Sequoia sempervirens) can grow over 115 meters (380 feet) tall. The tallest known tree is called Hyperion.',
  },
  {
    id: 6,
    question: 'What do you call the process of water moving up through a plant?',
    choices: ['Osmosis', 'Transpiration', 'Diffusion', 'Capillary action'],
    correctIndex: 1,
    fact: 'Transpiration pulls water from roots to leaves. A large oak tree can transpire over 400 liters of water per day!',
  },
  {
    id: 7,
    question: 'Which of these is NOT a type of plant reproduction?',
    choices: ['Pollination', 'Spore dispersal', 'Binary fission', 'Vegetative propagation'],
    correctIndex: 2,
    fact: 'Binary fission is how bacteria reproduce. Plants use seeds, spores, or vegetative methods like runners and bulbs.',
  },
  {
    id: 8,
    question: 'What is the world\'s largest flower?',
    choices: ['Sunflower', 'Rafflesia arnoldii', 'Titan Arum', 'Victoria Water Lily'],
    correctIndex: 1,
    fact: 'Rafflesia arnoldii can grow up to 1 meter across and smells like rotting flesh to attract pollinating flies!',
  },
  {
    id: 9,
    question: 'What part of the plant does a potato grow from?',
    choices: ['Root', 'Stem (tuber)', 'Seed', 'Fruit'],
    correctIndex: 1,
    fact: 'Potatoes are actually swollen underground stems called tubers. The "eyes" on a potato are buds that can sprout new plants.',
  },
  {
    id: 10,
    question: 'Which plant can survive the longest without water?',
    choices: ['Cactus', 'Resurrection plant', 'Aloe vera', 'Jade plant'],
    correctIndex: 1,
    fact: 'The resurrection plant (Selaginella lepidophylla) can survive years without water, curling into a dry ball and reviving when watered.',
  },
  {
    id: 11,
    question: 'What are the male reproductive parts of a flower called?',
    choices: ['Pistils', 'Stamens', 'Petals', 'Sepals'],
    correctIndex: 1,
    fact: 'Stamens produce pollen and consist of a filament topped by an anther. A single flower can have dozens of stamens!',
  },
  {
    id: 12,
    question: 'Which fruit is known as the "king of fruits" in Southeast Asia?',
    choices: ['Mango', 'Jackfruit', 'Durian', 'Mangosteen'],
    correctIndex: 2,
    fact: 'Durian is so pungent that it\'s banned in many hotels and public transport in Southeast Asia, yet many people love its creamy taste.',
  },
  {
    id: 13,
    question: 'How many years can a bristlecone pine tree live?',
    choices: ['About 500', 'About 1,000', 'About 3,000', 'Over 5,000'],
    correctIndex: 3,
    fact: 'The oldest known bristlecone pine, named Methuselah, is over 4,850 years old — it was already ancient when the pyramids were built!',
  },
  {
    id: 14,
    question: 'What is the process called when leaves change color in autumn?',
    choices: ['Photosynthesis', 'Senescence', 'Germination', 'Transpiration'],
    correctIndex: 1,
    fact: 'During senescence, chlorophyll breaks down revealing yellow and orange pigments that were hidden underneath all along.',
  },
  {
    id: 15,
    question: 'Which of these plants is carnivorous?',
    choices: ['Poison ivy', 'Venus flytrap', 'Kudzu', 'Mistletoe'],
    correctIndex: 1,
    fact: 'Venus flytraps can snap shut in about 100 milliseconds — one of the fastest movements in the plant kingdom!',
  },
  {
    id: 16,
    question: 'What is the main ingredient in chocolate?',
    choices: ['Coffee beans', 'Vanilla pods', 'Cacao beans', 'Carob pods'],
    correctIndex: 2,
    fact: 'Cacao trees produce pods that each contain 30-50 beans. It takes about 400 beans to make one pound of chocolate.',
  },
  {
    id: 17,
    question: 'Which part of a plant becomes the fruit?',
    choices: ['Stem', 'Leaf', 'Ovary', 'Root'],
    correctIndex: 2,
    fact: 'After pollination, the ovary of the flower swells and develops into a fruit that protects and helps disperse the seeds.',
  },
  {
    id: 18,
    question: 'What type of plant has seeds but no flowers?',
    choices: ['Angiosperm', 'Gymnosperm', 'Fern', 'Moss'],
    correctIndex: 1,
    fact: 'Gymnosperms like pine trees produce seeds in cones instead of flowers. The word means "naked seed" in Greek.',
  },
  {
    id: 19,
    question: 'What is the fastest-growing plant in the world?',
    choices: ['Kudzu', 'Bamboo', 'Giant kelp', 'Wisteria'],
    correctIndex: 1,
    fact: 'Some bamboo species can grow up to 91 cm (36 inches) in a single day. That\'s almost fast enough to watch it grow!',
  },
  {
    id: 20,
    question: 'What do sunflowers do throughout the day?',
    choices: ['Close their petals', 'Track the sun', 'Release pollen', 'Drop seeds'],
    correctIndex: 1,
    fact: 'Young sunflowers exhibit heliotropism — they face east in the morning and follow the sun to the west, then reset overnight.',
  },
  {
    id: 21,
    question: 'Which spice comes from the bark of a tree?',
    choices: ['Pepper', 'Cinnamon', 'Turmeric', 'Ginger'],
    correctIndex: 1,
    fact: 'Cinnamon is made from the inner bark of Cinnamomum trees. The bark curls into rolls ("quills") as it dries.',
  },
  {
    id: 22,
    question: 'What is the purpose of a flower\'s bright colors?',
    choices: ['Absorb sunlight', 'Attract pollinators', 'Scare predators', 'Store nutrients'],
    correctIndex: 1,
    fact: 'Flowers evolved bright colors and patterns, some even visible only in UV light, specifically to attract bees, butterflies, and birds.',
  },
  {
    id: 23,
    question: 'What is sap primarily used for in a tree?',
    choices: ['Structural support', 'Transporting nutrients', 'Storing energy', 'Fighting disease'],
    correctIndex: 1,
    fact: 'Sap flows through the phloem and xylem, carrying sugars, water, and minerals throughout the tree — it\'s like the plant\'s bloodstream.',
  },
  {
    id: 24,
    question: 'What is the name for plants that complete their life cycle in one year?',
    choices: ['Perennials', 'Biennials', 'Annuals', 'Evergreens'],
    correctIndex: 2,
    fact: 'Annuals germinate, flower, set seed, and die in one growing season. Marigolds, tomatoes, and basil are common annuals.',
  },
  {
    id: 25,
    question: 'Which plant produces the most oxygen?',
    choices: ['Amazon rainforest trees', 'Ocean phytoplankton', 'Grass', 'Bamboo'],
    correctIndex: 1,
    fact: 'Phytoplankton in the ocean produce about 50-80% of Earth\'s oxygen — tiny organisms with a massive impact!',
  },
  {
    id: 26,
    question: 'What is the largest seed in the plant kingdom?',
    choices: ['Coconut', 'Coco de mer', 'Avocado', 'Mango'],
    correctIndex: 1,
    fact: 'The coco de mer palm produces seeds that can weigh up to 25 kg (55 lbs). They\'re sometimes called "sea coconuts."',
  },
  {
    id: 27,
    question: 'What vitamin are citrus fruits especially rich in?',
    choices: ['Vitamin A', 'Vitamin B12', 'Vitamin C', 'Vitamin D'],
    correctIndex: 2,
    fact: 'Citrus fruits are rich in Vitamin C, which helped sailors prevent scurvy on long voyages — that\'s why British sailors were called "limeys."',
  },
  {
    id: 28,
    question: 'What is a group of trees growing together called?',
    choices: ['A meadow', 'A grove', 'A hedge', 'A thicket'],
    correctIndex: 1,
    fact: 'Groves can be natural or planted. Famous groves include olive groves in the Mediterranean and redwood groves in California.',
  },
  {
    id: 29,
    question: 'Which plant family includes roses, apples, and strawberries?',
    choices: ['Solanaceae', 'Rosaceae', 'Poaceae', 'Fabaceae'],
    correctIndex: 1,
    fact: 'Rosaceae is one of the most economically important plant families — it includes most of our favorite fruits and ornamental flowers.',
  },
  {
    id: 30,
    question: 'What is the waxy coating on leaves called?',
    choices: ['Epidermis', 'Cuticle', 'Cortex', 'Cambium'],
    correctIndex: 1,
    fact: 'The cuticle is a waxy layer that prevents water loss. Desert plants have especially thick cuticles to conserve moisture.',
  },
  {
    id: 31,
    question: 'What phenomenon describes roots growing toward water?',
    choices: ['Phototropism', 'Hydrotropism', 'Gravitropism', 'Thigmotropism'],
    correctIndex: 1,
    fact: 'Plants respond to many stimuli: light (phototropism), water (hydrotropism), gravity (gravitropism), and touch (thigmotropism).',
  },
  {
    id: 32,
    question: 'Which plant is used to make linen fabric?',
    choices: ['Cotton', 'Flax', 'Hemp', 'Jute'],
    correctIndex: 1,
    fact: 'Flax (Linum usitatissimum) fibers are spun into linen, one of the oldest textiles. Ancient Egyptians wrapped mummies in linen cloth.',
  },
  {
    id: 33,
    question: 'How do mushrooms differ from plants?',
    choices: ['They have no cells', 'They can\'t photosynthesize', 'They don\'t reproduce', 'They have no DNA'],
    correctIndex: 1,
    fact: 'Fungi are more closely related to animals than plants! They can\'t photosynthesize and instead absorb nutrients from organic matter.',
  },
  {
    id: 34,
    question: 'What is the term for a plant that grows on another plant without harming it?',
    choices: ['Parasite', 'Epiphyte', 'Saprophyte', 'Symbiont'],
    correctIndex: 1,
    fact: 'Orchids and bromeliads are common epiphytes. They perch on tree branches for better light access but make their own food.',
  },
  {
    id: 35,
    question: 'Which continent has no native flowering plants?',
    choices: ['Australia', 'Antarctica', 'Arctic (Greenland)', 'Africa'],
    correctIndex: 1,
    fact: 'Antarctica has only two native flowering plants: Antarctic hair grass and Antarctic pearlwort, both found on the peninsula. The interior has none.',
  },
];

const RECENT_WINDOW = 10;

/**
 * Pick a trivia question that hasn't been shown recently.
 * @param {number[]} recentIds — IDs of recently shown questions
 * @returns {{ question: object, updatedRecent: number[] }}
 */
export function pickTriviaQuestion(recentIds = []) {
  const available = TRIVIA_QUESTIONS.filter(q => !recentIds.includes(q.id));
  const pool = available.length > 0 ? available : TRIVIA_QUESTIONS;
  const picked = pool[Math.floor(Math.random() * pool.length)];

  const updatedRecent = [...recentIds, picked.id].slice(-RECENT_WINDOW);
  return { question: picked, updatedRecent };
}

/**
 * Check if the selected answer is correct.
 * @param {object} question — a TRIVIA_QUESTIONS entry
 * @param {number} selectedIndex — 0-3
 * @returns {boolean}
 */
export function checkAnswer(question, selectedIndex) {
  return selectedIndex === question.correctIndex;
}
