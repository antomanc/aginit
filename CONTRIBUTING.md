# Contributing to Aginit

Thank you for your interest in contributing to Aginit!

## Core Principles

1. **Orchestration, not replacement**: We do not duplicate or vendor upstream tools. If a capability belongs in Trail, `skills.sh`, Impeccable, or a specific skill, it should be improved upstream.
2. **Minimal & non-invasive**: Keep `AGENTS.md` and generated project configurations short, structured, and noise-free.
3. **Idempotence & safety**: Project creation and initialization must never destroy user files or overwrite custom changes destructively.
4. **Resilient defaults**: Always support `--dry-run` and keep offline fallbacks graceful.

## Adding or changing a capability

Skills, tools and test engines live in one place: `src/registry/catalog.ts`. Add a
`CapabilityDescriptor` there (install steps, platforms, credits, optional routing row,
rebuttals or docs section) and credit it in `THIRD_PARTY_NOTICES.md`; a test fails until you do.
CLI parsing, writers and doctor need no changes. Only a tool that needs its own init command
gets a `setup` entry in `src/registry/setup.ts`.

## Development Workflow

1. Clone repository and install dependencies:
   ```bash
   pnpm install
   ```

2. Run typecheck and automated tests:
   ```bash
   pnpm check
   ```

3. Build the TypeScript distribution:
   ```bash
   pnpm build
   ```

4. Test locally with the CLI:
   ```bash
   node ./bin/aginit.js --help
   node ./bin/aginit.js doctor
   ```

5. Before opening a pull request:
   - Ensure all tests pass (`pnpm test`).
   - Run typechecking (`pnpm typecheck`) and `pnpm audit`.
   - Verify packed consumer projects with `pnpm smoke`; use `pnpm smoke --frameworks` for scaffolding changes.
   - Keep commits focused and descriptive.
