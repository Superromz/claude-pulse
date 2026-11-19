#!/usr/bin/env node
// Full usage dashboard: plan limits, spending, open sessions, daily activity,
// projects and models.
//
//   dash.js            print once
//   dash.js --live     keep it open and refresh every 2 seconds (q to quit)
'use strict';

const L = require('./lib');
const S = require('./scan');
const G = require('./grid');
const { paint } = L;

const label = (s) => paint('gray', s);
const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function clockTime(t) {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function dayLabel(key, today) {
  const d = new Date(`${key}T12:00:00`);
  if (key === today) return 'Today    ';
  return `${WEEKDAY[d.getDay()]} ${String(d.getMonth() + 1).padStart(2, ' ')}/${String(d.getDate()).padStart(2, '0')}`;
}

const allTokens = (t) => t.input + t.output + t.cacheRead + t.cacheWrite;

function section(title, width) {
  const dash = L.loadConfig().ascii ? '-' : '─';
  const line = dash.repeat(Math.max(0, width - L.visWidth(title) - 4));
  return `\n${paint('gray', dash + dash)} ${paint('bold', title)} ${paint('gray', line)}`;
}

// The past year as a GitHub-style grid, with lifetime totals below. Fills
// `hits` with where each day's square lands, for hover in the live view.
function yearGrid(lt, width, now, cfg, hits, firstLine) {
  const weeks = G.weeksFor(width - 4);
  if (hits) {
    // Lines: title, blank, month names, then Sun..Sat; 2-cell indent.
    G.weekDays(weeks, now).forEach((c, w) => c.forEach((day, d) => {
      if (day) hits.push({ line: firstLine + 3 + d, col: 2 + G.GRID_LEFT + w * 2, day });
    }));
  }
  const yearTokens = Object.values(lt.daily || {}).reduce((s, n) => s + n, 0);
  const out = [`  ${paint('bold', L.fmtTokens(yearTokens))} ${label('tokens in the last year')}`, ''];
  out.push(...G.weekGrid(lt.daily, weeks, cfg, now).map((l) => `  ${l}`));
  const stats = [
    `${paint('bold', L.fmtTokens(lt.tokens))} ${label('tokens in total')}`,
    `${paint('white', lt.activeDays)} ${label('active days')}`,
    `${label('current streak')} ${paint('white', `${lt.streak || 0} ${lt.streak === 1 ? 'day' : 'days'}`)}`,
    `${label('longest')} ${paint('white', `${lt.longest || 0} days`)}`,
    lt.best ? `${label('busiest day')} ${paint('white', G.shortDate(lt.best.day))} ${label(`(${L.fmtTokens(lt.best.tokens)})`)}` : '',
    lt.since ? `${label('since')} ${paint('white', `${G.shortDate(lt.since)}, ${lt.since.slice(0, 4)}`)}` : '',
  ].filter(Boolean).join(label('  ·  '));
  out.push('', `  ${stats}`, `  ${G.legend(cfg)}`);
  return out;
}

function render({ width = 100, now = Date.now(), hits = null } = {}) {
  width = Math.max(70, Math.min(130, width));
  const cfg = L.loadConfig();
  const out = [];
  const sessions = L.loadSessions(35);
  const usage = S.loadUsage();
  const today = L.dayKey(now);

  out.push(`${paint('bold', ' Claude Usage')}${' '.repeat(Math.max(1, width - 13 - 25))}${label(new Date(now).toDateString() + ' ' + clockTime(now))}`);

  // ---- plan limits ----
  out.push(section('Plan limits', width));
  const lim = L.latestLimits(sessions);
  if (!lim || (!lim.five_hour && !lim.seven_day)) {
    out.push(`  ${label('Shows up after your next message in Claude Code (Pro and Max plans only).')}`);
  } else {
    for (const [key, name] of [['five_hour', '5-hour limit'], ['seven_day', 'Weekly limit']]) {
      const w = L.windowInfo(key, lim[key], now);
      if (!w) continue;
      const barW = Math.max(16, Math.min(40, width - 70));
      const reset = w.left != null ? `resets in ${L.fmtDur(w.left)} (${key === 'five_hour' ? clockTime(now + w.left * 1000) : new Date(now + w.left * 1000).toDateString().slice(0, 10)})` : '';
      let pace = '';
      if (w.used >= 100) pace = paint('red', 'Limit reached');
      else if (w.fast) pace = paint('yellow', `At this pace you'll run out before it resets`);
      else if (w.projected != null) pace = paint('green', 'On track');
      out.push(`  ${L.padVis(name, 13)} ${L.gauge(w.used / 100, barW, L.heat(w.used), cfg.ascii)} ${paint(L.heat(w.used), `${String(Math.round(w.used)).padStart(3)}%`)}  ${label(reset)}`);
      if (pace) out.push(`  ${' '.repeat(13)} ${pace}`);
    }
    const age = (now - lim.at) / 1000;
    if (age > 120) out.push(`  ${label(`Last updated ${L.fmtDur(age)} ago`)}`);
  }

  // ---- spending ----
  out.push(section('Spending', width));
  const sum = (days) => days.reduce((s, d) => s + L.spentOn(sessions, d), 0);
  const tracked = sessions.flatMap((s) => Object.keys(s.days || {})).sort()[0];
  const cell = (name, v) => `${label(name)} ${paint('bold', L.fmtUsd(v))}`;
  const todayCell = cfg.budgetDaily > 0
    ? `${label('Today')} ${paint('bold', paint(L.heat((sum([today]) / cfg.budgetDaily) * 100), L.fmtUsd(sum([today]))))} ${label(`of ${L.fmtUsd(cfg.budgetDaily)}`)}`
    : cell('Today', sum([today]));
  out.push(`  ${[todayCell, cell('Yesterday', sum([L.dayKey(now - 86400000)])), cell('Last 7 days', sum(L.lastDays(7, now))), cell('Last 30 days', sum(L.lastDays(30, now)))].join('    ')}`);
  // Month to date against the monthly budget, like a plan limit.
  if (cfg.budgetMonthly > 0) {
    const month = sum(L.lastDays(new Date(now).getDate(), now));
    const pct = (month / cfg.budgetMonthly) * 100;
    const barW = Math.max(16, Math.min(40, width - 70));
    out.push(`  ${L.padVis(label('This month'), 13)} ${L.gauge(pct / 100, barW, L.heat(pct), cfg.ascii)} ${paint(L.heat(pct), `${String(Math.round(pct)).padStart(3)}%`)}  ${paint('bold', L.fmtUsd(month))} ${label(`of ${L.fmtUsd(cfg.budgetMonthly)} monthly budget`)}`);
    // Recent sessions only go back 35 days, so when they start after the 1st,
    // look at every session to tell "tracking started this month" from "no
    // use earlier this month".
    const monthStart = L.dayKey(new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime());
    const started = tracked && tracked > monthStart && L.loadSessions(36500).flatMap((s) => Object.keys(s.days || {})).sort()[0];
    if (started && started > monthStart) out.push(`  ${label(`Only counts from ${started}, when tracking started; earlier days this month aren't included.`)}`);
  }
  out.push(`  ${label(tracked ? `Cost as Claude Code reports it. Tracked since ${tracked}.` : 'Cost is tracked from now on, as Claude Code reports it.')}`);

  // ---- year grid ----
  const lt = S.loadLifetime();
  if (lt && lt.tokens) {
    out.push(section('Your activity', width));
    out.push(...yearGrid(lt, width, now, cfg, hits, out.join('\n').split('\n').length));
  }

  // ---- open sessions ----
  const open =sessions.filter((s) => now - (s.seen || 0) < 10 * 60000).sort((a, b) => b.seen - a.seen);
  out.push(section(`Open sessions (${open.length})`, width));
  if (!open.length) out.push(`  ${label('No Claude Code session active in the last 10 minutes.')}`);
  for (const s of open.slice(0, 8)) {
    const name = require('path').basename(s.project || '?');
    const pct = s.ctx ? s.ctx.pct : null;
    const ctx = pct != null ? `${label('Context')} ${L.gauge(pct / 100, 12, L.heat(pct), cfg.ascii)} ${paint(L.heat(pct), `${String(Math.round(pct)).padStart(3)}%`)}` : '';
    const cacheLeft = s.cache && s.cache.expires ? s.cache.expires - now / 1000 : null;
    const cache = cacheLeft != null ? (cacheLeft > 0 ? paint('cyan', `cache warm ${L.fmtDur(cacheLeft)}`) : label('cache cold')) : '';
    out.push(`  ${paint('green', cfg.ascii ? '*' : '●')} ${L.padVis(paint('bold', name.slice(0, 18)), 18)} ${L.padVis(label(s.model || ''), 10)} ${ctx}  ${L.padVis(paint('white', L.fmtUsd(s.cost || 0)), 9)} ${cache}`);
    if (s.name) out.push(`    ${label(String(s.name).slice(0, width - 6))}`);
  }

  // ---- activity ----
  out.push(section('Activity, last 14 days', width));
  if (!usage.scannedAt) out.push(`  ${label('Reading your Claude Code history…')}`);
  else {
    const days = L.lastDays(14, now);
    const per = days.map((d) => S.totals(usage, [d]).all);
    const max = Math.max(1, ...per.map(allTokens));
    const barW = Math.max(10, width - 52);
    days.forEach((d, i) => {
      const t = per[i];
      const tok = allTokens(t);
      const b = paint(d === today ? 'cyan' : 'blue', L.bar(tok / max, barW, cfg.ascii));
      const msgs = t.messages ? `${t.messages.toLocaleString('en-US')} replies` : '';
      out.push(`  ${paint(d === today ? 'bold' : 'gray', dayLabel(d, today))} ${b} ${L.padVis(paint('white', L.fmtTokens(tok)), 6)} ${label(L.padVis(msgs, 14))} ${label(t.output ? `${L.fmtTokens(t.output)} written` : '')}`);
    });
    out.push(`  ${label('Tokens Claude read and wrote per day (mostly re-read context from the cache).')}`);

    // ---- projects and models ----
    const week = S.totals(usage, L.lastDays(7, now));
    const projects = Object.entries(week.projects).sort((a, b) => allTokens(b[1]) - allTokens(a[1])).slice(0, 6);
    out.push(section('Projects, last 7 days', width));
    if (!projects.length) out.push(`  ${label('No activity this week.')}`);
    const total = allTokens(week.all) || 1;
    for (const [name, t] of projects) {
      const share = allTokens(t) / total;
      out.push(`  ${L.padVis(name.slice(0, 22), 22)} ${paint('magenta', L.bar(share, Math.max(10, width - 52), cfg.ascii))} ${paint('white', `${String(Math.round(share * 100)).padStart(3)}%`)}  ${label(`${t.messages.toLocaleString('en-US')} replies`)}`);
    }

    out.push(section('Models, last 7 days', width));
    for (const [name, t] of Object.entries(week.models).sort((a, b) => allTokens(b[1]) - allTokens(a[1]))) {
      const fresh = t.input + t.cacheWrite + t.cacheRead;
      const hit = fresh ? t.cacheRead / fresh : 0;
      out.push(`  ${L.padVis(paint('bold', name), 12)} ${label('replies')} ${paint('white', t.messages.toLocaleString('en-US'))}   ${label('written')} ${paint('white', L.fmtTokens(t.output))}   ${label('new input')} ${paint('white', L.fmtTokens(t.input + t.cacheWrite))}   ${label('from cache')} ${paint('cyan', `${Math.round(hit * 100)}%`)}`);
    }
  }
  out.push('');
  return out.join('\n');
}

// Tooltip text for a day in the grid.
function dayTip(day) {
  const lt = S.loadLifetime() || {};
  const t = (lt.daily || {})[day] || 0;
  const r = (lt.replies || {})[day];
  return `${G.longDate(day)} · ${t ? `${L.fmtTokens(t)} tokens` : 'no activity'}${r ? ` · ${r.toLocaleString('en-US')} replies` : ''}`;
}

function live() {
  const { spawn } = require('child_process');
  const rescan = () => spawn(process.execPath, [require('path').join(__dirname, 'scan.js'), '--quiet'], { stdio: 'ignore', windowsHide: true });
  let scanner = rescan(), lastScan = Date.now();
  scanner.on('exit', () => { scanner = null; });
  let frame = '', hits = [], hover = null;
  const footer = label('  Hover a square for its day. Refreshes every 2 seconds. Press q to quit.');
  const paintFrame = () => {
    let out = `\x1b[H\x1b[2J${frame}\n${footer}`;
    if (hover) {
      // A small box just below and right of the pointer, kept on screen.
      const text = ` ${dayTip(hover.day)} `;
      const cols = process.stdout.columns || 100;
      const x = Math.max(1, Math.min(hover.x + 2, cols - L.visWidth(text)));
      out += `\x1b[${hover.y + 1};${x}H\x1b[48;2;40;44;52m\x1b[38;2;235;235;235m${text}\x1b[0m`;
    }
    process.stdout.write(out);
  };
  const draw = () => {
    if (!scanner && Date.now() - lastScan > 30000) { scanner = rescan(); lastScan = Date.now(); scanner.on('exit', () => { scanner = null; }); }
    hits = [];
    frame = render({ width: process.stdout.columns || 100, hits });
    paintFrame();
  };
  // Pointer at (x, y), 1-based terminal cells: which day's square is under it?
  const dayAt = (x, y) => hits.find((h) => h.line === y - 1 && h.col === x - 1) || null;
  const quit = () => { process.stdout.write('\x1b[?1003l\x1b[?1006l\x1b[?25h\x1b[?1049l'); process.exit(0); };
  // Alternate screen, hidden cursor, and mouse motion reports (SGR format).
  process.stdout.write('\x1b[?1049h\x1b[?25l\x1b[?1003h\x1b[?1006h');
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', (b) => {
      const k = b.toString();
      if (k === 'q' || k === '\x1b' || k === '\x03') return quit();
      const m = [...k.matchAll(/\x1b\[<(\d+);(\d+);(\d+)[mM]/g)].pop();
      if (!m) return;
      const x = Number(m[2]), y = Number(m[3]);
      const h = dayAt(x, y);
      const next = h ? { day: h.day, x, y } : null;
      if ((next && next.day) !== (hover && hover.day)) { hover = next; paintFrame(); }
    });
  }
  process.on('SIGINT', quit);
  process.stdout.on('resize', draw);
  draw();
  setInterval(draw, 2000);
}

module.exports = { render, dayTip };


if (require.main === module) {
  if (process.argv.includes('--live')) live();
  else {
    try { S.scanLocked(); } catch {}
    process.stdout.write(render({ width: Number(process.env.COLUMNS) || process.stdout.columns || 100 }));
  }
}
