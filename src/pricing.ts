/**
 * Public, approximate per-model pricing (USD per 1,000,000 tokens).
 *
 * These are list prices published by the model vendors and are used only to turn a
 * local token count into a rough dollar estimate. They are not billing-accurate —
 * subscription plans, discounts and price changes all move the real number — so the
 * CLI always labels cost as an estimate. Everything here is public information.
 */
export interface ModelPrice {
  /** USD per 1M input tokens. */
  input: number;
  /** USD per 1M output tokens. */
  output: number;
  /** USD per 1M tokens written to the prompt cache (defaults to 1.25× input). */
  cacheWrite?: number;
  /** USD per 1M tokens read from the prompt cache (defaults to 0.1× input). */
  cacheRead?: number;
}

/**
 * Matched by substring against the model id (longest match wins), so "claude-opus-4-7"
 * and "claude-opus-4-1-20250805" both resolve to the opus row. Add your own rows freely.
 */
const TABLE: Record<string, ModelPrice> = {
  "claude-opus": { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 },
  "claude-sonnet": { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  "claude-haiku": { input: 0.8, output: 4, cacheWrite: 1, cacheRead: 0.08 },
  "claude-3-5-sonnet": { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  "claude-3-5-haiku": { input: 0.8, output: 4, cacheWrite: 1, cacheRead: 0.08 },
  "claude-3-opus": { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 },
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4.1": { input: 2, output: 8 },
  "o3": { input: 2, output: 8 },
  "o4-mini": { input: 1.1, output: 4.4 },
  "gemini-2.5-pro": { input: 1.25, output: 10 },
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
};

/** Fallback when a model id matches nothing in the table (mid-tier assumption). */
const DEFAULT_PRICE: ModelPrice = { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 };

/** Resolve the price row for a model id by longest substring match. */
export function priceFor(model: string): ModelPrice {
  const id = model.toLowerCase();
  let best: { key: string; price: ModelPrice } | null = null;
  for (const [key, price] of Object.entries(TABLE)) {
    if (id.includes(key) && (!best || key.length > best.key.length)) {
      best = { key, price };
    }
  }
  return best?.price ?? DEFAULT_PRICE;
}

export interface TokenCounts {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

/** Estimated USD cost for a bucket of tokens billed at a model's rates. */
export function estimateCost(model: string, t: TokenCounts): number {
  const p = priceFor(model);
  const cacheWrite = p.cacheWrite ?? p.input * 1.25;
  const cacheRead = p.cacheRead ?? p.input * 0.1;
  return (
    (t.input * p.input +
      t.output * p.output +
      t.cacheWrite * cacheWrite +
      t.cacheRead * cacheRead) /
    1_000_000
  );
}
