/**
 * Persistent per-file parse cache for the native readers.
 *
 * Why this exists: both native readers (claude.ts, codex.ts) re-read and
 * re-parse the ENTIRE on-disk transcript corpus on every run. That corpus grows
 * without bound (a heavy user's is multiple GB), while the read budget is a
 * fixed wall clock — and the 15-minute background sync runs at launchd
 * `Background` priority, where macOS throttles CPU/IO several-fold. Once the
 * corpus outgrows the budget, EVERY sync abandons the read (`found:false`), the
 * ccusage fallback usually times out too, and the source silently drops out of
 * the payload run after run: the user's day-rows are born hours or days late
 * and they vanish from the daily leaderboard while visibly burning. (Measured
 * live 2026-07-17: 42% of listed users' day-rows were first inserted AFTER the
 * local day had ended.)
 *
 * The fix: transcripts are append-only and immutable once a session ends, so we
 * cache each file's PARSED items keyed by (size, mtime) in the CLI config dir.
 * A run then stats everything but reads only new/changed files — steady state
 * is "today's active sessions", seconds even under background throttling.
 *
 * Two properties the readers rely on:
 *  - Items are cached PER FILE, before any cross-file merge, so claude's
 *    cross-file dedup (forked sessions duplicate (messageId,requestId) pairs)
 *    still sees every file's requests and keeps its max-wins semantics.
 *  - On budget exhaustion the progress so far is PERSISTED before bailing, so a
 *    corpus too large for one tick is finished across ticks — the cold first
 *    pass converges instead of starving forever.
 */
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { defaultConfigDir } from "../config.js";

interface CachedFile<T> {
  size: number;
  mtimeMs: number;
  items: T[];
}

interface CacheShape<T> {
  v: number;
  files: Record<string, CachedFile<T>>;
}

/**
 * Resolve the on-disk cache path for a reader's cache inside the config dir.
 * Honors the caller's env object (the readers thread a test env through), then
 * the process default — so tests never touch the real config dir and the
 * background sync (which forwards WHOBURNEDMORE_CONFIG_DIR in its plist) shares
 * the cache with interactive runs.
 */
export function nativeCachePath(
  reader: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const override = env.WHOBURNEDMORE_CONFIG_DIR?.trim();
  const dir = override || defaultConfigDir();
  return join(dir, `native-cache-${reader}.json`);
}

async function loadCache<T>(
  path: string,
  version: number,
): Promise<Record<string, CachedFile<T>>> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as CacheShape<T>;
    if (parsed && parsed.v === version && parsed.files && typeof parsed.files === "object") {
      return parsed.files;
    }
  } catch {
    // Missing or corrupt cache: start over. Never fatal.
  }
  return {};
}

function saveCache<T>(
  path: string,
  version: number,
  files: Record<string, CachedFile<T>>,
): void {
  try {
    mkdirSync(dirname(path), { recursive: true });
    // Atomic replace: a crash mid-write must never leave a truncated JSON that
    // a later run would half-trust. rename() is atomic on the same volume.
    const tmp = `${path}.tmp-${process.pid}`;
    writeFileSync(tmp, JSON.stringify({ v: version, files }));
    renameSync(tmp, path);
  } catch {
    // Cache persistence is best-effort; the reader still returns correct data.
  }
}

export interface FileCacheResult<T> {
  /** Per-file item lists in input-file order, or null when the budget ran out. */
  itemsByFile: T[][] | null;
  /** Files actually READ (parsed) this run — cache hits don't count. */
  filesRead: number;
  timedOut: boolean;
}

/**
 * Read `files` through the persistent per-file cache: reuse the cached parse for
 * files whose (size, mtime) are unchanged, re-parse the rest, persist progress
 * (even on timeout), and return every file's items for the caller to merge.
 *
 * The deadline is only consulted before actual file reads — stats and cache
 * hits are near-free. On timeout the entries parsed so far are SAVED and
 * `itemsByFile` is null: the caller keeps its established "abandon and fall
 * back" semantics (a partial corpus must never be submitted — recent days would
 * be $set to an undercount server-side), but the next run resumes from the
 * persisted progress instead of starting over.
 */
export async function readFilesWithCache<T>(opts: {
  files: string[];
  cachePath: string;
  version: number;
  /** Parse one file's content into cacheable items. `path` lets the parser mint
   *  file-scoped identifiers (claude's synthetic request keys must never collide
   *  across files or across runs, or the max-wins dedup would merge them). */
  parseFile: (content: string, path: string) => T[];
  deadline: number;
  now?: () => number;
}): Promise<FileCacheResult<T>> {
  const now = opts.now ?? Date.now;
  const cached = await loadCache<T>(opts.cachePath, opts.version);
  const fresh: Record<string, CachedFile<T>> = {};
  const itemsByFile: T[][] = [];
  let filesRead = 0;

  for (const f of opts.files) {
    let size: number;
    let mtimeMs: number;
    try {
      const s = await stat(f);
      size = s.size;
      mtimeMs = s.mtimeMs;
    } catch {
      continue; // vanished between listing and stat — skip
    }
    const hit = cached[f];
    if (hit && hit.size === size && hit.mtimeMs === mtimeMs) {
      fresh[f] = hit;
      itemsByFile.push(hit.items);
      continue;
    }
    if (now() > opts.deadline) {
      // Persist the progress made so far (keep prior entries for files not yet
      // revisited this run, so partial passes accumulate monotonic progress).
      saveCache(opts.cachePath, opts.version, { ...cached, ...fresh });
      return { itemsByFile: null, filesRead, timedOut: true };
    }
    let content: string;
    try {
      content = await readFile(f, "utf8");
    } catch {
      continue; // unreadable — skip, and drop any stale cache entry for it
    }
    const items = opts.parseFile(content, f);
    // Stat was taken BEFORE the read: if the file grew in between, the recorded
    // mtime is older than the content we parsed — the next run simply re-reads
    // it. Never the reverse (a recorded mtime newer than the parsed content).
    fresh[f] = { size, mtimeMs, items };
    itemsByFile.push(items);
    filesRead += 1;
  }

  // Completed pass: persist ONLY files that still exist (deleted transcripts
  // must drop out, or their usage would survive on disk forever).
  saveCache(opts.cachePath, opts.version, fresh);
  return { itemsByFile, filesRead, timedOut: false };
}
