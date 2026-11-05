// ─────────────────────────────────────────────────────────────
//  Cozyfish — game data & tuning
// ─────────────────────────────────────────────────────────────

export const N = 160;            // world is N × N voxel columns
export const CENTER = 80;        // pond centre
export const WATER_Y = 8.7;      // water surface height
export const ICE_Y = 8.98;       // ice surface (collision top is 9)
export const POND_MAX_H = 8;     // columns with height ≤ this hold water
export const LAND_H = 9;         // base land height
export const DAY_LENGTH = 720;   // real seconds per in-game day

// Landmarks (world coords)
export const SPAWN = { x: 80.5, z: 113.5 };
export const MARKET = { x: 90, z: 113 };          // stand origin (5×3 cells)
export const HOUSE = { x: 109, z: 79, y: 9 };      // plot origin (9×7 cells)
export const CAMP = { x: 64, z: 40 };              // abandoned campsite
export const DOCK_X = 74;                          // dock columns 74..75

// ─── Seasons ────────────────────────────────────────────────
export const SEASONS = {
  spring: {
    key: 'spring', name: 'Spring', emoji: '🌸',
    blurb: 'Cherry blossoms, birdsong and hungry trout.',
    grass: 0x86bf5c, grassDark: 0x6aa64a, dirt: 0x8a6142, sand: 0xd8b878, stone: 0x8c8a86,
    snow: false, frozen: false,
    leaves: { oak: [0x86c95c, 0x76bb4e, 0xf4b4cc], pine: 0x3e7b48, birch: 0xa2d96b },
    flowers: [0xffe066, 0xff9ec7, 0xffffff, 0xb79cff],
    grassTuft: 0x9bd46a,
    sky: { day: [0x6fb0e6, 0xd7ecf4], dusk: [0x6a6aa8, 0xffb48a], night: [0x0c1430, 0x26315a] },
    sun: 0xfff0d8, water: [0x4aa3a8, 0x1d5a6e],
    weather: 'petals', night: 'fireflies', chill: 0.06,
  },
  summer: {
    key: 'summer', name: 'Summer', emoji: '☀️',
    blurb: 'Long golden evenings, fireflies and lazy catfish.',
    grass: 0x74ad4a, grassDark: 0x5e963d, dirt: 0x8a6142, sand: 0xddb874, stone: 0x8e8b86,
    snow: false, frozen: false,
    leaves: { oak: [0x4f9c3a, 0x5aab43, 0x47903a], pine: 0x2f6b3f, birch: 0x74c24c },
    flowers: [0xffd23f, 0xff7a5c, 0xffffff, 0x8fb8ff],
    grassTuft: 0x86c556,
    sky: { day: [0x5aa6ea, 0xcfe8f5], dusk: [0x7a6aa0, 0xffa66b], night: [0x0b1330, 0x283462] },
    sun: 0xffe9c4, water: [0x3f9fa0, 0x175468],
    weather: 'pollen', night: 'fireflies', chill: 0,
  },
  fall: {
    key: 'fall', name: 'Fall', emoji: '🍂',
    blurb: 'Crunchy leaves, misty mornings and fat pike.',
    grass: 0x9aa64a, grassDark: 0x7f8a3c, dirt: 0x86593a, sand: 0xcaa874, stone: 0x86837e,
    snow: false, frozen: false,
    leaves: { oak: [0xdb6a2c, 0xe9a73b, 0xb8422a], pine: 0x3a6a42, birch: 0xf0c246 },
    flowers: [0xe9a73b, 0xc2452c, 0xf3e1b6, 0x9a6bd1],
    grassTuft: 0xb3ad5a,
    sky: { day: [0x7aa8d6, 0xf1dcc0], dusk: [0x6f5c8e, 0xff9a5a], night: [0x0d1229, 0x2c2a4e] },
    sun: 0xffdcae, water: [0x47908f, 0x1a4b5c],
    weather: 'leaves', night: null, chill: 0.25,
  },
  winter: {
    key: 'winter', name: 'Winter', emoji: '❄️',
    blurb: 'Snowy pines, a frozen pond and ice fishing by the fire.',
    grass: 0xf2f6fb, grassDark: 0xe1e9f3, dirt: 0x7a5a42, sand: 0xe9edf2, stone: 0x8a8c90,
    snow: true, frozen: true,
    leaves: { oak: null, pine: 0x2c5d3e, birch: null },
    flowers: [],
    grassTuft: 0xc9b98a,
    sky: { day: [0x8db3d8, 0xe4edf3], dusk: [0x6a6c9a, 0xf7b896], night: [0x0b1028, 0x2a3156] },
    sun: 0xfff3e6, water: [0xbfd9ea, 0x8fb4cf],
    weather: 'snow', night: null, chill: 1.0,
  },
};
export const SEASON_ORDER = ['spring', 'summer', 'fall', 'winter'];

