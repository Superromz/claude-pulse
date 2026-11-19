---
description: Install the Usage Pulse status line - context, plan limits, cost and your activity grid under the prompt
allowed-tools: Bash(node:*)
---
!`node "${CLAUDE_PLUGIN_ROOT}/scripts/pulse.js" setup`

The command above already ran; don't run anything. In two short lines tell the user it's installed, and that /usage-pulse:dashboard shows the full usage dashboard and /usage-pulse:live keeps it open next to Claude.
