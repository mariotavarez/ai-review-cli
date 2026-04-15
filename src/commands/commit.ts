import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import simpleGit from 'simple-git';
import { isGitRepo, getStagedDiff, getStagedFiles } from '../lib/git.js';
import { generateCommitMessage } from '../lib/claude.js';
import { formatCommitMessage } from '../lib/formatter.js';
import { config } from '../config.js';

export const commitCommand = new Command('commit')
  .description('Generate an AI-assisted conventional commit message for staged changes')
  .action(async () => {
    // ── Validate git repo ──────────────────────────────────────────────────
    const inRepo = await isGitRepo();
    if (!inRepo) {
      console.error(chalk.red('✖  Not inside a git repository.'));
      process.exit(1);
    }

    // ── Check for staged files ─────────────────────────────────────────────
    const stagedFiles = await getStagedFiles();
    if (stagedFiles.length === 0) {
      console.error(chalk.yellow('⚠  No staged changes found. Stage some files with `git add` first.'));
      process.exit(0);
    }

    // ── Get diff ───────────────────────────────────────────────────────────
    const diffSpinner = ora('Getting staged diff…').start();
    let diff;
    try {
      diff = await getStagedDiff();
      diffSpinner.succeed(
        `Got staged diff — ${stagedFiles.length} file${stagedFiles.length !== 1 ? 's' : ''}`,
      );
    } catch (err) {
      diffSpinner.fail(chalk.red(`Failed to get staged diff: ${String(err)}`));
      process.exit(1);
    }

    // ── Generate commit message ────────────────────────────────────────────
    const msgSpinner = ora(
      config.demoMode
        ? 'Generating commit message (demo mode)…'
        : 'Generating commit message with Claude…',
    ).start();

    let message: string;
    try {
      message = await generateCommitMessage(diff);
      msgSpinner.succeed('Commit message generated');
    } catch (err) {
      msgSpinner.fail(chalk.red(`Failed to generate commit message: ${String(err)}`));
      process.exit(1);
    }

    // ── Show proposed message ──────────────────────────────────────────────
    console.log(formatCommitMessage(message, config.demoMode));

    // ── Ask user to confirm ────────────────────────────────────────────────
    const rl = readline.createInterface({ input, output });

    let answer: string;
    try {
      answer = await rl.question(chalk.bold('Use this commit message? ') + chalk.dim('[y/n] '));
    } finally {
      rl.close();
    }

    if (answer.trim().toLowerCase() !== 'y') {
      console.log(chalk.dim('Aborted — no commit was made.'));
      process.exit(0);
    }

    // ── Execute git commit ─────────────────────────────────────────────────
    const commitSpinner = ora('Committing…').start();
    try {
      const git = simpleGit(process.cwd());
      await git.commit(message);
      commitSpinner.succeed(chalk.green('Committed successfully!'));
      console.log(chalk.dim('  Message: ') + chalk.cyan(message.split('\n')[0]));
    } catch (err) {
      commitSpinner.fail(chalk.red(`Git commit failed: ${String(err)}`));
      process.exit(1);
    }
  });
