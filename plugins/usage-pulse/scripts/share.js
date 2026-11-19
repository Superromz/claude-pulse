// /usage-pulse:share: your year of activity as an SVG card to post. Plain
// SVG with no fonts, images or scripts from elsewhere, in your grid colors.
// It leaves out cost and project names, since it's meant to be shared.
'use strict';

const fs = require('fs');
const path = require('path');
const L = require('./lib');
const G = require('./grid');

const CARD_FILE = path.join(L.HOME, 'activity-card.svg');
const FONT = 'system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function card(lt, cfg = L.loadConfig(), now = Date.now()) {
  const weeks = 53;
  const step = 14;
  const size = 11;
  const pad = 28;
  const cols = G.weekDays(weeks, now);
  const level = G.levels(lt.daily || {});
  const pal = (G.PALETTES[cfg.palette] || G.PALETTES.green).map(([r, g, b]) => `rgb(${r},${g},${b})`);
  const W = pad * 2 + weeks * step - (step - size);
  const gridTop = 128;
  const H = gridTop + 7 * step + 52;

  const stats = [
    [L.fmtTokens(lt.tokens), 'tokens with Claude'],
    [String(lt.activeDays || 0), 'active days'],
    [`${lt.streak || 0} days`, `streak · best ${lt.longest || 0}`],
    lt.best ? [G.shortDate(lt.best.day), `busiest day · ${L.fmtTokens(lt.best.tokens)} tokens`] : null,
  ].filter(Boolean);
  const colW = (W - pad * 2) / stats.length;
  const statSvg = stats.map(([big, small], i) => {
    const x = pad + i * colW;
    return `<text x="${x}" y="70" font-size="26" font-weight="700" fill="#f0f3f6">${esc(big)}</text>`
      + `<text x="${x}" y="90" font-size="12" fill="#9198a1">${esc(small)}</text>`;
  }).join('');

  const months = cols.map((c, w) => {
    const first = new Date(`${c[0]}T12:00:00`);
    return first.getDate() <= 7 ? `<text x="${pad + w * step}" y="${gridTop - 8}" font-size="10" fill="#9198a1">${G.MONTHS[first.getMonth()]}</text>` : '';
  }).join('');
  const cells = cols.map((c, w) => c.map((day, d) => (day
    ? `<rect id="d${day}" x="${pad + w * step}" y="${gridTop + d * step}" width="${size}" height="${size}" rx="2" fill="${pal[level((lt.daily || {})[day])]}"><title>${esc(G.longDate(day))}</title></rect>`
    : '')).join('')).join('');
  // "Less ■ ■ ■ ■ ■ More" in the bottom right corner.
  const right = W - pad - 30;
  const legend = `<text x="${right - 5 * step - 6}" y="${H - 21}" font-size="11" fill="#656c76" text-anchor="end">Less</text>`
    + pal.map((p, i) => `<rect x="${right - (5 - i) * step}" y="${H - 30}" width="${size}" height="${size}" rx="2" fill="${p}"/>`).join('')
    + `<text x="${right + 3}" y="${H - 21}" font-size="11" fill="#656c76">More</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">`
    + `<rect width="${W}" height="${H}" rx="12" fill="#0d1117"/>`
    + `<text x="${pad}" y="36" font-size="14" font-weight="600" fill="#9198a1">My year with Claude</text>`
    + statSvg + months + cells
    + `<text x="${pad}" y="${H - 21}" font-size="11" fill="#656c76">Usage Pulse · since ${esc(lt.since ? `${G.shortDate(lt.since)}, ${lt.since.slice(0, 4)}` : 'the start')}</text>`
    + legend
    + '</svg>\n';
}

function writeCard(lt, cfg, now) {
  fs.mkdirSync(path.dirname(CARD_FILE), { recursive: true });
  fs.writeFileSync(CARD_FILE, card(lt, cfg, now));
  return CARD_FILE;
}

module.exports = { CARD_FILE, card, writeCard };
