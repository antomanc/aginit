# 2. Make installed skills and AGENTS.md visible to Claude Code

Date: 2026-10-11

## Status
Accepted

## Context
aginit installed skills only for Antigravity and Codex, which both read
`.agents/skills/`. Claude Code discovers project skills only in
`.claude/skills/<name>/SKILL.md`, so a project set up by aginit showed none of its
skills in Claude Code. Claude Code also loads instructions from `CLAUDE.md`. Since
v2.1.277 it reads `AGENTS.md` too, but only when no `CLAUDE.md` or
`CLAUDE.local.md` exists, and not in every session (older versions, the first
session after an upgrade, or with the built-in AGENTS.md plugin disabled).

Options considered:
1. Add `claude-code` to the Skills CLI `--agent` list.
2. Symlink `.claude/skills` to `../.agents/skills` from aginit.
3. Replace `agents.primary`/`secondary` with an agent array.

## Decision
- **Option 1.** The Skills CLI (`vercel-labs/skills`) already knows the
  `claude-code` agent and links each skill from the canonical
  `.agents/skills/<name>` into `.claude/skills/<name>`. There is one copy on
  disk, `skills update` flows through, and the CLI handles platforms where
  symlinks don't work (`--copy`). aginit keeps orchestrating instead of
  managing links itself.
- **Config:** add an optional `agents.claudeCode: boolean`, written as `true`
  by new configs. If the field is missing (configs written before 0.4.0), it
  counts as enabled, so existing projects get Claude Code support on the next
  `aginit init` or `aginit update` without editing their config. Set it to
  `false` to opt out. `primary`/`secondary` keep their shape.
- **Instructions:** when Claude Code is enabled and no `CLAUDE.md` exists,
  write a one-line `CLAUDE.md` containing `@AGENTS.md`. Claude Code documents
  this import as the way to share AGENTS.md. It works in every session, and
  Claude never reads AGENTS.md twice because of it. An existing `CLAUDE.md` is
  never modified; `aginit doctor` reports when it lacks the import.
- **Graft:** pass `claude` to `graft init --agents` so Graft wires its
  in-repo Claude Code integration (`.claude/skills/graft`, hooks, statusline,
  `.mcp.json`). `--no-global` still keeps it from writing outside the repo.
- **Update path:** `aginit update` relinks the configured sources with the full
  agent list when an installed skill is missing from `.claude/skills/`.

## Consequences
- Fresh and re-initialized projects expose every skill to Claude Code as
  `/name`, including skills with `disable-model-invocation: true`.
- Projects get `.claude/` and `CLAUDE.md` files to commit.
- `aginit doctor` gains two checks while Claude Code is enabled: skills
  missing from `.claude/skills/`, and a `CLAUDE.md` that doesn't import
  AGENTS.md.
