// /usage-pulse:doctor: checks the usual reasons Usage Pulse looks wrong and
// says what to do about each. It only reads; it never changes a file.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const L = require('./lib');

const SETTINGS = path.join(os.homedir(), '.claude', 'settings.json');
const BIN = path.join(L.HOME, 'bin');

// Each check: { status: 'ok' | 'fix' | 'info', title, detail }.
function checks({ env = process.env, scripts = __dirname, now = Date.now() } = {}) {
  const out = [];
  const add = (status, title, detail = '') => out.push({ status, title, detail });

  const version = env.PULSE_NODE_VERSION || process.versions.node;
  if (Number(version.split('.')[0]) >= 20) add('ok', `Node.js ${version}`);
  else add('fix', `Node.js ${version} is too old`, 'Usage Pulse needs Node.js 20 or newer. Install the current version from https://nodejs.org, then run /usage-pulse:setup.');

  const settings = L.readJSON(SETTINGS, {});
  const command = String((settings.statusLine && settings.statusLine.command) || '');
  if (command.includes('.claude/pulse/')) add('ok', 'The status line is Usage Pulse');
  else if (command) add('fix', 'Another tool replaced the status line', `It runs: ${command}. Run /usage-pulse:setup to switch back.`);
  else add('fix', 'No status line is set up', 'Run /usage-pulse:setup.');

  // The status line runs from copies in ~/.claude/pulse/bin; after an update
  // they're refreshed by setup (or the next /usage-pulse:dashboard).
  const ours = fs.readdirSync(scripts).filter((f) => f.endsWith('.js') && f !== 'pulse.js');
  const missing = ours.filter((f) => !fs.existsSync(path.join(BIN, f)));
  const stale = ours.filter((f) => !missing.includes(f) && fs.readFileSync(path.join(BIN, f), 'utf8') !== fs.readFileSync(path.join(scripts, f), 'utf8'));
  if (missing.length) add('fix', 'Status line scripts are missing', `Not found in ${BIN}: ${missing.join(', ')}. Run /usage-pulse:setup.`);
  else if (stale.length) add('fix', 'Status line scripts are out of date', `They don't match the installed plugin (${stale.join(', ')}). Run /usage-pulse:setup.`);
  else add('ok', 'Status line scripts match the installed plugin');

  let readable = false;
  try { fs.readdirSync(L.PROJECTS_DIR); readable = true; } catch {}
  const usage = L.readJSON(path.join(L.HOME, 'usage.json'), null);
  if (!readable) add('fix', 'Claude Code\'s history can\'t be read', `${L.PROJECTS_DIR} is missing or not readable, so lifetime totals, activity, projects and models stay empty.`);
  else if (usage && usage.scannedAt) add('ok', 'Claude Code\'s history is readable', `Last read ${L.fmtDur((now - usage.scannedAt) / 1000)} ago.`);
  else add('info', 'Claude Code\'s history hasn\'t been read yet', 'It\'s read in the background within a few minutes, or now with /usage-pulse:dashboard.');

  const limits = L.latestLimits(L.loadSessions(35));
  if (limits) add('ok', 'Plan limits are reported', `Last reported ${L.fmtDur((now - limits.at) / 1000)} ago.`);
  else add('info', 'No plan limits reported', 'That\'s expected with an API key; on Pro and Max plans they appear after your next message.');

  const cfg = L.loadConfig();
  const exact = L.truecolor(env, cfg.color);
  const why = cfg.color === 'auto' ? 'detected automatically' : `set with color-depth ${cfg.color}`;
  add('info', `Colors: ${exact ? 'exact shades' : 'nearest of 256 colors'} (${why})`, exact
    ? 'If colors look wrong or garish, try /usage-pulse:settings color-depth 256.'
    : 'If your terminal shows exact colors, try /usage-pulse:settings color-depth truecolor.');

  add('info', cfg.ascii ? 'Plain text is on: symbols are ASCII' : 'Symbols: ━━━╸──  ■ ■ ■  ⎇  ↑  ⚠', cfg.ascii
    ? 'Turn it off with /usage-pulse:plain off if your font shows bars and squares.'
    : 'If you see boxes or question marks instead, run /usage-pulse:plain on.');
  return out;
}

// Plain text: slash command output shows no colors.
function format(list) {
  const mark = { ok: '[ok]  ', fix: '[fix] ', info: '[info]' };
  const fixes = list.filter((c) => c.status === 'fix').length;
  const lines = ['Usage Pulse health check', ''];
  for (const c of list) {
    lines.push(`${mark[c.status]} ${c.title}`);
    if (c.detail) lines.push(`       ${c.detail}`);
  }
  lines.push('', fixes ? `${fixes} thing${fixes === 1 ? '' : 's'} to fix.` : 'Everything looks right.');
  return lines.join('\n');
}

module.exports = { checks, format };
