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

# 4. Create new project with aginit
echo "Scaffolding new project via installed package..."
"$AGINIT_BIN" new smoke-app --preset web --framework none

cd smoke-app

# 5. Run doctor on generated project
echo "Running aginit doctor..."
"$AGINIT_BIN" doctor -d .

# 6. Test generated project test suite
echo "Installing dependencies and running tests in generated project..."
pnpm install --silent
pnpm test

echo "=== Smoke Test Passed Successfully! ==="
