import { getDiff, getDiffStats, isGitRepository } from './git.js';
import { parseDiff } from './diff-parser.js';
import { renderSideBySide } from './renderer.js';
import { colors, symbols, applyBackground } from './colors.js';
import pc from 'picocolors';

function renderStatsHeader(stats, commitRange) {
  const TERMINAL_WIDTH = process.stdout.columns || 120;
  const heavyBorder = pc.bold(symbols.heavyHorizontal.repeat(TERMINAL_WIDTH));

  const fileWord = stats.filesChanged === 1 ? 'file' : 'files';
  const statsLine = [
    pc.bold(colors.commit(commitRange)),
    pc.bold(colors.separator('│')),
    pc.bold(colors.fileName(`${stats.filesChanged} ${fileWord} changed`)),
    stats.insertions > 0 ? pc.bold(colors.added(`+${stats.insertions}`)) : null,
    stats.deletions > 0 ? pc.bold(colors.removed(`-${stats.deletions}`)) : null,
  ].filter(Boolean).join(' ');

  return [
    applyBackground('', TERMINAL_WIDTH),
    applyBackground(heavyBorder, TERMINAL_WIDTH),
    applyBackground(`  ${statsLine}`, TERMINAL_WIDTH),
    applyBackground(heavyBorder, TERMINAL_WIDTH),
  ].join('\n');
}

export async function showDiff(commitRange) {
  // Check if we're in a git repository
  const isRepo = await isGitRepository();
  if (!isRepo) {
    throw new Error('Not a git repository');
  }

  try {
    // Get diff stats first
    const stats = await getDiffStats(commitRange);

    if (stats.filesChanged === 0) {
      console.log(colors.separator('No changes found in the specified range.'));
      return;
    }

    // Show stats header
    console.log(renderStatsHeader(stats, commitRange));

    // Get the diff
    const diffText = await getDiff(commitRange);

    if (!diffText || diffText.trim() === '') {
      console.log(colors.separator('No diff content.'));
      return;
    }

    // Parse it
    const files = parseDiff(diffText);

    if (files.length === 0) {
      console.log(colors.separator('No files changed.'));
      return;
    }

    // Render it beautifully
    const output = renderSideBySide(files);

    // Output to stdout (will be piped to less for scrolling/search)
    console.log(output);

  } catch (error) {
    throw error;
  }
}
