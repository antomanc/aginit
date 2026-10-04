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
- **Conservative & idempotent**: Never overwrites existing code destructively; respects your choice of framework and toolchain.

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
   - Playwright for end-to-end browser verification when a web target exists.
5. **Declarative State (`aginit.config.json`)**:
   - Versioned project manifest (`schemaVersion: "1.0.0"`) tracking active agents, skills, and presets.

---

## Quickstart

Run directly with `pnpm dlx` / `npx`, or install globally:

```bash
# Global installation (recommended)
pnpm add -g @antomanc/aginit

# Create a new web project
aginit new my-web-app --preset web

# Or run with npx / dlx without global install
pnpm dlx @antomanc/aginit new my-web-app --preset web
```

Then open the project in **T3 Code**, and tell Antigravity:
> *"bootstrap this project"*

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

Aginit will safely preserve all existing files, detecting your current `package.json`, appending non-destructively to `AGENTS.md`, and wiring upstream skills and Graft.

---

## Diagnostics (`aginit doctor`)

Run the health check at any time to verify system tooling and repository agent readiness:

```bash
aginit doctor
```

Checks:
- Node.js runtime and pnpm manager
- Git repository state
- Global Graft CLI availability
- Codex CLI availability (secondary reviewer)
- Skills CLI engine functionality
- `aginit.config.json` schema validation
- `AGENTS.md` context and intake section
- Installed `.agents/skills/` health

---

## Updating Upstream Capabilities (`aginit update`)

Keep your project's skills and codebase graph up to date:

```bash
aginit update
```

This runs `npx skills update` across configured sources and refreshes the Graft graph index.

---

## Safety & Dry Run

Preview changes without touching the disk:

```bash
aginit new test-project --preset web --dry-run
aginit init --dry-run
```

All operations are non-destructive and idempotent.

---

## Upstream Licenses Notice

Aginit integrates and configures independent open-source software and skills:
- **Graft**: Copyright © open-code/graft contributors
- **skills.sh**: Copyright © Vercel Inc. and contributors
- **Matt Pocock Skills**: Copyright © Matt Pocock
- **Impeccable**: Copyright © Peter Bak-Hansen
- **agent-browser**: Copyright © Vercel Labs
- **Playwright**: Copyright © Microsoft Corporation

Each upstream tool is governed by its own independent license. Aginit does not vendor, alter, or relicense upstream software.

---

## License

[MIT](LICENSE) © 2026 Antonio Mancuso
