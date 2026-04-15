import chalk from 'chalk';
import boxen from 'boxen';
import type { ReviewComment, ReviewResult } from '../types.js';

// ---------------------------------------------------------------------------
// Score & risk helpers
// ---------------------------------------------------------------------------

export function colorScore(score: number): string {
  const str = `${score}/100`;
  if (score >= 80) return chalk.bold.green(str);
  if (score >= 60) return chalk.bold.yellow(str);
  return chalk.bold.red(str);
}

export function colorRisk(level: 'low' | 'medium' | 'high'): string {
  switch (level) {
    case 'low':
      return chalk.bgGreen.black(` LOW RISK `);
    case 'medium':
      return chalk.bgYellow.black(` MEDIUM RISK `);
    case 'high':
      return chalk.bgRed.white(` HIGH RISK `);
  }
}

export function scoreBar(score: number): string {
  const total = 20;
  const filled = Math.round((score / 100) * total);
  const bar =
    chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(total - filled));
  return bar;
}

// ---------------------------------------------------------------------------
// Comment helpers
// ---------------------------------------------------------------------------

const SEVERITY_ORDER: ReviewComment['severity'][] = [
  'critical',
  'warning',
  'suggestion',
  'praise',
];

export function severityIcon(severity: ReviewComment['severity']): string {
  switch (severity) {
    case 'critical':
      return chalk.bold.red('✖ CRITICAL');
    case 'warning':
      return chalk.bold.yellow('⚠ WARNING ');
    case 'suggestion':
      return chalk.bold.blue('◆ SUGGEST ');
    case 'praise':
      return chalk.bold.green('✔ PRAISE  ');
  }
}

export function formatComment(comment: ReviewComment): string {
  const icon = severityIcon(comment.severity);
  const location =
    comment.file
      ? chalk.dim(` ${comment.file}${comment.line ? `:${comment.line}` : ''}`)
      : '';
  const message = comment.message;
  return `  ${icon}${location}\n  ${chalk.white(message)}`;
}

// ---------------------------------------------------------------------------
// Full review formatter
// ---------------------------------------------------------------------------

