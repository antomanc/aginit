---
title: scalebridge fixes and the Graft to Trail switch
author: Antonio
date: 2026-10-20
branch: fix/scalebridge-findings
cost: { minutes: 11, tokens: 142130 }
touches:
  - AGENTS.md
  - aginit.config.json
  - CONTRIBUTING.md
  - README.md
  - THIRD_PARTY_NOTICES.md
  - docs/assets/demo.tape
  - scripts/smoke-test.mjs
  - src/adapters/agents-md.ts
  - src/adapters/git.ts
  - src/adapters/graft.ts
---

## Decided
- Ruff is one more ToolIgnore in src/adapters/tool-ignores.ts: extend-exclude inserted at the top of ruff.toml/.ruff.toml or right under an existing [tool.ruff]; an existing extend-exclude in that table gets advice, never an edit. ruffConfigFile() in src/detect/index.ts is the single detection used by both the ignore and the Python lint command.
- Python lint = `ruff check . && ruff format --check .`, prefixed with `uv run ` when uv.lock exists. No mypy/pyright: `mypy .` would also scan vendored skill scripts.
- GuideContext.testDir (existing tests/ or test/) drives the native guide's layout sentence.
- Bootstrap & First Session lives inside the aginit block. An exact legacy copy outside it is stripped; an edited one is kept. doctor checks AGINIT_START_PATTERN, not the heading.
- The PRODUCT.md routing row appears only when the file exists or a design-category capability is active.
- Graft is now Trail (@trailhq/trail-code, bin trail). Capability id, --no-trail and codebase.trail renamed; validateConfig reads old codebase.graft and graft ids as trail. trail init migrates graft wiring; aginit only drops graft's unedited .ignore hint.

## Tried and ruled out
- Writing a stub PRODUCT.md for non-UI projects: scaffolding noise.
- Opting users out of Trail telemetry: aginit would silently change another tool's settings. It is disclosed in the wizard summary and README instead.

## Watch out
- Testing the packed CLI via `npx --package=<tgz> aginit` breaks nested `npx skills` (npm_config_package leaks). Install the tarball into a prefix and run its bin.
- trail check flags keyword overlaps with learnings ("claude", "graft") that are not real conflicts; read each before acting.
- Old aginit-written .gitignore lines (/graft/, .ignore) are left in user repos; harmless.
