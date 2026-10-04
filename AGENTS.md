# aginit

Minimal, modular AI-first project bootstrapper for T3 Code, Antigravity, and Codex.

## Core Invariants
- Orchestrate upstream tools; do not duplicate, vendor, or fork them.
- Keep changes minimal, test-verified, and idempotent.
- Never commit broken builds, failed typechecks, or unverified changes.

## Essential Commands
- Package Manager: `pnpm`
- Build: `pnpm build`
- Typecheck: `pnpm typecheck`
- Test: `pnpm test`

## AI Capabilities & Skills
Installed skills live in `.agents/skills/` (shared by Antigravity and Codex):
- **Engineering**: `tdd`, `code-review`, `diagnosing-bugs`
- **Codebase Graph**: Use `graft ask "<query>" --source` or `graft map` for orientation before raw grep.

## Bootstrap & First Session
When the user asks to "bootstrap this project" or kicks off a new initiative:
1. Understand product intent and ask 2-3 essential questions to resolve ambiguity.
2. Draft or refine canonical context in `PRODUCT.md` and `DESIGN.md` (or `docs/adr/`).
3. Plan in small verifiable increments and implement test-first using installed skills.

<!-- graft:start -->
## Graft — repo context graph

This repo is indexed in `graft/`: small linked markdown nodes that explain each
system and carry exact file:line spans, kept in sync with the code through git.

For ANY task here — understanding how something works, finding where code lives,
or scoping a change — get context from the graph before grepping or opening
source files. Re-ask freely (it's cheap) and reuse literal identifiers you
already have (symbol, error string, file name) as the query. New to this repo?
Run `graft map` first — a token-budgeted orientation (dir clusters, hubs,
hotspots), no LLM, no key.

- Run `graft ask "<your question>" --source` → ranked nodes with the relevant
  code spans inlined (each hit's ≤8-line crux by default; `--full` for whole
  definitions when the crux isn't enough).
- `graft skeleton <file>` → every definition's signature + span.
- `graft callers <symbol>` → precomputed, exact edges.
- `graft grep "<literal>"` → exhaustive search over indexed files.

After code changes, refresh the graph with `graft build`.
<!-- graft:end -->
