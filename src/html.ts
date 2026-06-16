/**
 * Builds a single self-contained HTML dashboard from a {@link Report}.
 * All CSS is inline and there are no external fonts, scripts, or trackers — the file
 * makes zero network requests, so it works fully offline and leaks nothing.
 */
import type { Bucket, Report } from "./scan.js";
import { formatTokens, formatUSD, topBy } from "./format.js";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (ch) =>
    ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : ch === '"' ? "&quot;" : "&#39;",
  );
}

function rows(map: Map<string, Bucket>, total: number, accent: string): string {
  return topBy(map, 10)
    .map(([label, b]) => {
      const pct = total > 0 ? (b.tokens / total) * 100 : 0;
      return `
      <div class="row">
        <div class="row-label" title="${esc(label)}">${esc(label)}</div>
        <div class="track"><div class="fill" style="width:${pct.toFixed(1)}%;background:${accent}"></div></div>
        <div class="row-tokens">${formatTokens(b.tokens)}</div>
        <div class="row-cost">${formatUSD(b.costUSD)}</div>
      </div>`;
    })
    .join("");
}

export function renderHtml(report: Report): string {
  const t = report.totals;
  const span =
    report.firstDate && report.lastDate ? `${report.firstDate} → ${report.lastDate}` : "all time";
  const cacheable = t.cacheRead + t.input;
  const hitRate = cacheable > 0 ? (t.cacheRead / cacheable) * 100 : 0;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>whoburnedmore — local burn report</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 48px 20px; min-height: 100vh;
    font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: radial-gradient(1200px 600px at 50% -10%, #20140a, #0b0b0d 60%); color: #e8e8ea;
  }
  .wrap { max-width: 780px; margin: 0 auto; }
  h1 { font-size: 26px; margin: 0 0 4px; letter-spacing: -0.02em; }
  .flame { color: #ff8a3d; }
  .sub { color: #9a9aa2; margin: 0 0 28px; }
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 32px; }
  .card { background: #16161a; border: 1px solid #26262c; border-radius: 14px; padding: 18px; }
  .card .n { font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }
  .card .n.green { color: #3ddc84; }
  .card .n.orange { color: #ff8a3d; }
  .card .k { color: #8a8a92; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 6px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: #8a8a92; margin: 28px 0 10px; }
  .row { display: grid; grid-template-columns: 150px 1fr 70px 80px; align-items: center; gap: 12px; padding: 6px 0; }
  .row-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #d6d6da; }
  .track { background: #1d1d22; border-radius: 6px; height: 10px; overflow: hidden; }
  .fill { height: 100%; border-radius: 6px; }
  .row-tokens { text-align: right; font-variant-numeric: tabular-nums; }
  .row-cost { text-align: right; color: #9a9aa2; font-variant-numeric: tabular-nums; }
  footer { margin-top: 36px; padding-top: 18px; border-top: 1px solid #26262c; color: #8a8a92; font-size: 13px; }
  a { color: #ff8a3d; text-decoration: none; }
  a:hover { text-decoration: underline; }
</style>
</head>
<body>
  <div class="wrap">
    <h1><span class="flame">🔥</span> whoburnedmore</h1>
    <p class="sub">Your local AI token burn report · ${esc(span)}</p>

    <div class="stats">
      <div class="card"><div class="n green">${formatTokens(t.tokens)}</div><div class="k">tokens burned</div></div>
      <div class="card"><div class="n orange">${formatUSD(t.costUSD)}</div><div class="k">estimated cost</div></div>
      <div class="card"><div class="n">${hitRate.toFixed(0)}%</div><div class="k">cache hit rate</div></div>
    </div>

    <h2>By model</h2>
    ${rows(report.byModel, t.tokens, "#3ddc84")}

    <h2>By project</h2>
    ${rows(report.byProject, t.tokens, "#ff8a3d")}

    <footer>
      ${t.messages.toLocaleString()} assistant messages across ${report.byDay.size} active days.
      Generated locally — nothing left your machine.
      Compare on the public board at <a href="https://whoburnedmore.com">whoburnedmore.com</a>.
    </footer>
  </div>
</body>
</html>`;
}
