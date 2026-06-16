/** Renders an aggregated {@link Report} as a colourful terminal "burn report". */
import type { Report } from "./scan.js";
import { bar, formatTokens, formatUSD, topBy } from "./format.js";

// Minimal ANSI styling — no dependency, and it auto-disables when output isn't a TTY
// or when NO_COLOR is set (https://no-color.org).
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const wrap = (code: string) => (s: string) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const c = {
  orange: wrap("38;5;208"),
  green: wrap("38;5;42"),
  dim: wrap("2"),
  bold: wrap("1"),
  cyan: wrap("36"),
};

const RULE = "─".repeat(48);

export function renderReport(report: Report): string {
  const { totals } = report;
  const lines: string[] = [];
  const push = (s = "") => lines.push(s);

  push();
  push(`  ${c.orange("🔥 whoburnedmore")} ${c.dim("— your local AI token burn report")}`);
  push(`  ${c.dim(RULE)}`);

  if (totals.tokens === 0) {
    push();
    push(`  ${c.dim("No Claude Code usage found yet.")}`);
    push(`  ${c.dim("Use Claude Code for a bit, then run this again.")}`);
    push();
    return lines.join("\n");
  }

  const span =
    report.firstDate && report.lastDate
      ? `${report.firstDate} → ${report.lastDate}`
      : "all time";

  push();
  push(`  ${c.bold(c.green(formatTokens(totals.tokens)))} ${c.dim("tokens burned")}   ${c.bold(formatUSD(totals.costUSD))} ${c.dim("est.")}`);
  push(`  ${c.dim(`${totals.messages.toLocaleString()} assistant messages · ${report.byDay.size} active days · ${span}`)}`);

  // Per-model breakdown
  push();
  push(`  ${c.bold("By model")}`);
  for (const [model, b] of topBy(report.byModel)) {
    const frac = b.tokens / totals.tokens;
    push(
      `    ${c.green(bar(frac, 18))} ${model.padEnd(26)} ${formatTokens(b.tokens).padStart(8)}  ${c.dim(formatUSD(b.costUSD).padStart(11))}`,
    );
  }

  // Per-project breakdown
  push();
  push(`  ${c.bold("By project")}`);
  for (const [project, b] of topBy(report.byProject)) {
    const frac = b.tokens / totals.tokens;
    push(
      `    ${c.orange(bar(frac, 18))} ${project.slice(0, 26).padEnd(26)} ${formatTokens(b.tokens).padStart(8)}  ${c.dim(formatUSD(b.costUSD).padStart(11))}`,
    );
  }

  // Cache efficiency — a fun, genuinely useful stat
  const cacheable = totals.cacheRead + totals.input;
  if (cacheable > 0) {
    const hitRate = (totals.cacheRead / cacheable) * 100;
    push();
    push(`  ${c.bold("Prompt cache")}   ${c.green(`${hitRate.toFixed(1)}%`)} ${c.dim("read-hit rate")} ${c.dim(`(${formatTokens(totals.cacheRead)} cached reads)`)}`);
  }

  push();
  push(`  ${c.dim(RULE)}`);
  push(`  ${c.dim("100% local · nothing left your machine.")}`);
  push(`  ${c.dim("Compare on the public board →")} ${c.cyan("https://whoburnedmore.com")}`);
  push();

  return lines.join("\n");
}
