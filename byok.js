// Bring your own key: the viewer's browser fetches daily bars straight from the viewer's own free data
// provider. Nothing passes through this site. Keys and bars stay on the viewer's device.

const ok = (b) => [b.o, b.h, b.l, b.c].every((v) => Number.isFinite(v) && v > 0) && /^\d{4}-\d{2}-\d{2}$/.test(b.d);
const byDate = (a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0);

export const PROVIDERS = {
  fmp: {
    name: "FMP",
    signup: "https://site.financialmodelingprep.com/register",
    gapMs: 350, // free plan: 250 calls a day
    url: (m, key, from) => `https://financialmodelingprep.com/stable/historical-price-eod/full?symbol=${encodeURIComponent(m.fmp)}&from=${from}&apikey=${encodeURIComponent(key)}`,
    parse(j) {
      const rows = Array.isArray(j) ? j : j?.historical;
      if (!Array.isArray(rows)) {
        const msg = j?.["Error Message"] || j?.message || "no data";
        return { error: msg, auth: /invalid api ?key|unauthori/i.test(msg), limit: /limit reach|daily limit/i.test(msg) ? "day" : null, skip: /subscription|premium|upgrade|not available/i.test(msg) && !/limit reach/i.test(msg) };
      }
      return { bars: rows.map((r) => ({ d: String(r.date).slice(0, 10), o: +r.open, h: +r.high, l: +r.low, c: +r.close })).filter(ok).sort(byDate) };
    },
  },
  td: {
    name: "Twelve Data",
    signup: "https://twelvedata.com/register",
    perMin: 8, // free plan: 8 calls a minute, 800 a day
    url: (m, key, from) => `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(m.td)}&interval=1day&start_date=${from}&outputsize=5000&order=asc&apikey=${encodeURIComponent(key)}`,
    parse(j) {
      if (j?.status !== "ok" || !Array.isArray(j.values)) {
        const msg = String(j?.message || "no data").replace(/\*\*/g, "");
        const limit = j?.code === 429 ? (/minute/i.test(msg) ? "minute" : "day") : null;
        return { error: msg, auth: j?.code === 401 || /apikey parameter is incorrect|invalid api ?key/i.test(msg), limit, skip: j?.code === 403 || /grow|pro plan|upgrade|not available/i.test(msg) };
      }
      return { bars: j.values.map((v) => ({ d: String(v.datetime).slice(0, 10), o: +v.open, h: +v.high, l: +v.low, c: +v.close })).filter(ok).sort(byDate) };
    },
  },
};

// New bars replace old bars on the same date.
export function mergeBars(old, fresh) {
  const map = new Map(old.map((b) => [b.d, b]));
  for (const b of fresh) map.set(b.d, b);
  return [...map.values()].sort(byDate);
}

const nyParts = (now) => Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false }).formatToParts(now).map((p) => [p.type, p.value]));
// The last bar is still forming: crypto trades all day; US listings 09:30-16:00 New York time on weekdays.
export function isLiveBar(m, bars, now = new Date()) {
  const last = bars[bars.length - 1]?.d;
  if (m.kind === "crypto" || m.symbol === "BTC") return last === now.toISOString().slice(0, 10);
  const p = nyParts(now);
  const today = `${p.year}-${p.month}-${p.day}`, mins = (+p.hour % 24) * 60 + +p.minute;
  return last === today && !["Sat", "Sun"].includes(p.weekday) && mins >= 570 && mins < 960;
}

/* ---------- Device cache (IndexedDB). Fails quietly: the page then just fetches again. ---------- */

