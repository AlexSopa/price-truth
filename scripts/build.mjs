// Run-your-own build: fetch daily bars from Yahoo Finance for YOUR personal use, keep only TheStrat labels,
// write data/signals.json. Run it on your computer (npm run build) or in your own fork's GitHub Actions.
// Open sessions are kept (the bar in force) and flagged live. No prices are written to the output.
// `node scripts/build.mjs crypto` builds the crypto layer cake instead: data/crypto.json.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { buildSignals } from "../signals.js";
import { parseChart, chartUrl, isLive, localDate } from "../yahoo.js";

const CRYPTO = process.argv[2] === "crypto";
const MARKETS = CRYPTO ? (await import("../crypto-universe.js")).CRYPTO_MARKETS : (await import("../universe.js")).MARKETS;
const NAME = CRYPTO ? "crypto" : "signals";
const AXIS_DAYS = CRYPTO ? 366 : 260; // replay axis: coins trade every day of the year
const RANGE = CRYPTO ? "10y" : "5y"; // coins: more yearly bars (Bitcoin has daily bars for all 10 years)
const OUT = new URL(`../data/${NAME}.json`, import.meta.url);
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DEADLINE = Date.now() + 20 * 60 * 1000; // stay well inside the 30-minute job limit
const MAX_STALE_DAYS = 7;
let blocked = 0; // 429s in a row

async function fetchChart(symbol) {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (Date.now() > DEADLINE || blocked >= 3) return null;
    let wait = 1500 * (attempt + 1);
    try {
      const r = await fetch(chartUrl(symbol, attempt % 2 ? "query2" : "query1", RANGE), {
        headers: { "User-Agent": UA, Accept: "application/json" },
        signal: AbortSignal.timeout(15000),
      });
      if (r.ok) { blocked = 0; return await r.json(); }
      if (r.status === 404) return null;
      if (r.status === 429) { blocked++; wait = 20000 * (attempt + 1); }
    } catch {}
    if (attempt < 2) await sleep(wait);
  }
  return null;
}

let previous = new Map();
try {
  const old = JSON.parse(await readFile(OUT, "utf8"));
  previous = new Map(old.markets.map((m) => [m.symbol, m]));
} catch {}

const entries = [], stale = [], failed = [];
for (const m of MARKETS) {
  const json = await fetchChart(m.symbol);
  const bars = json ? parseChart(json) : [];
  if (bars.length >= 30) {
    const tz = json.chart.result[0].meta?.exchangeTimezoneName || "UTC";
    entries.push({ meta: m, bars, live: isLive(json) && bars.at(-1).d === localDate(Date.now() / 1000, tz) });
  } else {
    failed.push(m.symbol);
    const old = previous.get(m.symbol);
    const age = old?.asOf ? (Date.now() - Date.parse(old.asOf)) / 864e5 : Infinity;
    if (old && age <= MAX_STALE_DAYS) stale.push({ ...old, ...m, live: false, stale: true, tl: undefined });
  }
  await sleep(250);
}
const fresh = entries.length;
const out = buildSignals(entries, "Yahoo Finance (your own copy)", AXIS_DAYS);
out.failed = failed;
const order = new Map(MARKETS.map((m, i) => [m.symbol, i]));
out.markets = [...out.markets, ...stale].sort((a, b) => order.get(a.symbol) - order.get(b.symbol));

console.log(`fresh: ${fresh}/${MARKETS.length}  live now: ${out.markets.filter((m) => m.live).length}  failed: ${failed.join(" ") || "none"}`);
if (fresh < MARKETS.length * 0.8) {
  console.error("Too many markets failed. Keeping the previous data file.");
  process.exit(1);
}
if (CRYPTO) {
  // Free extras: stablecoin supply and market value shares. Each is optional.
  const { stablecoins, marketValue } = await import("./crypto-extras.mjs");
  const stable = await stablecoins(out.axis), value = await marketValue(MARKETS);
  if (stable) out.stable = stable;
  if (value) out.value = value;
  console.log(`extras: stablecoin supply ${stable ? "ok" : "MISSING"}  market value ${value ? "ok" : "MISSING"}`);
}
await mkdir(new URL("../data/", import.meta.url), { recursive: true });
if (process.env.GEV_PASSWORD) {
  // Owner vault: publish only the encrypted file; the plain data never leaves this machine.
  const { seal } = await import("../vault.js");
  await writeFile(new URL(`../data/${NAME}.enc.json`, import.meta.url), JSON.stringify(await seal(out, process.env.GEV_PASSWORD)));
  console.log(`wrote data/${NAME}.enc.json (encrypted)`);
} else {
  await writeFile(OUT, JSON.stringify(out));
}
