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

// Current-bar state on one timeframe: { s: scenario, g: color, q: last 3 scenarios (oldest first) }.
export function lastState(bars) {
  if (bars.length < 2) return null;
  const n = bars.length;
  const cur = bars[n - 1];
  const q = [];
  for (let i = Math.max(1, n - 3); i < n; i++) q.push(scenario(bars[i], bars[i - 1]));
  return { s: q[q.length - 1], g: color(cur), q };
}

// TheStrat reversal in force on the current bar, or null.
// Returns { dir: 1 up / -1 down, name, story } — longest pattern first.
export function reversal(st) {
  if (!st?.q) return null;
  const [a, b, c] = st.q.length === 3 ? st.q : [null, ...st.q.slice(-2)];
  const up = c === "2u", dn = c === "2d";
  if (!up && !dn) return null;
  if (up && st.g < 0) return { dir: -1, name: "FAILED 2U", story: "Price broke the high but is closing red. Buyers are failing." };
  if (dn && st.g > 0) return { dir: 1, name: "FAILED 2D", story: "Price broke the low but is closing green. Sellers are failing." };
  const dir = up ? 1 : -1;
  const against = up ? "2d" : "2u";
  if (a === against && b === "1") return { dir, name: up ? "2-1-2 UP" : "2-1-2 DOWN", story: up ? "Sellers pushed, paused, then buyers broke out." : "Buyers pushed, paused, then sellers broke down." };
  if (a === "3" && b === "1") return { dir, name: up ? "3-1-2 UP" : "3-1-2 DOWN", story: up ? "A big fight, a pause, then buyers broke out." : "A big fight, a pause, then sellers broke down." };
  if (a === "1" && b === against) return { dir, name: up ? "1-2-2 UP" : "1-2-2 DOWN", story: up ? "Sellers broke out of a pause, failed, and buyers took over." : "Buyers broke out of a pause, failed, and sellers took over." };
  if (b === against) return { dir, name: up ? "2-2 UP" : "2-2 DOWN", story: up ? "Sellers had control last bar. Buyers took it back this bar." : "Buyers had control last bar. Sellers took it back this bar." };
  return null;
}

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
