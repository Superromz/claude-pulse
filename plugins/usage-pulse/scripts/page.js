// A local web page with your activity grid and real hover tooltips, opened
// with /usage-pulse:activity. Written by the background scan; never served
// online. Also the hover text for the status line's squares.
'use strict';

const fs = require('fs');
const path = require('path');
const L = require('./lib');
const G = require('./grid');

const PAGE_FILE = path.join(L.HOME, 'activity.html');

// What a terminal shows when you hover a day's square in the status line:
// "Thu, Nov 19 | 259M tokens | 565 replies". Terminals show a hyperlink's
// target on hover, so the target is this text rather than an address. OSC 8
// targets may only hold printable ASCII, hence "|" instead of a box line.
function dayHover(day, lt) {
  const tokens = (lt.daily || {})[day] || 0;
  const replies = (lt.replies || {})[day];
  const parts = [G.longDate(day), `${L.fmtTokens(tokens)} tokens`];
  if (replies) parts.push(`${replies.toLocaleString('en-US')} replies`);
  return parts.join(' | ').replace(/[^\x20-\x7e]/g, '');
}

// Open the page in the default browser.
function openPage() {
  const { spawn } = require('child_process');
  const [cmd, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', PAGE_FILE]]
    : process.platform === 'darwin' ? ['open', [PAGE_FILE]] : ['xdg-open', [PAGE_FILE]];
  spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: true }).unref();
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function writePage(lt, cfg = L.loadConfig(), now = Date.now()) {
  const weeks = 53;
  const cols = G.weekDays(weeks, now);
  const level = G.levels(lt.daily || {});
  const pal = (G.PALETTES[cfg.palette] || G.PALETTES.green).map(([r, g, b]) => `rgb(${r},${g},${b})`);
  const tip = (day) => {
    const t = (lt.daily || {})[day] || 0;
    const r = (lt.replies || {})[day];
    return t ? `${L.fmtTokens(t)} tokens${r ? ` · ${r.toLocaleString('en-US')} replies` : ''} on ${G.longDate(day)}` : `No activity on ${G.longDate(day)}`;
  };
  const months = cols.map((c, w) => {
    const first = new Date(`${c[0]}T12:00:00`);
    return first.getDate() <= 7 ? `<span style="grid-column:${w + 1}">${G.MONTHS[first.getMonth()]}</span>` : '';
  }).join('');
  const cells = cols.map((c, w) => c.map((day, d) => (day
    ? `<i id="d${day}" style="grid-column:${w + 1};grid-row:${d + 1};background:${pal[level((lt.daily || {})[day])]}" data-tip="${esc(tip(day))}"></i>`
    : '')).join('')).join('');
  const year = Object.values(lt.daily || {}).reduce((s, n) => s + n, 0);
  const stats = [
    `<b>${L.fmtTokens(lt.tokens)}</b> tokens in total`,
    `<b>${lt.activeDays}</b> active days`,
    `current streak <b>${lt.streak || 0}</b> days`,
    `longest <b>${lt.longest || 0}</b> days`,
    lt.best ? `busiest day <b>${G.shortDate(lt.best.day)}</b> (${L.fmtTokens(lt.best.tokens)})` : '',
  ].filter(Boolean).join(' · ');

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Usage Pulse activity</title>
<style>
:root{--bg:#0d1117;--fg:#e6edf3;--dim:#8b949e;--card:#161b22;--line:#30363d}
@media (prefers-color-scheme:light){:root:not([data-theme="dark"]){--bg:#f6f8fa;--fg:#1f2328;--dim:#59636e;--card:#fff;--line:#d1d9e0}}
body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;padding:32px 16px}
main{max-width:980px;margin:0 auto}
h1{font-size:20px;margin:0 0 4px}p{color:var(--dim);margin:0 0 20px}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:18px 18px 14px;overflow-x:auto}
.wrap{display:grid;grid-template-columns:32px auto;gap:6px 6px;width:max-content}
.months,.grid{display:grid;grid-template-columns:repeat(${weeks},13px);gap:3px}
.months{font-size:11px;color:var(--dim);height:16px}.months span{white-space:nowrap}
.days{display:grid;grid-template-rows:repeat(7,13px);gap:3px;font-size:11px;color:var(--dim)}
.grid{grid-template-rows:repeat(7,13px)}
.grid i{border-radius:3px;outline:1px solid rgba(127,127,127,.08);outline-offset:-1px}
.grid i:hover,.grid i.on{outline:2px solid var(--fg);outline-offset:0}
.legend{display:flex;gap:4px;align-items:center;justify-content:flex-end;font-size:11px;color:var(--dim);margin-top:10px}
.legend i{width:13px;height:13px;border-radius:3px;display:inline-block}
.stats{margin-top:16px;color:var(--dim)}.stats b{color:var(--fg)}
#tip{position:fixed;pointer-events:none;background:#1f2328;color:#fff;font-size:12px;padding:6px 9px;border-radius:6px;white-space:nowrap;opacity:0;transform:translate(-50%,-130%);transition:opacity .08s}
</style></head><body><main>
<h1>${L.fmtTokens(year)} tokens in the last year</h1>
<p>Your Claude Code activity, day by day. Updated ${esc(new Date(now).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }))}.</p>
<div class="card">
<div class="wrap"><div></div><div class="months">${months}</div>
<div class="days"><span></span><span>Mon</span><span></span><span>Wed</span><span></span><span>Fri</span><span></span></div>
<div class="grid">${cells}</div></div>
<div class="legend">Less ${pal.map((c) => `<i style="background:${c}"></i>`).join('')} More</div>
</div>
<div class="stats">${stats}</div>
</main><div id="tip"></div>
<script>
const tip = document.getElementById('tip');
const show = (el) => { const r = el.getBoundingClientRect(); tip.textContent = el.dataset.tip; tip.style.left = (r.left + r.width / 2) + 'px'; tip.style.top = r.top + 'px'; tip.style.opacity = 1; };
document.querySelectorAll('.grid i').forEach((el) => { el.addEventListener('mouseenter', () => show(el)); el.addEventListener('mouseleave', () => { tip.style.opacity = 0; }); });
// Opened with a day in the address (#2026-11-14): highlight it.
const day = (location.hash.match(/\\d{4}-\\d{2}-\\d{2}/) || [])[0];
const el = day && document.getElementById('d' + day);
if (el) { el.classList.add('on'); el.scrollIntoView({ inline: 'center', block: 'nearest' }); setTimeout(() => show(el), 50); }
</script></body></html>
`;
  fs.mkdirSync(L.HOME, { recursive: true });
  fs.writeFileSync(PAGE_FILE, html);
  return PAGE_FILE;
}

module.exports = { PAGE_FILE, dayHover, openPage, writePage };
