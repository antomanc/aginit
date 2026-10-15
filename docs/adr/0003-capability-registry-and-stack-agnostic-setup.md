# 3. Declarative capability registry and stack-agnostic setup

Date: 2026-10-15

## Status
Accepted

## Context
aginit hard-coded every tool in several places: the skill list in
`config/defaults.ts`, agent-browser checks in `cli/new.ts` and `cli/doctor.ts`,
Graft in `cli/new.ts`, capability lines in `adapters/agents-md.ts`. Adding or
swapping a skill meant touching CLI parsing, writers and doctor at once. Every
preset also wrote a root `package.json`, so a Flutter, Swift, Kotlin, Rust, Go
or Python project got Node files it never asked for.

## Decision
- **One registry.** `src/registry/catalog.ts` lists each capability as a
  `CapabilityDescriptor`: category, platforms, credits, install steps
  (`skills-sh`, `binary`, or a named `setup` for upstream init commands),
  extra doctor checks, an AGENTS.md routing row, anti-rationalization
  rebuttals, and a micro-doc section. `init`, `list`, `add`, `remove`,
  `doctor` and the docs generators read the registry. None of them name a tool.
- **Install steps stay orchestration.** Skills go through `npx skills add`;
  e2e through its own `e2e init`; Graft through `graft init`. aginit installs
  no new global CLIs. It checks them and prints the upstream install command.
  The one global install it already did, agent-browser's runtime, is kept.
- **Config.** `aginit.config.json` gains optional `platform`, `stack`,
  `capabilities`, `customCapabilities` and `disabledCapabilities`. A saved
  config is reused verbatim on reruns. Profile flags, `add` and `remove`
  change it incrementally, so hand-narrowed `skills.sources` survive. Configs
  without `capabilities` (pre-v2) are not rewritten; their capabilities are
  inferred from `skills.sources`, `codebase.graft` and `browser.playwright`.
  Those switches still turn their capability off.
- **Exclusive categories.** Methodology, design and UI driver hold one pick
  each, so two workflow suites never fight over slash commands. Add-ons are
  marked `addon` and never replaced by a category flag.
- **Stack detection** (`src/detect/`) picks the platform and the host
  commands. A preset writes `package.json` only when the `vitest`
  capability is active, and Node-only capabilities (`requiresNodeInProjectRoot`)
  are refused for other stacks. e2e runs at the root of Node projects and in an
  isolated `.agents/e2e/` workspace otherwise.
- **AGENTS.md** keeps the project-owned header (invariants, commands) and
  gains a managed `<!-- aginit:start -->…<!-- aginit:end -->` block
  (guardrails, Task Routing, Anti-Rationalization), placed above Graft's block.
  Task details move to `docs/agents/{testing,ui-verification,workflows}.md`.
  Those files carry a marker line. Deleting it hands the file to the user, and
  aginit stops writing it.
- **PRODUCT.md / DESIGN.md are not templated.** Impeccable's `/impeccable init`
  and `/impeccable document` create them and record native platforms
  (`ios`, `android`, `adaptive`). A placeholder file from aginit would read as
  real context to Impeccable.
- **Bare `aginit` stays safe.** It opens the wizard in a TTY and prints help
  otherwise; any option (or `--yes`) runs init. A stray invocation in CI never
  rewrites a project.

## Consequences
- A new skill or tool is one catalog entry, and doctor, `list`, routing and
  docs pick it up. Users can add a skill repo without a release
  (`--add-skill owner/repo` or `customCapabilities`).
- Non-JS projects get AGENTS.md, skills, Graft and e2e with no root
  `package.json`.
- The default set gains `karpathy-guidelines`. Existing configs keep their
  sources as written; `aginit add karpathy-guidelines` opts in.
- `context-mode` is Elastic License 2.0 (source-available), so it is opt-in
  only and labeled as such in `aginit list` and THIRD_PARTY_NOTICES.md.
