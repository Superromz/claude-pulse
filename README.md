# Claude Pulse

**Your Claude usage at a glance, right where you work.** Claude Pulse is a Claude Code plugin that
puts your context window, plan limits, session cost and a GitHub-style activity grid under the
prompt, and gives you a usage dashboard one command away.

- **Live:** the numbers come straight from Claude Code every second.
- **Plain words:** "Context 27%", "5-hour 34% resets 1h12m", "This session $3.20".
- **Local and private:** everything stays in `~/.claude/pulse/`. Nothing is sent anywhere.
- **Zero dependencies:** plain Node 18+, MIT licensed.

## Install

You need Claude Code and Node.js 18 or newer. In Claude Code:

```
/plugin marketplace add superromz/claude-pulse
/plugin install claude-pulse@claude-pulse
/claude-pulse:setup
```

Setup replaces your status line, adds a few usage tips under the spinner, and saves what was there
before, so `/claude-pulse:uninstall` can put it back.

| Command | What it does |
|---|---|
| `/claude-pulse:setup` | Install the status line and spinner tips. |
| `/claude-pulse:dashboard` | Print the full usage dashboard. |
| `/claude-pulse:live` | Keep the dashboard open next to Claude (also: `claude-pulse` in any terminal). |
| `/claude-pulse:activity` | Open your activity page in the browser. |
| `/claude-pulse:colors red` | Activity grid colors: `green` (default), `red`, `blue` or `purple`. |
| `/claude-pulse:plain on` | Plain text only (ASCII bars and symbols), for fonts that lack block and line characters. `off` turns it back. |
| `/claude-pulse:uninstall` | Put your previous status line and tips back. |

## The status line

```
Context ━━━━────────── 27% 275k of 1M    5-hour ━━━━━──── 34% resets 1h12m    Weekly …            Dec     Jan     Feb   …   Sep     Oct     Nov
Opus 5.5 · medium                       This session $3.20 · 1h05m · +120 −8    ⎇ dev          ■ ■ ■ ■ ■ ■ ■ ■ ■ ■   …   ■ ■ ■ ■ ■ ■ ■ ■ ■ ■
                                                                                          Mon  ■ ■ ■ ■ ■ ■ ■ ■ ■ ■   …   ■ ■ ■ ■ ■ ■ ■ ■ ■ ■
Lifetime    7.5B tokens since Jan 23, 2026                                                     ■ ■ ■ ■ ■ ■ ■ ■ ■ ■   …   ■ ■ ■ ■ ■ ■ ■ ■ ■ ■
Past year   7.5B tokens · 39 active days                                                  Wed  ■ ■ ■ ■ ■ ■ ■ ■ ■ ■   …   ■ ■ ■ ■ ■ ■ ■ ■ ■ ■
Streak      11 days · best 13                                                                  ■ ■ ■ ■ ■ ■ ■ ■ ■ ■   …   ■ ■ ■ ■ ■ ■ ■ ■ ■ ■
Busiest day Sep 25 · 920M tokens                                                          Fri  ■ ■ ■ ■ ■ ■ ■ ■ ■ ■   …   ■ ■ ■ ■ ■ ■ ■ ■ ■ ■
                                                                                               ■ ■ ■ ■ ■ ■ ■ ■ ■ ■   …   ■ ■ ■ ■ ■ ■ ■ ■ ■
```

The top row holds the three gauges that matter most. Each one turns yellow at 60% and red at 85%.
On a wide terminal your activity grid sits on the right, with a lifetime summary under the gauges.

