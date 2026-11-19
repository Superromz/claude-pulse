// Last week at a glance: /usage-pulse:recap prints it, and the dashboard shows
// its headline. "Last week" is the most recent complete Monday-to-Sunday week,
// compared with the week before. Figures come from the same history and spend
// records as the dashboard, so the two always agree.
'use strict';

const L = require('./lib');
const S = require('./scan');
const G = require('./grid');

const allTokens = (t) => t.input + t.output + t.cacheRead + t.cacheWrite;
const DAY = 86400000;

// The seven day keys of the week that starts `weeksAgo` Mondays before this one.
function weekOf(now, weeksAgo) {
  const d = new Date(now);
  d.setHours(12, 0, 0, 0);
  const monday = d.getTime() - ((d.getDay() + 6) % 7) * DAY - weeksAgo * 7 * DAY;
  return Array.from({ length: 7 }, (_, i) => L.dayKey(monday + i * DAY));
}

// Figures for one week. Cost is null when nothing was tracked that week, and
// `costFrom` says when tracking started if it began partway through.
function figures(days, usage, sessions, tracked) {
  const t = S.totals(usage, days);
  const perDay = days.map((d) => [d, allTokens(S.totals(usage, [d]).all)]);
  const busiest = perDay.reduce((a, b) => (b[1] > a[1] ? b : a));
  const top = (o, f) => Object.entries(o).sort((a, b) => f(b[1]) - f(a[1]))[0];
  const project = top(t.projects, allTokens);
  const model = top(t.models, (m) => m.messages);
  const costDays = tracked ? days.filter((d) => d >= tracked) : [];
  return {
    days,
    tokens: allTokens(t.all),
    replies: t.all.messages,
    active: perDay.filter(([, n]) => n > 0).length,
    cost: costDays.length ? costDays.reduce((s, d) => s + L.spentOn(sessions, d), 0) : null,
    costFrom: costDays.length && costDays[0] !== days[0] ? costDays[0] : null,
    busiest: busiest[1] > 0 ? { day: busiest[0], tokens: busiest[1] } : null,
    project: project && allTokens(t.all) ? { name: project[0], share: allTokens(project[1]) / allTokens(t.all) } : null,
    model: model && t.all.messages ? { name: model[0], share: model[1].messages / t.all.messages } : null,
  };
}

// `loaded` lets the dashboard pass the history and sessions it already read.
function weekRecap(now = Date.now(), loaded = {}) {
  const usage = loaded.usage || S.loadUsage();
  const first = (list) => list.flatMap((s) => Object.keys(s.days || {})).sort()[0] || null;
  // Recent sessions cover both weeks; only when they start inside them, look
  // at every session to tell when tracking really started (the live
  // dashboard calls this every 2 seconds).
  const sessions = loaded.sessions || L.loadSessions(35);
  let tracked = first(sessions);
  if (tracked && tracked > weekOf(now, 2)[0]) tracked = first(L.loadSessions(36500));
  const lt = S.loadLifetime();
  return {
    last: figures(weekOf(now, 1), usage, sessions, tracked),
    before: figures(weekOf(now, 2), usage, sessions, tracked),
    streak: lt ? { now: lt.streak || 0, best: lt.longest || 0 } : null,
  };
}

const weekday = (key) => new Date(`${key}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' });
const span = (days) => `${weekday(days[0])} ${G.shortDate(days[0])} - ${weekday(days[6])} ${G.shortDate(days[6])}`;

// "+23%", "-5%", "same", or "" when there's nothing to compare with.
function change(now, before) {
  if (now == null || before == null || !before) return '';
  const pct = Math.round(((now - before) / before) * 100);
  return pct === 0 ? 'same' : `${pct > 0 ? '+' : ''}${pct}%`;
}

// The full recap, as plain text (slash command output shows no colors).
function formatRecap(r) {
  const { last, before } = r;
  if (!last.tokens) return `No Claude Code activity last week (${span(last.days)}).`;
  const row = (k, v, c = '') => `  ${k.padEnd(13)} ${String(v).padEnd(26)} ${c}`.trimEnd();
  const vs = (c) => (c ? `${c} vs the week before` : '');
  const cost = last.cost == null ? 'not tracked yet' : `${L.fmtUsd(last.cost)}${last.costFrom ? ` (tracked from ${G.shortDate(last.costFrom)})` : ''}`;
  const out = [`Last week, ${span(last.days)}`, ''];
  out.push(row('Tokens', L.fmtTokens(last.tokens), vs(change(last.tokens, before.tokens))));
  out.push(row('Replies', last.replies.toLocaleString('en-US'), change(last.replies, before.replies)));
  out.push(row('Cost', cost, last.costFrom || before.costFrom ? '' : change(last.cost, before.cost)));
  out.push(row('Active days', `${last.active} of 7`, change(last.active, before.active)));
  if (last.busiest) out.push(row('Busiest day', `${weekday(last.busiest.day)} ${G.shortDate(last.busiest.day)} · ${L.fmtTokens(last.busiest.tokens)} tokens`));
  if (last.project) out.push(row('Top project', `${last.project.name} · ${Math.round(last.project.share * 100)}% of tokens`));
  if (last.model) out.push(row('Top model', `${last.model.name} · ${Math.round(last.model.share * 100)}% of replies`));
  if (r.streak) out.push(row('Streak', `${r.streak.now} ${r.streak.now === 1 ? 'day' : 'days'} now · best ${r.streak.best}`));
  return out.join('\n');
}

// One line for the dashboard, at most `room` characters: the comparison goes
// first when space is short, then the active days.
function headline(r, room = Infinity) {
  const { last, before } = r;
  if (!last.tokens) return null;
  const c = change(last.tokens, before.tokens);
  const bits = [`${L.fmtTokens(last.tokens)} tokens`, `${last.replies.toLocaleString('en-US')} replies`];
  if (last.cost != null) bits.push(L.fmtUsd(last.cost));
  const days = `${last.active} active ${last.active === 1 ? 'day' : 'days'}`;
  const tries = [
    `${[...bits, days].join(' · ')}${c ? ` (${c} vs the week before)` : ''}`,
    [...bits, days].join(' · '),
    bits.join(' · '),
  ];
  return tries.find((t) => t.length <= room) || null;
}

module.exports = { weekOf, weekRecap, formatRecap, headline, change };
