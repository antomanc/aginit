# From the repo root: pnpm build && vhs docs/assets/demo.tape
# Requires vhs, ttyd, ffmpeg, JetBrains Mono, graft, agent-browser and network access.
# npx aginit resolves to our local build; all setup/doctor output is real.
Output docs/assets/demo.gif
Set Shell bash
Set FontFamily "JetBrains Mono"
Set FontSize 16
Set Width 1100
Set Height 680
Set Padding 24
Set WindowBar Colorful
Set Theme "Catppuccin Mocha"
Set TypingSpeed 45ms
Set Framerate 20

Hide
Type "source scripts/demo-setup.sh"
Enter
Sleep 500ms
Ctrl+L
Show
Sleep 1.2s

Type "npx aginit"
Enter
Wait+Screen /What would you like to do/
Sleep 650ms
# Existing Vite marker defaults to Current directory.
Enter
Wait+Screen /Platform/
Sleep 700ms
Enter
Wait+Screen /Methodology/
Down
Sleep 650ms
Up
Sleep 650ms
Enter
Wait+Screen /Design/
Sleep 700ms
Enter
Wait+Screen /Testing engine/
# Existing project runner -> e2e (Vitest, Native, Playwright, e2e).
Down 2
Sleep 700ms
Enter
Wait+Screen /UI driver/
Sleep 700ms
Enter
Wait+Screen /Add-ons/
# Show optional selection, then leave the baseline free of extra integrations.
Space
Sleep 650ms
Space
Enter
# No lockfile in the fixture: choose pnpm for the existing Node project.
Sleep 700ms
Enter
Sleep 700ms
Sleep 1.2s
Screenshot node_modules/.release/demo-summary.png
Enter
# Upstream installs run unmodified; omit network-dependent time from the recording.
Hide
Wait+Screen@10m /Setup exited: 0/
Ctrl+L
Show
Sleep 1.2s
Type "aginit doctor"
Sleep 600ms
Enter
Hide
Wait+Screen@2m /All [0-9]+ health checks passed/
Show
Sleep 2.5s
Screenshot node_modules/.release/demo-doctor.png
Sleep 100ms
