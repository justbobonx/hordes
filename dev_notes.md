# horde — dev notes

Repo folder `horde`. Working title. Do not rewrite `README.md` unless asked.

Bump every `?v=` in `index.html` after script or css edits. Do not put the current stamp here.

## Files

- `index.html` — canvas, HUDs, overlays, script tags
- `css/style.css` — HUD, title, menus, overlays, end card, stamp tray
- `fonts/` — pixel type, same file foxes uses
- `js/cell.js` — cell data, draw, `CELL_TYPES`
- `js/grid.js` — live board, footprint, apply, dump / load. No generate
- `js/grid_builder.js` — drop stamps, backfill cities, `build`
- `js/plan.js` — wave spec and the one-card offer
- `js/story.js` — page catalog. Game decides when to show
- `js/save.js` — localStorage board and run
- `js/chrome.js` — fullscreen enter, wake lock. Enter stays on click
- `js/ui.js` — HUD, overlays, DOM wiring. Game keeps board state
- `js/game.js` — layout, input, flow, clock, draw

Load order matches the script tags in `index.html`. Grid before builder. Save before plan. Story before chrome before ui before game.

No `planner.js` yet. Path is one card from `Plan.offer`. No solver. Covers are not unique on purpose.

## Cell

`type`: `grass` | `city` | `horde` | `cleared` | `ruined`

`CELL_TYPES` look fields: `fill`, `mark`.

- grass — medium green, filler, a stamp does not change it
- city — blue, a stamp ruins it
- horde — red, a stamp clears it
- cleared — green with an X, was horde
- ruined — grey with an X, was city. Sticky loss

Helpers: `cell.is(name)`, `cell.setType(name)`.

Look is assigned in `Cell.dress`. Game calls it after build and after `Grid.load`.

## Plan

A plan is `{ wave, size, stamps[], cities }`.

Stamp kinds: `3`, `5`, `col`.

`Plan.forWave` is the temporary ramp. `Plan.offer` returns one unlocked card. Picking it does not roll a path. Next wave is just `wave + 1` after a clear.

`Plan.fromQuery` reads `?plan=` as JSON `{ size, stamps, cities }` or `size,stamps,cities` with stamps joined by `+` (`7,3+5+col,4`). Test plans do not advance the run.

## Build

`GridBuilder.build(plan)` makes `new Grid(size)` then:

1. Drop stamps in play order. First stamp has no overlap rule. Later stamps must cross current red and add new red. Clip at the edge is legal. A stamp inside the blob is rejected. A fully apart stamp is a late fallback.
2. Cap the red union near two thirds of the board. A column counts against that cap.
3. Paint `cities` on grass. Halo of the blob first, then farther grass. Never on red, or the authored drops would grey a city.

Half random: passing anchors are collected and one is picked. Not a best-score search.

## Grid

Square. `Grid.footprint(n, kind, row, col)` is the shared clip. Anchor must be on the board. `3` is radius 1, `5` is radius 2, `col` is every row of that column. Off-board cells are skipped.

`apply` turns horde into cleared and city into ruined. Grass, cleared, and ruined stay. Returns whether this drop ruined a city.

Dump stores `type` per cell plus `initial` types so RESET does not rebuild.

## Rules the player already has

- Stamps drop in order. Tray draws left to right, rightmost is live, eat from the right (`queue[0]` is live, `shift` on drop)
- Must use every stamp
- Partial footprints are legal
- Green is neither cleared nor ruined
- A ruined city fails the wave even if the red is gone
- Play continues until the queue is empty
- End card: no red and no grey is a clear. Any red or any grey is a miss. TRY AGAIN restores `initial`

## UI / input

Portrait. Top HUD is the tray plus wave. Board is the square in the leftover strip. Bottom is MENU and RESET.

Tap commits. Hold (~300ms) draws the outline and marks the anchor. Release on that cell drops. Leaving the cell cancels. A drop that greys a city still commits.

Fullscreen is `chrome.enter()` from the start click, the story continue click, and the plan click. Not from the stamp pointerup.

Overlays: start, menu, plan card, story, end. Menu is RESET / GIVE UP. Help replays the start story.

## Score / persist

Left HUD is stamps left. Mid is the wave. Right is clears.

Board key and run key are separate. Board dump: cells, initial, queue, plan, wave, lost, elapsedMs, ended. Run dump: wave, cleared, stories seen. Away time does not count.

Won or lost boards stay saved until the end button, GIVE UP, or a new wave.

## Next

- Plan path. One card until that exists
- Stamp art. Tray and story use drawn swatches
- Row stamp, when the column is boring
