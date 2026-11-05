# Cozyfish 🎣

A cozy, warm-glow voxel fishing & survival-lite game that runs in the browser — Three.js, no build step.

Wake up by a quiet pond in the deep woods. Gather sticks and find string to make your first rod, dig up worms,
catch fish and sell them at Mabel's market stand. Upgrade your gear, chop trees, raise a log cabin block by block,
build a rowboat and go after the legendary fish in the deep middle of the pond. Pick the season you want to live in:
spring, summer, fall or winter (ice fishing!).

![Fishing off the dock at sunset](docs/screenshots/gameplay-dock.png)

## Play

**Online (GitHub Pages):** this repo is a static site with no build step, so GitHub Pages can host it as-is.
In the repo's **Settings → Pages**, set *Source* to **Deploy from a branch**, pick the branch that has these files
(e.g. `main` after merging) and the **/ (root)** folder. The game appears at
`https://<your-user>.github.io/<repo>/` a minute later. (`.nojekyll` is included so Pages serves every file untouched.)

**Locally:** serve the folder with any static file server and open `index.html`:

```sh
python3 -m http.server 8000
# → http://localhost:8000
```

Works with mouse & keyboard or touch (phones and tablets, best in landscape).

| Keyboard & mouse | Touch | Action |
|---|---|---|
| **WASD**, Shift to sprint | Left thumb joystick (push far to run) | Walk |
| **Mouse** (click the game to capture it) | Drag with right thumb | Look |
| **Space** | ▲ button | Jump · swim up |
| **C** | — | Dive while swimming |
| **E** (hold on dirt mounds) | **E** button, or tap the thing | Pick up · talk · dig |
| **Left click** (hold to charge a cast, hold to reel) | Big **Use** button | Cast & reel, chop, throw |
| **1–5 / wheel** | Tap the hotbar | Hands · Rod · Axe · Stones · Lantern |
| **J** / **Tab** | Book button | Field journal: tasks, pack, crafting, fish, map |
| **F** | — | Toggle lantern |
| **Esc** | **II** button | Menu: season, settings, save |

Rest any time in the old tent, by a campfire, or in your own bed: nap until evening or sleep through to morning.
A small compass at the top shows the directions, landmarks and where your current task is.

**Battery & smoothness:** the menu has Low / Medium / High graphics and a 30 or 60 fps cap. Phones default to
Medium at 30 fps. Resolution drops automatically if frames run slow, shadows refresh only every few frames,
trees outside your view aren't drawn, menus run at a low frame rate, and audio sleeps when the game is in the background.

The HUD stays out of the way: just your hotbar, plus meters that only appear when they matter (warmth, casting,
line tension). New tasks are announced briefly; turn on *Pin current task* or *Show minimap* in the menu if you
like them always visible.

## The loop

1. **Gather** sticks, stones and fiber around the pond. Old crates hide in the woods — the abandoned campsite to
   the north has string.
2. **Craft** a Stick Rod (3 sticks + 1 string). **Dig** worms from dirt mounds for bait.
3. **Fish** — hold to charge a cast, wait for the bobber to plunge (nibbles are fakes!), click to hook, then hold to
   reel. Ease off when the fish pulls or the line snaps.
4. **Sell** at Mabel's stand. **Buy** better rods (Willow → Carbon → Golden), an iron axe, lanterns, nails, lures.
5. **Chop** trees with a Stone Axe — they topple with physics and break into logs (which float if they land in the
   pond). Split logs into planks.
6. **Build** your cabin in four stages (foundation, walls, roof, cozy interior) — then sleep in your own bed.
7. **Build a rowboat** at the dock and fish the deep water. Legendary fish need a Carbon Rod or better.
8. **Fill the journal** — 21 species (and some junk), different in every season, some only at night.

Also: skip stones across the pond, build campfires to warm up (winter and wet clothes are chilly), swim and dive,
watch the ducks, and catch the golden hour — fish bite faster at dusk.

## Code tour

| File | What |
|---|---|
| `src/main.js` | Game state, loop, input, interaction, economy, save/load |
| `src/config.js` | Seasons, items, fish, recipes, shop, building costs, goals — tune the game here |
| `src/terrain.js` | Heightmap voxel world, pond, paths, water/ice shader |
| `src/trees.js` | Instanced choppable trees with fall physics |
| `src/props.js` | Gatherables and ground cover |
| `src/structures.js` | Market, dock, campsite, signs, campfires, house stages |
| `src/player.js` | First-person voxel physics, swimming, held-item view model |
| `src/fishing.js` | Casting, bobber, bites, tension fight |
| `src/boat.js`, `src/life.js` | Rowboat; ducks & jumping fish |
| `src/sky.js`, `src/render.js` | Day/night sky, sun/moon, god rays, bloom, warm grade |
| `src/mesher.js`, `src/models.js` | Voxel mesher with baked AO, pixel-grain shader, all the little models |
| `src/particles.js`, `src/audio.js` | Particles & weather, procedural sound & music |
| `src/ui.js`, `src/icons.js`, `src/touch.js` | HUD & field-journal menus, icons rendered from the voxel models, touch controls |

`preview.html?season=fall&time=17.5&view=hill` renders still shots of the world (views: shore, aerial, woods, dock,
low, sunset, hill, forest, forest2). `index.html?test` runs the game with a manually stepped clock for automated
playtests (`game.step(n)`).

Progress saves automatically to your browser (localStorage).

## Screenshots

![Title](docs/screenshots/title.png)
![Mabel's market at night](docs/screenshots/gameplay-market-night.png)
![Summer sunset](docs/screenshots/summer-17.9-sunset.png)

![Golden hour over the pond](docs/screenshots/summer-17.6-hill.png)
![Walking through the fall woods](docs/screenshots/fall-17.2-forest2.png)

| | |
|---|---|
| ![Fall sunset](docs/screenshots/fall-18.3-shore.png) | ![Fall morning mist](docs/screenshots/fall-8-aerial.png) |
| ![Winter ice](docs/screenshots/winter-14-low.png) | ![Summer night](docs/screenshots/summer-21.3-low.png) |

Three.js r160 is vendored in `vendor/three` (MIT).
