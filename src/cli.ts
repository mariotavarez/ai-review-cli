#!/usr/bin/env node
import { Command } from 'commander';
import { reviewCommand } from './commands/review.js';
import { commitCommand } from './commands/commit.js';
import { explainCommand } from './commands/explain.js';

const program = new Command();

program
  .name('ai-review')
  .description('AI-powered code review in your terminal — powered by Claude')
  .version('1.0.0');

program.addCommand(reviewCommand);
program.addCommand(commitCommand);
program.addCommand(explainCommand);

program.parse(process.argv);
