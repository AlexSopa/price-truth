// TheStrat engine. Pure functions, no I/O. Used by the build script and the browser.
//
// A bar is { d: "YYYY-MM-DD", o, h, l, c }.
// Scenario of a bar against the bar before it:
//   "1"  inside   — high <= prior high AND low >= prior low
//   "2u" up       — takes out the prior high only
//   "2d" down     — takes out the prior low only
//   "3"  outside  — takes out both sides

export const TIMEFRAMES = ["D", "W", "M", "Q", "Y"];

export function scenario(cur, prev) {
  const up = cur.h > prev.h;
  const down = cur.l < prev.l;
  if (up && down) return "3";
  if (up) return "2u";
  if (down) return "2d";
  return "1";
}

// +1 green (close above open), -1 red, 0 flat.
export const color = (b) => Math.sign(b.c - b.o);

function weekKey(d, sunStart = false) {
  // First day of the week (Monday, or Sunday for Sunday-Thursday markets such as Saudi Arabia).
  // Dates are already exchange-local calendar days.
  const t = new Date(d + "T00:00:00Z");
  const dow = sunStart ? t.getUTCDay() : (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dow);
  return t.toISOString().slice(0, 10);
}

const KEY = {
  D: (d) => d,
  W: (d, sunStart) => weekKey(d, sunStart),
  M: (d) => d.slice(0, 7),
  Q: (d) => `${d.slice(0, 4)}-Q${Math.floor((+d.slice(5, 7) - 1) / 3) + 1}`,
  Y: (d) => d.slice(0, 4),
};

export const periodKey = (d, tf, sunStart = false) => KEY[tf](d, sunStart);

// One letter per bar state: scenario (1, 2u, 2d, 3) x color (red, flat, green) -> "a".."l". "." = no data.
const SCEN = ["1", "2u", "2d", "3"];
export const encodeState = (s, g) => String.fromCharCode(97 + SCEN.indexOf(s) * 3 + (g + 1));
export function decodeState(ch) {
  const n = ch ? ch.charCodeAt(0) - 97 : -1;
  return n >= 0 && n < 12 ? { s: SCEN[Math.floor(n / 3)], g: (n % 3) - 1 } : null;
}

// Timeline: for each date of a shared axis, the state of the bar in force on that date, per timeframe.
// A weekly letter on a Wednesday is the week-so-far bar against last week's bar, as it stood that day.
export function timeline(daily, axis, sunStart = false) {
  const out = {};
  for (const tf of TIMEFRAMES) {
    let i = 0, cur = null, prev = null, code = ".", s = "";
    for (const d of axis) {
      while (i < daily.length && daily[i].d <= d) {
        const b = daily[i++];
        const k = KEY[tf](b.d, sunStart);
        if (cur && cur.k === k) {
          cur.h = Math.max(cur.h, b.h); cur.l = Math.min(cur.l, b.l); cur.c = b.c;
        } else {
          prev = cur;
          cur = { k, o: b.o, h: b.h, l: b.l, c: b.c };
        }
        code = prev ? encodeState(scenario(cur, prev), color(cur)) : ".";
      }
      s += code;
    }
    out[tf] = s;
  }
  return out;
}

// Roll daily bars up into one timeframe. Each output bar keeps its period key in `k`.
export function aggregate(daily, tf, sunStart = false) {
  const out = [];
  for (const b of daily) {
    const k = KEY[tf](b.d, sunStart);
    const last = out[out.length - 1];
    if (last && last.k === k) {
      last.h = Math.max(last.h, b.h);
      last.l = Math.min(last.l, b.l);
      last.c = b.c;
      last.d = b.d;
    } else {
      out.push({ k, d: b.d, o: b.o, h: b.h, l: b.l, c: b.c });
    }
  }
  return out;
}

// Current-bar state on one timeframe: { s, g, q: last 3 scenarios, qg: their colors (oldest first) }.
export function lastState(bars) {
  if (bars.length < 2) return null;
  const n = bars.length;
  const q = [], qg = [];
  for (let i = Math.max(1, n - 3); i < n; i++) { q.push(scenario(bars[i], bars[i - 1])); qg.push(color(bars[i])); }
  return { s: q[q.length - 1], g: color(bars[n - 1]), q, qg };
}

