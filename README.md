# Aginit

> **Public Beta (v0.1.0)** — Minimal, modular AI-first project bootstrapper for T3 Code, Antigravity, and Codex.

[![CI](https://github.com/antomanc/aginit/actions/workflows/ci.yml/badge.svg)](https://github.com/antomanc/aginit/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/@antomanc/aginit)](https://www.npmjs.com/package/@antomanc/aginit)

---

## Philosophy

> **“We orchestrate the tools. We don’t replace them.”**

Aginit initializes software projects ready for AI-assisted development in seconds. Instead of reinventing custom agent frameworks or vendoring brittle skills, Aginit ties together best-in-class upstream capabilities into a coherent, idempotent developer workflow.

- **Zero vendoring**: Skills and codebase graphs are fetched and configured directly from upstream maintainers via standard package ecosystems (`skills.sh`, `graft`).
- **Dual-agent parity**: Antigravity and Codex share the exact same `.agents/skills` and `AGENTS.md` conventions without conflicting configurations.
- **Conservative & idempotent**: Never overwrites existing code destructively; respects your choice of framework, toolchain, and package manager.

---

## What Aginit Configures

Every project bootstrapped with Aginit receives:

1. **Upstream Skills Engine (`skills.sh`)**:
   - Universal engineering trio: `tdd`, `code-review`, `diagnosing-bugs` (by Matt Pocock).
   - *Optional* spec workflow: `to-spec`, `to-tickets`, `implement-spec` (`--spec-workflow`).
   - Frontend craft & UI polish: `impeccable` (by Peter Bak-Hansen) for web presets.
   - Interactive visual inspection: `agent-browser` (by Vercel Labs) for web presets.
2. **Codebase Understanding (`graft`)**:
   - Deterministic structural code graph and fast token-efficient semantic map (`graft map`, `graft ask`).
3. **Agent Invariants (`AGENTS.md`)**:
   - A short, non-invasive intake contract and invariant guide that agents parse immediately upon opening the repository in T3 Code.
4. **Deterministic Testing Harness**:
   - Vitest for instant unit testing.
   - Playwright for browser testing when a web framework is selected. Its starter test is explicitly skipped until you supply an application URL and real assertions.
5. **Declarative State (`aginit.config.json`)**:
   - Versioned project manifest (`schemaVersion: "1.0.0"`) tracking active agents, skills, preset, and package manager.

---

## Quickstart

### Prerequisites

- Node.js **22.12 or newer** (use a supported Node LTS release).
- Git and npm/npx in `PATH`; install your selected package manager before using it.
- Internet access for official framework scaffolders and upstream skills.
- Optional Graft CLI: `npm install -g @nanonets/graft`. Use `--no-graft` to omit it.

### Interactive Wizard (Recommended)

Simply run `aginit` or `npx @antomanc/aginit` with no arguments in your terminal to launch the interactive prompt:

```bash
# Run directly without installation
npx @antomanc/aginit

# Or with pnpm dlx
pnpm dlx @antomanc/aginit

# Or install globally
npm install -g @antomanc/aginit
aginit
```

The wizard prompts only for meaningful choices:
1. Action: *Create brand new project* vs *Initialize in current directory*
2. Project name (when creating a new project)
3. Preset (`web` | `cli` | `generic`)
4. Framework (for `web`: `none` | `vite` | `next` | `existing`)
5. Workflow (`minimal` | `spec`)
6. Package Manager (`pnpm (Recommended)` | `npm` | `yarn` | `bun`) — *auto-detected and preserved when initializing existing projects*

### Non-Interactive / Scriptable CLI

All commands accept explicit flags for automated environments and CI:

```bash
# Create a new web project directly with pnpm
aginit new my-web-app --preset web --framework vite --package-manager pnpm

# Or with npm, yarn, or bun
aginit new my-app --preset web --package-manager bun

# Or via npx
npx @antomanc/aginit new my-web-app --preset web
```

Then open the project in **T3 Code**, and tell Antigravity:
> *"bootstrap this project"*

---

## Package Managers

Aginit provides centralized package manager orchestration:
- **Supported Managers**: `pnpm` (recommended/default), `npm`, `yarn` (Classic or modern), `bun`.
- **New Projects**: Prompted as the final wizard step, or configured via `--package-manager <pm>`. Stored in `aginit.config.json`.
- **Existing Projects**: Automatically detects existing lockfiles (`pnpm-lock.yaml`, `bun.lockb`, `yarn.lock`, `package-lock.json`) and preserves your manager without prompting.
- **Official Scaffolding**: Passes the selected package manager to upstream toolchains (e.g. `--use-pnpm`, `--use-npm`, `--use-yarn`, `--use-bun` for Next.js, and package manager specific create commands for Vite).
- **Clean Toolchains**: `pnpm-workspace.yaml` and pnpm-specific lifecycle configs are only generated when `pnpm` is the active manager.

---

## Presets & Frameworks

### 1. `web` Preset

Framework-agnostic by default:

```bash
# Agnostic baseline: clean TypeScript + Vitest, zero bundler lock-in
aginit new my-app --preset web --framework none

# Official Vite scaffolding
aginit new my-vite-app --preset web --framework vite

# Official Next.js scaffolding
aginit new my-next-app --preset web --framework next
```

*Note: With `--framework none`, Aginit does not generate dummy or failing E2E configs until an actual web target is introduced.*

### 2. `cli` Preset

```bash
aginit new my-cli --preset cli
```
Configures an executable Node.js/TypeScript CLI with Commander, Picocolors, and Vitest.

### 3. `generic` Preset

```bash
aginit new my-repo --preset generic
```
Minimal AI readiness for any codebase: Git, `.agents/skills`, Graft context graph, and `AGENTS.md`.

---

## Adding Aginit to an Existing Project

Run `aginit init` inside an existing repository:

```bash
cd my-existing-project
aginit init --preset web
```

Aginit preserves application source, custom scripts, dependency versions, and existing test configurations. The web and CLI presets add missing test tooling to `package.json`; custom test runners get a separate `test:unit` script. The generic preset leaves an existing project manifest untouched.

Repeat `aginit init` preserves the saved preset, framework, agents, workflow, skill sources, and extension fields. Explicit options override the requested setting. Invalid JSON or configuration is reported before initialization changes files. `--no-skills` skips installation without erasing an existing configuration's sources.

---

## Diagnostics (`aginit doctor`)

Run the health check at any time to inspect system tooling and repository agent readiness (it may download the upstream Skills CLI through npx):

```bash
aginit doctor
```

Checks:
- Node.js runtime and active project package manager (`pnpm`, `npm`, `yarn`, or `bun`)
- Git repository state
- Global Graft CLI availability
- Codex CLI availability (secondary reviewer)
- Skills CLI engine functionality
- `aginit.config.json` schema validation and package manager setting
- `AGENTS.md` context and intake section
- Installed `.agents/skills/` health

---

## Updating Upstream Capabilities (`aginit update`)

Keep your project's skills and codebase graph up to date:

```bash
aginit update
```

This runs the upstream project-scoped `skills update` and refreshes the Graft graph index. Disabled integrations are skipped; failed updates return a nonzero exit status.

---

## Safety & Dry Run

Preview changes without touching the disk:

```bash
aginit new test-project --preset web --dry-run
aginit init --dry-run
```

Existing application files are preserved. Manifest additions and explicit configuration changes are intentional; rerunning the same initialization is idempotent. Framework scaffold failures stop the command instead of generating a substitute app.

Missing Graft or failed skill installation produces an actionable warning and a nonzero exit status. The scaffold is retained so you can resolve the prerequisite and rerun `aginit init`.

`--dry-run` prints planned operations without creating files or downloading framework tools. Upstream-generated files cannot be enumerated until the real scaffolder runs.

---

## Development & Release Verification

```bash
pnpm install --frozen-lockfile
pnpm check                 # typecheck, tests, build, dependency audit
pnpm smoke                 # install the tarball and verify generated consumer projects
pnpm smoke --frameworks    # additionally scaffold, test, build, and serve Vite and Next.js
pnpm smoke --package-managers # verify native pnpm, Yarn, and Bun consumer commands
npm pack --dry-run
```

The framework smoke test downloads upstream tools and dependencies. The generated generic project has a working Vitest starter harness; application-specific assertions remain yours to write. `npm publish` runs the checks and base consumer smoke test before publication.

---

## Upstream Licenses Notice

Aginit integrates and configures independent open-source software and skills:
- **Graft**: Copyright © NanoNets / Graft contributors
- **skills.sh**: Copyright © Vercel Inc. and contributors
- **Matt Pocock Skills**: Copyright © Matt Pocock
- **Impeccable**: Copyright © Peter Bak-Hansen
- **agent-browser**: Copyright © Vercel Labs
- **Playwright**: Copyright © Microsoft Corporation

Each upstream tool is governed by its own independent license. Aginit does not vendor, alter, or relicense upstream software. For details, see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

---

## Contributing & Security

- **Contributing**: Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on development and submitting pull requests.
- **Security**: See [SECURITY.md](SECURITY.md) for our vulnerability reporting policy.

---

## License

[MIT](LICENSE) © 2026 Antonio Mancuso
