/** One-card offer. Stamp list and city budget. Does not size a board. */

function Planner() {}

Planner.INTRO = {
  1: { stamps: ["33"], cities: 3, clip: 0 },
  2: { stamps: ["33"], cities: 4, clip: 1 },
  3: { stamps: ["33", "33"], cities: 4, clip: 0 },
  4: { stamps: ["33", "35"], cities: 5, clip: 0 },
  6: { stamps: ["33", "53"], cities: 6, clip: 0 },
  8: { stamps: ["33", "55"], cities: 6, clip: 0 },
  12: { stamps: ["33", "33", "51"], cities: 8, clip: 0 },
  13: { stamps: ["33", "35", "15"], cities: 8, clip: 0 },
};

Planner.offer = function (wave) {
  const w = wave > 0 ? wave : 1;
  const scripted = Planner.INTRO[w];
  if (scripted) {
    return [{ plan: Plan.copy({ wave: w, stamps: scripted.stamps, cities: scripted.cities, clip: scripted.clip }), locked: false }];
  }
  let count = 1 + (((w - 1) / 4) | 0);
  if (count > 9) count = 9;
  const open = [];
  let total = 0;
  const ids = Object.keys(Grid.STAMP_DEFINITIONS);
  for (let i = 0; i < ids.length; i++) {
    const piece = Grid.STAMP_DEFINITIONS[ids[i]];
    if (piece.minlevel > w) continue;
    open.push(ids[i]);
    total += piece.p;
  }
  const stamps = [];
  for (let n = 0; n < count; n++) {
    let roll = Math.random() * total;
    let pick = open[open.length - 1];
    for (let i = 0; i < open.length; i++) {
      roll -= Grid.STAMP_DEFINITIONS[open[i]].p;
      if (roll < 0) {
        pick = open[i];
        break;
      }
    }
    stamps.push(pick);
  }
  let cities = 3 + (((w - 1) / 2) | 0);
  if (cities > 12) cities = 12;
  return [{ plan: Plan.copy({ wave: w, stamps: stamps, cities: cities, clip: 0 }), locked: false }];
};
