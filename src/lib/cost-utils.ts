
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gemini-3-flash-preview': {
    input: 0.10 / 1_000_000, // $0.10 per 1M tokens
    output: 0.40 / 1_000_000, // $0.40 per 1M tokens
  },
  'gemini-3.1-pro-preview': {
    input: 1.25 / 1_000_000, // $1.25 per 1M tokens
    output: 5.00 / 1_000_000, // $5.00 per 1M tokens
  }
};

export function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['gemini-3-flash-preview'];
  return (inputTokens * pricing.input) + (outputTokens * pricing.output);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  }).format(amount);
}
