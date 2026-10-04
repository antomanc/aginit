#!/usr/bin/env bash
set -euo pipefail

echo "=== Aginit Packaging Smoke Test ==="

# 1. Build and pack
REPO_ROOT="$(pwd)"
pnpm build
TARBALL="$(npm pack | tail -n 1)"
TARBALL_PATH="$REPO_ROOT/$TARBALL"

echo "Tarball created: $TARBALL_PATH"

# 2. Create isolated temp directory
SMOKE_DIR="$(mktemp -d -t aginit-smoke-XXXXXX)"
trap 'rm -rf "$SMOKE_DIR" "$TARBALL_PATH"' EXIT

echo "Testing in isolated directory: $SMOKE_DIR"
cd "$SMOKE_DIR"

# Initialize clean consumer package and install tarball
npm init -y > /dev/null 2>&1
npm install "$TARBALL_PATH" > /dev/null 2>&1

AGINIT_BIN="$SMOKE_DIR/node_modules/.bin/aginit"

# 3. Test CLI version
echo "Checking CLI binary..."
"$AGINIT_BIN" --version

# 4. Create new project with aginit (default pnpm)
echo "Scaffolding new project via installed package (pnpm)..."
"$AGINIT_BIN" new smoke-app --preset web --framework none --package-manager pnpm

cd smoke-app

# 5. Run doctor on generated project
echo "Running aginit doctor..."
"$AGINIT_BIN" doctor -d .

# 6. Verify pnpm-workspace.yaml exists for pnpm
test -f pnpm-workspace.yaml || { echo "Missing pnpm-workspace.yaml"; exit 1; }

# 7. Test generated project test suite
echo "Installing dependencies and running tests in generated project..."
pnpm install --silent
pnpm test

cd "$SMOKE_DIR"

# 8. Test npm package manager option
echo "Scaffolding project with npm package manager..."
"$AGINIT_BIN" new smoke-npm --preset cli --package-manager npm

# Verify pnpm-workspace.yaml is NOT created for npm
if [ -f "$SMOKE_DIR/smoke-npm/pnpm-workspace.yaml" ]; then
  echo "Error: pnpm-workspace.yaml should not exist for npm project!"
  exit 1
fi

echo "=== Smoke Test Passed Successfully! ==="
