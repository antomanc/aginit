# Aginit

Project bootstrapper for T3 Code, Antigravity, and Codex. Configures agent instructions, skills, a codebase graph, and test tooling using upstream tools.

Beta · v0.1.0

[![CI](https://github.com/antomanc/aginit/actions/workflows/ci.yml/badge.svg)](https://github.com/antomanc/aginit/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/@antomanc/aginit)](https://www.npmjs.com/package/@antomanc/aginit)

## Quickstart

Requires Node.js 22.12+, Git, npm/npx, and internet access. Install your chosen package manager before using it.

Run the interactive wizard:

```bash
npx @antomanc/aginit
# or
pnpm dlx @antomanc/aginit
```

For a global installation:

```bash
npm install -g @antomanc/aginit
aginit
```

The wizard lets you create a project or initialize an existing directory, then choose a preset, framework, workflow, and package manager. Existing projects retain their detected package manager.

Graft requires a separate installation. Use `--no-graft` to skip it.

```bash
npm install -g @nanonets/graft
```

## Usage

```bash
aginit new my-app --preset web --framework vite
aginit new my-app --preset web --framework next --package-manager npm
aginit new my-cli --preset cli
aginit new my-repo --preset generic

# Run inside an existing project
aginit init --preset web

# Preview changes
aginit init --dry-run
aginit new my-app --preset web --dry-run
```

Supported package managers: `pnpm` (default), `npm`, `yarn`, and `bun`. Set one with `--package-manager`; the choice is saved in `aginit.config.json` and passed to framework scaffolders.

### Presets

| Preset | Setup |
| --- | --- |
| `web` | TypeScript and Vitest, with optional Vite or Next.js scaffolding. Playwright is added when a web framework is selected. |
| `cli` | Node.js/TypeScript CLI with Commander, Picocolors, and Vitest. |
| `generic` | Git, agent instructions, skills, and Graft. Leaves an existing `package.json` untouched. |

The web preset supports `--framework none` (default), `vite`, `next`, or `existing`. Vite and Next.js use their official scaffolders. `none` creates a TypeScript baseline without a bundler or browser test configuration.

### Agent configuration

- `AGENTS.md`: project instructions shared by agents.
- `.agents/skills/`: `tdd`, `code-review`, and `diagnosing-bugs` from Matt Pocock. Web projects also include Impeccable and agent-browser.
- Graft: a codebase graph for `graft map` and `graft ask`.
- `aginit.config.json`: saved preset, framework, package manager, agents, and skill sources.

Use `--spec-workflow` to add `to-spec`, `to-tickets`, and `implement-spec`. Use `--no-skills` to skip skill installation.

## Existing projects

`aginit init` preserves application source, custom scripts, dependency versions, and existing test configurations. The web and CLI presets add missing test tooling; projects with a custom test runner receive a separate `test:unit` script.

Repeated initialization preserves saved settings and extension fields. Explicit options override the corresponding settings. Invalid configuration is reported before files are changed. `--no-skills` skips installation while retaining saved skill sources.

## Maintenance

```bash
aginit doctor
aginit update
```

`doctor` checks Node.js, the project package manager, Git, Graft, Codex, the Skills CLI, and project configuration. It may download the Skills CLI through npx.

`update` runs project-scoped `skills update` and rebuilds the Graft index. Disabled integrations are skipped; failed updates return a nonzero exit status.

## Behavior

- Rerunning the same initialization is idempotent. Manifest additions and explicit configuration changes are applied without replacing application code.
- Framework scaffold failures stop the command.
- Missing Graft or failed skill installation returns a nonzero exit status. The scaffold is retained so you can fix the prerequisite and rerun `aginit init`.
- `--dry-run` lists planned operations without writing files or downloading framework tools. Files produced by upstream scaffolders are only known after they run.
- Playwright's starter test is skipped until you add an application URL and assertions. Generated test harnesses still need application-specific tests.

## Development

```bash
pnpm install --frozen-lockfile
pnpm check                    # typecheck, tests, build, dependency audit
pnpm smoke                    # verify projects generated from the packed tarball
pnpm smoke --frameworks       # also scaffold, test, build, and serve Vite and Next.js
pnpm smoke --package-managers # verify pnpm, Yarn, and Bun consumer commands
npm pack --dry-run
```

Framework smoke tests download upstream tools and dependencies. `npm publish` runs `pnpm check` and the base consumer smoke test before publication.

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines and [SECURITY.md](SECURITY.md) for vulnerability reporting.

## License

[MIT](LICENSE) © 2026 Antonio Mancuso.

Upstream tools and skills retain their own licenses. Aginit does not vendor or relicense them. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
