export const config = {
  apiKey: process.env.ANTHROPIC_API_KEY ?? '',
  model: 'claude-opus-4-5',
  maxTokens: 4096,
  demoMode: !process.env.ANTHROPIC_API_KEY,
} as const;
