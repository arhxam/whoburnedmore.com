import assert from "node:assert/strict";
import { test } from "node:test";
import { estimateCost, priceFor } from "../src/pricing.js";

test("priceFor resolves models by longest substring match", () => {
  assert.equal(priceFor("claude-opus-4-7").output, 75);
  assert.equal(priceFor("claude-sonnet-4-5-20250929").output, 15);
  assert.equal(priceFor("claude-3-5-haiku-20241022").output, 4);
  assert.equal(priceFor("gpt-4o-2024-08-06").input, 2.5);
});

test("priceFor falls back to a mid-tier default for unknown models", () => {
  const p = priceFor("some-future-model-v9");
  assert.equal(p.input, 3);
  assert.equal(p.output, 15);
});

test("estimateCost sums input/output/cache at the model's rates", () => {
  // 1M input + 1M output on opus = 15 + 75 = $90
  const cost = estimateCost("claude-opus-4-7", {
    input: 1_000_000,
    output: 1_000_000,
    cacheWrite: 0,
    cacheRead: 0,
  });
  assert.equal(Math.round(cost), 90);
});

test("estimateCost prices cache reads far below input", () => {
  const read = estimateCost("claude-sonnet-4-5", {
    input: 0,
    output: 0,
    cacheWrite: 0,
    cacheRead: 1_000_000,
  });
  // sonnet cache-read is $0.30 / 1M
  assert.ok(read > 0.29 && read < 0.31, `expected ~0.30, got ${read}`);
});

test("estimateCost of nothing is zero", () => {
  assert.equal(
    estimateCost("claude-opus-4-7", { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 }),
    0,
  );
});
