# ai-project-bootstrap
AI-first cli project bootstrapped with `ai-project-bootstrap`.
## Core Invariants
- Keep changes small, focused, and test-verified.
- Prefer native language & platform capabilities over heavy external frameworks.
- Never commit broken builds, failed typechecks, or unverified changes.
## Essential Commands
- Package Manager: `pnpm`
- Build: `pnpm build`
- Typecheck: `pnpm typecheck`
- Test: `pnpm test`
## AI Capabilities & Skills
Installed skills live in `.agents/skills/` (shared by Antigravity and Codex):
- **Engineering**: `tdd`, `code-review`, `diagnosing-bugs`
## Bootstrap & First Session
When the user asks to "bootstrap this project" or kicks off a new initiative:
1. Understand product intent and ask 2-3 essential questions to resolve ambiguity.
2. Draft or refine canonical context in `PRODUCT.md` and `DESIGN.md` (or `docs/adr/`).
3. Plan in small verifiable increments and implement test-first using installed skills.