// ─── Items ──────────────────────────────────────────────────
export const ITEMS = {
  stick:    { name: 'Stick',        icon: '🥢', sell: 1,  desc: 'A sturdy little stick.' },
  stone:    { name: 'Stone',        icon: '🪨', sell: 1,  desc: 'Smooth and flat — good for skipping.' },
  fiber:    { name: 'Plant Fiber',  icon: '🌾', sell: 1,  desc: 'Tough grass. Twist it into rope.' },
  string:   { name: 'String',       icon: '🧵', sell: 3,  desc: 'Fishing line, of a sort.' },
  worm:     { name: 'Worm',         icon: '🪱', sell: 1,  desc: 'Wriggly bait. Fish love it.', bait: 1 },
  lure:     { name: 'Shiny Lure',   icon: '🪝', sell: 4,  desc: 'Attracts rarer fish.', bait: 2 },
  berries:  { name: 'Wild Berries', icon: '🫐', sell: 3,  desc: 'Sweet and tart.' },
  mushroom: { name: 'Mushroom',     icon: '🍄', sell: 4,  desc: 'Mabel makes soup with these.' },
  log:      { name: 'Log',          icon: '🪵', sell: 2,  desc: 'Fresh-cut timber.' },
  plank:    { name: 'Plank',        icon: '🟫', sell: 2,  desc: 'Split from logs.' },
  rope:     { name: 'Rope',         icon: '🪢', sell: 5,  desc: 'Braided fiber rope.' },
  nails:    { name: 'Nails',        icon: '🔩', sell: 1,  desc: 'Bought from Mabel.' },
};

export const RODS = [
  null,
  { name: 'Stick Rod',  cast: 13, reel: 2.3, strength: 1.0, rare: 0.0, window: 0.95, color: 0x8a5a2b, accent: 0xd8c39a },
  { name: 'Willow Rod', cast: 18, reel: 2.9, strength: 1.3, rare: 0.35, window: 1.05, color: 0xc9a46a, accent: 0x5b7a3a },
  { name: 'Carbon Rod', cast: 24, reel: 3.6, strength: 1.7, rare: 0.8, window: 1.15, color: 0x2e3238, accent: 0x3d8bd6 },
  { name: 'Golden Rod', cast: 30, reel: 4.5, strength: 2.2, rare: 1.4, window: 1.3, color: 0xe2b23a, accent: 0xfff1b0 },
];
export const AXES = [null, { name: 'Stone Axe', hits: 6 }, { name: 'Iron Axe', hits: 3 }];

