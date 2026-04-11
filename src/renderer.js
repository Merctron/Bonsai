import { colors, symbols, applyBackground } from './colors.js';
import { highlightCode } from './highlighter.js';
import pc from 'picocolors';

const TERMINAL_WIDTH = process.stdout.columns || 120;
const GUTTER_WIDTH = 6; // Line number width
const DIVIDER_WIDTH = 3; // Space for divider
const AVAILABLE_WIDTH = TERMINAL_WIDTH - (GUTTER_WIDTH * 2) - DIVIDER_WIDTH;
const SIDE_WIDTH = Math.floor(AVAILABLE_WIDTH / 2);

function formatLineNumber(num, width = GUTTER_WIDTH) {
  return colors.lineNumber(num.toString().padStart(width - 1, ' ') + ' ');
}

// Strip ANSI codes to get actual string length
function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

function truncate(str, maxLen) {
  const plainText = stripAnsi(str);
  const actualLen = plainText.length;

  if (actualLen <= maxLen) {
    // Pad with spaces to reach maxLen
    return str + ' '.repeat(maxLen - actualLen);
  }

  // Truncate: need to find position in original string
  // This is tricky with ANSI codes, so we'll rebuild
  let result = '';
  let visualLen = 0;
  let inAnsi = false;
  let ansiCode = '';

  for (let i = 0; i < str.length && visualLen < maxLen - 1; i++) {
    const char = str[i];

    if (char === '\x1b') {
      inAnsi = true;
      ansiCode = char;
    } else if (inAnsi) {
      ansiCode += char;
      if (char === 'm') {
        result += ansiCode;
        inAnsi = false;
        ansiCode = '';
      }
    } else {
      result += char;
      visualLen++;
    }
  }

  return result + '…' + pc.reset('');
}

export function renderFileHeader(file) {
  const fileName = file.newPath || file.oldPath;
  const border = colors.border(symbols.horizontal.repeat(TERMINAL_WIDTH));

  return [
    applyBackground(border, TERMINAL_WIDTH),
    applyBackground(colors.fileName(`  ${fileName}`), TERMINAL_WIDTH),
    applyBackground(border, TERMINAL_WIDTH),
  ].join('\n');
}

export function renderSideBySide(files) {
  let output = [];

  for (const file of files) {
    output.push(renderFileHeader(file));

    for (const hunk of file.hunks) {
      if (hunk.heading) {
        output.push(applyBackground(colors.separator(`  ${hunk.heading}`), TERMINAL_WIDTH));
      }

      let oldLineNum = hunk.oldStart;
      let newLineNum = hunk.newStart;

      // Build two separate sides
      const leftLines = [];
      const rightLines = [];

      let i = 0;
      while (i < hunk.lines.length) {
        const line = hunk.lines[i];

        if (line.type === 'context') {
          // Context appears on both sides
          leftLines.push({
            lineNum: oldLineNum++,
            content: line.content,
            type: 'context',
          });
          rightLines.push({
            lineNum: newLineNum++,
            content: line.content,
            type: 'context',
          });
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
              leftLines.push({
                lineNum: oldLineNum++,
                content: removed[j].content,
                type: 'removed',
              });
            } else {
              leftLines.push({
                lineNum: null,
                content: '',
                type: 'empty',
              });
            }

            if (j < added.length) {
              rightLines.push({
                lineNum: newLineNum++,
                content: added[j].content,
                type: 'added',
              });
            } else {
              rightLines.push({
                lineNum: null,
                content: '',
                type: 'empty',
              });
            }
          }
        } else if (line.type === 'added') {
          // Addition without corresponding removal
          leftLines.push({
            lineNum: null,
            content: '',
            type: 'empty',
          });
          rightLines.push({
            lineNum: newLineNum++,
            content: line.content,
            type: 'added',
          });
          i++;
        }
      }

      // Render side by side
      const filePath = file.newPath || file.oldPath;

      for (let j = 0; j < leftLines.length; j++) {
        const left = leftLines[j];
        const right = rightLines[j];

        const leftNum = left.lineNum !== null ? formatLineNumber(left.lineNum) : ' '.repeat(GUTTER_WIDTH);
        const rightNum = right.lineNum !== null ? formatLineNumber(right.lineNum) : ' '.repeat(GUTTER_WIDTH);

        // Apply syntax highlighting
        let leftContent = left.content;
        let rightContent = right.content;

        // Highlight context and changed lines differently
        if (left.type === 'context' || left.type === 'removed') {
          leftContent = highlightCode(leftContent, filePath);
        }
        if (right.type === 'context' || right.type === 'added') {
          rightContent = highlightCode(rightContent, filePath);
        }

        // Apply diff coloring (custom color vertical bars for changed lines)
        if (left.type === 'removed') {
          // Add custom deletion color bar for removed lines
          leftContent = colors.deletionBar(' ') + leftContent;
        } else if (left.type === 'context') {
          leftContent = ' ' + leftContent;
        } else {
          leftContent = ' ' + leftContent;
        }

        if (right.type === 'added') {
          // Add custom addition color bar for added lines
          rightContent = colors.additionBar(' ') + rightContent;
        } else if (right.type === 'context') {
          rightContent = ' ' + rightContent;
        } else {
          rightContent = ' ' + rightContent;
        }

        // Truncate after highlighting
        leftContent = truncate(leftContent, SIDE_WIDTH);
        rightContent = truncate(rightContent, SIDE_WIDTH);

        // Choose divider color based on line type
        let divider;
        if (right.type === 'added') {
          divider = colors.additionDivider(` ${symbols.divider} `);
        } else if (left.type === 'removed') {
          divider = colors.deletionDivider(` ${symbols.divider} `);
        } else {
          divider = colors.separator(` ${symbols.divider} `);
        }

        const line = `${leftNum}${leftContent}${divider}${rightNum}${rightContent}`;
        output.push(applyBackground(line, TERMINAL_WIDTH));
      }

      output.push(applyBackground('', TERMINAL_WIDTH));
    }
  }

  return output.join('\n');
}
