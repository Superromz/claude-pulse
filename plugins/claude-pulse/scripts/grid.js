// GitHub-style contribution grid, shared by the status line and the dashboard:
// one column per week (oldest on the left), Sunday to Saturday from top to
// bottom, month names above. Each day is a square with a gap around it.
'use strict';

const L = require('./lib');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const PALETTES = {
  red: [[56, 42, 46], [110, 36, 52], [165, 44, 66], [220, 62, 86], [255, 104, 124]],
  green: [[52, 58, 64], [14, 68, 41], [0, 109, 50], [38, 166, 65], [57, 211, 83]],
  blue: [[46, 52, 66], [22, 58, 110], [30, 92, 170], [56, 136, 224], [120, 190, 255]],
  purple: [[54, 46, 64], [70, 40, 120], [110, 60, 180], [155, 100, 230], [200, 160, 255]],
};

// GitHub-style intensity, 0 (no activity) to 4, with thresholds at the
// quartiles of the active days so a heavy month doesn't wash out the rest.
function levels(daily) {
  const vals = Object.values(daily).filter((v) => v > 0).sort((a, b) => a - b);
  const q = (p) => vals[Math.min(vals.length - 1, Math.floor(p * vals.length))] || 0;
  const cut = [q(0.25), q(0.5), q(0.75)];
  return (v) => (!v ? 0 : v <= cut[0] ? 1 : v <= cut[1] ? 2 : v <= cut[2] ? 3 : 4);
}

function cell(level, cfg = {}) {
  if (cfg.ascii) return '.-+*#'[level] || '.';
  const pal = PALETTES[cfg.palette] || PALETTES.green;
  return L.rgb(pal[level] || pal[0], '■');
}

// Width in cells of a grid with `weeks` columns (day labels included).
const gridWidth = (weeks) => 5 + weeks * 2 - 1;

// How many weeks fit in `room` cells (0 if not even two months do).
function weeksFor(room, max = 53) {
  const w = Math.min(max, Math.floor((room - 4) / 2));
  return w >= 8 ? w : 0;
}

// The days shown: cols[week][weekday] is a day key, or null after today.
function weekDays(weeks, now = Date.now()) {
  const today = new Date(now);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay() - (weeks - 1) * 7, 12);
  const last = L.dayKey(now);
  return Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => {
    const key = L.dayKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d, 12).getTime());
    // Compare calendar days, not times: today counts from midnight.
    return key > last ? null : key;
  }));
}

// Where a day's square sits inside the grid lines: weekday d is line d + 1,
// week w is at cell GRID_LEFT + 2w.
const GRID_LEFT = 5;

// 8 lines: month names, then one line per weekday. Every line is exactly
// gridWidth(weeks) cells wide. `link(day)`, when given, returns the target of
// an OSC 8 hyperlink around a day's square (it takes no space on screen).
function weekGrid(daily, weeks, cfg = {}, now = Date.now(), link = null) {
  daily = daily || {};
  const level = levels(daily);
  const cols = weekDays(weeks, now);

  // Month name over the first week that starts in that month, when it fits.
  let months = '', at = 0;
  cols.forEach((c, w) => {
    const first = new Date(`${c[0]}T12:00:00`);
    if (first.getDate() <= 7 && w * 2 >= at && w * 2 + 3 <= weeks * 2 - 1) {
      months += ' '.repeat(w * 2 - at) + MONTHS[first.getMonth()];
      at = w * 2 + 3;
    }
  });
  const width = gridWidth(weeks);
  const lines = [L.padVis(`     ${L.paint('gray', months)}`, width)];
  const names = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
  for (let d = 0; d < 7; d++) {
    const row = cols.map((c) => {
      if (!c[d]) return ' ';
      const sq = cell(level(daily[c[d]]), cfg);
      const url = link && daily[c[d]] ? link(c[d]) : null;
      return url ? `\x1b]8;;${url}\x07${sq}\x1b]8;;\x07` : sq;
    }).join(' ');
    lines.push(L.padVis(`${L.paint('gray', names[d].padEnd(4))} ${row}`, width));
  }
  return lines;
}

function legend(cfg = {}) {
  return `${L.paint('gray', 'Less')} ${[0, 1, 2, 3, 4].map((n) => cell(n, cfg)).join(' ')} ${L.paint('gray', 'More')}`;
}

const shortDate = (key) => { const d = new Date(`${key}T12:00:00`); return `${MONTHS[d.getMonth()]} ${d.getDate()}`; };

// "Fri, Nov 14" for tooltips.
const longDate = (key) => new Date(`${key}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

module.exports = { MONTHS, PALETTES, GRID_LEFT, levels, cell, gridWidth, weeksFor, weekDays, weekGrid, legend, shortDate, longDate };
