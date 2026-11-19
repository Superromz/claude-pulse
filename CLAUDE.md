# CLAUDE.md

Guidance for Claude Code and other agents working on Claude Pulse.

## What this is

A Claude Code plugin that shows your Claude usage in the status line (context, plan limits, cost,
an activity grid) and in a dashboard. `README.md` describes what users see.

## Docs as we go (required)

Every task that changes behavior updates the docs **in the same commit**:

- `README.md`: what users see and do (status line items, dashboard sections, commands).
- `CHANGELOG.md`: one line under `## Unreleased`, written for users, not implementation.

Keep the wording plain and friendly: no jargon, no game terms.

## Code

- Zero runtime dependencies. Node 18+. Code lives in `plugins/claude-pulse/scripts/`.
- The status line runs every second: keep it fast (no spawning git, no rescanning history in the
  foreground) and never let it throw. Write to disk only when something changed.
- Every status line row must fit inside `COLUMNS` minus the margin; Claude Code cuts the rest with "…".
  The tests check this.
- Run `npm test` before committing. For visual changes, render the output to a PNG with
  `python tools/ansi2png.py out.txt out.png` and look at it.

## Commits

- Short messages describing what changed for users.
- No Claude attribution trailers.
