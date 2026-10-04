# Contributing to Aginit

Thank you for your interest in contributing to Aginit!

## Core Principles

1. **Orchestration, not replacement**: We do not duplicate or vendor upstream tools. If a capability belongs in Graft, `skills.sh`, Impeccable, or a specific skill, it should be improved upstream.
2. **Minimal & non-invasive**: Keep `AGENTS.md` and generated project configurations short, structured, and noise-free.
3. **Idempotence & safety**: Project creation and initialization must never destroy user files or overwrite custom changes destructively.
4. **Resilient defaults**: Always support `--dry-run` and keep offline fallbacks graceful.

## Development Workflow

1. Clone repository and install dependencies:
   ```bash
   pnpm install
   ```

2. Run typecheck and automated tests:
   ```bash
   pnpm typecheck
   pnpm test
   ```

3. Build the TypeScript distribution:
   ```bash
   pnpm build
   ```

4. Test locally with the CLI:
   ```bash
   ./bin/aginit --help
   ./bin/aginit doctor
   ```

5. Before opening a pull request:
   - Ensure all tests pass (`pnpm test`).
   - Run typechecking (`pnpm typecheck`).
   - Keep commits focused and descriptive.
