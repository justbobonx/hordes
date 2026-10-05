/** Story page catalog. Game decides when to show. */

const StoryPages = {
  start: [
    {
      swatch: "#c4392f",
      text:
`The hoard is coming!
We must protect our cities!`
    },
    {
      swatch: "#c4392f",
      text:
`Red cells are the horde.
Blue cells are cities.
Green is just grass.
`
    },
    {
      swatch: "#e07a2f",
      text: 
`Rid the horde with booms!
You only get so many.
Listed across the top.`
    },
    {
      swatch: "#e07a2f",
      text: 
`Tap and hold to aim a boom.
Release to drop.
Hit the horde!
Miss the cities!`
    } ],
  first_col: {
    swatch: "#c4392f",
    text: "A line takes out the whole row!",
  },
};

function Story() {}

Story.DEFAULT_SIZE = 64;

Story.isPage = function (p) {
  if (!p) return false;
  return !!(String(p.text || "").trim() || String(p.image || "").trim() || p.swatch);
};

Story.normPage = function (p) {
  return {
    image: p.image || "",
    swatch: p.swatch || "",
    sizex: p.sizex || Story.DEFAULT_SIZE,
    sizey: p.sizey || Story.DEFAULT_SIZE,
    text: String(p.text || ""),
  };
};

Story.pages = function (id) {
  if (!id) return [];
  const entry = StoryPages[id];
  if (!entry) return [];
  const list = Array.isArray(entry) ? entry : [entry];
  const out = [];
  for (let i = 0; i < list.length; i++) {
    if (!Story.isPage(list[i])) continue;
    out.push(Story.normPage(list[i]));
  }
  return out;
};
