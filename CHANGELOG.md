# Changelog

All notable changes to Claude Pulse are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## Unreleased

### Added
- Claude Pulse: your context window and 5-hour and weekly plan limits as gauges under the prompt, with session cost, prompt cache, today's spend and git branch.
- A GitHub-style activity grid in the status line, with lifetime tokens, active days, your streak and your busiest day. Pick its colors with `/claude-pulse:colors`.
- A usage dashboard (`/claude-pulse:dashboard`, or live next to Claude with `/claude-pulse:live`): plan limits, spending, a year of activity, open sessions, daily activity, projects and models.
- Hover a day in the activity grid to see its tokens and replies, in the status line and in the live dashboard.
- `/claude-pulse:activity` opens a local activity page with a tooltip on every day.
- Practical usage tips under the spinner while Claude works.
- Works in more terminals: the nearest 256 colors where exact shades aren't available (such as macOS Terminal), and `/claude-pulse:plain on` for fonts without block and line symbols.

### Removed
- Claude Arcade, the game this repository used to hold. It stays in the git history.
