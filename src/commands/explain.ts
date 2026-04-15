import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { readFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { marked } from 'marked';
import { markedTerminal } from 'marked-terminal';
import { explainCode } from '../lib/claude.js';
import { formatExplanation } from '../lib/formatter.js';
import { config } from '../config.js';

// Configure marked to render markdown in the terminal
marked.use(markedTerminal());

interface ExplainOptions {
  function?: string;
}

export const explainCommand = new Command('explain')
  .description('Explain the contents of a specific file (or a function within it)')
  .argument('<file>', 'Path to the file to explain')
  .option('-f, --function <name>', 'Name of a specific function/method to focus on')
  .action(async (filePath: string, options: ExplainOptions) => {
    const absolutePath = resolve(process.cwd(), filePath);
    const filename = basename(absolutePath);

    // ── Read the file ──────────────────────────────────────────────────────
    let source: string;
    try {
      source = await readFile(absolutePath, 'utf-8');
    } catch (err) {
      console.error(chalk.red(`✖  Could not read file: ${absolutePath}`));
      console.error(chalk.dim(String(err)));
      process.exit(1);
    }

    // ── Optionally extract a specific function ─────────────────────────────
    let codeToExplain = source;
    if (options.function) {
      const extracted = extractFunction(source, options.function);
      if (!extracted) {
        console.error(
          chalk.yellow(
            `⚠  Could not isolate function "${options.function}" — explaining the full file instead.`,
          ),
        );
      } else {
        codeToExplain = extracted;
        console.log(chalk.dim(`  Extracted function "${options.function}" (${extracted.split('\n').length} lines)`));
      }
    }

    // ── Send to Claude ─────────────────────────────────────────────────────
    const spinner = ora(
      config.demoMode
        ? `Explaining ${chalk.cyan(filename)} (demo mode)…`
        : `Sending ${chalk.cyan(filename)} to Claude…`,
    ).start();

    let explanation: string;
    try {
      explanation = await explainCode(codeToExplain, filename);
      spinner.succeed(`Explanation ready`);
    } catch (err) {
      spinner.fail(chalk.red(`Claude API error: ${String(err)}`));
      process.exit(1);
    }

    // ── Render markdown explanation ────────────────────────────────────────
    const rendered = marked(explanation) as string;
    console.log(formatExplanation(rendered, filename, config.demoMode));
  });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Attempt to extract the source text of a named function from TypeScript/JavaScript source.
 * Uses a simple brace-counting heuristic — works for most real-world cases.
 */
function extractFunction(source: string, funcName: string): string | null {
  // Match: function foo, const foo =, export function foo, async function foo, etc.
  const patterns = [
    new RegExp(`(export\\s+)?(async\\s+)?function\\s+${funcName}\\s*[(<]`),
    new RegExp(`(export\\s+)?(const|let|var)\\s+${funcName}\\s*=\\s*(async\\s+)?(?:function|\\()`),
    new RegExp(`(async\\s+)?${funcName}\\s*\\(`), // method
  ];

  let startIndex = -1;
  for (const pattern of patterns) {
    const match = pattern.exec(source);
    if (match) {
      startIndex = match.index;
      break;
    }
  }

  if (startIndex === -1) return null;

  // Walk forward counting braces to find the end of the function body
  let depth = 0;
  let inString: string | null = null;
  let foundOpenBrace = false;
  let endIndex = startIndex;

  for (let i = startIndex; i < source.length; i++) {
    const ch = source[i];

    // Skip string literals
    if (inString) {
      if (ch === inString && source[i - 1] !== '\\') inString = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch;
      continue;
    }

    if (ch === '{') {
      foundOpenBrace = true;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (foundOpenBrace && depth === 0) {
        endIndex = i + 1;
        break;
      }
    }
  }

  if (!foundOpenBrace) return null;
  return source.slice(startIndex, endIndex);
}
