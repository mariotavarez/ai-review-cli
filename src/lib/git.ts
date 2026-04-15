import simpleGit from 'simple-git';
import type { GitDiff } from '../types.js';

function getGit() {
  return simpleGit(process.cwd());
}

/**
 * Check if the current working directory is inside a git repository.
 */
export async function isGitRepo(): Promise<boolean> {
  try {
    const git = getGit();
    await git.revparse(['--git-dir']);
    return true;
  } catch {
    return false;
  }
}

/**
 * Return the list of staged file names.
 */
export async function getStagedFiles(): Promise<string[]> {
  const git = getGit();
  const result = await git.diff(['--cached', '--name-only']);
  return result
    .split('\n')
    .map((f) => f.trim())
    .filter(Boolean);
}

/**
 * Return the full staged diff along with addition/deletion counts.
 */
export async function getStagedDiff(): Promise<GitDiff> {
  const git = getGit();

  const [diffText, statText, files] = await Promise.all([
    git.diff(['--cached']),
    git.diff(['--cached', '--stat']),
    getStagedFiles(),
  ]);

  const { additions, deletions } = parseStat(statText);

  return {
    files,
    additions,
    deletions,
    diff: diffText,
  };
}

/**
 * Return the diff of the last commit.
 */
export async function getLastCommitDiff(): Promise<GitDiff> {
  const git = getGit();

  const [diffText, statText] = await Promise.all([
    git.diff(['HEAD~1', 'HEAD']),
    git.diff(['HEAD~1', 'HEAD', '--stat']),
  ]);

  const filesText = await git.diff(['HEAD~1', 'HEAD', '--name-only']);
  const files = filesText
    .split('\n')
    .map((f) => f.trim())
    .filter(Boolean);

  const { additions, deletions } = parseStat(statText);

  return {
    files,
    additions,
    deletions,
    diff: diffText,
  };
}

/**
 * Return the diff of a specific file (staged).
 */
export async function getFileDiff(file: string): Promise<string> {
  const git = getGit();
  return git.diff(['--cached', '--', file]);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseStat(statText: string): { additions: number; deletions: number } {
  // Example last line: " 3 files changed, 42 insertions(+), 7 deletions(-)"
  const insertionMatch = statText.match(/(\d+)\s+insertion/);
  const deletionMatch = statText.match(/(\d+)\s+deletion/);

  return {
    additions: insertionMatch ? parseInt(insertionMatch[1], 10) : 0,
    deletions: deletionMatch ? parseInt(deletionMatch[1], 10) : 0,
  };
}
