# Third-Party Notices & Upstream Capabilities

Aginit is an orchestrator and bootstrapper that configures and integrates independent open-source tools and skills. Aginit does not vendor, fork, claim ownership of, or relicense upstream software. Each capability is installed from its upstream source (the Skills CLI, npm, or the tool's own installer) when a project enables it.

Each integrated upstream tool is governed by its respective authors and licenses. The capability registry (`src/registry/catalog.ts`) records the same author, license and repository for every entry, and the test suite checks that each one is listed here.

## Installers

- **Skills CLI / skills.sh**
  - Project: Decentralized agent skill package installer
  - Author: Vercel Inc. and contributors
  - License: MIT
  - Repository: https://github.com/vercel-labs/skills

## Codebase graph

- **Trail** (formerly Graft)
  - Project: Codebase context graph and team learnings CLI (`@trailhq/trail-code`, formerly `@nanonets/graft`)
  - Author: Trail and Graft contributors
  - License: MIT
  - Repository: https://github.com/trailhq/Trail-Code (formerly NanoNets/context-graph-engine)

## Methodology

- **Matt Pocock Skills**
  - Project: Workflow skills (`tdd`, `code-review`, `diagnosing-bugs`, `to-spec`, `to-tickets`, `implement-spec`, ...)
  - Author: Matt Pocock
  - License: MIT
  - Repository: https://github.com/mattpocock/skills

- **Superpowers**
  - Project: Agentic skills framework and development methodology
  - Author: Jesse Vincent (obra)
  - License: MIT
  - Repository: https://github.com/obra/superpowers

## Discipline

- **Ponytail**
  - Project: Agent skill for the smallest complete change and less over-engineering
  - Author: Dietrich Gebert
  - License: MIT
  - Repository: https://github.com/DietrichGebert/ponytail

- **Karpathy guidelines**
  - Project: `karpathy-guidelines` skill, derived from Andrej Karpathy's observations on LLM coding pitfalls
  - Author: Jiayuan Zhang (forrestchang)
  - License: MIT, as declared in the skill's frontmatter (the repository has no LICENSE file)
  - Repository: https://github.com/multica-ai/andrej-karpathy-skills (formerly forrestchang/andrej-karpathy-skills)

- **Humanizer**
  - Project: Agent skill that removes signs of AI-generated writing from text
  - Author: Siqi Chen (blader)
  - License: MIT
  - Repository: https://github.com/blader/humanizer

## Design

- **Impeccable**
  - Project: Design language, design-system and anti-slop review skill for web and native UI
  - Author: Paul Bakaus
  - License: Apache-2.0
  - Repository: https://github.com/pbakaus/impeccable

- **Taste Skill**
  - Project: Art direction for websites and landing pages
  - Author: Leonxlnx
  - License: MIT
  - Repository: https://github.com/Leonxlnx/taste-skill

## UI drivers

- **agent-browser**
  - Project: Browser automation CLI for AI agents
  - Author: Vercel Labs
  - License: Apache-2.0
  - Repository: https://github.com/vercel-labs/agent-browser

- **agent-device**
  - Project: iOS Simulator / Android Emulator automation for AI agents
  - Author: Callstack
  - License: MIT
  - Repository: https://github.com/callstack/agent-device (formerly callstackincubator/agent-device)

- **Chrome DevTools MCP**
  - Project: Chrome DevTools for coding agents (network, performance, memory)
  - Author: Google Chrome DevTools team
  - License: Apache-2.0
  - Repository: https://github.com/ChromeDevTools/chrome-devtools-mcp

- **BrowserSkill**
  - Project: Lets agents use the user's real, logged-in browser (`bsk`)
  - Author: Tencent
  - License: MIT
  - Repository: https://github.com/Tencent/BrowserSkill

## Testing

- **Vitest**
  - Project: Unit test framework
  - Author: Vitest team
  - License: MIT
  - Repository: https://github.com/vitest-dev/vitest

- **Playwright**
  - Project: End-to-end testing framework
  - Author: Microsoft Corporation
  - License: Apache-2.0
  - Repository: https://github.com/microsoft/playwright

- **e2e**
  - Project: AI-assisted end-to-end testing framework for web and mobile apps with a replay cache
  - Author: TesterArmy
  - License: Apache-2.0
  - Repository: https://github.com/tester-army/e2e

## Context guards (opt-in add-ons)

- **context-mode**
  - Project: Context window optimization that sandboxes large tool output
  - Author: Mert Köseoğlu (mksglu)
  - License: Elastic License 2.0 (ELv2). This is a source-available license, not an OSI open-source license; review its terms before enabling the add-on.
  - Repository: https://github.com/mksglu/context-mode

- **Worktrunk**
  - Project: Git worktree manager for parallel agents (`wt`)
  - Author: Maximilian Roos (max-sixty)
  - License: MIT OR Apache-2.0
  - Repository: https://github.com/max-sixty/worktrunk
