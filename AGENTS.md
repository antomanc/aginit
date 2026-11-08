# aginit

Set up new or existing projects for AI coding agents in one command: AGENTS.md, skills, codebase graph and test tooling.

## Core Invariants
- Orchestrate upstream tools; do not duplicate, vendor, or fork them.
- Keep changes minimal, test-verified, and idempotent.
- Never commit broken builds, failed typechecks, or unverified changes.
- Tools and skills are registry entries in `src/registry/catalog.ts`; never special-case one in CLI, writers or doctor.
- Never add Node files (`package.json`, `tsconfig.json`) to a non-JS project root.

## Essential Commands
- Package Manager: `pnpm`
- Build: `pnpm build`
- Typecheck: `pnpm typecheck`
- Test: `pnpm test`
- Full check: `pnpm check` (typecheck, tests, build, audit)
- Packed-CLI smoke: `pnpm smoke` (`--frameworks` also scaffolds Vite and Next.js)

<!-- aginit:start — managed by npx @antomanc/aginit (re-run to refresh) -->
## Bootstrap & First Session
When the user asks to "bootstrap this project" or kicks off a new initiative:
1. Understand product intent and ask 2-3 essential questions to resolve ambiguity.
2. Draft or refine canonical context in `PRODUCT.md` and `DESIGN.md` (or `docs/adr/`).
3. Plan in small verifiable increments and implement test-first using installed skills.

## Guardrails (karpathy-guidelines)
- **Think before coding**: state assumptions and trade-offs; ask instead of guessing.
- **Simplicity first**: minimum code that solves the problem; no speculative features or abstractions.
- **Surgical changes**: touch only what the task needs; no silent scope creep or drive-by refactors.
- **Goal-driven execution**: define a verifiable success check first, then loop until it passes.

## Task Routing
Load only what the task needs. Skills live in `.agents/skills/` (linked into `.claude/skills/` for Claude Code).

| Task | Read / Use |
| --- | --- |
| Automated unit & E2E testing | `docs/agents/testing.md` |
| Engineering workflow & skills | `docs/agents/workflows.md` |
| Scoping or simplifying a change | `ponytail` skill |
| Prose & Copy (docs, README, UI text) | `humanizer` skill |

## Anti-Rationalization
| Excuse | Rule |
| --- | --- |
| "Unit tests pass, so the feature works." | Insufficient. Unit tests do not verify wiring or rendering. Exercise the feature end to end (integration or smoke run) before marking complete. |
<!-- aginit:end -->
