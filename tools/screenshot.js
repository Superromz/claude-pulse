#!/usr/bin/env node
// Dev-only: renders the status line with made-up demo data (never your own usage)
// and saves it as the README screenshot.
//   node tools/screenshot.js          writes docs/statusline.png (needs Python with Pillow)
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const scripts = path.join(root, 'plugins', 'usage-pulse', 'scripts');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-demo-'));
const pulse = path.join(home, '.claude', 'pulse');
fs.mkdirSync(pulse, { recursive: true });

// A believable year: busier on weekdays, a few weeks off, a steady recent streak.
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const daily = {};
const replies = {};
const now = Date.now();
for (let i = 0; i < 365; i++) {
  const d = new Date(now - i * 86400000);
  const day = d.toLocaleDateString('en-CA');
  const weekend = d.getDay() === 0 || d.getDay() === 6;
  const off = i > 20 && (rand() < (weekend ? 0.7 : 0.18) || (i > 200 && i < 214));
  if (off) continue;
  const tokens = Math.round((weekend ? 4e7 : 1.2e8) * (0.3 + rand() * 2.2));
  daily[day] = tokens;
  replies[day] = Math.round(tokens / 4e5);
}
const total = Object.values(daily).reduce((a, b) => a + b, 0);
const best = Object.entries(daily).sort((a, b) => b[1] - a[1])[0];
fs.writeFileSync(path.join(pulse, 'lifetime.json'), JSON.stringify({
  tokens: total, activeDays: Object.keys(daily).length, since: Object.keys(daily).sort()[0],
  streak: 21, longest: 34, best: { day: best[0], tokens: best[1] }, daily, replies, at: now,
}));
fs.writeFileSync(path.join(pulse, 'config.json'), JSON.stringify({ palette: 'red', color: 'truecolor' }));

const s = now / 1000;
const input = {
  session_id: 'demo',
  cwd: root,
  model: { id: 'claude-opus-5-5', display_name: 'Opus 5.5' },
  effort: { level: 'high' },
  cost: { total_cost_usd: 3.2, total_duration_ms: 65 * 60000, total_lines_added: 120, total_lines_removed: 8 },
  context_window: { total_input_tokens: 275000, context_window_size: 1000000, used_percentage: 27 },
  prompt_cache: { expires_at: s + 47 * 60 },
  rate_limits: { five_hour: { used_percentage: 34, resets_at: s + 72 * 60 }, seven_day: { used_percentage: 62, resets_at: s + 3 * 86400 } },
};
const env = { ...process.env, HOME: home, USERPROFILE: home, COLUMNS: '226', NO_COLOR: '' };
const ansi = execFileSync(process.execPath, [path.join(scripts, 'statusline.js')], { input: JSON.stringify(input), env, encoding: 'utf8' });

const txt = path.join(home, 'statusline.txt');
fs.writeFileSync(txt, ansi);
fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
const out = path.join(root, 'docs', 'statusline.png');
execFileSync(process.platform === 'win32' ? 'python' : 'python3', [path.join(__dirname, 'ansi2png.py'), txt, out, '--pretty'], { stdio: 'inherit' });
fs.rmSync(home, { recursive: true, force: true });
console.log(`Saved ${path.relative(root, out)}`);
