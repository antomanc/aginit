# Sourced by docs/assets/demo.tape from the repository root.
# Real CLI and upstream tools; only download/install time is hidden in the GIF.
export AGINIT="$PWD/bin/aginit.js"
export AGINIT_DEMO_ROOT="$PWD"
export AGINIT_DEMO_DIR
AGINIT_DEMO_DIR=$(mktemp -d /tmp/aginit-demo.XXXXXX)
trap 'rm -rf "$AGINIT_DEMO_DIR"' EXIT
cd "$AGINIT_DEMO_DIR" || exit 1
printf '%s\n' '{"name":"orbit-web","private":true,"type":"module","packageManager":"pnpm@12.10.1","scripts":{"dev":"vite"},"devDependencies":{"vite":"^7.0.0"}}' > package.json
printf '%s\n' '<!doctype html><html><title>Orbit</title><body>Orbit dashboard</body></html>' > index.html
aginit() {
  local status
  if [ "${1:-}" = doctor ]; then
    # Keep the full real report for verification; frame its final checks in the GIF.
    FORCE_COLOR=1 node "$AGINIT" "$@" > "$AGINIT_DEMO_ROOT/node_modules/.release/demo-doctor.log" 2>&1
    status=$?
    printf '\033[3J\033[2J\033[H'
    tail -n 15 "$AGINIT_DEMO_ROOT/node_modules/.release/demo-doctor.log"
  else
    node "$AGINIT" "$@"
    status=$?
    printf '\033[3J\033[2J\033[HSetup exited: %s\n' "$status"
  fi
  return "$status"
}

npx() {
  if [ "$1" = aginit ]; then shift; aginit "$@"; else command npx "$@"; fi
}
export PS1='$ '
unset CI NO_COLOR
export FORCE_COLOR=1
clear
