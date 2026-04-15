# ai-review-cli

> AI-powered code review in your terminal — powered by Claude

![Node.js 20+](https://img.shields.io/badge/node-%3E%3D20-brightgreen)
![TypeScript 5.7](https://img.shields.io/badge/typescript-5.7-blue)
![Claude API](https://img.shields.io/badge/claude-api-orange)
![MIT License](https://img.shields.io/badge/license-MIT-green)

---

```
╭──────────────────── ai-review ────────────────────╮
│                                                    │
│  Score   87/100  ████████████████░░░░             │
│  Risk    LOW RISK                                  │
│                                                    │
│  Summary                                           │
│  Clean refactor with solid type safety. One null   │
│  check is missing before accessing user fields.    │
│                                                    │
│  ── Critical (1) ──────────────────────────────── │
│  ✖ CRITICAL  src/auth/login.ts                    │
│  Possible null dereference on `findUser()` result. │
│                                                    │
│  ── Warning (2) ───────────────────────────────── │
│  ⚠ WARNING   src/api/client.ts                    │
│  Missing error handling on async fetch.            │
│                                                    │
│  ── Praise (2) ────────────────────────────────── │
│  ✔ PRAISE    src/utils/types.ts                   │
│  Excellent generic constraints — very tight types. │
│                                                    │
│  Actionable Suggestions                            │
│  1. Add a null check after calling findUser()      │
│  2. Wrap fetch calls in try/catch                  │
│                                                    │
│  ────────────────────────────────────────────────  │
│  Issues: 1 critical · 2 warnings · 2 praise        │
╰────────────────────────────────────────────────────╯
```

---

## Features

- **Review staged changes** — `ai-review review` sends your `git diff --cached` to Claude and returns a structured, colour-coded review
- **AI commit messages** — `ai-review commit` generates a [Conventional Commits](https://www.conventionalcommits.org/) message and optionally commits for you
- **Code explanation** — `ai-review explain <file>` gives you a plain-English walkthrough of any file (or a specific function inside it)
- **Score system** — every review includes a 0–100 quality score coloured green / yellow / red
- **Severity levels** — comments are classified as `critical`, `warning`, `suggestion`, or `praise` and rendered with distinct icons and colours
- **Risk badge** — `LOW RISK` / `MEDIUM RISK` / `HIGH RISK` at a glance
- **Demo mode** — works without an API key using realistic mock data, so you can explore the UI immediately

---

## Installation

### From source

```bash
git clone https://github.com/mariotavarez/ai-review-cli.git
cd ai-review-cli
npm install
npm run build
npm link          # makes `ai-review` available globally
```

### Requirements

- **Node.js 20+**
- An **Anthropic API key** (optional — see Demo Mode below)

---

## Setup

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

Add that line to your `~/.zshrc` or `~/.bashrc` to persist it across sessions.

---

## Usage

### Review staged changes (default)

```bash
git add src/some-file.ts
ai-review review
```

### Review last commit

```bash
ai-review review --last-commit
```

### Review a specific staged file

```bash
ai-review review --file src/auth/login.ts
```

### Generate an AI commit message

```bash
git add .
ai-review commit
# Proposed message is shown; press y to commit, n to abort
```

### Explain a file

```bash
ai-review explain src/lib/claude.ts
```

### Explain a specific function

```bash
ai-review explain src/lib/git.ts --function getStagedDiff
```

---

## Demo Mode

When `ANTHROPIC_API_KEY` is **not** set, `ai-review` runs in **demo mode**:

- All commands still work and display realistic output
- A `DEMO MODE` banner is shown at the top of each result
- No network requests are made — great for CI preview or exploring the UI

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | No | Anthropic API key. Omit to use demo mode. |

---

## Development

```bash
npm install
npm run dev -- review        # run without building
npm run build                # compile TypeScript → dist/
npm run lint                 # ESLint
```

---

## License

MIT © Mario Tavarez