export function formatReview(result: ReviewResult, demoMode: boolean): string {
  const lines: string[] = [];

  // ── Header ────────────────────────────────────────────────────────────────
  if (demoMode) {
    lines.push(
      chalk.bgMagenta.white.bold(' DEMO MODE ') +
        chalk.dim(' Set ANTHROPIC_API_KEY for a real review\n'),
    );
  }

  // ── Score & risk ──────────────────────────────────────────────────────────
  lines.push(
    chalk.bold('  Score  ') +
      colorScore(result.score) +
      '  ' +
      scoreBar(result.score),
  );
  lines.push(chalk.bold('  Risk   ') + colorRisk(result.estimatedRiskLevel));
  lines.push('');

  // ── Summary ───────────────────────────────────────────────────────────────
  lines.push(chalk.bold.underline('Summary'));
  lines.push(chalk.white('  ' + result.summary));
  lines.push('');

  // ── Comments grouped by severity ──────────────────────────────────────────
  const grouped = groupBySeverity(result.comments);
  let hasComments = false;

  for (const severity of SEVERITY_ORDER) {
    const group = grouped[severity];
    if (!group || group.length === 0) continue;
    hasComments = true;
    lines.push(sectionHeader(severity, group.length));
    for (const comment of group) {
      lines.push(formatComment(comment));
      lines.push('');
    }
  }

  if (!hasComments) {
    lines.push(chalk.dim('  No comments.'));
    lines.push('');
  }

  // ── Suggestions ───────────────────────────────────────────────────────────
  if (result.suggestions.length > 0) {
    lines.push(chalk.bold.underline('Actionable Suggestions'));
    for (const [i, suggestion] of result.suggestions.entries()) {
      lines.push(chalk.cyan(`  ${i + 1}. `) + chalk.white(suggestion));
    }
    lines.push('');
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  const counts = countBySeverity(result.comments);
  const parts = [
    counts.critical > 0 ? chalk.red(`${counts.critical} critical`) : null,
    counts.warning > 0 ? chalk.yellow(`${counts.warning} warning${counts.warning !== 1 ? 's' : ''}`) : null,
    counts.suggestion > 0 ? chalk.blue(`${counts.suggestion} suggestion${counts.suggestion !== 1 ? 's' : ''}`) : null,
    counts.praise > 0 ? chalk.green(`${counts.praise} praise`) : null,
  ].filter(Boolean);

  const footerText =
    parts.length > 0
      ? `Issues: ${parts.join(chalk.dim(' · '))}`
      : chalk.green('No issues found — looks great!');

  lines.push(chalk.dim('─'.repeat(60)));
  lines.push(chalk.dim('  ') + footerText);

  // ── Wrap in boxen ─────────────────────────────────────────────────────────
  const inner = lines.join('\n');

  return boxen(inner, {
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
    margin: { top: 1, bottom: 1, left: 0, right: 0 },
    borderStyle: 'round',
    borderColor:
      result.estimatedRiskLevel === 'high'
        ? 'red'
        : result.estimatedRiskLevel === 'medium'
          ? 'yellow'
          : 'green',
    title: chalk.bold(' ai-review '),
    titleAlignment: 'center',
  });
}

// ---------------------------------------------------------------------------
// Commit message formatter
// ---------------------------------------------------------------------------

export function formatCommitMessage(message: string, demoMode: boolean): string {
  const lines: string[] = [];

  if (demoMode) {
    lines.push(
      chalk.bgMagenta.white.bold(' DEMO MODE ') +
        chalk.dim(' Set ANTHROPIC_API_KEY for a real commit message\n'),
    );
  }

  lines.push(chalk.bold.underline('Proposed commit message\n'));
  lines.push(chalk.cyan(message));

  return boxen(lines.join('\n'), {
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
    margin: { top: 1, bottom: 0, left: 0, right: 0 },
    borderStyle: 'round',
    borderColor: 'cyan',
    title: chalk.bold(' ai-commit '),
    titleAlignment: 'center',
  });
}

// ---------------------------------------------------------------------------
// Explain formatter
// ---------------------------------------------------------------------------

export function formatExplanation(explanation: string, filename: string, demoMode: boolean): string {
  const lines: string[] = [];

  if (demoMode) {
    lines.push(
      chalk.bgMagenta.white.bold(' DEMO MODE ') +
        chalk.dim(' Set ANTHROPIC_API_KEY for a real explanation\n'),
    );
  }

  lines.push(explanation);

  return boxen(lines.join('\n'), {
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
    margin: { top: 1, bottom: 1, left: 0, right: 0 },
    borderStyle: 'round',
    borderColor: 'blue',
    title: chalk.bold(` Explanation: ${filename} `),
    titleAlignment: 'center',
  });
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

type GroupedComments = Partial<Record<ReviewComment['severity'], ReviewComment[]>>;

function groupBySeverity(comments: ReviewComment[]): GroupedComments {
  return comments.reduce<GroupedComments>((acc, comment) => {
    const key = comment.severity;
    if (!acc[key]) acc[key] = [];
    acc[key]!.push(comment);
    return acc;
  }, {});
}

function countBySeverity(
  comments: ReviewComment[],
): Record<ReviewComment['severity'], number> {
  return {
    critical: comments.filter((c) => c.severity === 'critical').length,
    warning: comments.filter((c) => c.severity === 'warning').length,
    suggestion: comments.filter((c) => c.severity === 'suggestion').length,
    praise: comments.filter((c) => c.severity === 'praise').length,
  };
}

function sectionHeader(severity: ReviewComment['severity'], count: number): string {
  const label = severity.charAt(0).toUpperCase() + severity.slice(1);
  const countStr = chalk.dim(`(${count})`);
  switch (severity) {
    case 'critical':
      return chalk.bold.red(`  ── ${label} ${countStr} ──────────────────────────`);
    case 'warning':
      return chalk.bold.yellow(`  ── ${label} ${countStr} ──────────────────────────`);
    case 'suggestion':
      return chalk.bold.blue(`  ── ${label} ${countStr} ──────────────────────────`);
    case 'praise':
      return chalk.bold.green(`  ── ${label} ${countStr} ──────────────────────────`);
  }
}