// ─── Fish ───────────────────────────────────────────────────
// seasons: list or 'all'. night: true (night only) | 'bonus'. deep: needs deep water.
export const FISH = [
  { id: 'boot',     name: 'Old Boot',       rarity: 'junk',      price: 1,   seasons: 'all', w: [0.4, 0.9], strength: 0.1, body: 0x5a3d26, belly: 0x3c2818, fin: 0x2a1c12, shape: 'boot' },
  { id: 'can',      name: 'Rusty Can',      rarity: 'junk',      price: 0,   seasons: 'all', w: [0.1, 0.2], strength: 0.05, body: 0x9a5b3a, belly: 0xc8b9a0, fin: 0x6d4a35, shape: 'can' },
  { id: 'bluegill', name: 'Bluegill',       rarity: 'common',    price: 8,   seasons: ['spring', 'summer', 'fall'], w: [0.1, 0.5], strength: 0.25, body: 0x5a7f8f, belly: 0xf0b14a, fin: 0x31505e, len: 7, tall: 1.2, spots: 0x223a48 },
  { id: 'perch',    name: 'Yellow Perch',   rarity: 'common',    price: 10,  seasons: 'all', w: [0.2, 0.8], strength: 0.3, body: 0xc9b23a, belly: 0xf3e6a8, fin: 0xe07a2e, len: 8, stripes: 0x4a5a2a },
  { id: 'sunfish',  name: 'Pumpkinseed',    rarity: 'common',    price: 9,   seasons: ['summer'], w: [0.1, 0.4], strength: 0.25, body: 0x6f9a6a, belly: 0xf28a2e, fin: 0x3f6a7a, len: 6, tall: 1.3, spots: 0xe0602a },
  { id: 'crappie',  name: 'Crappie',        rarity: 'common',    price: 12,  seasons: ['spring', 'fall'], w: [0.2, 0.9], strength: 0.3, body: 0xb7c2b0, belly: 0xeef0e6, fin: 0x55604f, len: 8, tall: 1.1, spots: 0x3a4436 },
  { id: 'carp',     name: 'Common Carp',    rarity: 'common',    price: 15,  seasons: ['spring', 'summer'], w: [1.5, 6], strength: 0.5, body: 0xa8853f, belly: 0xe8cf8a, fin: 0x7a5a2a, len: 11 },
  { id: 'smelt',    name: 'Rainbow Smelt',  rarity: 'common',    price: 7,   seasons: ['winter'], w: [0.05, 0.15], strength: 0.2, body: 0xb9d4dc, belly: 0xf4fbff, fin: 0x8fb0c4, len: 6, stripes: 0xc79ad8 },
  { id: 'trout',    name: 'Rainbow Trout',  rarity: 'uncommon',  price: 22,  seasons: ['spring', 'fall'], w: [0.5, 2.5], strength: 0.5, body: 0x8a9a6a, belly: 0xf2ece0, fin: 0x6a7a4a, len: 10, band: 0xe86b7a, spots: 0x2e3a22 },
  { id: 'brook',    name: 'Brook Trout',    rarity: 'uncommon',  price: 30,  seasons: ['spring'], w: [0.4, 1.8], strength: 0.5, body: 0x4f6a4a, belly: 0xf27a3a, fin: 0xe8603a, len: 9, spots: 0xe8d070 },
  { id: 'bass',     name: 'Largemouth Bass',rarity: 'uncommon',  price: 28,  seasons: ['spring', 'summer', 'fall'], w: [0.8, 4], strength: 0.6, body: 0x5f7a3a, belly: 0xe0e2b0, fin: 0x45592a, len: 10, band: 0x2d3a1c },
  { id: 'catfish',  name: 'Channel Catfish',rarity: 'uncommon',  price: 35,  seasons: ['summer', 'fall'], w: [1, 7], strength: 0.65, body: 0x6c6f78, belly: 0xd8d8d0, fin: 0x45474e, len: 12, night: true, whiskers: true },
  { id: 'walleye',  name: 'Walleye',        rarity: 'uncommon',  price: 40,  seasons: ['fall', 'winter'], w: [0.8, 4], strength: 0.6, body: 0xa59a4a, belly: 0xefe8c8, fin: 0x6a5a2a, len: 11, night: 'bonus', stripes: 0x4d4826 },
  { id: 'burbot',   name: 'Burbot',         rarity: 'uncommon',  price: 45,  seasons: ['winter'], w: [0.8, 3], strength: 0.55, body: 0x6a5a3a, belly: 0xc8b890, fin: 0x4a3c26, len: 12, night: true, spots: 0x3a2e1c, whiskers: true },
  { id: 'pike',     name: 'Northern Pike',  rarity: 'rare',      price: 70,  seasons: ['fall', 'winter'], w: [2, 9], strength: 0.85, body: 0x4f6a3a, belly: 0xe8e8c8, fin: 0x9a5a2a, len: 14, spots: 0xd8e0a0, minTier: 2 },
  { id: 'char',     name: 'Arctic Char',    rarity: 'rare',      price: 85,  seasons: ['winter'], w: [1, 5], strength: 0.75, body: 0x3f5a6a, belly: 0xe8603a, fin: 0xf0f0f0, len: 11, spots: 0xf4c0b0, minTier: 2 },
  { id: 'koi',      name: 'Pond Koi',       rarity: 'rare',      price: 95,  seasons: ['spring', 'summer'], w: [1, 4], strength: 0.6, body: 0xf4f0e8, belly: 0xfaf6f0, fin: 0xf4f0e8, len: 10, patches: 0xe8502a, minTier: 2 },
  { id: 'sturgeon', name: 'Lake Sturgeon',  rarity: 'legendary', price: 260, seasons: 'all', w: [12, 40], strength: 1.0, body: 0x5a5f66, belly: 0xc8ccd0, fin: 0x3c4046, len: 16, deep: true, minTier: 3, scutes: 0xa0a4aa },
  { id: 'goldcarp', name: 'Golden Carp',    rarity: 'legendary', price: 320, seasons: ['spring', 'summer'], w: [3, 9], strength: 0.9, body: 0xf2b630, belly: 0xffe58a, fin: 0xe08a20, len: 12, deep: true, minTier: 3, glow: true },
  { id: 'moonfish', name: 'Moonlit Ghost',  rarity: 'legendary', price: 420, seasons: ['fall', 'winter'], w: [2, 6], strength: 0.95, body: 0xcfe2ff, belly: 0xffffff, fin: 0x9fc0f0, len: 11, deep: true, night: true, minTier: 3, glow: true },
];
export const FISH_BY_ID = Object.fromEntries(FISH.map(f => [f.id, f]));
export const RARITY = {
  junk:      { label: 'Junk',      color: '#8a7a68', weight: 7,   stars: 0 },
  common:    { label: 'Common',    color: '#6f9a4f', weight: 52,  stars: 1 },
  uncommon:  { label: 'Uncommon',  color: '#3f86b8', weight: 22,  stars: 2 },
  rare:      { label: 'Rare',      color: '#9a5ac8', weight: 7,   stars: 3 },
  legendary: { label: 'Legendary', color: '#e0962a', weight: 1.6, stars: 4 },
};

