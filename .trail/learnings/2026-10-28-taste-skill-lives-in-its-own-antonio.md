---
title: Taste Skill lives in its own art-direction category so it can coexist with Impeccable
author: Antonio
date: 2026-10-28
branch: feat/design-taste
cost: { minutes: 17, tokens: 55846 }
id: l-6036b79f
scope: repo
status: active
src: agent
touches:
  - README.md
  - THIRD_PARTY_NOTICES.md
  - src/adapters/agents-md.ts
  - src/cli/capabilities.ts
  - src/config/validation.ts
  - src/registry/catalog.ts
  - src/registry/types.ts
  - tests/registry.test.ts
  - src/registry/index.ts
---

## Decided
- `design-taste` (Leonxlnx/taste-skill, skill `design-taste-frontend` only) is a default on web only, in a new non-exclusive `art-direction` category (src/registry/types.ts, catalog.ts, config/validation.ts). `aginit list` groups it under design (src/cli/capabilities.ts).
- Existing projects keep their saved capability list; they opt in with `aginit add design-taste`.

## Tried and ruled out
- Putting it in `design`: that category is in EXCLUSIVE (src/registry/index.ts) and `--design X` / `aginit add` (capabilities.ts) replace the whole category, so the two would displace each other. Making design non-exclusive means changing `--design` into a list and touching the wizard.
- `addon: true`: add-ons are skipped by defaultCapabilities, so they can never be on by default.

## Watch out
- `--design none` does not remove Taste Skill; use `--without design-taste`.
- The upstream repo dir is `skills/taste-skill` but the skill name to install is `design-taste-frontend`; v2 is labelled experimental upstream.
- `pnpm audit` (so `pnpm check`) already fails on vite via vitest, independent of this change.
