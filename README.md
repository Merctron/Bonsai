# Bonsai

A beautiful, opinionated git diff viewer built for human-centric code review.

## Philosophy

Bonsai is a scoped tool with a singular focus: make code review readable and enjoyable for humans. It prioritizes visual clarity and workflow efficiency over feature breadth.

**Design Goals:**
- Help humans collaborate with AI better through superior code readability
- Excellent at one thing (code review) rather than adequate at many things
- Visual features matter - humans think visually when reading code
- Fast and responsive even with large diffs
- Opinionated aesthetics - custom color palette, no theming

**Non-Goals:**
- Not a replacement for git
- No git integration (staging, committing, etc.)
- No configuration files or customization beyond code changes

## Features

### Interactive TUI Mode (Default)
- Sticky header with file context and review progress
- Review state tracking - mark files as reviewed, resume where you left off
- Per-branch state persistence
- File navigation with vim keybindings
- Side-by-side diff view with syntax highlighting
- Toggle file list to see all files and jump between them

### Static Dump Mode
- Beautiful static output with custom color scheme
- Pipe to less for traditional pager experience
- Use for scripts, piping, or quick diffs

## Installation

```bash
cargo build --release
# Binary will be at ./target/release/bonsai
```

To install globally:
```bash
cargo install --path .
```

## Usage

### Interactive Mode

```bash
bonsai HEAD~1           # Review last commit
bonsai HEAD~5           # Review last 5 commits
bonsai feature..main    # Compare branches
```

**Key Bindings:**
```
r       - Mark current file as reviewed
n       - Next file
p       - Previous file
f       - Toggle file list
j/k     - Scroll up/down
d/u     - Scroll half page
g/G     - Jump to top/bottom
q       - Quit
```

**Review Workflow:**
1. Launch bonsai to start reviewing
2. Scroll through diff with j/k
3. Press r to mark file as reviewed
4. Press n to move to next file
5. Press f to see all files and progress
6. State auto-saves, resume anytime

### Static Mode

```bash
bonsai HEAD~1 dump              # Output to terminal
bonsai HEAD~1 dump | less       # Pipe to pager
bonsai HEAD~1 dump > diff.txt   # Save to file
bonsai HEAD~1 dump | grep TODO  # Pipe to other tools
```

## Review State

Review state is saved per-branch in `.bonsai-review-{branch}.json` files (gitignored). Each file tracks:
- Which files have been reviewed
- Last scroll position in each file

State persists across sessions, so you can resume reviews anytime.

## Color Scheme

Custom color palette designed for readability:
- Background: `#30292f` (dark purple-brown)
- Addition indicators: `#00635D` (teal)
- Deletion indicators: `#8F000A` (dark red)

## Development

Built with Rust using ratatui for the TUI and crossterm for terminal control. Source code is in `src/`.

## License

MIT
