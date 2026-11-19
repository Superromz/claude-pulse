// Warnings before a plan limit or the context window runs out: a line on top
// of the status line while it's over the threshold, and one desktop
// notification per crossing (once per limit window, once per session for the
// context window). Thresholds and switches live in options.js.
'use strict';

const path = require('path');
const L = require('./lib');

const SENT_FILE = path.join(L.HOME, 'alerts.json');
const WEEK = 7 * 86400;

// What's over its threshold right now, most urgent first.
function crossings(input, cfg, now = Date.now()) {
  if (!cfg.alerts) return [];
  const out = [];
  const rl = input.rate_limits || {};
  for (const [key, name] of [['five_hour', '5-hour'], ['seven_day', 'Weekly']]) {
    const w = L.windowInfo(key, rl[key], now);
    if (!w || w.used < cfg.limitAlert) continue;
    out.push({ kind: key, pct: w.used, resets: rl[key].resets_at || null, left: w.left, text: `${name} limit ${Math.round(w.used)}% used` });
  }
  const cw = input.context_window;
  if (cw && cw.used_percentage != null && cw.used_percentage >= cfg.contextAlert) {
    out.push({ kind: 'context', pct: cw.used_percentage, text: `Context ${Math.round(cw.used_percentage)}% full` });
  }
  return out.sort((a, b) => b.pct - a.pct);
}

// The warning line, in the widest wording that fits `cols` (0: no limit).
function warningRow(list, cfg, cols) {
  if (!list.length) return '';
  const mark = cfg.ascii ? '!' : '⚠';
  const color = L.heat(list[0].pct);
  const ctx = list.some((c) => c.kind === 'context');
  const resets = (c) => (c.left != null ? ` (resets ${L.fmtDur(c.left)})` : '');
  const sep = cfg.ascii ? ' - ' : ' · ';
  const wordings = [
    list.map((c) => c.text + resets(c)).join(sep) + (ctx ? ': /compact soon frees room' : ''),
    list.map((c) => c.text).join(sep) + (ctx ? ': /compact soon' : ''),
    list.map((c) => c.text).join(sep),
  ];
  const text = wordings.find((w) => !cols || w.length + 2 <= cols);
  return text ? L.paint('bold', L.paint(color, `${mark} ${text}`)) : '';
}

// Which crossings haven't had their desktop notification yet. A limit window
// is identified by its reset time (allowing for a little drift between
// reports), the context window by the session.
function unsent(list, sid, sent) {
  return list.filter((c) => (c.kind === 'context'
    ? !(sent.context || []).includes(sid || '')
    : !(sent[c.kind] || []).some((t) => c.resets == null || Math.abs(t - c.resets) < 1800)));
}

// Send what's new, remember it, and forget windows that ended long ago.
function notifyNew(list, input, cfg, now = Date.now()) {
  if (!cfg.alerts || !cfg.desktopAlerts || !list.length) return;
  const sent = L.readJSON(SENT_FILE, {});
  const fresh = unsent(list, input.session_id, sent);
  if (!fresh.length) return;
  for (const c of fresh) {
    if (c.kind === 'context') sent.context = [...(sent.context || []), input.session_id || ''].slice(-50);
    else sent[c.kind] = [...(sent[c.kind] || []).filter((t) => t > now / 1000 - WEEK), c.resets || now / 1000];
  }
  L.writeJSON(SENT_FILE, sent);
  const c = fresh[0];
  const body = c.kind === 'context'
    ? `${c.text}. Run /compact soon to free room for the rest of the task.`
    : `${c.text}${c.left != null ? `. It resets in ${L.fmtDur(c.left)}` : ''}.`;
  notify('Usage Pulse', fresh.length > 1 ? `${body} Also: ${fresh.slice(1).map((x) => x.text).join(', ')}.` : body);
}

// A desktop notification, sent in the background: the status line never waits
// for it, and a system without a way to show one is skipped silently.
function notify(title, body) {
  if (process.env.PULSE_NOTIFY_LOG) {
    require('fs').appendFileSync(process.env.PULSE_NOTIFY_LOG, JSON.stringify({ title, body }) + '\n');
    return;
  }
  let cmd, args;
  if (process.platform === 'win32') {
    const q = (s) => s.replace(/'/g, "''").replace(/[<>&]/g, '');
    cmd = 'powershell.exe';
    args = ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', [
      '[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null',
      '$x = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)',
      `$t = $x.GetElementsByTagName('text'); $t.Item(0).InnerText = '${q(title)}'; $t.Item(1).InnerText = '${q(body)}'`,
      "$id = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe'",
      '[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($id).Show([Windows.UI.Notifications.ToastNotification]::new($x))',
    ].join('; ')];
  } else if (process.platform === 'darwin') {
    const q = (s) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    cmd = 'osascript';
    args = ['-e', `display notification "${q(body)}" with title "${q(title)}"`];
  } else {
    cmd = 'notify-send';
    args = [title, body];
  }
  try {
    const child = require('child_process').spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: true });
    child.on('error', () => {});
    child.unref();
  } catch {}
}

module.exports = { crossings, warningRow, unsent, notifyNew, notify, SENT_FILE };
