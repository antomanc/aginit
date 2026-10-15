# From the repo root: pnpm build && vhs docs/assets/demo.tape
# Requires vhs, ttyd, ffmpeg, JetBrains Mono, graft, agent-browser and network access.
# npx aginit resolves to our local build; all setup/doctor output is real.
Output docs/assets/demo.gif

Set Shell bash
Set FontFamily "JetBrains Mono"
Set FontSize 18
Set LineHeight 1.25
Set Width 1140
Set Height 720
Set Padding 28
Set WindowBar Colorful
Set Theme "Catppuccin Mocha"
Set TypingSpeed 75ms
Set Framerate 30
Set CursorBlink false

Hide
Type "source scripts/demo-setup.sh"
Enter
Sleep 500ms
Ctrl+L
Show
Sleep 1s

# 1. Launch the interactive wizard (let the viewer read the command!)
Type "npx aginit"
Sleep 600ms
Enter

# 2. Target directory (auto-detected Vite project)
Wait+Screen /What would you like to do/
Sleep 1.3s
Enter

# 3. Platform (auto-detected Web)
Wait+Screen /Platform/
Sleep 1.3s
Enter

# 4. Methodology: browse options smoothly so the viewer can read them
Wait+Screen /Methodology/
Sleep 900ms
Down
Sleep 750ms
Down
Sleep 750ms
Up
Sleep 500ms
Up
Sleep 900ms
Enter

# 5. Design system (highlight Impeccable)
Wait+Screen /Design/
Sleep 1.4s
Enter

# 6. Testing engine: step down one-by-one to e2e and pause on it!
Wait+Screen /Testing engine/
Sleep 900ms
Down
Sleep 550ms
Down
Sleep 1.4s
Enter

# 7. UI driver (highlight agent-browser)
Wait+Screen /UI driver/
Sleep 1.4s
Enter

# 8. Add-ons: toggle Karpathy / Context-Mode slowly so viewer sees multiselect
Wait+Screen /Add-ons/
Sleep 900ms
Space
Sleep 800ms
Space
Sleep 700ms
Enter

# 9. Package manager selection (pnpm)
Sleep 1.1s
Enter

# 10. THE MONEY SHOT #1: The Setup Summary!
# Give the viewer 2.8 seconds to read the full stack configuration before confirming.
Sleep 2.8s
Screenshot node_modules/.release/demo-summary.png
Enter

# 11. Run real upstream installs off-camera, then show the completion output!
Hide
Wait+Screen@10m /Setup exited: 0/
Show
Sleep 2.4s

# 12. THE MONEY SHOT #2: Verify everything with aginit doctor
Type "aginit doctor"
Sleep 600ms
Enter
Hide
Wait+Screen@2m /All [0-9]+ health checks passed/
Show
# Hold on the final green 17/17 screen so the GIF loop feels rewarding
Sleep 4s
Screenshot node_modules/.release/demo-doctor.png
Sleep 200ms
