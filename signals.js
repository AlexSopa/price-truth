// Turn daily bars into the signals file shape the page reads. Shared by the build script (run-your-own)
// and the browser (bring-your-own-key). Labels and chart shapes only; no prices leave this function.
import { analyze, timeline, sundayWeek } from "./strat.js";

// entries: [{ meta, bars, live }] — meta is the market's universe entry, bars are daily { d, o, h, l, c }.
export function buildSignals(entries, source, axisDays = 260) {
  const out = { generatedAt: new Date().toISOString(), source, markets: [], failed: [] };
  const seen = new Map();
  for (const e of entries) for (const b of e.bars) seen.set(b.d, (seen.get(b.d) ?? 0) + 1);
  // Replay axis: the last ~1 year of dates on which at least 40% of markets traded.
  out.axis = [...seen].filter(([, n]) => n >= entries.length * 0.4).map(([d]) => d).sort().slice(-axisDays);
  for (const e of entries) {
    out.markets.push({ ...e.meta, ...analyze(e.bars), live: !!e.live, tl: timeline(e.bars, out.axis, sundayWeek(e.bars)) });
  }
  return out;
}
