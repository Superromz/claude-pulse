#!/usr/bin/env node
// CLI behind the /usage-pulse:* commands.
//   pulse.js setup            install the status line and spinner tips into ~/.claude/settings.json
//   pulse.js uninstall        restore the settings that setup replaced
//   pulse.js dashboard        print the usage dashboard
//   pulse.js live             open the live dashboard (split pane where the terminal allows it)
//   pulse.js settings [name] [value]  list every setting, or change one
//   pulse.js colors <name>    colors of the activity grid (green, red, blue, purple)
//   pulse.js activity         open the activity page in the browser
//   pulse.js plain <on|off>   plain text only, for fonts without block and line symbols
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const L = require('./lib');

const SETTINGS = path.join(os.homedir(), '.claude', 'settings.json');
const BIN = path.join(L.HOME, 'bin');
const BACKUP = path.join(L.HOME, 'settings-backup.json');
const BACKED_UP = ['statusLine', 'spinnerTipsOverride'];
const node = (file, args = '') => `node "${path.join(BIN, file).replace(/\\/g, '/')}"${args}`;

// Shown under the spinner while Claude works, next to Claude Code's own tips.
const TIPS = [
  'Context above 60%? /compact frees room for the rest of the task',
  'Switching tasks? /clear starts fresh, so old context stops costing tokens',
  'A warm cache makes your next message cheaper and faster. The status line shows how long it lasts',
  '"↑ fast pace" on a limit means you\'d reach it before it resets',
  '/usage-pulse:dashboard shows where your usage went this week',
  '/usage-pulse:live keeps your usage dashboard open next to Claude',
  'Change the activity grid colors with /usage-pulse:colors',
];

// Copy scripts to a stable path: the plugin dir changes on every update.
function installScripts() {
  fs.mkdirSync(BIN, { recursive: true });
  for (const f of fs.readdirSync(__dirname)) if (f.endsWith('.js') && f !== 'pulse.js') fs.copyFileSync(path.join(__dirname, f), path.join(BIN, f));
}

// A `usage-pulse` command on PATH that opens the live dashboard. Windows: a
// .cmd next to npm's global shims (already on PATH with Node). macOS/Linux:
// ~/.local/bin/usage-pulse. Returns where it went, or null if no PATH dir fit.
// Every place a command may be, including `claude-pulse`, its name before 0.1.0.
const commandFiles = () => ['usage-pulse', 'claude-pulse'].flatMap((n) => [path.join(process.env.APPDATA || '', 'npm', n + '.cmd'), path.join(os.homedir(), '.local', 'bin', n)]);
const removeCommands = () => { for (const f of commandFiles()) try { fs.unlinkSync(f); } catch {} };

function installCommand() {
  removeCommands();
  const dash = path.join(BIN, 'dash.js');
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  const onPath = (d) => dirs.some((p) => path.resolve(p).toLowerCase() === path.resolve(d).toLowerCase());
  try {
    if (process.platform === 'win32') {
      const npmDir = path.join(process.env.APPDATA || '', 'npm');
      if (!process.env.APPDATA || !fs.existsSync(npmDir) || !onPath(npmDir)) return null;
      const target = path.join(npmDir, 'usage-pulse.cmd');
      fs.writeFileSync(target, `@echo off\r\nnode "${dash}" --live %*\r\n`);
      return target;
    }
    const local = path.join(os.homedir(), '.local', 'bin');
    fs.mkdirSync(local, { recursive: true });
    const target = path.join(local, 'usage-pulse');
    fs.writeFileSync(target, `#!/bin/sh\nexec node "${dash}" --live "$@"\n`, { mode: 0o755 });
    return onPath(local) ? target : null;
  } catch { return null; }
}

function setup() {
  installScripts();
  L.saveConfig(L.loadConfig());

  const settings = L.readJSON(SETTINGS, {});
  const ours = String((settings.statusLine && settings.statusLine.command) || '').includes('.claude/pulse/');
  if (!ours && !fs.existsSync(BACKUP)) L.writeJSON(BACKUP, Object.fromEntries(BACKED_UP.map((k) => [k, settings[k] ?? null])), true);
  settings.statusLine = { type: 'command', command: node('statusline.js'), refreshInterval: 1, padding: 0 };
  settings.spinnerTipsOverride = { tips: TIPS, excludeDefault: false };
  L.writeJSON(SETTINGS, settings, true);

  // Read the history now so the first dashboard opens instantly.
  try { require('./scan').scanLocked(); } catch {}

  console.log('Usage Pulse is installed. Context, plan limits, cost and your activity now show under the prompt.');
  console.log(`Previous settings saved to ${BACKUP}.`);
  const cmd = installCommand();
  console.log(cmd ? 'Live dashboard: split your terminal and run: usage-pulse' : `Live dashboard: run /usage-pulse:live, or in any terminal: ${node('dash.js', ' --live')}`);
}

