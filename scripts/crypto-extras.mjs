// Free extras for the crypto layer cake, fetched at build time. No key, no account.
//   stablecoins(): the total supply of stablecoins, one value a day (DefiLlama). Tracked dollars, not price.
//   marketValue(): each coin's share of the market value of the coins on the cake (CoinGecko).
// Each one is optional: when its source does not answer, the build leaves it out and the page hides that part.
import { analyze, timeline } from "../strat.js";
import { GECKO } from "../crypto-universe.js";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const round = (v, n) => Math.round(v * 10 ** n) / 10 ** n;

// A 429 (rate limit) gets one more try after a wait. Anything else that fails returns null.
async function getJson(url, tries = 2) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(30000) });
      if (r.ok) return await r.json();
      if (r.status !== 429) return null;
    } catch {}
    if (i < tries - 1) await sleep(25000);
  }
  return null;
}

// One value a day -> daily bars. The open is the value of the day before, so the bars join end to end.
// points: [{ d: "YYYY-MM-DD", v }], oldest first.
export function valueBars(points) {
  const out = [];
  for (let i = 1; i < points.length; i++) {
    const o = points[i - 1].v, c = points[i].v;
    out.push({ d: points[i].d, o, h: Math.max(o, c), l: Math.min(o, c), c });
  }
  return out;
}

export async function stablecoins(axis) {
  const rows = await getJson("https://stablecoins.llama.fi/stablecoincharts/all");
  if (!Array.isArray(rows)) return null;
  const pts = rows.map((r) => ({ d: new Date(+r.date * 1000).toISOString().slice(0, 10), v: r.totalCirculatingUSD?.peggedUSD })).filter((p) => p.v > 0);
  if (pts.length < 400) return null;
  const bars = valueBars(pts.slice(-3700)); // about 10 years
  const last = pts.at(-1).v;
  const pct = (days) => { const then = pts.at(-1 - days)?.v; return then ? round((last / then - 1) * 100, 2) : null; };
  return { ...analyze(bars), tl: timeline(bars, axis), usd: Math.round(last), chg: { w: pct(7), m: pct(30), q: pct(90), y: pct(365) }, source: "DefiLlama" };
}

export async function marketValue(markets) {
  const ids = markets.map((m) => GECKO[m.symbol]).filter(Boolean);
  const rows = await getJson(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&per_page=250&ids=${ids.join(",")}`);
  if (!Array.isArray(rows) || rows.length < ids.length * 0.8) return null;
  const cap = new Map(rows.map((r) => [r.id, r.market_cap ?? 0]));
  const sum = [...cap.values()].reduce((a, b) => a + b, 0);
  if (!(sum > 0)) return null;
  const share = {};
  for (const m of markets) {
    const v = cap.get(GECKO[m.symbol]);
    if (v > 0) share[m.symbol] = round(v / sum, 6);
  }
  const out = { share, source: "CoinGecko" };
  await sleep(2500);
  const g = (await getJson("https://api.coingecko.com/api/v3/global"))?.data;
  if (g?.total_market_cap?.usd > 0) {
    out.btcDom = round(g.market_cap_percentage?.btc ?? 0, 1); // Bitcoin's share of all crypto value
    out.cover = round((sum / g.total_market_cap.usd) * 100, 1); // how much of all crypto value the cake's coins hold
  }
  return out;
}
