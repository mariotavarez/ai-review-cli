import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { isGitRepo, getStagedDiff, getLastCommitDiff, getFileDiff, getStagedFiles } from '../lib/git.js';
import { reviewDiff } from '../lib/claude.js';
import { formatReview } from '../lib/formatter.js';
import { config } from '../config.js';
import type { GitDiff } from '../types.js';

interface ReviewOptions {
  staged: boolean;
  lastCommit: boolean;
  file?: string;
}

export const reviewCommand = new Command('review')
  .description('Analyse git changes with Claude AI and display a structured code review')
  .option('--staged', 'Review staged changes (default)', false)
  .option('--last-commit', 'Review the diff of the last commit', false)
  .option('--file <path>', 'Review a specific staged file')
  .action(async (options: ReviewOptions) => {
    // ── Validate we are inside a git repo ──────────────────────────────────
    const inRepo = await isGitRepo();
    if (!inRepo) {
      console.error(chalk.red('✖  Not inside a git repository.'));
      process.exit(1);
    }

    // ── Fetch the diff ─────────────────────────────────────────────────────
    let diff: GitDiff;

    if (options.file) {
      const spinner = ora(`Getting diff for ${chalk.cyan(options.file)}…`).start();
      try {
        const rawDiff = await getFileDiff(options.file);
        if (!rawDiff.trim()) {
          spinner.fail(chalk.yellow(`No staged changes found for file: ${options.file}`));
          process.exit(0);
        }
        diff = {
          files: [options.file],
          additions: countLines(rawDiff, '+'),
          deletions: countLines(rawDiff, '-'),
          diff: rawDiff,
        };
        spinner.succeed(`Got diff for ${chalk.cyan(options.file)}`);
      } catch (err) {
        spinner.fail(chalk.red(`Failed to get diff: ${String(err)}`));
        process.exit(1);
      }
    } else if (options.lastCommit) {
      const spinner = ora('Getting last commit diff…').start();
      try {
        diff = await getLastCommitDiff();
        if (!diff.diff.trim()) {
          spinner.fail(chalk.yellow('No changes found in the last commit.'));
          process.exit(0);
        }
        spinner.succeed(`Got last commit diff (${diff.files.length} file${diff.files.length !== 1 ? 's' : ''})`);
      } catch (err) {
        spinner.fail(chalk.red(`Failed to get last commit diff: ${String(err)}`));
        process.exit(1);
      }
    } else {
      // Default: staged changes
      const spinner = ora('Getting staged diff…').start();
      try {
        const stagedFiles = await getStagedFiles();
        if (stagedFiles.length === 0) {
          spinner.fail(chalk.yellow('No staged changes found. Stage some files with `git add` first.'));
          process.exit(0);
        }
        diff = await getStagedDiff();
        spinner.succeed(
          `Got staged diff — ${stagedFiles.length} file${stagedFiles.length !== 1 ? 's' : ''}, ` +
            `${chalk.green(`+${diff.additions}`)} ${chalk.red(`-${diff.deletions}`)}`,
        );
      } catch (err) {
        spinner.fail(chalk.red(`Failed to get staged diff: ${String(err)}`));
        process.exit(1);
      }
    }

    // ── Call Claude ────────────────────────────────────────────────────────
    const reviewSpinner = ora(
      config.demoMode
        ? 'Running in demo mode (no API key set)…'
        : 'Sending diff to Claude for review…',
    ).start();

    let result;
    try {
      result = await reviewDiff(diff);
      reviewSpinner.succeed('Review complete');
    } catch (err) {
      reviewSpinner.fail(chalk.red(`Claude API error: ${String(err)}`));
      process.exit(1);
    }

    // ── Print the formatted review ─────────────────────────────────────────
    console.log(formatReview(result, config.demoMode));
  });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countLines(diff: string, prefix: '+' | '-'): number {
  return diff.split('\n').filter((l) => l.startsWith(prefix) && !l.startsWith(prefix.repeat(3))).length;
}
