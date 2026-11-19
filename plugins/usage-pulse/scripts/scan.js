#!/usr/bin/env node
// Token usage history from Claude Code's own transcripts
// (~/.claude/projects/**/*.jsonl). Reads each file incrementally from where
// the last scan stopped, so only new lines cost anything after the first run.
//
//   scan.js            update the totals in ~/.claude/pulse/usage.json
//   scan.js --quiet    same, no output (used by the status line in the background)
'use strict';

const fs = require('fs');
const path = require('path');
const L = require('./lib');

const USAGE_FILE = path.join(L.HOME, 'usage.json');
const LIFETIME_FILE = path.join(L.HOME, 'lifetime.json');
const STATS_CACHE = path.join(path.dirname(L.PROJECTS_DIR), 'stats-cache.json');
const LOCK = path.join(L.HOME, 'scan.lock');
const KEEP_DAYS = 400;

function emptyUsage() { return { version: 1, scannedAt: 0, files: {}, days: {} }; }

function listTranscripts(dir, out = []) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) listTranscripts(p, out);
    else if (e.name.endsWith('.jsonl')) out.push(p);
  }
  return out;
}

const blank = () => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0, messages: 0 });
function add(t, u) {
  t.input += u.input_tokens || 0;
  t.output += u.output_tokens || 0;
  t.cacheRead += u.cache_read_input_tokens || 0;
  t.cacheWrite += u.cache_creation_input_tokens || 0;
  t.messages += 1;
}

// Short model label: "claude-opus-5-5" -> "Opus 5.5".
function modelName(id) {
  const m = String(id || '').match(/claude-(?:\d+-\d+-)?([a-z]+)-(\d+)(?:-(\d+))?/i);
  if (!m) return id || 'unknown';
  return `${m[1][0].toUpperCase()}${m[1].slice(1)} ${m[2]}${m[3] && m[3].length <= 2 ? `.${m[3]}` : ''}`;
}

// Name a project after the folder the session started in; a worktree counts
// as the repository it belongs to.
function projectName(cwd) {
  if (!cwd) return 'unknown';
  const root = String(cwd).split(/[\\/]\.claude[\\/]worktrees[\\/]/)[0];
  return path.basename(root);
}

// Read new bytes of one transcript and fold its assistant messages into `usage`.
function scanFile(file, usage) {
  let st;
  try { st = fs.statSync(file); } catch { return; }
  const rec = usage.files[file] || { offset: 0, recent: [], project: null };
  if (st.size < rec.offset) { rec.offset = 0; rec.recent = []; } // rewritten file
  if (st.size === rec.offset) { usage.files[file] = rec; return; }

  const fd = fs.openSync(file, 'r');
  try {
    const CHUNK = 4 * 1024 * 1024;
    let pos = rec.offset, carry = '';
    const recent = new Set(rec.recent);
    while (pos < st.size) {
      const buf = Buffer.alloc(Math.min(CHUNK, st.size - pos));
      const n = fs.readSync(fd, buf, 0, buf.length, pos);
      if (!n) break;
      pos += n;
      const text = carry + buf.toString('utf8', 0, n);
      const lines = text.split('\n');
      carry = lines.pop();
      for (const line of lines) {
        // Cheap filter before JSON.parse: most lines are not usage records.
        if (!line.includes('"usage"') || !line.includes('"assistant"')) continue;
        let j;
        try { j = JSON.parse(line); } catch { continue; }
        const msg = j.message;
        if (j.type !== 'assistant' || !msg || !msg.usage || msg.model === '<synthetic>') continue;
        // One reply is logged once per content block with the same usage: count it once.
        const id = msg.id || j.requestId;
        if (id) { if (recent.has(id)) continue; recent.add(id); }
        const day = L.dayKey(Date.parse(j.timestamp) || st.mtimeMs);
        const d = usage.days[day] || (usage.days[day] = { models: {}, projects: {} });
        // Claude may cd into subfolders; keep the session's starting folder.
        if (!rec.project && j.cwd) rec.project = projectName(j.cwd);
        const model = modelName(msg.model), project = rec.project || 'unknown';
        add(d.models[model] || (d.models[model] = blank()), msg.usage);
        add(d.projects[project] || (d.projects[project] = blank()), msg.usage);
      }
    }
    // Leave a partial last line for the next scan.
    rec.offset = pos - Buffer.byteLength(carry, 'utf8');
    rec.recent = [...recent].slice(-64);
  } finally { fs.closeSync(fd); }
  usage.files[file] = rec;
}

