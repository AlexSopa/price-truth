// Yahoo Finance chart API helpers. Shared by the build script and the optional browser live mode.

export const chartUrl = (symbol, host = "query1") =>
  `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5y&interval=1d`;

const fmtCache = new Map();
export function localDate(t, tz) {
  if (!fmtCache.has(tz)) fmtCache.set(tz, new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }));
  return fmtCache.get(tz).format(t * 1000);
}

// Daily bars keyed by the exchange-local calendar date (each bar's own DST offset).
// The current, still-open session is kept: TheStrat reads the bar in force.
// Rows with a missing or zero price are dropped, except a last row whose only gap is the close,
// which is filled from the latest traded price.
export function parseChart(json) {
  const res = json?.chart?.result?.[0];
  const q = res?.indicators?.quote?.[0];
  if (!res?.timestamp || !q) return [];
  const meta = res.meta ?? {};
  const tz = meta.exchangeTimezoneName || "UTC";
  const ok = (v) => v != null && Number.isFinite(v) && v > 0;
  const last = res.timestamp.length - 1;
  const bars = [];
  res.timestamp.forEach((t, i) => {
    let [o, h, l, c] = [q.open[i], q.high[i], q.low[i], q.close[i]];
    if (i === last && ok(o) && ok(h) && ok(l) && !ok(c) && ok(meta.regularMarketPrice)) c = meta.regularMarketPrice;
    if (![o, h, l, c].every(ok)) return;
    const d = localDate(t, tz);
    if (bars.length && bars[bars.length - 1].d === d) bars[bars.length - 1] = { d, o, h, l, c };
    else bars.push({ d, o, h, l, c });
  });
  return bars;
}

// True while the exchange's regular session is open and the last bar is today's, so it is still forming.
export function isLive(json, now = Date.now() / 1000) {
  const res = json?.chart?.result?.[0];
  const reg = res?.meta?.currentTradingPeriod?.regular;
  if (!reg || now < reg.start || now >= reg.end || !res.timestamp?.length) return false;
  const tz = res.meta.exchangeTimezoneName || "UTC";
  return localDate(res.timestamp.at(-1), tz) === localDate(now, tz);
}
