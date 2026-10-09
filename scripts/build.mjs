// Daily build: fetch EOD bars from Yahoo Finance, keep only TheStrat labels, write data/signals.json.
// Runs in GitHub Actions after the US close. No prices are written to the output.
import { writeFile, mkdir } from "node:fs/promises";
import { MARKETS } from "../universe.js";
import { analyze } from "../strat.js";
import { parseChart, chartUrl } from "../yahoo.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchDaily(symbol) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const url = chartUrl(symbol, attempt % 2 ? "query2" : "query1");
    try {
      const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (global-strat-pulse)" } });
      if (r.ok) return parseChart(await r.json());
      if (r.status === 404) return [];
    } catch {}
    await sleep(1500 * (attempt + 1));
  }
  return [];
}

const out = { generatedAt: new Date().toISOString(), source: "Yahoo Finance", markets: [] };
const failed = [];
for (const m of MARKETS) {
  const bars = await fetchDaily(m.symbol);
  if (bars.length < 30) { failed.push(m.symbol); continue; }
  out.markets.push({ ...m, ...analyze(bars) });
  await sleep(250);
}
out.failed = failed;

await mkdir(new URL("../data/", import.meta.url), { recursive: true });
await writeFile(new URL("../data/signals.json", import.meta.url), JSON.stringify(out));
console.log(`markets: ${out.markets.length}/${MARKETS.length}  failed: ${failed.join(" ") || "none"}`);
if (out.markets.length < MARKETS.length * 0.8) process.exit(1); // keep yesterday's file if Yahoo blocks us
