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

