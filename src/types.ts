export interface ReviewComment {
  severity: 'critical' | 'warning' | 'suggestion' | 'praise';
  file?: string;
  line?: number;
  message: string;
  code?: string;
}

export interface ReviewResult {
  summary: string;
  score: number; // 0-100
  comments: ReviewComment[];
  suggestions: string[];
  estimatedRiskLevel: 'low' | 'medium' | 'high';
}

export interface GitDiff {
  files: string[];
  additions: number;
  deletions: number;
  diff: string;
}
