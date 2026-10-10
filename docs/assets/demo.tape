# Hero GIF for the README. Regenerate with: vhs docs/assets/demo.tape
# Needs vhs, ttyd and ffmpeg, a built dist/ (pnpm build) and network access for skills.sh.

Output docs/assets/demo.gif

Set Shell bash
Set FontFamily "JetBrains Mono"
Set FontSize 15
Set LineHeight 1.15
Set Width 1000
Set Height 820
Set Padding 24
Set Theme "Catppuccin Mocha"
Set TypingSpeed 60ms
Set WindowBar Colorful

# Tidy prompt; run the local build from a scratch directory.
Hide
Type `export AGINIT="$PWD/bin/aginit.js" && rm -rf /tmp/demo && mkdir /tmp/demo && cd /tmp/demo`
Enter
# npx @antomanc/aginit -> the local build (same code as the published release).
Type `npx() { shift; node "$AGINIT" "$@"; }`
Enter
Type `export PS1='\[\e[32m\]antomanc@home-server\[\e[0m\]:\[\e[34m\]\w\[\e[0m\]$ '`
Enter
Type "clear"
Enter
Show

Sleep 800ms
Type "npx @antomanc/aginit"
Sleep 400ms
Enter
Sleep 1.5s

# What would you like to do? -> new project
Enter
Sleep 800ms
Type "my-app"
Sleep 500ms
Enter
Sleep 800ms
# Preset: Web -> CLI Tool
Down
Sleep 500ms
Enter
Sleep 800ms
# Package manager: pnpm
Enter

Sleep 20s
Type "ls -A my-app"
Enter
Sleep 3s