| Item | What it means |
|---|---|
| Context | How full the conversation's context window is. |
| 5-hour, Weekly | Your plan's usage windows (Pro and Max plans) and when each one resets. **↑ fast pace** means that at the current rate you'd reach the limit before it resets. |
| Model · effort | The model answering and the effort level it uses. |
| This session | What this session has cost, how long it has been open, and the lines added and removed. |
| Today | What all your Claude Code sessions have cost today. |
| Cache | Claude Code keeps your conversation cached for a while after each message, which makes the next message faster and cheaper. "Warm 47m" is how long that lasts; "cold" means the next message rebuilds it. |
| ⎇ | The git branch of the folder you're working in. |
| Activity grid | Like the contribution graph on GitHub: a column per week, a row per weekday, a square per day. The brighter the square, the busier the day; dim squares are days off. It shows as many weeks as fit, up to a year. Pick its colors with `/claude-pulse:colors red` (or `green`, `blue`, `purple`). Hover an active day to see its usage, like `Thu, Nov 19 | 259M tokens | 565 replies` (in terminals that preview links on hover, such as Warp). |
| Lifetime | Every token Claude has read and written for you. Mostly context re-read from the cache, so the number gets big fast. |
| Past year | Tokens in the last 12 months and how many days you used Claude. |
| Streak | Days in a row you've used Claude, and your best run. Today doesn't break it until it's over. |
| Busiest day | The day you used the most tokens. |

On a medium-width terminal the summary and grid move under the two main rows instead, side by
side, so the full year still fits from about 165 columns. Narrower still, the grid shows fewer weeks,
then steps aside (leaving two rows), and the wording gets shorter, so the rows never wrap. Anything Claude Code doesn't report (for example plan limits on an API key) is simply left out.

## Your activity page

`/claude-pulse:activity` opens `~/.claude/pulse/activity.html` in your browser: the past year as a
GitHub-style grid, with a tooltip on every day (tokens and replies). It updates every 10 minutes and
never leaves your computer.

## The dashboard

`/claude-pulse:dashboard` prints the full picture. `/claude-pulse:live` opens it next to Claude
and keeps it up to date (in Windows Terminal it splits the window for you; elsewhere it copies the
`claude-pulse` command so you can paste it into a split pane). In the live view, hover any square in
the activity grid to see that day's tokens and replies.

- **Plan limits**: both windows with reset times and whether you're on track.
- **Spending**: today, yesterday, the last 7 and 30 days.
- **Your activity**: the past year as a GitHub-style grid, in the colors you picked, with lifetime
  tokens, active days, your current and longest streak, and your busiest day.
- **Open sessions**: every Claude Code window active in the last 10 minutes, with its context
  and cost.
- **Activity, last 14 days**: tokens and replies per day.
- **Projects** and **Models**: where your usage went this week, and how much input came from the
  cache.

## Where the numbers come from

- The status line numbers come straight from Claude Code, every second.
- Spending is Claude Code's own cost figure, recorded per session per day from the moment
  Claude Pulse is installed. A session that was already open before midnight only counts the part of its
  cost since midnight (spread evenly over the session).
- Lifetime totals, activity, projects and models are read from Claude Code's history in `~/.claude/projects`, so
  they go back as far as that history does. Older days come from Claude Code's own stats. Only new lines are read after the first time.

Everything stays in `~/.claude/pulse/`. Nothing is sent anywhere.

## Where it works

Claude Pulse is a Claude Code plugin, so it runs inside Claude Code: on Windows, macOS and Linux,
with Node.js 18 or newer. It doesn't work in other AI command-line tools.

- **Colors:** exact shades in Warp, Windows Terminal, iTerm2, Kitty, WezTerm, VS Code and most Linux
  terminals. Terminals that can't show them, such as macOS Terminal, automatically get the nearest
  of 256 colors. To force one or the other, set `"color": "truecolor"` or `"color": "256"` in
  `~/.claude/pulse/config.json`.
- **Symbols:** if your font shows boxes instead of bars and squares, run `/claude-pulse:plain on`.
- **Hover in the status line:** needs a terminal that previews links on hover, such as Warp. SSH
  and tmux can strip it.
- **Hover in the live dashboard:** needs mouse support, which almost every terminal has (in tmux,
  turn on `set -g mouse on`).
- **Plan limits:** Claude Code reports the 5-hour and weekly limits on Pro and Max plans. With an
  API key those gauges are left out.

## Development

```sh
npm test
```

Tests run on Windows, macOS and Linux with Node 18 and 24 on every push (`.github/workflows/test.yml`).

The plugin lives in `plugins/claude-pulse/`: `statusline.js` (the status line), `dash.js` (the
dashboard), `grid.js` (the activity grid), `page.js` (the activity page), `scan.js` (reads Claude
Code's history), `lib.js` (shared helpers and the spend ledger) and `pulse.js` (the commands).

## License

MIT