function scan({ root = L.PROJECTS_DIR } = {}) {
  const usage = L.readJSON(USAGE_FILE, null) || emptyUsage();
  const files = listTranscripts(root);
  for (const f of files) scanFile(f, usage);
  // Forget deleted transcripts and very old days.
  const live = new Set(files);
  for (const f of Object.keys(usage.files)) if (!live.has(f)) delete usage.files[f];
  const oldest = L.dayKey(Date.now() - KEEP_DAYS * 86400000);
  for (const d of Object.keys(usage.days)) if (d < oldest) delete usage.days[d];
  usage.scannedAt = Date.now();
  L.writeJSON(USAGE_FILE, usage);
  try {
    const lt = lifetime(usage);
    L.writeJSON(LIFETIME_FILE, lt);
    require('./page').writePage(lt);
  } catch {}
  return usage;
}

// Lifetime totals for the status line, kept small so it can read them every
// second. Transcripts are pruned by Claude Code after a while, so days older
// than the oldest transcript come from Claude Code's own stats cache.
function lifetime(usage, statsFile = STATS_CACHE) {
  const days = new Map();
  for (const [day, d] of Object.entries(usage.days)) {
    const t = Object.values(d.models).reduce((s, m) => s + m.input + m.output + m.cacheRead + m.cacheWrite, 0);
    if (t) days.set(day, t);
  }
  const oldest = [...days.keys()].sort()[0] || '9999';
  const stats = L.readJSON(statsFile, null);
  for (const d of (stats && stats.dailyModelTokens) || []) {
    if (!d || !d.date || d.date >= oldest) continue;
    const t = Object.values(d.tokensByModel || {}).reduce((s, n) => s + (Number(n) || 0), 0);
    if (t) days.set(d.date, t);
  }
  const first = (stats && stats.firstSessionDate && L.dayKey(Date.parse(stats.firstSessionDate))) || [...days.keys()].sort()[0] || null;
  const now = Date.now();

  // Streaks: consecutive days with activity. Today doesn't break the current
  // streak until it's over.
  let streak = 0;
  for (let i = days.has(L.dayKey(now)) ? 0 : 1; days.has(L.dayKey(now - i * 86400000)); i++) streak++;
  let longest = 0, run = 0, prev = null;
  for (const d of [...days.keys()].sort()) {
    run = prev && Date.parse(`${d}T12:00:00`) - Date.parse(`${prev}T12:00:00`) <= 86400000 * 1.5 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  const best = [...days.entries()].sort((a, b) => b[1] - a[1])[0];

  // Last year, day by day, for the activity graph.
  const year = new Set(L.lastDays(371, now));
  const daily = Object.fromEntries([...days.entries()].filter(([d]) => year.has(d)));
  // Replies per day, where the transcripts still have them (for tooltips).
  const replies = {};
  for (const [day, d] of Object.entries(usage.days)) {
    const n = Object.values(d.models).reduce((s, m) => s + (m.messages || 0), 0);
    if (n && year.has(day)) replies[day] = n;
  }
  return {
    tokens: [...days.values()].reduce((s, n) => s + n, 0), activeDays: days.size, since: first,
    streak, longest, best: best ? { day: best[0], tokens: best[1] } : null, daily, replies, at: now,
  };
}

function loadLifetime() { return L.readJSON(LIFETIME_FILE, null); }

// Only one scan at a time (several status lines may ask at once).
function scanLocked(opts) {
  fs.mkdirSync(L.HOME, { recursive: true });
  try { fs.mkdirSync(LOCK); } catch {
    try { if (Date.now() - fs.statSync(LOCK).mtimeMs < 10 * 60000) return null; fs.rmdirSync(LOCK); fs.mkdirSync(LOCK); } catch { return null; }
  }
  try { return scan(opts); } finally { try { fs.rmdirSync(LOCK); } catch {} }
}

function loadUsage() { return L.readJSON(USAGE_FILE, null) || emptyUsage(); }

// Sum a set of days into per-model and per-project totals.
function totals(usage, days) {
  const all = blank(), models = {}, projects = {};
  for (const day of days) {
    const d = usage.days[day];
    if (!d) continue;
    for (const [k, v] of Object.entries(d.models)) for (const t of [all, models[k] || (models[k] = blank())]) for (const f of Object.keys(v)) t[f] += v[f];
    for (const [k, v] of Object.entries(d.projects)) { const t = projects[k] || (projects[k] = blank()); for (const f of Object.keys(v)) t[f] += v[f]; }
  }
  return { all, models, projects };
}

module.exports = { USAGE_FILE, LIFETIME_FILE, scan, scanLocked, loadUsage, loadLifetime, lifetime, totals, modelName, listTranscripts };

if (require.main === module) {
  const quiet = process.argv.includes('--quiet');
  const t0 = Date.now();
  const u = scanLocked();
  if (!quiet) console.log(u ? `Read ${Object.keys(u.files).length} transcripts in ${((Date.now() - t0) / 1000).toFixed(1)}s.` : 'A scan is already running.');
}
