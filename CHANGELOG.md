# Changelog

All notable changes to Usage Pulse are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## Unreleased

### Added
- The dashboard's Projects section shows what each project cost in the last 7 days and this month.
- `/usage-pulse:recap` sums up last week (Monday to Sunday) against the week before: tokens, replies, cost, active days, busiest day, top project and model, and your streak. The dashboard shows the headline.
- Choose what the status line shows: `layout compact` keeps it to two rows, and `grid`, `summary` and `branch` turn those parts off one at a time (all in `/usage-pulse:settings`).

## 0.2.0 - 2026-11-19

### Added
- `/usage-pulse:settings` shows every setting with its current value and changes any of them, like `/usage-pulse:settings colors red`. Settings that used to need editing `config.json` by hand (the activity summary and grid, color depth, margin) can now be changed there too.
- Alerts before you run out: a warning above the gauges when the 5-hour or weekly limit passes 80% or the context window passes 70% (with a nudge to `/compact`), plus one desktop notification each time. Thresholds and both parts can be changed in settings.
- Daily and monthly budgets: "Today" in the status line shows how much of your daily budget is used, and the dashboard shows this month against your monthly budget, turning yellow and red as you get close.

### Changed
- "↑ fast pace" on a plan limit now says when you'd run out at the current rate, like "↑ out by 4:10pm" (with the day for the weekly limit), in the status line and the dashboard.
- Usage Pulse now needs Node.js 20 or newer (Node 18 no longer gets security updates). On an older Node, setup says so and changes nothing.

## 0.1.0 - 2026-11-19

### Added
- Usage Pulse: your context window and 5-hour and weekly plan limits as gauges under the prompt, with session cost, prompt cache, today's spend and git branch.
- A GitHub-style activity grid in the status line, with lifetime tokens, active days, your streak and your busiest day. Pick its colors with `/usage-pulse:colors`.
- A usage dashboard (`/usage-pulse:dashboard`, or live next to Claude with `/usage-pulse:live`): plan limits, spending, a year of activity, open sessions, daily activity, projects and models.
- Hover a day in the activity grid to see its tokens and replies, in the status line and in the live dashboard.
- `/usage-pulse:activity` opens a local activity page with a tooltip on every day.
- Practical usage tips under the spinner while Claude works.
- Works in more terminals: the nearest 256 colors where exact shades aren't available (such as macOS Terminal), and `/usage-pulse:plain on` for fonts without block and line symbols.

### Removed
- The name Claude Pulse. It is now Usage Pulse: commands start with `/usage-pulse:` and the terminal command is `usage-pulse`. If you installed it as claude-pulse, see "Moving from claude-pulse" in the README.
- Claude Arcade, the game this repository used to hold. It stays in the git history.
