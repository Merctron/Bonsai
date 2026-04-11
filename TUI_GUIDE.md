# Bonsai TUI Mode

## Overview

Bonsai now has two modes:
1. **TUI Mode** (default) - Interactive code review interface
2. **Dump Mode** (`--dump` flag) - Static output for piping/scripts

## TUI Mode (Interactive)

Launch with:
```bash
bonsai HEAD~1           # Default: launches TUI
bonsai HEAD~5           # Review last 5 commits
bonsai feature..main    # Compare branches
```

### Features

#### Sticky Header
- Shows commit range, branch, file count, review progress
- Displays current file with review status (✓ = reviewed, ○ = not reviewed)
- Always visible while scrolling

#### Review State Tracking
- Mark files as reviewed with `r` key
- State persists per-branch in `.bonsai-review-{branch}.json`
- Resume reviews where you left off
- Track progress: "3/5 files reviewed"

#### File Navigation
- `n` - Next file
- `p` - Previous file
- `f` - Toggle file list (shows all files with review status)
- Select file in list with arrow keys + Enter

#### Scrolling & Navigation
- `j` / `↓` - Scroll down
- `k` / `↑` - Scroll up
- `d` - Scroll down half page
- `u` - Scroll up half page
- `g` - Jump to top
- `G` - Jump to bottom
- Mouse scroll works too!

#### Key Bindings
```
r       - Toggle review status for current file
n       - Next file
p       - Previous file
f       - Toggle file list
/       - Search (coming soon)
q       - Quit
Ctrl+C  - Quit
```

### Review Workflow

Typical workflow:
1. `bonsai HEAD~3` - Start review
2. Review first file, scroll with `j/k`
3. Press `r` to mark as reviewed
4. Press `n` to go to next file
5. Press `f` to see all files and jump around
6. State auto-saves, resume anytime

### Review State Files

State is saved to `.bonsai-review-{branch}.json`:
```json
{
  "files": {
    "src/components/Button.tsx": {
      "reviewed": true,
      "lastPosition": 0
    },
    "src/api/client.ts": {
      "reviewed": false,
      "lastPosition": 45
    }
  }
}
```

These files are gitignored and per-branch, so each branch has independent review state.

## Dump Mode (Static)

For scripts, piping, or traditional pager view:
```bash
bonsai HEAD~1 --dump              # Output to less
bonsai HEAD~1 --dump > diff.txt   # Save to file
bonsai HEAD~1 --dump | grep TODO  # Pipe to other tools
```

Same beautiful output as before, just non-interactive.

## Color Scheme

Both modes use your custom palette:
- Background: `#30292f` (dark purple-brown)
- Addition bars: `#00635D` (teal)
- Deletion bars: `#8F000A` (dark red)

## Roadmap

### Phase 1 (Current - MVP)
- ✅ Sticky header with file context
- ✅ Review state tracking
- ✅ Basic navigation (n/p/f)
- ✅ Vim keybindings for scroll
- ✅ Per-branch state persistence

### Phase 2 (Next)
- Search within file (`/` key)
- Syntax highlighting in TUI
- Better color rendering
- Jump to specific line
- Show commit messages

### Phase 3 (Future)
- Fuzzy file finder (Ctrl+P)
- Hide/show reviewed files
- Collapse unchanged hunks
- Export review summary
- Inline notes/comments

## Known Limitations

1. **Syntax highlighting**: Basic for now, will improve
2. **Search**: Not yet implemented
3. **Very large diffs**: Tested up to ~5000 lines, should be fine
4. **Colors**: Blessed uses different color rendering than static mode

## Troubleshooting

**TUI looks weird:**
- Make sure your terminal supports UTF-8
- Try resizing the terminal
- Some terminals have issues with blessed - report if you see problems

**State not saving:**
- Check file permissions in current directory
- Review state saved to `.bonsai-review-{branch}.json`

**Want old behavior:**
- Use `--dump` flag for non-interactive mode

## Feedback

This is an MVP! Let me know what works, what doesn't, and what features would make code review easier for you.
