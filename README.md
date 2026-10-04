# ai-project-bootstrap

A clean, minimal, modular AI-first project bootstrapper for **T3 Code**, **Antigravity**, and **Codex**.

Initialize a new project in seconds with automated Git, shared agent skills, codebase intelligence, testing conventions, and an intelligent intake protocol.

---

## Philosophy

> **Our project maintains orchestration; upstreams maintain capabilities.**

- **No vendoring**: We do not duplicate prompt dumps or copy third-party code. Upstream tools maintain their own skills and CLIs.
- **Dual-agent harmony**: Antigravity and Codex share standard `.agents/skills` and `AGENTS.md` without conflicts.
- **Idempotent & safe**: Never destroys existing code; conservative with file merges.
- **High signal, low noise**: `AGENTS.md` stays lean and actionable; no bloated mega-prompts.

---

## Quickstart

### Create a new project
```bash
# Web application (Vite, Vitest, Playwright, Impeccable, agent-browser, Graft)
./bin/ai-new my-web-app --preset web

# CLI application (Commander, Vitest, Graft, engineering skills)
./bin/ai-new my-cli-tool --preset cli

# Minimal agnostic repository
./bin/ai-new my-repo --preset generic
```

Or using the unified `ai` CLI:
```bash
./bin/ai new my-web-app --preset web
```

### Initialize in an existing repository
```bash
./bin/ai init --preset web
```

### Check system & project readiness
```bash
./bin/ai doctor
```

---

## Presets

| Preset | Stack & Tooling | Preconfigured Skills | Intelligence & Verification |
| :--- | :--- | :--- | :--- |
| **`web`** | TypeScript, Vite, Vitest | Matt Pocock (`tdd`, `code-review`, `diagnosing-bugs`, `prototype`, `implement-spec`), Impeccable (`impeccable`), `agent-browser` | Graft context graph, Playwright E2E, interactive browser QA |
| **`cli`** | TypeScript, Commander, Vitest | Matt Pocock (`tdd`, `code-review`, `diagnosing-bugs`, `codebase-design`) | Graft context graph, Vitest unit runner |
| **`generic`** | Minimal repo skeleton, ADR | Matt Pocock (`tdd`, `code-review`, `diagnosing-bugs`) | Graft context graph, ADR record |

---

## Upstream Capabilities

1. **Agent Skills (`skills.sh` / `npx skills`)**:
   Standardized execution skills installed into `.agents/skills/`. Compatible with Antigravity, Codex, Copilot, and Cursor.
2. **Codebase Understanding (`graft`)**:
   Deterministic graph indexing (`graft build`, `graft ask "<query>" --source`, `graft map`). Integrated non-invasively via delimited blocks in `AGENTS.md`.
3. **Frontend & UX (`impeccable`)**:
   Upstream UI polish, design critique, and design tokens via `pbakaus/impeccable`.
4. **Browser Testing & QA (`playwright` & `agent-browser`)**:
   Deterministic automated testing with Playwright paired with interactive agent browser automation via `vercel-labs/agent-browser`.

---

## Intelligent Bootstrap Boundary

The CLI deliberately stops at deterministic initialization:
1. Git repo + `.gitignore`
2. Declarative `ai.config.json`
3. Preset scaffolding (package.json, tsconfig, test harness)
4. Upstream skills installed into `.agents/skills`
5. Graft context graph initialized
6. Minimal `AGENTS.md`

### First Session in T3 Code
Once you open the created project in T3 Code, prompt the agent:
```
bootstrap this project
```

The agent will read the intake protocol defined in `AGENTS.md`:
1. Ask 2-3 essential questions to resolve product scope and target user intent.
2. Draft real product and design documentation (`PRODUCT.md`, `DESIGN.md`, or `docs/adr/`).
3. Begin test-first implementation using the pre-installed skills.

---

## Maintenance & Updates

- **Update skills**: `./bin/ai update` or `npx skills update`
- **Rebuild context graph**: `graft build`
- **Add a new skill**: `npx skills add <source> -s <skill> -a antigravity codex -y`
- **Doctor check**: `./bin/ai doctor`
