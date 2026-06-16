/**
 * whoburnedmore — a 100% local CLI that tells you how many tokens your AI coding
 * agents (Claude Code) really burned. No account, no upload, no network: it reads
 * the session transcripts already on your disk and prints a report.
 *
 *   whoburnedmore                 print the burn report
 *   whoburnedmore --html [file]   also write a self-contained HTML dashboard
 *   whoburnedmore --since 30      only count the last 30 days
 *   whoburnedmore --dir <path>    read transcripts from a custom directory
 *   whoburnedmore --json          print the raw aggregated JSON
 *   whoburnedmore --help          show help
 *   whoburnedmore --version       print the version
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defaultDataDir, scan, type Bucket, type Report } from "./scan.js";
import { renderReport } from "./report.js";
import { renderHtml } from "./html.js";

const VERSION = "1.0.0";

interface Args {
  help: boolean;
  version: boolean;
  json: boolean;
  html: boolean;
  htmlPath?: string;
  dir?: string;
  sinceDays?: number;
}

/** Tiny argv parser. Recognises flags first so `--help`/`--version` never do real work. */
export function parseArgs(argv: string[]): Args {
  const args: Args = { help: false, version: false, json: false, html: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    const takesValue = next !== undefined && !next.startsWith("-");
    switch (a) {
      case "--help":
      case "-h":
        args.help = true;
        break;
      case "--version":
      case "-v":
        args.version = true;
        break;
      case "--json":
        args.json = true;
        break;
      case "--html":
        args.html = true;
        if (takesValue) args.htmlPath = argv[++i];
        break;
      case "--dir":
        if (takesValue) args.dir = argv[++i];
        break;
      case "--since":
        if (takesValue) args.sinceDays = Number(argv[++i]);
        break;
    }
  }
  return args;
}

const HELP = `
  🔥 whoburnedmore — see how many tokens your AI coding agents really burned

  Usage
    whoburnedmore                  print your local burn report
    whoburnedmore --html [file]    also write an HTML dashboard (default: ./whoburnedmore.html)
    whoburnedmore --since <days>   only count the last N days
    whoburnedmore --dir <path>     read transcripts from a custom directory
    whoburnedmore --json           print the raw aggregated JSON
    whoburnedmore --version        print the version
    whoburnedmore --help           show this help

  Reads Claude Code transcripts from ${defaultDataDir()}
  100% local — no account, no upload, nothing leaves your machine.
  Hosted leaderboard: https://whoburnedmore.com
`;

/** Convert the Maps in a Report into plain objects for --json output. */
function toJSON(report: Report) {
  const obj = (m: Map<string, Bucket>) => Object.fromEntries(m);
  return {
    totals: report.totals,
    firstDate: report.firstDate,
    lastDate: report.lastDate,
    sessions: report.sessions,
    activeDays: report.byDay.size,
    byModel: obj(report.byModel),
    byProject: obj(report.byProject),
    byDay: obj(report.byDay),
  };
}

export async function main(argv: string[]): Promise<number> {
  const args = parseArgs(argv);

  if (args.help) {
    process.stdout.write(HELP + "\n");
    return 0;
  }
  if (args.version) {
    process.stdout.write(VERSION + "\n");
    return 0;
  }

  const report = await scan({ dir: args.dir, sinceDays: args.sinceDays });

  if (args.json) {
    process.stdout.write(JSON.stringify(toJSON(report), null, 2) + "\n");
    return 0;
  }

  process.stdout.write(renderReport(report) + "\n");

  if (args.html) {
    const out = resolve(args.htmlPath ?? "whoburnedmore.html");
    writeFileSync(out, renderHtml(report), "utf8");
    process.stdout.write(`  Dashboard written to ${out}\n\n`);
  }

  return 0;
}

main(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    process.stderr.write(`whoburnedmore: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 1;
  });
