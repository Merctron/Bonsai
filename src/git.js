import simpleGit from 'simple-git';

const git = simpleGit();

export async function isGitRepository() {
  try {
    await git.revparse(['--git-dir']);
    return true;
  } catch (error) {
    return false;
  }
}

export async function getDiff(commitRange) {
  try {
    // Handle different input formats:
    // "HEAD~3" -> diff from HEAD~3 to HEAD
    // "HEAD~5..HEAD~2" -> diff between two commits
    let diffCommand;

    if (commitRange.includes('..')) {
      diffCommand = commitRange;
    } else {
      // Single commit reference - compare it to HEAD
      diffCommand = `${commitRange}..HEAD`;
    }

    // Ignore whitespace changes by default
    const diff = await git.diff([
      diffCommand,
      '--unified=3',
      '-w', // Ignore whitespace
      '--ignore-blank-lines'
    ]);
    return diff;
  } catch (error) {
    throw new Error(`Failed to get diff: ${error.message}`);
  }
}

export async function getDiffStats(commitRange) {
  try {
    let diffCommand;

    if (commitRange.includes('..')) {
      diffCommand = commitRange;
    } else {
      diffCommand = `${commitRange}..HEAD`;
    }

    // Get diff statistics
    const stats = await git.diff([
      diffCommand,
      '--stat',
      '-w',
      '--ignore-blank-lines'
    ]);

    // Parse the stats
    const lines = stats.trim().split('\n');
    const summaryLine = lines[lines.length - 1];

    // Extract numbers from summary like: "2 files changed, 50 insertions(+), 4 deletions(-)"
    const filesMatch = summaryLine.match(/(\d+) files? changed/);
    const insertionsMatch = summaryLine.match(/(\d+) insertions?/);
    const deletionsMatch = summaryLine.match(/(\d+) deletions?/);

    return {
      filesChanged: filesMatch ? parseInt(filesMatch[1]) : 0,
      insertions: insertionsMatch ? parseInt(insertionsMatch[1]) : 0,
      deletions: deletionsMatch ? parseInt(deletionsMatch[1]) : 0,
      raw: stats
    };
  } catch (error) {
    throw new Error(`Failed to get diff stats: ${error.message}`);
  }
}

export async function getCommitInfo(commitRef) {
  try {
    const log = await git.log([commitRef, '-1']);
    return log.latest;
  } catch (error) {
    throw new Error(`Failed to get commit info: ${error.message}`);
  }
}

export async function getCommitRange(range) {
  try {
    let fromRef, toRef;

    if (range.includes('..')) {
      [fromRef, toRef] = range.split('..');
    } else {
      fromRef = range;
      toRef = 'HEAD';
    }

    const log = await git.log([`${fromRef}..${toRef}`]);
    return log.all;
  } catch (error) {
    throw new Error(`Failed to get commit range: ${error.message}`);
  }
}