function db() {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open("gods-eye-view", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("bars", { keyPath: "symbol" });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}
async function cacheGet(conn, symbol) {
  if (!conn) return null;
  return new Promise((resolve) => {
    try {
      const r = conn.transaction("bars").objectStore("bars").get(symbol);
      r.onsuccess = () => resolve(r.result ?? null);
      r.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}
function cachePut(conn, rec) {
  if (!conn) return;
  try { conn.transaction("bars", "readwrite").objectStore("bars").put(rec); } catch {}
}
export async function clearCache() {
  const conn = await db();
  try { conn?.transaction("bars", "readwrite").objectStore("bars").clear(); } catch {}
}

/* ---------- Loader ---------- */

const FRESH_MS = 3 * 3600 * 1000; // re-use cached bars for 3 hours
const LIVE_FRESH_MS = 20 * 60 * 1000; // a bar that was still trading at fetch time: 20 minutes
const FORCE_MIN_MS = 15 * 60 * 1000; // REFRESH skips bars fetched in the last 15 minutes
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isoDaysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const FULL_FROM_DAYS = 5 * 365 - 10; // inside the free plans' 5-year window

// Symbols a provider's free plan refuses (e.g. FMP "not available under your current subscription").
// Remembered on the device so the next run does not spend a call on them.
const SKIP_KEY = "gev-skip-v1";
function readSkips() { try { return JSON.parse(localStorage.getItem(SKIP_KEY) || "{}"); } catch { return {}; } }
function addSkip(p, symbol) {
  try { const s = readSkips(); (s[p] ??= []).includes(symbol) || s[p].push(symbol); localStorage.setItem(SKIP_KEY, JSON.stringify(s)); } catch {}
}

function needsFetch(m, rec, force) {
  if (!rec?.bars?.length) return true;
  const age = Date.now() - rec.at;
  if (force) return age > FORCE_MIN_MS;
  // A bar that was still forming when fetched is refetched once it has closed.
  if (rec.live && !isLiveBar(m, rec.bars)) return true;
  return age > (rec.live ? LIVE_FRESH_MS : FRESH_MS);
}

// Load every market. Calls onMarket(meta, bars, live, fetchedAt) as each one arrives, onProgress(info)
// as it goes, onAuthError(provider, msg) if a key is refused, onLimit(provider) if a free daily limit is
// used up. Stops early when cancelled() returns true. Each provider runs as its own worker on a shared
// queue; a market one provider cannot serve is retried on the other.
export async function loadMarkets(markets, keys, { onMarket, onProgress, onAuthError, onLimit, cancelled = () => false, force = false }) {
  const conn = await db();
  const skips = readSkips();
  const active = Object.keys(PROVIDERS).filter((p) => keys[p]);
  const can = (p, m) => !!m[p] && !(skips[p] ?? []).includes(m.symbol);
  const total = markets.length;
  let done = 0;
  const failed = [];
  const report = (extra) => { if (!cancelled()) onProgress?.({ done, total, failed: failed.length, ...extra }); };

  // 1. Cached bars first, so a return visit draws at once.
  const queue = [];
  for (const m of markets) {
    const rec = await cacheGet(conn, m.symbol);
    if (rec?.bars?.length >= 30) onMarket(m, rec.bars, isLiveBar(m, rec.bars), rec.at);
    if (!needsFetch(m, rec, force)) { done++; continue; }
    queue.push({ m, rec, tried: new Set() });
  }
  report({ scanned: true });

  // 2. Fetch the rest from the viewer's provider(s).
  const stamps = { td: [] };
  const dead = new Set();
  async function worker(p) {
    const P = PROVIDERS[p];
    while (!cancelled()) {
      const i = queue.findIndex((job) => !job.tried.has(p) && can(p, job.m));
      if (i < 0 || dead.has(p)) return;
      const job = queue.splice(i, 1)[0];
      if (P.perMin) {
        // Stay under the free per-minute limit.
        const s = stamps[p];
        while (s.length && Date.now() - s[0] > 61000) s.shift();
        if (s.length >= P.perMin) {
          const waitMs = 61000 - (Date.now() - s[0]);
          report({ symbol: job.m.symbol, provider: P.name, waitMs });
          await sleep(waitMs);
          if (cancelled()) return;
          s.shift();
        }
        s.push(Date.now());
      } else {
        await sleep(P.gapMs);
      }
      report({ symbol: job.m.symbol, provider: P.name });
      // Full 5 years for a first load or after a long absence; otherwise only the recent bars.
      const lastBar = job.rec?.bars?.at(-1)?.d;
      const gapDays = lastBar ? (Date.now() - Date.parse(lastBar)) / 864e5 : Infinity;
      const from = gapDays > 25 ? isoDaysAgo(FULL_FROM_DAYS) : isoDaysAgo(gapDays + 7);
      let res;
      try {
        const r = await fetch(P.url(job.m, keys[p], from));
        res = r.status === 402 ? { error: "not in the free plan", skip: true } : P.parse(await r.json());
        if (r.status === 429 && !res.limit) res = { error: "rate limit", limit: "minute" };
      } catch (e) { res = { error: String(e?.message ?? e) }; }
      if (cancelled()) return;
      if (res.limit === "minute") {
        // Per-minute limit: wait and retry the same market on the same provider.
        report({ symbol: job.m.symbol, provider: P.name, waitMs: 61000 });
        await sleep(61000);
        queue.unshift(job);
        continue;
      }
      job.tried.add(p);
      if (res.auth) { dead.add(p); onAuthError?.(p, res.error); }
      if (res.limit) { dead.add(p); onLimit?.(p); }
      if (res.skip) addSkip(p, job.m.symbol);
      if (res.bars?.length) {
        const bars = job.rec?.bars && gapDays <= 25 ? mergeBars(job.rec.bars, res.bars) : res.bars;
        if (bars.length >= 30) {
          const live = isLiveBar(job.m, bars), at = Date.now();
          cachePut(conn, { symbol: job.m.symbol, bars, at, live, provider: p });
          onMarket(job.m, bars, live, at);
          done++;
          report({});
          continue;
        }
      }
      // Not served: let another provider try it, or count it as failed.
      if (active.some((q) => !job.tried.has(q) && !dead.has(q) && can(q, job.m))) queue.push(job);
      else { failed.push(job.m.symbol); done++; report({}); }
    }
  }
  const servable = () => !cancelled() && queue.some((job) => active.some((p) => !dead.has(p) && !job.tried.has(p) && can(p, job.m)));
  do { await Promise.all(active.map(worker)); } while (servable());
  for (const job of queue.splice(0)) failed.push(job.m.symbol);
  report({ finished: true });
  return { failed, dead: [...dead] };
}
