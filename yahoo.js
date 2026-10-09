// Yahoo Finance chart API helpers. Shared by the build script and the optional browser live mode.

export const chartUrl = (symbol, host = "query1") =>
  `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=2y&interval=1d`;

// Daily bars keyed by the exchange-local calendar date. Holidays and null rows are dropped.
export function parseChart(json) {
  const res = json?.chart?.result?.[0];
  const q = res?.indicators?.quote?.[0];
  if (!res?.timestamp || !q) return [];
  const off = res.meta?.gmtoffset ?? 0;
  const bars = [];
  res.timestamp.forEach((t, i) => {
    const [o, h, l, c] = [q.open[i], q.high[i], q.low[i], q.close[i]];
    if ([o, h, l, c].some((v) => v == null || !Number.isFinite(v)) || h <= 0) return;
    const d = new Date((t + off) * 1000).toISOString().slice(0, 10);
    if (bars.length && bars[bars.length - 1].d === d) bars[bars.length - 1] = { d, o, h, l, c };
    else bars.push({ d, o, h, l, c });
  });
  return bars;
}