// ─── Crafting ───────────────────────────────────────────────
export const RECIPES = [
  { id: 'rod1',     name: 'Stick Rod',  icon: '🎣', needs: { stick: 3, string: 1 }, gives: { tool: 'rod', tier: 1 }, desc: 'Your very first fishing pole.' },
  { id: 'axe1',     name: 'Stone Axe',  icon: '🪓', needs: { stick: 2, stone: 2, fiber: 3 }, gives: { tool: 'axe', tier: 1 }, desc: 'Lets you chop down trees.' },
  { id: 'rope',     name: 'Rope',       icon: '🪢', needs: { fiber: 4 }, gives: { item: 'rope', qty: 1 }, desc: 'Needed for boats.' },
  { id: 'plank',    name: 'Planks ×3',  icon: '🟫', needs: { log: 1 }, gives: { item: 'plank', qty: 3 }, desc: 'Split a log into planks.' },
  { id: 'campfire', name: 'Campfire',   icon: '🔥', needs: { stick: 5, stone: 4 }, gives: { place: 'campfire' }, desc: 'Warmth and light. Placed in front of you.' },
];

// ─── Mabel's market ─────────────────────────────────────────
export const SHOP = [
  { id: 'rod2',    name: 'Willow Rod',     icon: '🎣', price: 60,  kind: 'rod', tier: 2, desc: 'Longer casts. Lands rare fish.' },
  { id: 'rod3',    name: 'Carbon Rod',     icon: '🎣', price: 220, kind: 'rod', tier: 3, desc: 'Strong enough for legendary fish in deep water.' },
  { id: 'rod4',    name: 'Golden Rod',     icon: '✨', price: 650, kind: 'rod', tier: 4, desc: 'The best rod in the woods.' },
  { id: 'axe2',    name: 'Iron Axe',       icon: '🪓', price: 80,  kind: 'axe', tier: 2, desc: 'Fells trees in half the swings.' },
  { id: 'lantern', name: 'Lantern',        icon: '🏮', price: 45,  kind: 'lantern', desc: 'A warm light for night fishing. Press F.' },
  { id: 'nails',   name: 'Nails ×10',      icon: '🔩', price: 18,  kind: 'item', item: 'nails', qty: 10, desc: 'For building.' },
  { id: 'lure',    name: 'Shiny Lures ×5', icon: '🪝', price: 25,  kind: 'item', item: 'lure', qty: 5, desc: 'Better bait — more rare bites.' },
  { id: 'worms',   name: 'Worms ×5',       icon: '🪱', price: 6,   kind: 'item', item: 'worm', qty: 5, desc: 'Basic bait.' },
  { id: 'string',  name: 'String',         icon: '🧵', price: 8,   kind: 'item', item: 'string', qty: 1, desc: 'Spare fishing line.' },
  { id: 'rope',    name: 'Rope',           icon: '🪢', price: 14,  kind: 'item', item: 'rope', qty: 1, desc: 'For boats and builds.' },
];

