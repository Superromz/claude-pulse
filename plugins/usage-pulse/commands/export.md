---
description: Save your daily Claude usage as CSV (for spreadsheets) and JSON (with each project and model) in ~/.claude/pulse/exports
allowed-tools: Bash(node:*)
---
!`node "${CLAUDE_PLUGIN_ROOT}/scripts/pulse.js" export`

The command above already ran; don't run anything. Tell the user where the files are, in one or two lines.
