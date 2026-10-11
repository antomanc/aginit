# Changelog

## 0.4.1 — 2026-10-11

### Fixed

- `typecheck` on existing web projects uses the framework's checker instead of `tsc --noEmit`, which can't resolve Astro virtual modules or single-file components: `astro check` (adds `@astrojs/check`), `nuxi typecheck`, `svelte-kit sync && svelte-check` or `svelte-check`, and `vue-tsc` (each adds its checker package when missing). An existing `typecheck` script is left alone.
- Projects with a solution-style `tsconfig.json` (`"files": []` plus `references`, as in the Vite templates) get `tsc -b --noEmit`. Plain `tsc --noEmit` checked nothing there, so a fresh `--framework vite` project passed typecheck with type errors.
- Vendored skills no longer break the project's linters and formatters. `aginit init` and `aginit update` add `.agents/` and `.claude/` to `.prettierignore`, to `.eslintignore` (legacy ESLint, oxlint), to the global ignores of a flat ESLint config (`globalIgnores([...])` or an ignores-only object), and to `files.includes` in `biome.json` (Biome 2.2+). Configs that can't be edited safely get a warning with the exact line to add.
- `aginit doctor` reports linters and formatters that still check vendored skills.

## 0.4.0 — 2026-10-11

### Added

- Claude Code support. Skills are now installed for the `claude-code` agent too, so the Skills CLI links each one from `.agents/skills/` into `.claude/skills/`, where Claude Code finds it as `/name`. aginit writes a one-line `CLAUDE.md` (`@AGENTS.md`) when none exists, and wires Graft for Claude Code (`graft init --agents ... claude`). See `docs/adr/0002-claude-code-skills-and-instructions.md`.
- New `agents.claudeCode` config flag, `true` by default. Configs without the flag keep loading and count as enabled. Set it to `false` to opt out.
- `aginit update` links already-installed skills for Claude Code when they're missing from `.claude/skills/`, and adds the `CLAUDE.md` import.
- `aginit doctor` reports skills missing from `.claude/skills/` and a `CLAUDE.md` that doesn't import `AGENTS.md`.

## 0.3.0 — 2026-10-10

### Fixed

- Web projects no longer ship an agent-browser skill stub without its runtime: `aginit init` now installs the `agent-browser` CLI (`npm i -g agent-browser`) and its browser binaries (`agent-browser install`) when the skill is configured or already on disk, and reports a failed provisioning as an incomplete setup (#4).
- `aginit init` and `aginit doctor` detect the Linux restriction that blocks Chrome's sandbox (`kernel.apparmor_restrict_unprivileged_userns=1`) and report the persisted sysctl fix plus the narrower `--no-sandbox` alternative instead of failing later with `No usable sandbox!`.

### Added

- The [ponytail](https://github.com/DietrichGebert/ponytail) skill installs by default in every preset, and AGENTS.md points agents to it for the smallest complete change (#5). Existing configs keep their skill sources as written; add `dietrichgebert/ponytail` to `skills.sources` to opt in.
- `aginit doctor` verifies the agent-browser runtime when the project ships the skill: CLI presence, upstream `agent-browser doctor --quick --offline --json` findings, and Chrome sandbox prerequisites.

## 0.2.0 — 2026-10-09

### Breaking

- Removed `--spec-workflow` from `aginit new` and `aginit init`, and removed the
  wizard's "Select AI engineering workflow" prompt. The spec and tickets skills
  are part of the standard set now, so the selector no longer had anything to
  select.
- `skills.workflow` is no longer written to `aginit.config.json`. Existing
  configs that still carry it keep loading unchanged.

### Changed

- All 27 stable Matt Pocock skills install by default instead of the
  `tdd` / `code-review` / `diagnosing-bugs` trio: the `engineering` and
  `productivity` categories. The `misc` and `in-progress` categories stay out.
- Saved configs holding an old default skill selection are upgraded on
  `aginit init`. A skill list narrowed by hand is preserved as written.
- AGENTS.md now lists the full standard skill set and the spec workflow.
- Dependency updates: TypeScript 7, Vitest 5, Commander 15, tsx 4.23,
  pnpm 12.10. `@types/node` stays on the 22.x line so the types match the
  `engines.node >= 22.12.0` support floor.
- Descriptions no longer mention T3 Code.

### Fixed

- Generated AGENTS.md separates its sections with blank lines again; only
  inapplicable lines are dropped.
- AGENTS.md no longer claims skills are disabled when a source installs every
  skill it ships.
- `aginit init` in the current directory no longer prints `cd .`.
- `aginit doctor` no longer warns about missing skills when installation is
  disabled in the configuration, and reports skills installed by hand even when
  the lockfile records none.
- `aginit --version` and the smoke test read the version from `package.json`.

### Added

- `pnpm typecheck` now type-checks `tests/` through `tsconfig.test.json`.
- `pnpm check:skills` and a weekly `Skill drift` CI job that fails when a
  standard skill disappears upstream or a new stable skill is published.
