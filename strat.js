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

function weekKey(d) {
  // Monday of the week, in UTC (dates are already exchange-local calendar days).
  const t = new Date(d + "T00:00:00Z");
  const dow = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dow);
  return t.toISOString().slice(0, 10);
}

const KEY = {
  D: (d) => d,
  W: weekKey,
  M: (d) => d.slice(0, 7),
  Q: (d) => `${d.slice(0, 4)}-Q${Math.floor((+d.slice(5, 7) - 1) / 3) + 1}`,
  Y: (d) => d.slice(0, 4),
};

// Roll daily bars up into one timeframe. Each output bar keeps its period key in `k`.
export function aggregate(daily, tf) {
  const out = [];
  for (const b of daily) {
    const k = KEY[tf](b.d);
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

// Current-bar state on one timeframe: { s: scenario, g: color }.
export function lastState(bars) {
  if (bars.length < 2) return null;
  const cur = bars[bars.length - 1];
  return { s: scenario(cur, bars[bars.length - 2]), g: color(cur) };
}

// Who controls the bar, in plain words, and a score from -1 to +1.
// A 2u that closes red is a failed break up; a 2d that closes green is a failed break down.
export function control(st) {
  if (!st) return { label: "NO DATA", score: 0 };
  const { s, g } = st;
  if (s === "1") return { label: "COILING", score: 0 };
  if (s === "3") return g >= 0 ? { label: "BUYERS WON THE FIGHT", score: 0.5 } : { label: "SELLERS WON THE FIGHT", score: -0.5 };
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

// Everything we publish for one market: labels only, never prices.
export function analyze(daily, histDays = 90) {
  const tf = {};
  for (const t of TIMEFRAMES) tf[t] = lastState(aggregate(daily, t));
  const hist = [];
  for (let i = Math.max(1, daily.length - histDays); i < daily.length; i++) {
    hist.push([daily[i].d, scenario(daily[i], daily[i - 1]), color(daily[i])]);
  }
  return { asOf: daily[daily.length - 1]?.d ?? null, tf, hist };
}
