import assert from "node:assert/strict";
import { test } from "node:test";
import { bar, formatTokens, formatUSD, topBy } from "../src/format.js";

test("formatTokens scales to K/M/B", () => {
  assert.equal(formatTokens(42), "42");
  assert.equal(formatTokens(9_900), "9.9K");
  assert.equal(formatTokens(2_860_000_000), "2.86B");
});

test("formatUSD adds thousands separators and two decimals", () => {
  assert.equal(formatUSD(1234.5), "$1,234.50");
  assert.equal(formatUSD(0), "$0.00");
});

test("bar fills proportionally and clamps", () => {
  assert.equal(bar(0, 10), "░".repeat(10));
  assert.equal(bar(1, 10), "█".repeat(10));
  assert.equal(bar(2, 10), "█".repeat(10)); // clamped
  assert.equal(bar(0.5, 10), "█".repeat(5) + "░".repeat(5));
});

test("topBy sorts by tokens descending and caps the count", () => {
  const m = new Map([
    ["a", { tokens: 10 }],
    ["b", { tokens: 30 }],
    ["c", { tokens: 20 }],
  ]);
  const top = topBy(m, 2);
  assert.deepEqual(
    top.map(([k]) => k),
    ["b", "c"],
  );
});
