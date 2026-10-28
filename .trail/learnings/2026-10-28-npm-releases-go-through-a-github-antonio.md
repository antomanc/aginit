---
title: "npm releases go through a GitHub release, and pnpm audit gates them"
author: Antonio
date: 2026-10-28
branch: main
cost: { minutes: 4, tokens: 92550 }
id: l-05ac61e5
scope: repo
status: active
src: agent
touches:
  - CHANGELOG.md
  - package.json
  - pnpm-lock.yaml
  - ".github/workflows/publish.yml"
---

## Decided
- Publish by creating a GitHub release for the version tag: `.github/workflows/publish.yml` runs `pnpm check` then `pnpm publish --provenance` with the NPM_TOKEN secret. This machine has no npm login, so never `npm publish` locally.
- Release commit is `chore(release): X.Y.Z` (package.json version + CHANGELOG), then tag `vX.Y.Z`, push main and the tag, then `gh release create`.

## Tried and ruled out
- Releasing with a failing `pnpm audit`: `pnpm check` includes the audit, so an advisory on a transitive dev dependency (vite via vitest in 0.7.0) blocks CI publish. `pnpm update <pkg> -r` refreshed only pnpm-lock.yaml and cleared it.

## Watch out
- CI logs "Published" about a minute before the npm registry lists the version; expect lag before `npm view` shows it.
- The OIDC token exchange warning (ERR_PNPM_AUTH_TOKEN_EXCHANGE) in the publish log is harmless; it falls back to the token.
