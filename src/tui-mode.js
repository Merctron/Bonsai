import blessed from 'blessed';
import { getDiff, getDiffStats, isGitRepository } from './git.js';
import { parseDiff } from './diff-parser.js';
import { highlightCode } from './highlighter.js';
import { palette, BG_CODE, RESET_CODE } from './colors.js';
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

  // Diff content area
  const diffBox = blessed.box({
    top: 3,
    left: 0,
    width: '100%',
    height: '100%-4',
    scrollable: true,
    alwaysScroll: true,
    scrollbar: {
      ch: '│',
      style: {
        fg: 'white'
      }
    },
    keys: true,
    vi: true,
    mouse: true,
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

  // Render diff for current file
  function renderDiff() {
    const file = files[currentFileIndex];
    const filePath = file.newPath || file.oldPath;

    let content = [];

    for (const hunk of file.hunks) {
      if (hunk.heading) {
        content.push(hunk.heading);
      }

      let oldLineNum = hunk.oldStart;
      let newLineNum = hunk.newStart;

      for (const line of hunk.lines) {
        let lineStr = '';

        if (line.type === 'removed') {
          lineStr = `{red-fg}${oldLineNum.toString().padStart(4)} - ${line.content}{/red-fg}`;
          oldLineNum++;
        } else if (line.type === 'added') {
          lineStr = `{green-fg}${newLineNum.toString().padStart(4)} + ${line.content}{/green-fg}`;
          newLineNum++;
        } else {
          lineStr = `${oldLineNum.toString().padStart(4)}   ${line.content}`;
          oldLineNum++;
          newLineNum++;
        }

        content.push(lineStr);
      }

      content.push('');
    }

    diffBox.setContent(content.join('\n'));

    // Restore scroll position
    const savedPosition = reviewState.files[filePath]?.lastPosition || 0;
    diffBox.setScrollPerc(savedPosition);

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
  statusBar.setContent('[r]eview [n]ext [p]rev [f]iles [/]search [q]uit');

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
      reviewState.files[filePath].lastPosition = diffBox.getScrollPerc();
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
      reviewState.files[filePath].lastPosition = diffBox.getScrollPerc();
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
      diffBox.width = '70%';
      diffBox.left = '30%';
      updateFileList();
      fileList.focus();
    } else {
      diffBox.width = '100%';
      diffBox.left = 0;
      diffBox.focus();
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
      reviewState.files[filePath].lastPosition = diffBox.getScrollPerc();
      saveReviewState(reviewState);

      currentFileIndex = selected;
      renderDiff();
      updateFileList();
    }

    // Hide file list after selection
    showFileList = false;
    fileList.hidden = true;
    diffBox.width = '100%';
    diffBox.left = 0;
    diffBox.focus();
    screen.render();
  });

  // Append elements
  screen.append(header);
  screen.append(diffBox);
  screen.append(fileList);
  screen.append(statusBar);

  // Initial render
  updateHeader();
  renderDiff();
  diffBox.focus();
  screen.render();
}
