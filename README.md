# aginit

**Set up a new or existing project for AI coding agents with one command.**

aginit gives a repo what agents need to do good work from the first session: an `AGENTS.md`
that explains the project, a curated set of engineering skills, a codebase graph so agents
read less and understand more, and a test harness they can actually run. It wires up
upstream tools instead of reimplementing them.

```bash
npx @antomanc/aginit
```

[![CI](https://github.com/antomanc/aginit/actions/workflows/ci.yml/badge.svg)](https://github.com/antomanc/aginit/actions)
[![npm version](https://img.shields.io/npm/v/@antomanc/aginit)](https://www.npmjs.com/package/@antomanc/aginit)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> **Beta.** Expect flags and defaults to change before 1.0.

## Why

Agents in a fresh repo usually start out blind:
- no instructions, so they guess at the build, test and package manager commands
- no shared workflow for specs, TDD, code review or bug hunting
- grep-and-read-everything to find their way around the code
- no test runner, so "it works" is never checked
- a different setup in every repo, done by hand

aginit sets all of this up the same way every time, and you can re-run it whenever you want.

## What you get

| | |
|---|---|
| **Instructions** | `AGENTS.md` with the project's real commands, invariants and a first-session playbook, shared by Antigravity, Codex and any agent that reads `AGENTS.md` |
| **Skills** | All 27 stable [Matt Pocock skills](https://github.com/mattpocock/skills) (`tdd`, `code-review`, `diagnosing-bugs`, `to-spec`, `to-tickets`, `implement-spec`, `pr`...) plus [humanizer](https://github.com/blader/humanizer), installed in `.agents/skills/` via the [Skills CLI](https://github.com/vercel-labs/skills) |
| **Codebase graph** | [Graft](https://www.npmjs.com/package/@nanonets/graft): `graft map` and `graft ask` give agents the relevant code spans before they grep |
| **Test tooling** | Vitest for TypeScript projects, plus Playwright when a web framework is selected |
| **Web extras** | [Impeccable](https://github.com/pbakaus/impeccable) for UI design and [agent-browser](https://github.com/vercel-labs/agent-browser) for visual QA, with its CLI and browser binaries installed so it works out of the box |
| **Scaffolding** | Official Vite and Next.js scaffolders, or a Commander-based TypeScript CLI |
| **Maintenance** | `aginit doctor` checks readiness; `aginit update` refreshes skills and the graph |

## Quick start

Requires Node.js 22.12+, Git and internet access.

```bash
npx @antomanc/aginit          # interactive wizard
pnpm dlx @antomanc/aginit     # same, with pnpm
npm install -g @antomanc/aginit   # or install globally and run `aginit`
```

The wizard creates a new project or initializes the current directory, then asks for a
preset, framework and package manager. Existing projects keep the package manager they
already use.

Graft is installed separately (or skip it with `--no-graft`):

```bash
npm install -g @nanonets/graft
```

## Commands

```
aginit new [name]   Create a new project
aginit init         Add or update agent setup in the current directory
aginit doctor       Check Node.js, package manager, Git, Graft, Codex, Skills CLI, agent-browser and config
aginit update       Update installed skills and rebuild the Graft index
```

Useful flags: `--preset web|cli|generic`, `--framework none|vite|next|existing`,
`--package-manager pnpm|npm|yarn|bun`, `--dry-run`, `--no-skills`, `--no-graft`, `--no-git`.

```bash
aginit new my-app --preset web --framework vite
aginit new my-app --preset web --framework next --package-manager npm
aginit new my-cli --preset cli
aginit init --preset generic --dry-run
```

## Presets

| Preset | Setup |
| --- | --- |
| `web` | TypeScript and Vitest, with optional Vite or Next.js scaffolding. Playwright is added when a web framework is selected. |
| `cli` | Node.js/TypeScript CLI with Commander, Picocolors and Vitest. |
| `generic` | Git, `AGENTS.md`, skills and Graft. Leaves an existing `package.json` untouched. |

The web preset's `--framework none` (default) creates a TypeScript baseline without a bundler
or browser tests. `existing` keeps the framework you already have.

Your choices (preset, framework, package manager, agents, skill sources) are saved in
`aginit.config.json`, so the next run starts from them. The package manager is also passed
to framework scaffolders.

## Existing projects

`aginit init` never replaces application code. It keeps your source, custom scripts,
dependency versions and test configs, and only adds what's missing. If you already use a
different test runner, aginit adds a separate `test:unit` script instead of touching yours.

An existing `AGENTS.md` is preserved; aginit only appends its bootstrap section. Configs from
older versions that used the retired default skill selection are upgraded to the current
set, while a skill list you narrowed by hand stays as written.

## Design

- **Orchestrates, doesn't vendor.** Skills, Graft, Vite, Next.js and Playwright come from
  their upstream tools. aginit picks good defaults and runs them.
- **Idempotent.** Re-running the same init is safe; explicit options override saved settings.
- **Honest dry-run.** `--dry-run` lists every planned operation without writing files or
  downloading tools. (Files produced by upstream scaffolders are only known after they run.)
- **Fails loudly.** Invalid config is reported before any file changes. A failed scaffold
  stops the command; missing Graft, a failed skill install or a failed agent-browser setup
  exits nonzero and keeps the scaffold, so you can fix it and re-run `aginit init`.
- **Hands off your system.** If the Linux kernel blocks Chrome's sandbox (`No usable
  sandbox!`), aginit tells you the sysctl fix and the narrower `--no-sandbox` option. It
  never changes system settings for you.

## Related

[agbox](https://github.com/antomanc/agbox) prepares the *machine* for AI agents (toolchains,
Docker, Playwright, Tailscale, snapshots). aginit prepares the *project*. Use them together:
`agbox setup`, then `npx @antomanc/aginit` in a new project.

## Development

```bash
pnpm install --frozen-lockfile
pnpm check                    # typecheck (src + tests), tests, build, dependency audit
pnpm check:skills             # compare the standard skill set with upstream (after pnpm build)
pnpm smoke                    # verify projects generated from the packed tarball
pnpm smoke --frameworks       # also scaffold, test, build and serve Vite and Next.js
pnpm smoke --package-managers # verify pnpm, Yarn and Bun consumer commands
```

`npm publish` runs `pnpm check` and the base smoke test first. See
[CHANGELOG.md](CHANGELOG.md), [CONTRIBUTING.md](CONTRIBUTING.md) and
[SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © 2026 Antonio Mancini

Upstream tools and skills keep their own licenses; aginit does not vendor or relicense them.
See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
