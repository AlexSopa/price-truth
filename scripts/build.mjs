// Build: fetch daily bars from Yahoo Finance, keep only TheStrat labels, write data/signals.json.
// Runs hourly on trading days in GitHub Actions. Open sessions are kept (the bar in force) and flagged live.
// No prices are written to the output.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { MARKETS } from "../universe.js";
import { analyze } from "../strat.js";
import { parseChart, chartUrl, isLive } from "../yahoo.js";

const OUT = new URL("../data/signals.json", import.meta.url);
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchChart(symbol) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await fetch(chartUrl(symbol, attempt % 2 ? "query2" : "query1"), {
        headers: { "User-Agent": UA, Accept: "application/json" },
        signal: AbortSignal.timeout(15000),
      });
      if (r.ok) return await r.json();
      if (r.status === 404) return null;
      await sleep(r.status === 429 ? 30000 * (attempt + 1) : 1500 * (attempt + 1));
    } catch {
      await sleep(1500 * (attempt + 1));
    }
  }
  return null;
}

let previous = new Map();
try {
  const old = JSON.parse(await readFile(OUT, "utf8"));
  previous = new Map(old.markets.map((m) => [m.symbol, m]));
} catch {}

const out = { generatedAt: new Date().toISOString(), source: "Yahoo Finance", markets: [], failed: [] };
let fresh = 0;
for (const m of MARKETS) {
  const json = await fetchChart(m.symbol);
  const bars = json ? parseChart(json) : [];
  if (bars.length >= 30) {
    out.markets.push({ ...m, ...analyze(bars), live: isLive(json) });
    fresh++;
  } else {
    out.failed.push(m.symbol);
    const old = previous.get(m.symbol);
    if (old) out.markets.push({ ...old, ...m, live: false, stale: true });
  }
  await sleep(250);
}

console.log(`fresh: ${fresh}/${MARKETS.length}  live now: ${out.markets.filter((m) => m.live).length}  failed: ${out.failed.join(" ") || "none"}`);
if (fresh < MARKETS.length * 0.8) {
  console.error("Too many markets failed. Keeping the previous data file.");
  process.exit(1);
}
await mkdir(new URL("../data/", import.meta.url), { recursive: true });
await writeFile(OUT, JSON.stringify(out));