function uninstall() {
  const settings = L.readJSON(SETTINGS, {});
  const backup = L.readJSON(BACKUP, {});
  for (const k of BACKED_UP) {
    if (backup[k]) settings[k] = backup[k];
    else delete settings[k];
  }
  L.writeJSON(SETTINGS, settings, true);
  try { fs.unlinkSync(BACKUP); } catch {}
  removeCommands();
  console.log(backup.statusLine ? 'Usage Pulse removed. Your previous status line is back.' : 'Usage Pulse removed.');
}

function dashboard() {
  installScripts();
  try { require('./scan').scanLocked(); } catch {}
  const { render } = require('./dash');
  // Slash commands capture output, so leave the colors out.
  process.env.NO_COLOR = '1';
  process.stdout.write(render({ width: 96 }));
}

// Open the live dashboard next to Claude. Windows Terminal can split itself;
// other terminals get the command on the clipboard.
function live() {
  const { spawn, execSync } = require('child_process');
  installScripts();
  const cmd = installCommand() ? 'usage-pulse' : node('dash.js', ' --live');
  if (process.env.WT_SESSION) {
    spawn('wt.exe', ['-w', '0', 'sp', '-V', '-s', '0.45', 'node', path.join(BIN, 'dash.js'), '--live'], { detached: true, stdio: 'ignore' }).unref();
    console.log('Opened the live dashboard in a Windows Terminal split pane.');
    return;
  }
  let copied = false;
  if (!process.env.PULSE_NO_CLIPBOARD) try {
    const clip = process.platform === 'win32' ? 'clip' : process.platform === 'darwin' ? 'pbcopy' : 'xclip -selection clipboard';
    execSync(clip, { input: cmd, stdio: ['pipe', 'ignore', 'ignore'] });
    copied = true;
  } catch {}
  const split = process.env.TERM_PROGRAM === 'WarpTerminal'
    ? (process.platform === 'darwin' ? 'Cmd+D' : 'Ctrl+Shift+D') + ' in Warp'
    : 'your terminal\'s split-pane shortcut';
  console.log(`Split the window with ${split}, then paste and run${copied ? ' (already copied to your clipboard)' : ''}:`);
  console.log(`  ${cmd}`);
}

// /usage-pulse:settings: list every setting, show one, or change one.
function settings(name, value) {
  const { OPTIONS, option } = require('./options');
  const cfg = L.loadConfig();
  if (!name) {
    const width = Math.max(...OPTIONS.map((o) => o.name.length)) + 2;
    console.log('Usage Pulse settings. Change one with /usage-pulse:settings <name> <value>.\n');
    for (const o of OPTIONS) {
      console.log(`${o.name.padEnd(width)}${o.show(cfg[o.key]).padEnd(10)} ${o.values.join(', ')}`);
      console.log(`${' '.repeat(width)}${o.help}`);
    }
    return;
  }
  const o = option(name);
  if (!o) return console.log(`There's no setting called "${name}". Settings: ${OPTIONS.map((x) => x.name).join(', ')}.`);
  if (value === undefined) return console.log(`${o.name} is ${o.show(cfg[o.key])} (${o.values.join(', ')}). ${o.help}`);
  const v = o.parse(value);
  if (v === undefined) return console.log(`Pick one of: ${o.values.join(', ')}. Now: ${o.show(cfg[o.key])}.`);
  cfg[o.key] = v;
  L.saveConfig(cfg);
  // The activity page has the grid colors baked in.
  if (o.key === 'palette') {
    const lt = require('./scan').loadLifetime();
    if (lt) try { require('./page').writePage(lt, cfg); } catch {}
  }
  console.log(o.done(v));
}

const colors = (name) => settings('colors', name || '');

function activity() {
  const P = require('./page');
  const lt = require('./scan').scanLocked() && require('./scan').loadLifetime();
  if (lt && lt.tokens) P.writePage(lt);
  if (!fs.existsSync(P.PAGE_FILE)) return console.log('No activity yet. Send Claude a message first.');
  P.openPage();
  console.log(`Opened your activity page: ${P.PAGE_FILE}`);
}

// With no on/off, plain flips the current setting.
const plain = (arg) => settings('plain', arg === 'on' || arg === 'off' ? arg : (L.loadConfig().ascii ? 'off' : 'on'));

const [cmd, arg, value] = process.argv.slice(2);
const commands = { setup, uninstall, dashboard, live, activity, plain: () => plain(arg), colors: () => colors(arg), settings: () => settings(arg, value) };
(commands[cmd] || (() => console.log('Usage: pulse.js setup|uninstall|dashboard|live|activity|settings [name] [value]|plain <on|off>|colors <name>')))();
