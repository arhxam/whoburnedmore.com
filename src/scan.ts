/**
 * Reads Claude Code's local session transcripts and adds up how many tokens you
 * burned. Everything happens on your machine — this module opens files under your
 * home directory, parses them, and returns numbers. It never makes a network call.
 *
 * Claude Code stores one JSON-Lines file per session under
 *   ~/.claude/projects/<slugified-cwd>/<session-id>.jsonl
 * Each assistant turn carries a `message.usage` block with the token counts and a
 * `message.model`; the top-level record carries a `timestamp` and the project `cwd`.
 */
import { readdirSync, statSync, createReadStream } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { createInterface } from "node:readline";
import { estimateCost } from "./pricing.js";

/** A single line of a transcript, with only the fields we care about. */
interface UsageRecord {
  type?: string;
  timestamp?: string;
  cwd?: string;
  message?: {
    model?: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
  };
}

export interface Bucket {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
  tokens: number;
  costUSD: number;
  messages: number;
}

export interface Report {
  totals: Bucket;
  byModel: Map<string, Bucket>;
  byProject: Map<string, Bucket>;
  byDay: Map<string, Bucket>;
  firstDate: string | null;
  lastDate: string | null;
  sessions: number;
  filesScanned: number;
}

function emptyBucket(): Bucket {
  return { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, tokens: 0, costUSD: 0, messages: 0 };
}

/** The default place Claude Code keeps its transcripts. */
export function defaultDataDir(): string {
  return join(homedir(), ".claude", "projects");
}

/** Turn a project path like /Users/me/code/app into a short label "app". */
function projectLabel(cwd: string | undefined): string {
  if (!cwd) return "unknown";
  return basename(cwd) || "unknown";
}

/** Recursively collect every *.jsonl file under `dir`. */
function findTranscripts(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    let s;
    try {
      s = statSync(full);
    } catch {
      continue;
    }
    if (s.isDirectory()) out.push(...findTranscripts(full));
    else if (name.endsWith(".jsonl")) out.push(full);
  }
  return out;
}

/** Fold one parsed record into the report. Exported so it can be unit-tested directly. */
export function applyRecord(report: Report, rec: UsageRecord, sinceMs: number | null): void {
  if (rec.type !== "assistant") return;
  const usage = rec.message?.usage;
  if (!usage) return;

  const ts = rec.timestamp ? Date.parse(rec.timestamp) : NaN;
  if (sinceMs !== null && Number.isFinite(ts) && ts < sinceMs) return;

  const input = usage.input_tokens ?? 0;
  const output = usage.output_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const tokens = input + output + cacheWrite + cacheRead;
  if (tokens === 0) return;

  const model = rec.message?.model ?? "unknown";
  const cost = estimateCost(model, { input, output, cacheWrite, cacheRead });

  const add = (b: Bucket) => {
    b.input += input;
    b.output += output;
    b.cacheWrite += cacheWrite;
    b.cacheRead += cacheRead;
    b.tokens += tokens;
    b.costUSD += cost;
    b.messages += 1;
  };

  add(report.totals);

  const bump = (map: Map<string, Bucket>, key: string) => {
    let b = map.get(key);
    if (!b) {
      b = emptyBucket();
      map.set(key, b);
    }
    add(b);
  };

  bump(report.byModel, model);
  bump(report.byProject, projectLabel(rec.cwd));

  if (Number.isFinite(ts)) {
    const day = new Date(ts).toISOString().slice(0, 10);
    bump(report.byDay, day);
    if (!report.firstDate || day < report.firstDate) report.firstDate = day;
    if (!report.lastDate || day > report.lastDate) report.lastDate = day;
  }
}

export interface ScanOptions {
  /** Directory of transcripts (defaults to ~/.claude/projects). */
  dir?: string;
  /** Only count usage newer than this many days ago. */
  sinceDays?: number;
}

/** Scan transcripts on disk and return an aggregated report. Local-only, async I/O. */
export async function scan(opts: ScanOptions = {}): Promise<Report> {
  const dir = opts.dir ?? defaultDataDir();
  const sinceMs =
    opts.sinceDays && opts.sinceDays > 0 ? Date.now() - opts.sinceDays * 86_400_000 : null;

  const report: Report = {
    totals: emptyBucket(),
    byModel: new Map(),
    byProject: new Map(),
    byDay: new Map(),
    firstDate: null,
    lastDate: null,
    sessions: 0,
    filesScanned: 0,
  };

  const files = findTranscripts(dir);
  report.sessions = files.length;

  for (const file of files) {
    report.filesScanned += 1;
    await new Promise<void>((resolve) => {
      const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
      rl.on("line", (line) => {
        if (!line) return;
        let rec: UsageRecord;
        try {
          rec = JSON.parse(line);
        } catch {
          return; // skip a malformed line rather than crash the whole scan
        }
        applyRecord(report, rec, sinceMs);
      });
      rl.on("close", resolve);
      rl.on("error", () => resolve());
    });
  }

  return report;
}
