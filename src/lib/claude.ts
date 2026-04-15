import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import { CODE_REVIEW_PROMPT, COMMIT_MESSAGE_PROMPT, EXPLAIN_CODE_PROMPT } from './prompts.js';
import type { GitDiff, ReviewResult } from '../types.js';

// ---------------------------------------------------------------------------
// Client (lazy-initialized so mock mode never touches the SDK constructor)
// ---------------------------------------------------------------------------

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: config.apiKey });
  }
  return _client;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Analyse a git diff and return a structured review.
 * Falls back to mock data when ANTHROPIC_API_KEY is not set.
 */
export async function reviewDiff(diff: GitDiff): Promise<ReviewResult> {
  if (config.demoMode) {
    return mockReview(diff);
  }

  const client = getClient();
  const userMessage = buildDiffMessage(diff);

  const message = await client.messages.create({
    model: config.model,
    max_tokens: config.maxTokens,
    system: CODE_REVIEW_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = extractText(message.content);
  return parseReviewResult(text);
}

/**
 * Generate a conventional-commits style commit message from a diff.
 * Falls back to mock data when ANTHROPIC_API_KEY is not set.
 */
export async function generateCommitMessage(diff: GitDiff): Promise<string> {
  if (config.demoMode) {
    return mockCommitMessage(diff);
  }

  const client = getClient();
  const userMessage = buildDiffMessage(diff);

  const message = await client.messages.create({
    model: config.model,
    max_tokens: 512,
    system: COMMIT_MESSAGE_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  return extractText(message.content).trim();
}

/**
 * Provide a plain-English explanation of a piece of code.
 * Falls back to mock data when ANTHROPIC_API_KEY is not set.
 */
export async function explainCode(code: string, filename: string): Promise<string> {
  if (config.demoMode) {
    return mockExplanation(filename);
  }

  const client = getClient();

  const message = await client.messages.create({
    model: config.model,
    max_tokens: config.maxTokens,
    system: EXPLAIN_CODE_PROMPT,
    messages: [
      {
        role: 'user',
        content: `File: ${filename}\n\n\`\`\`\n${code}\n\`\`\``,
      },
    ],
  });

  return extractText(message.content).trim();
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildDiffMessage(diff: GitDiff): string {
  const fileList = diff.files.join(', ');
  return [
    `Files changed: ${fileList || '(none)'}`,
    `Additions: +${diff.additions}  Deletions: -${diff.deletions}`,
    '',
    '```diff',
    diff.diff || '(empty diff)',
    '```',
  ].join('\n');
}

function extractText(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

function parseReviewResult(raw: string): ReviewResult {
  // Strip markdown code fences if the model wrapped the JSON
  const cleaned = raw
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```\s*$/m, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as ReviewResult;
    // Ensure required fields exist with sensible defaults
    return {
      summary: parsed.summary ?? 'No summary provided.',
      score: typeof parsed.score === 'number' ? Math.min(100, Math.max(0, parsed.score)) : 50,
      comments: Array.isArray(parsed.comments) ? parsed.comments : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      estimatedRiskLevel: parsed.estimatedRiskLevel ?? 'medium',
    };
  } catch {
    // If JSON parsing fails, return a graceful fallback
    return {
      summary: 'Could not parse the review response from Claude.',
      score: 50,
      comments: [
        {
          severity: 'warning',
          message: 'Raw response: ' + raw.slice(0, 300),
        },
      ],
      suggestions: ['Try running the review again.'],
      estimatedRiskLevel: 'medium',
    };
  }
}

// ---------------------------------------------------------------------------
// Mock data (demo mode — no API key required)
// ---------------------------------------------------------------------------

function mockReview(diff: GitDiff): ReviewResult {
  const hasFiles = diff.files.length > 0;
  const primaryFile = hasFiles ? diff.files[0] : 'src/index.ts';
  const secondaryFile = diff.files.length > 1 ? diff.files[1] : 'src/utils.ts';

  return {
    summary:
      'The changes introduce new functionality with generally good code quality. A couple of potential issues deserve attention before merging.',
    score: 78,
    estimatedRiskLevel: 'medium',
    comments: [
      {
        severity: 'critical',
        file: primaryFile,
        message:
          'Potential null dereference: the result of `findUser()` is used without a null check. If the user is not found, this will throw at runtime.',
      },
      {
        severity: 'warning',
        file: primaryFile,
        message:
          'Missing error handling on the async operation. Unhandled promise rejections can crash the process in Node 20+.',
      },
      {
        severity: 'warning',
        file: secondaryFile,
        message:
          'Magic number `3` used for retry count. Consider extracting it to a named constant like `MAX_RETRIES` for clarity.',
      },
      {
        severity: 'suggestion',
        file: primaryFile,
        message:
          'This function has grown to 60+ lines. Consider splitting it into smaller, single-responsibility helpers.',
      },
      {
        severity: 'suggestion',
        file: secondaryFile,
        message:
          'The `forEach` loop could be replaced with `Array.prototype.reduce` to make the intent clearer and avoid the external variable.',
      },
      {
        severity: 'praise',
        file: primaryFile,
        message:
          'Excellent use of TypeScript generics here — the type constraints are tight and correctly prevent misuse.',
      },
      {
        severity: 'praise',
        file: secondaryFile,
        message: 'Good test coverage added alongside the feature code. The edge cases are well thought out.',
      },
    ],
    suggestions: [
      'Add a null/undefined guard after calling `findUser()` before accessing its properties.',
      'Wrap async calls in try/catch blocks or use `.catch()` to handle potential rejections.',
      'Extract the magic number `3` to a named constant `MAX_RETRIES = 3`.',
      'Consider adding JSDoc comments to exported functions for better IDE integration.',
      'Run the full test suite locally before pushing — a few new code paths lack test coverage.',
    ],
  };
}

function mockCommitMessage(diff: GitDiff): string {
  const fileCount = diff.files.length;
  const scope = diff.files.length > 0 ? inferScope(diff.files[0]) : 'core';

  if (diff.additions > diff.deletions * 3) {
    return `feat(${scope}): add new functionality across ${fileCount} file${fileCount !== 1 ? 's' : ''}\n\n- Introduced ${diff.additions} lines of new code\n- See diff for full details`;
  }

  if (diff.deletions > diff.additions * 2) {
    return `refactor(${scope}): remove dead code and simplify logic\n\n- Deleted ${diff.deletions} lines\n- Reduces bundle size and improves readability`;
  }

  return `refactor(${scope}): update implementation in ${fileCount} file${fileCount !== 1 ? 's' : ''}\n\n- ${diff.additions} insertions, ${diff.deletions} deletions\n- See diff for full details`;
}

function mockExplanation(filename: string): string {
  return `## Explanation of \`${filename}\`

> **Demo mode** — this is a placeholder explanation. Set \`ANTHROPIC_API_KEY\` to get a real explanation from Claude.

### What it does
This file appears to contain business logic related to \`${filename.replace(/\.[^.]+$/, '')}\`. It exports one or more functions that are consumed by other parts of the application.

### How it works
The code follows a standard module pattern: it imports its dependencies at the top, defines internal helper functions, and exports the public API at the bottom.

### Key details
- Uses TypeScript for type-safety
- Async operations are handled with \`async/await\`

### Potential gotchas
- Ensure all async functions are properly awaited at the call site
- Validate inputs before passing them to the exported functions
`;
}

function inferScope(filePath: string): string {
  const parts = filePath.split('/');
  if (parts.length >= 2) {
    return parts[parts.length - 2]; // parent directory
  }
  return parts[0].replace(/\.[^.]+$/, '');
}