// ─── Building ───────────────────────────────────────────────
export const HOUSE_STAGES = [
  { name: 'Stone Foundation', needs: { stone: 10, log: 4 },          desc: 'A level stone base by the water.' },
  { name: 'Log Walls',        needs: { log: 12, nails: 20 },         desc: 'Stacked logs with a door and windows.' },
  { name: 'Plank Roof',       needs: { plank: 16, nails: 10, stone: 6 }, desc: 'A pitched roof and a stone chimney.' },
  { name: 'Cozy Interior',    needs: { plank: 8, fiber: 6, mushroom: 2 }, desc: 'A bed, a fireplace, a rug — home.' },
];
export const BOAT_NEEDS = { plank: 12, rope: 3, nails: 10 };

// ─── Goals ──────────────────────────────────────────────────
export const QUESTS = [
  { text: 'Gather 3 sticks', hint: 'Sticks lie around the pond and under trees. Press E to pick up.', done: g => g.count('stick') >= 3 || g.tools.rod > 0 },
  { text: 'Find some string', hint: 'Someone left an old campsite in the woods to the north. Check the crate.', done: g => g.count('string') >= 1 || g.tools.rod > 0 },
  { text: 'Craft a Stick Rod', hint: 'Open your pack with TAB and craft it.', done: g => g.tools.rod > 0 },
  { text: 'Dig up some bait', hint: 'Dig worms from dirt mounds — hold E.', done: g => g.count('worm') + g.count('lure') > 0 || g.stats.caught > 0 },
  { text: 'Catch your first fish', hint: 'Select the rod (2), hold the mouse to charge a cast, wait for the bobber to dip, then click and hold to reel.', done: g => g.stats.caught > 0 },
  { text: "Sell a fish at Mabel's stand", hint: 'The market stand is just east of where you woke up.', done: g => g.stats.sold > 0 },
  { text: 'Craft a Stone Axe', hint: 'You need fiber — tall pale grass near the shore. Plus sticks and stones.', done: g => g.tools.axe > 0 },
  { text: 'Chop down a tree', hint: 'Equip the axe and swing at a trunk. Collect the logs.', done: g => g.stats.chopped > 0 },
  { text: 'Lay the house foundation', hint: 'The building plot is on the east shore. Look for the sign.', done: g => g.house >= 1 },
  { text: 'Raise the log walls', hint: 'Mabel sells nails.', done: g => g.house >= 2 },
  { text: 'Put on a roof', hint: 'Split logs into planks in your pack.', done: g => g.house >= 3 },
  { text: 'Make it cozy inside', hint: 'Furnish the house — then you can sleep there.', done: g => g.house >= 4 },
  { text: 'Build a rowboat', hint: 'The boat site is at the base of the dock.', done: g => g.boat },
  { text: 'Land a legendary fish', hint: 'Deep water in the middle of the pond, with a Carbon Rod or better.', done: g => g.stats.legendary > 0 },
  { text: 'Fill the fish journal', hint: 'Every fish, every season. Press J.', done: g => Object.keys(g.journal).length >= FISH.length },
];
