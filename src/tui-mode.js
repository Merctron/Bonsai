import blessed from 'blessed';
import { getDiff, getDiffStats, isGitRepository } from './git.js';
import { parseDiff } from './diff-parser.js';
import { highlightCode } from './highlighter.js';
import { palette, BG_CODE, RESET_CODE } from './colors.js';
import { ansiToBlessed } from './ansi-to-blessed.js';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Get current git branch
function getCurrentBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

// State file path
function getStateFilePath() {
  const branch = getCurrentBranch();
  const safeBranch = branch.replace(/[^a-zA-Z0-9-_]/g, '_');
  return path.join(process.cwd(), `.bonsai-review-${safeBranch}.json`);
}

// Load review state
function loadReviewState() {
  const filePath = getStateFilePath();
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      return { files: {} };
    }
  }
  return { files: {} };
}

// Save review state
function saveReviewState(state) {
  const filePath = getStateFilePath();
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
}

export async function launchTUI(commitRange) {
  // Check if we're in a git repository
  const isRepo = await isGitRepository();
  if (!isRepo) {
    throw new Error('Not a git repository');
  }

  // Get diff data
  const stats = await getDiffStats(commitRange);
  if (stats.filesChanged === 0) {
    console.log('No changes found in the specified range.');
    return;
  }

  const diffText = await getDiff(commitRange);
  const files = parseDiff(diffText);

  if (files.length === 0) {
    console.log('No files changed.');
    return;
  }

  // Load review state
  const reviewState = loadReviewState();
  const branch = getCurrentBranch();

  // Initialize state for new files
  files.forEach(file => {
    const filePath = file.newPath || file.oldPath;
    if (!reviewState.files[filePath]) {
      reviewState.files[filePath] = {
        reviewed: false,
        lastPosition: 0
      };
    }
  });

  // Create blessed screen
  const screen = blessed.screen({
    smartCSR: true,
    fullUnicode: true,
    title: 'Bonsai - Code Review'
  });

  // Current state
  let currentFileIndex = 0;
  let showFileList = false;

  // Get reviewed count
  function getReviewedCount() {
    return files.filter(f => {
      const fp = f.newPath || f.oldPath;
      return reviewState.files[fp]?.reviewed;
    }).length;
  }

  // Sticky header
  const header = blessed.box({
    top: 0,
    left: 0,
    width: '100%',
    height: 3,
    tags: true,
    style: {
      bg: palette.background,
      fg: 'white',
      bold: true
    }
  });

  // Update header content
  function updateHeader() {
    const currentFile = files[currentFileIndex];
    const filePath = currentFile.newPath || currentFile.oldPath;
    const reviewed = reviewState.files[filePath]?.reviewed ? '✓' : '○';
    const reviewedCount = getReviewedCount();

    const line1 = `${commitRange} │ ${branch} │ ${stats.filesChanged} files │ ${reviewedCount} reviewed ✓ │ +${stats.insertions} -${stats.deletions}`;
    const line2 = `[${currentFileIndex + 1}/${files.length}] ${reviewed} ${filePath}`;

    header.setContent(`{center}${line1}{/center}\n{center}${line2}{/center}`);
    screen.render();
  }

  // Left side diff box
  const leftBox = blessed.box({
    top: 3,
    left: 0,
    width: '49%',
    height: '100%-4',
    scrollable: true,
    alwaysScroll: true,
    wrap: true,
    scrollbar: {
      ch: '│',
      style: {
        fg: 'white'
      }
    },
    keys: true,
    vi: true,
    mouse: true,
    tags: true,
    style: {
      bg: palette.background,
      fg: 'white'
    }
  });

  // Divider
  const divider = blessed.line({
    top: 3,
    left: '49%',
    height: '100%-4',
    orientation: 'vertical',
    style: {
      fg: 'white',
      bg: palette.background
    }
  });

  // Right side diff box
  const rightBox = blessed.box({
    top: 3,
    left: '49%+1',
    width: '51%-1',
    height: '100%-4',
    scrollable: true,
    alwaysScroll: true,
    wrap: true,
    scrollbar: {
      ch: '│',
      style: {
        fg: 'white'
      }
    },
    tags: true,
    style: {
      bg: palette.background,
      fg: 'white'
    }
  });

  // File list (hidden by default)
  const fileList = blessed.list({
    top: 3,
    left: 0,
    width: '30%',
    height: '100%-4',
    keys: true,
    vi: true,
    mouse: true,
    hidden: true,
    style: {
      bg: palette.background,
      fg: 'white',
      selected: {
        bg: palette.additionLine,
        fg: 'white'
      }
    },
    border: {
      type: 'line'
    }
  });

  // Populate file list
  function updateFileList() {
    const items = files.map((f, i) => {
      const fp = f.newPath || f.oldPath;
      const reviewed = reviewState.files[fp]?.reviewed ? '✓' : '○';
      const current = i === currentFileIndex ? '→' : ' ';
      return `${current} ${reviewed} ${fp}`;
    });
    fileList.setItems(items);
    fileList.select(currentFileIndex);
  }

  // Synchronize scrolling between boxes
  function syncScroll(source, target) {
    const sourceScroll = source.getScrollPerc();
    target.setScrollPerc(sourceScroll);
    screen.render();
  }

  // Setup scroll synchronization
  leftBox.on('scroll', () => syncScroll(leftBox, rightBox));
  rightBox.on('scroll', () => syncScroll(rightBox, leftBox));

  // Render diff for current file (side-by-side with syntax highlighting)
  function renderDiff() {
    const file = files[currentFileIndex];
    const filePath = file.newPath || file.oldPath;

    let leftContent = [];
    let rightContent = [];

    for (const hunk of file.hunks) {
      if (hunk.heading) {
        leftContent.push(`{cyan-fg}${hunk.heading}{/cyan-fg}`);
        rightContent.push(`{cyan-fg}${hunk.heading}{/cyan-fg}`);
      }

      let oldLineNum = hunk.oldStart;
      let newLineNum = hunk.newStart;

      // Process lines in pairs for side-by-side
      let i = 0;
      while (i < hunk.lines.length) {
        const line = hunk.lines[i];

        if (line.type === 'context') {
          // Apply syntax highlighting
          const highlighted = ansiToBlessed(highlightCode(line.content, filePath));

          const leftNum = oldLineNum.toString().padStart(4);
          const rightNum = newLineNum.toString().padStart(4);

          leftContent.push(`${leftNum}  ${highlighted}`);
          rightContent.push(`${rightNum}  ${highlighted}`);

          oldLineNum++;
          newLineNum++;
          i++;
        } else if (line.type === 'removed') {
          // Collect consecutive removals
          const removed = [];
          while (i < hunk.lines.length && hunk.lines[i].type === 'removed') {
            removed.push(hunk.lines[i]);
            i++;
          }

          // Collect consecutive additions
          const added = [];
          while (i < hunk.lines.length && hunk.lines[i].type === 'added') {
            added.push(hunk.lines[i]);
            i++;
          }

          // Pair them up
          const maxLen = Math.max(removed.length, added.length);
          for (let j = 0; j < maxLen; j++) {
            if (j < removed.length) {
              const leftNum = oldLineNum.toString().padStart(4);
              const highlighted = ansiToBlessed(highlightCode(removed[j].content, filePath));
              leftContent.push(`{red-fg}${leftNum} -${highlighted}{/red-fg}`);
              oldLineNum++;
            } else {
              leftContent.push('');
            }

            if (j < added.length) {
              const rightNum = newLineNum.toString().padStart(4);
              const highlighted = ansiToBlessed(highlightCode(added[j].content, filePath));
              rightContent.push(`{green-fg}${rightNum} +${highlighted}{/green-fg}`);
              newLineNum++;
            } else {
              rightContent.push('');
            }
          }
        } else if (line.type === 'added') {
          // Addition without corresponding removal
          leftContent.push('');

          const rightNum = newLineNum.toString().padStart(4);
          const highlighted = ansiToBlessed(highlightCode(line.content, filePath));
          rightContent.push(`{green-fg}${rightNum} +${highlighted}{/green-fg}`);
          newLineNum++;
          i++;
        }
      }

      leftContent.push('');
      rightContent.push('');
    }

    leftBox.setContent(leftContent.join('\n'));
    rightBox.setContent(rightContent.join('\n'));

    // Restore scroll position
    const savedPosition = reviewState.files[filePath]?.lastPosition || 0;
    leftBox.setScrollPerc(savedPosition);
    rightBox.setScrollPerc(savedPosition);

    updateHeader();
    screen.render();
  }

  // Status bar
  const statusBar = blessed.box({
    bottom: 0,
    left: 0,
    width: '100%',
    height: 1,
    tags: true,
    style: {
      bg: palette.background,
      fg: 'white'
    }
  });
  statusBar.setContent('{bold}[r]{/bold}eview {bold}[n]{/bold}ext {bold}[p]{/bold}rev {bold}[f]{/bold}iles {bold}[q]{/bold}uit  {cyan-fg}j/k{/cyan-fg} scroll {cyan-fg}d/u{/cyan-fg} page {cyan-fg}g/G{/cyan-fg} top/bottom');

  // Key bindings
  screen.key(['q', 'C-c'], () => {
    return process.exit(0);
  });

  // Toggle review status
  screen.key(['r'], () => {
    const file = files[currentFileIndex];
    const filePath = file.newPath || file.oldPath;
    reviewState.files[filePath].reviewed = !reviewState.files[filePath].reviewed;
    saveReviewState(reviewState);
    updateHeader();
    updateFileList();
    screen.render();
  });

  // Next file
  screen.key(['n'], () => {
    if (currentFileIndex < files.length - 1) {
      // Save current position
      const file = files[currentFileIndex];
      const filePath = file.newPath || file.oldPath;
      reviewState.files[filePath].lastPosition = leftBox.getScrollPerc();
      saveReviewState(reviewState);

      currentFileIndex++;
      renderDiff();
      updateFileList();
    }
  });

  // Previous file
  screen.key(['p'], () => {
    if (currentFileIndex > 0) {
      // Save current position
      const file = files[currentFileIndex];
      const filePath = file.newPath || file.oldPath;
      reviewState.files[filePath].lastPosition = leftBox.getScrollPerc();
      saveReviewState(reviewState);

      currentFileIndex--;
      renderDiff();
      updateFileList();
    }
  });

  // Toggle file list
  screen.key(['f'], () => {
    showFileList = !showFileList;
    fileList.hidden = !showFileList;

    if (showFileList) {
      leftBox.width = '34%';
      leftBox.left = '30%';
      divider.left = '64%';
      rightBox.width = '36%-1';
      rightBox.left = '64%+1';
      updateFileList();
      fileList.focus();
    } else {
      leftBox.width = '49%';
      leftBox.left = 0;
      divider.left = '49%';
      rightBox.width = '51%-1';
      rightBox.left = '49%+1';
      leftBox.focus();
    }

    screen.render();
  });

  // File list selection
  fileList.key(['enter'], () => {
    const selected = fileList.selected;
    if (selected !== currentFileIndex) {
      // Save current position
      const file = files[currentFileIndex];
      const filePath = file.newPath || file.oldPath;
      reviewState.files[filePath].lastPosition = leftBox.getScrollPerc();
      saveReviewState(reviewState);

      currentFileIndex = selected;
      renderDiff();
      updateFileList();
    }

    // Hide file list after selection
    showFileList = false;
    fileList.hidden = true;
    leftBox.width = '49%';
    leftBox.left = 0;
    divider.left = '49%';
    rightBox.width = '51%-1';
    rightBox.left = '49%+1';
    leftBox.focus();
    screen.render();
  });

  // Append elements
  screen.append(header);
  screen.append(leftBox);
  screen.append(divider);
  screen.append(rightBox);
  screen.append(fileList);
  screen.append(statusBar);

  // Initial render
  updateHeader();
  renderDiff();
  leftBox.focus();
  screen.render();
}
