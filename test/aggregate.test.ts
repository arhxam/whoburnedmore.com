import assert from "node:assert/strict";
import { test } from "node:test";
import { applyRecord, type Report } from "../src/scan.js";

function freshReport(): Report {
  return {
    totals: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, tokens: 0, costUSD: 0, messages: 0 },
    byModel: new Map(),
    byProject: new Map(),
    byDay: new Map(),
    firstDate: null,
    lastDate: null,
    sessions: 0,
    filesScanned: 0,
  };
}

function assistant(usage: Record<string, number>, extra: Record<string, unknown> = {}) {
  return {
    type: "assistant",
    timestamp: "2026-06-10T12:00:00.000Z",
    cwd: "/Users/me/code/my-app",
    message: { model: "claude-sonnet-4-5", usage },
    ...extra,
  };
}

test("applyRecord sums every token class into the totals", () => {
  const r = freshReport();
  applyRecord(
    r,
    assistant({
      input_tokens: 100,
      output_tokens: 50,
      cache_creation_input_tokens: 30,
      cache_read_input_tokens: 1000,
    }),
    null,
  );
  assert.equal(r.totals.input, 100);
  assert.equal(r.totals.output, 50);
  assert.equal(r.totals.cacheWrite, 30);
  assert.equal(r.totals.cacheRead, 1000);
  assert.equal(r.totals.tokens, 1180);
  assert.equal(r.totals.messages, 1);
  assert.ok(r.totals.costUSD > 0);
});

test("applyRecord groups by model, project label, and day", () => {
  const r = freshReport();
  applyRecord(r, assistant({ input_tokens: 10, output_tokens: 10 }), null);
  applyRecord(r, assistant({ input_tokens: 10, output_tokens: 10 }), null);
  assert.equal(r.byModel.get("claude-sonnet-4-5")?.messages, 2);
  assert.equal(r.byProject.get("my-app")?.tokens, 40);
  assert.equal(r.byDay.get("2026-06-10")?.tokens, 40);
  assert.equal(r.firstDate, "2026-06-10");
  assert.equal(r.lastDate, "2026-06-10");
});

test("applyRecord ignores non-assistant records and zero-token turns", () => {
  const r = freshReport();
  applyRecord(r, { type: "user", message: {} }, null);
  applyRecord(r, assistant({ input_tokens: 0, output_tokens: 0 }), null);
  assert.equal(r.totals.messages, 0);
  assert.equal(r.totals.tokens, 0);
});

test("applyRecord respects the --since cutoff", () => {
  const r = freshReport();
  const cutoff = Date.parse("2026-06-01T00:00:00.000Z");
  // older than cutoff -> skipped
  applyRecord(
    r,
    assistant({ input_tokens: 10, output_tokens: 10 }, { timestamp: "2026-05-01T00:00:00.000Z" }),
    cutoff,
  );
  // newer than cutoff -> counted
  applyRecord(
    r,
    assistant({ input_tokens: 10, output_tokens: 10 }, { timestamp: "2026-06-15T00:00:00.000Z" }),
    cutoff,
  );
  assert.equal(r.totals.messages, 1);
});

test("applyRecord labels missing cwd as 'unknown' without crashing", () => {
  const r = freshReport();
  applyRecord(r, assistant({ input_tokens: 5, output_tokens: 5 }, { cwd: undefined }), null);
  assert.equal(r.byProject.get("unknown")?.messages, 1);
});
