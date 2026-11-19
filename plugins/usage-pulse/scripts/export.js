// /usage-pulse:export: daily usage as CSV (for spreadsheets) and JSON (with a
// breakdown per project and model), written to ~/.claude/pulse/exports/.
// Local files only; nothing is sent anywhere.
'use strict';

const fs = require('fs');
const path = require('path');
const L = require('./lib');
const S = require('./scan');

const DIR = path.join(L.HOME, 'exports');
const tokens = (t) => ({ input: t.input, output: t.output, cacheRead: t.cacheRead, cacheWrite: t.cacheWrite });

// One entry per day with usage or recorded cost. Cost is null before Usage
// Pulse started recording it, so a spreadsheet shows a blank, not $0.
function days(usage = S.loadUsage(), sessions = L.loadSessions(36500)) {
  const tracked = sessions.flatMap((s) => Object.keys(s.days || {})).sort()[0] || null;
  const keys = new Set(Object.keys(usage.days));
  for (const s of sessions) for (const d of Object.keys(s.days || {})) keys.add(d);
  return [...keys].sort().map((date) => {
    const t = S.totals(usage, [date]);
    const each = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { ...tokens(v), replies: v.messages }]));
    return {
      date,
      ...tokens(t.all),
      replies: t.all.messages,
      cost: tracked && date >= tracked ? Math.round(L.spentOn(sessions, date) * 100) / 100 : null,
      projects: each(t.projects),
      models: each(t.models),
    };
  });
}

// Header row, ISO dates, plain numbers: opens as-is in Excel, Google Sheets and Numbers.
function csv(list) {
  const head = 'date,input_tokens,output_tokens,cache_read_tokens,cache_write_tokens,total_tokens,replies,cost_usd';
  const row = (d) => [d.date, d.input, d.output, d.cacheRead, d.cacheWrite, d.input + d.output + d.cacheRead + d.cacheWrite, d.replies, d.cost == null ? '' : d.cost.toFixed(2)].join(',');
  return [head, ...list.map(row)].join('\n') + '\n';
}

// Writes today's files (a second export the same day replaces them) and returns their paths.
function exportUsage(now = Date.now()) {
  const list = days();
  fs.mkdirSync(DIR, { recursive: true });
  const base = path.join(DIR, `usage-${L.dayKey(now)}`);
  fs.writeFileSync(`${base}.csv`, csv(list));
  fs.writeFileSync(`${base}.json`, JSON.stringify({ exported: new Date(now).toISOString(), days: list }, null, 2) + '\n');
  return { csv: `${base}.csv`, json: `${base}.json`, days: list.length, from: list.length ? list[0].date : null };
}

module.exports = { DIR, days, csv, exportUsage };
