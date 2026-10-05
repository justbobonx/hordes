/** Story page catalog. Game decides when to show. */

const StoryPages = {
  start: [
    {
      swatch: "#c4392f",
      text: "Red is the horde\nBlue is a city\nGreen is just ground\nDrop the stamps in order\nCover the red\nMiss the blue",
    },
    {
      swatch: "#3f8f45",
      text: "Press a cell to aim\nDrag the mark, release to drop\nSlide off the grid to cancel\nRed turns green with an X\nGround hit goes dark green\nBlue turns grey with an X\nThat wave is lost\nFinish the stamps anyway\nRESET puts the wave back",
    },
  ],
  first_col: {
    swatch: "#c4392f",
    text: "A column takes the whole file\nThe row you tap does not matter\nThe cell you tap is only the aim mark",
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
