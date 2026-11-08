# 4. Trail is an opt-in add-on

Date: 2026-11-08

## Status
Accepted

## Context
Trail (formerly Graft) was a default capability: every new project got its
graph, hooks, MCP entries and a "Forbidden: grep, query trail first"
rebuttal in `AGENTS.md`. In practice it did not pay for itself well enough to
justify turning it on for everyone, it needs a separate global install, and it
sends usage stats by default.

## Decision
- Trail is `addon: true` in `src/registry/catalog.ts`, off by default.
  Users opt in with `--addons trail`, `aginit add trail`, or the wizard's
  add-on list. `--no-trail` stays as an alias for the default.
- Saved configs that already enable Trail keep it; only fresh projects change.
- aginit's own repo no longer uses Trail. The still-useful notes from its
  `.trail/learnings/` are kept below.

## Consequences
- `aginit remove trail` must run `trail uninstall --no-global -y`; without
  `-y` upstream only previews the removal.

## Notes carried over from Trail learnings
- **Releases:** publish by creating a GitHub release for the version tag.
  `.github/workflows/publish.yml` runs `pnpm check` and then
  `pnpm publish --provenance` with `NPM_TOKEN`. This machine has no npm
  login, so never `npm publish` locally. The release commit is
  `chore(release): X.Y.Z` (version plus CHANGELOG). After it, tag `vX.Y.Z`,
  push main and the tag, and run `gh release create`. `pnpm check` includes
  `pnpm audit`, so an advisory blocks publishing; `pnpm update <pkg> -r`
  usually clears a transitive one. npm lists the version about a minute after
  CI logs "Published".
- **Packed CLI testing:** `npx --package=<tgz> aginit` breaks nested
  `npx skills` because `npm_config_package` leaks. Install the tarball into a
  prefix and run its bin instead.
- **Vendored-skill excludes** (prettier, eslint, biome, ruff) live in
  `src/adapters/tool-ignores.ts`. They patch the config or give advice and
  never edit an existing exclude. Add new linters there.
- **Taste Skill** is in its own non-exclusive `art-direction` category so it
  can sit next to Impeccable. Putting it in `design` would let `--design`
  replace it. `--design none` does not remove it; `--without design-taste`
  does.
- **Python lint** is `ruff check . && ruff format --check .` (through
  `uv run` when `uv.lock` exists). No mypy or pyright: they would scan
  vendored skill scripts.
- Don't write a stub `PRODUCT.md` for non-UI projects; it is scaffolding
  noise. `HANDOFF-*.md` files are local notes and are never committed.