// TheStrat signal in force on the current bar, named as in the TheStrat docs (thestrat.ai/docs):
//   FAILED 2U / 2D           a 2 closing against its break (a 2 going 3)
//   2-1-2 REV / CONT         2, inside bar, 2 against / with the first 2
//   3-1-2 REV / CONT         3, inside bar, 2 against / with the color of the 3
//   3-2 REV / CONT           3 then a 2 through its opposite side / its own direction
//   1-2-2 REV, 3-2-2 REV, 2-2 REV   a 2 reversed straight back by the opposite 2
// Returns { dir, name, kind: "rev" | "cont" | "failed" | "signal", doc } or null.
export function reversal(st) {
  if (!st?.q) return null;
  const n = st.q.length;
  const c = st.q[n - 1], b = st.q[n - 2] ?? null, a = st.q[n - 3] ?? null;
  const gb = st.qg?.[n - 2], ga = st.qg?.[n - 3];
  const up = c === "2u", dn = c === "2d";
  if (!up && !dn) return null;
  const dir = up ? 1 : -1, against = up ? "2d" : "2u";
  const sig = (base, g3, doc) => {
    // REV when the 2 counters the color of the 3, CONT when it confirms it. Unknown color: plain name.
    if (!g3) return { dir, name: base, kind: "signal", doc };
    const rev = (up && g3 < 0) || (dn && g3 > 0);
    return { dir, name: `${base} ${rev ? "REV" : "CONT"}`, kind: rev ? "rev" : "cont", doc };
  };
  if (up && st.g < 0) return { dir: -1, name: "FAILED 2U", kind: "failed", doc: "failed2" };
  if (dn && st.g > 0) return { dir: 1, name: "FAILED 2D", kind: "failed", doc: "failed2" };
  if (b === "1" && a === "3") return sig("3-1-2", ga, "3-1-2");
  if (b === "1" && (a === "2u" || a === "2d")) {
    return a === against ? { dir, name: "2-1-2 REV", kind: "rev", doc: "2-1-2r" } : { dir, name: "2-1-2 CONT", kind: "cont", doc: "2-1-2c" };
  }
  if (b === "3") return sig("3-2", gb, "3-2");
  if (b === against) {
    if (a === "1") return { dir, name: "1-2-2 REV", kind: "rev", doc: "1-2-2" };
    if (a === "3") return { dir, name: "3-2-2 REV", kind: "rev", doc: "3-2-2" };
    return { dir, name: "2-2 REV", kind: "rev", doc: "2-2" };
  }
  return null;
}
export const isTurn = (r) => !!r && (r.kind === "rev" || r.kind === "failed");

// Who controls the bar, in plain words, and a score from -1 to +1.
// A 2u that closes red is a failed break up; a 2d that closes green is a failed break down.
export function control(st) {
  if (!st) return { label: "NO DATA", score: 0 };
  const { s, g } = st;
  if (s === "1") return { label: "COILING", score: 0 };
  if (s === "3") return g > 0 ? { label: "BUYERS WON THE FIGHT", score: 0.5 } : g < 0 ? { label: "SELLERS WON THE FIGHT", score: -0.5 } : { label: "DEAD HEAT", score: 0 };
  if (s === "2u") return g >= 0 ? { label: "BUYERS IN CONTROL", score: 1 } : { label: "BREAKOUT FAILING", score: -0.25 };
  return g <= 0 ? { label: "SELLERS IN CONTROL", score: -1 } : { label: "BREAKDOWN FAILING", score: 0.25 };
}

// Full Timeframe Continuity: every timeframe bar green (up) or every one red (down).
export function continuity(tfStates) {
  const gs = TIMEFRAMES.map((tf) => tfStates[tf]?.g).filter((g) => g !== undefined);
  if (!gs.length) return 0;
  if (gs.every((g) => g > 0)) return 1;
  if (gs.every((g) => g < 0)) return -1;
  return 0;
}

// Chart shape of the last n bars: o,h,l,c scaled to 0-999 inside that window, plus each bar's scenario.
// Price levels cannot be read back from it.
export function spark(bars, n = 15) {
  const from = Math.max(0, bars.length - n);
  const win = bars.slice(from);
  if (!win.length) return null;
  const lo = Math.min(...win.map((b) => b.l)), hi = Math.max(...win.map((b) => b.h));
  const k = hi > lo ? 999 / (hi - lo) : 0;
  const z = (v) => Math.round((v - lo) * k);
  return {
    c: win.flatMap((b) => [z(b.o), z(b.h), z(b.l), z(b.c)]),
    s: win.map((b, i) => (from + i > 0 ? scenario(b, bars[from + i - 1]) : "")),
  };
}

// Everything we publish for one market: labels and chart shapes only, never prices.
// Markets that trade on Sundays (Sunday-Thursday weeks) start their week on Sunday.
// 24/7 markets (crypto) trade every day, so they keep Monday weeks.
export function sundayWeek(daily) {
  const days = daily.map((b) => new Date(b.d + "T00:00:00Z").getUTCDay());
  const sun = days.filter((x) => x === 0).length, sat = days.filter((x) => x === 6).length;
  return sun > daily.length * 0.1 && sat < daily.length * 0.05;
}

export function analyze(daily, histDays = 90) {
  const sun = sundayWeek(daily);
  const tf = {}, sp = {};
  for (const t of TIMEFRAMES) {
    const bars = aggregate(daily, t, sun);
    tf[t] = lastState(bars);
    sp[t] = spark(bars);
  }
  const hist = [];
  for (let i = Math.max(1, daily.length - histDays); i < daily.length; i++) {
    hist.push([daily[i].d, scenario(daily[i], daily[i - 1]), color(daily[i])]);
  }
  return { asOf: daily[daily.length - 1]?.d ?? null, tf, hist, spark: sp };
}
