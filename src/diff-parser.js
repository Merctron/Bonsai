export function parseDiff(diffText) {
  const files = [];
  const lines = diffText.split('\n');

  let currentFile = null;
  let currentHunk = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // File header: diff --git a/file b/file
    if (line.startsWith('diff --git')) {
      if (currentFile) {
        files.push(currentFile);
      }

      const match = line.match(/diff --git a\/(.*) b\/(.*)/);
      currentFile = {
        oldPath: match?.[1] || '',
        newPath: match?.[2] || '',
        hunks: [],
      };
      continue;
    }

    // Old file: --- a/file
    if (line.startsWith('---')) {
      if (currentFile) {
        currentFile.oldFile = line.substring(4);
      }
      continue;
    }

    // New file: +++ b/file
    if (line.startsWith('+++')) {
      if (currentFile) {
        currentFile.newFile = line.substring(4);
      }
      continue;
    }

    // Hunk header: @@ -1,3 +1,4 @@
    if (line.startsWith('@@')) {
      const match = line.match(/@@ -(\d+),?(\d+)? \+(\d+),?(\d+)? @@(.*)/);
      currentHunk = {
        oldStart: parseInt(match?.[1] || '0'),
        oldLines: parseInt(match?.[2] || '1'),
        newStart: parseInt(match?.[3] || '0'),
        newLines: parseInt(match?.[4] || '1'),
        heading: match?.[5]?.trim() || '',
        lines: [],
      };
      currentFile?.hunks.push(currentHunk);
      continue;
    }

    // Content lines
    if (currentHunk) {
      if (line.startsWith('+')) {
        currentHunk.lines.push({ type: 'added', content: line.substring(1) });
      } else if (line.startsWith('-')) {
        currentHunk.lines.push({ type: 'removed', content: line.substring(1) });
      } else if (line.startsWith(' ')) {
        currentHunk.lines.push({ type: 'context', content: line.substring(1) });
      } else if (line.startsWith('\\')) {
        // "\ No newline at end of file" - ignore for now
      }
    }
  }

  if (currentFile) {
    files.push(currentFile);
  }

  return files;
}
