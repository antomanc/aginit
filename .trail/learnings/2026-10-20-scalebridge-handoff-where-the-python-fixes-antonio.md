---
title: "scalebridge handoff: where the Python fixes plug in"
author: Antonio
date: 2026-10-20
branch: main
cost: { minutes: 1, tokens: 50669 }
touches:
  - AGENTS.md
  - HANDOFF-scalebridge-findings.md
  - src/adapters/agents-md.ts
  - src/adapters/tool-ignores.ts
---

## Decided
- Nothing yet; the design questions are still open with the user.

## Tried and ruled out
- The "generic preset gives Python a vitest command" worry: presetScripts() only runs for Node stacks (src/adapters/agents-md.ts:127).
- Changing the Graft hooks in .claude/settings.json from aginit: upstream `graft init` writes them, and the invariant says orchestrate, don't fork.

## Watch out
- Vendored-skill excludes already have a home: src/adapters/tool-ignores.ts (prettier/eslint/biome ToolIgnore entries, patch-or-advice, which doctor also reports). Add new linters (e.g. ruff) there, not as a new mechanism.
- BOOTSTRAP_SECTION is appended outside the aginit markers for existing AGENTS.md files (setupAgentsMarkdown). doctor.ts:232 keys on its heading, so moving it means updating doctor and migrating legacy copies.
- HANDOFF-*.md files are local working notes; don't commit them.
