import assert from "node:assert/strict";
import { scenario, aggregate, analyze, control, continuity, sundayWeek, reversal, spark } from "../strat.js";
import { parseChart, isLive } from "../yahoo.js";

const b = (d, o, h, l, c) => ({ d, o, h, l, c });

// Scenarios
assert.equal(scenario(b("", 0, 10, 5, 0), b("", 0, 10, 5, 0)), "1"); // equal high/low = inside
assert.equal(scenario(b("", 0, 11, 5, 0), b("", 0, 10, 5, 0)), "2u");
assert.equal(scenario(b("", 0, 10, 4, 0), b("", 0, 10, 5, 0)), "2d");
assert.equal(scenario(b("", 0, 11, 4, 0), b("", 0, 10, 5, 0)), "3");

// Weekly roll-up: Mon 2026-10-05 .. Fri 2026-10-09 is one week, 2026-10-12 starts the next.
const daily = [
  b("2026-09-30", 10, 12, 9, 11), // Wed, prior week
  b("2026-10-02", 11, 13, 10, 12), // Fri, prior week -> week1 H13 L9
  b("2026-10-05", 12, 14, 11, 13), // Mon
  b("2026-10-09", 13, 15, 10, 14), // Fri -> week2 H15 L10 (2u, green)
];
const w = aggregate(daily, "W");
assert.equal(w.length, 2);
assert.deepEqual([w[1].o, w[1].h, w[1].l, w[1].c], [12, 15, 10, 14]);
const m = aggregate(daily, "M");
assert.deepEqual(m.map((x) => x.k), ["2026-09", "2026-10"]);
assert.equal(aggregate(daily, "Q")[1].k, "2026-Q4");

const a = analyze(daily);
assert.equal(a.tf.W.s, "2u");
assert.equal(a.tf.W.g, 1);
assert.equal(a.tf.M.s, "2u"); // Oct H15 > Sep H12, Oct L10 > Sep L9
assert.equal(a.tf.Y, null); // one year of data only
assert.equal(a.hist.length, 3);

// Plain-word control
assert.equal(control({ s: "2u", g: 1 }).label, "BUYERS IN CONTROL");
assert.equal(control({ s: "2u", g: -1 }).label, "BREAKOUT FAILING");
assert.equal(control({ s: "2d", g: -1 }).score, -1);
assert.equal(continuity({ D: { g: 1 }, W: { g: 1 }, M: { g: 1 } }), 1);
assert.equal(continuity({ D: { g: 1 }, W: { g: -1 } }), 0);

// Sunday-start weeks: Sun 2026-10-04 and Thu 2026-10-08 are one week; Sun 2026-10-11 starts the next.
const sa = [b("2026-10-04", 1, 2, 1, 2), b("2026-10-08", 1, 2, 1, 2), b("2026-10-11", 1, 2, 1, 2)];
assert.deepEqual(aggregate(sa, "W", true).map((w) => w.d), ["2026-10-08", "2026-10-11"]);
assert.deepEqual(aggregate(sa, "W", false).map((w) => w.d), ["2026-10-04", "2026-10-11"]); // Monday weeks put each Sunday in the week before
const tadawul = [];
for (let d = new Date("2026-06-07T00:00:00Z"); tadawul.length < 60; d.setUTCDate(d.getUTCDate() + 1)) {
  if (d.getUTCDay() <= 4) tadawul.push(b(d.toISOString().slice(0, 10), 1, 2, 1, 2));
}
assert.equal(sundayWeek(tadawul), true);
assert.equal(sundayWeek(daily), false);
assert.equal(control({ s: "3", g: 0 }).score, 0);

// Yahoo parser: exchange-local dates with per-bar DST, zero rows dropped, missing last close filled.
const ts = (iso) => Date.parse(iso) / 1000;
const chart = (rows, meta = {}) => ({ chart: { result: [{ meta: { exchangeTimezoneName: "America/New_York", ...meta },
  timestamp: rows.map((r) => ts(r[0])), indicators: { quote: [{ open: rows.map((r) => r[1]), high: rows.map((r) => r[2]), low: rows.map((r) => r[3]), close: rows.map((r) => r[4]) }] } }] } });
const p = parseChart(chart([
  ["2026-07-01T04:00:00Z", 10, 11, 9, 10], // midnight New York in summer (EDT) -> 2026-07-01
  ["2026-12-01T05:00:00Z", 10, 11, 9, 10], // midnight New York in winter (EST) -> 2026-12-01
  ["2026-12-02T05:00:00Z", 0, 0, 0, null], // broken row -> dropped
  ["2026-12-03T05:00:00Z", 10, 12, 9, null], // last row, close missing -> filled
], { regularMarketPrice: 11.5 }));
assert.deepEqual(p.map((x) => x.d), ["2026-07-01", "2026-12-01", "2026-12-03"]);
assert.equal(p[2].c, 11.5);
const day = ts("2026-10-08T14:00:00Z");
const live = { chart: { result: [{ meta: { exchangeTimezoneName: "UTC", currentTradingPeriod: { regular: { start: day - 3600, end: day + 3600 } } }, timestamp: [day - 600] }] } };
assert.equal(isLive(live, day), true);
assert.equal(isLive(live, day + 7200), false); // session closed
live.chart.result[0].timestamp = [day - 86400];
assert.equal(isLive(live, day), false); // last bar is yesterday's

// Reversals
assert.equal(reversal({ q: ["2d", "1", "2u"], g: 1 }).name, "2-1-2 UP");
assert.equal(reversal({ q: ["2d", "1", "2u"], g: -1 }).name, "FAILED 2U"); // a red 2u is not a reversal up
assert.equal(reversal({ q: ["2u", "1", "2d"], g: -1 }).name, "2-1-2 DOWN");
assert.equal(reversal({ q: ["3", "1", "2u"], g: 1 }).name, "3-1-2 UP");
assert.equal(reversal({ q: ["1", "2u", "2d"], g: -1 }).name, "1-2-2 DOWN");
assert.equal(reversal({ q: ["2u", "2d", "2u"], g: 1 }).name, "2-2 UP");
assert.equal(reversal({ q: ["2u", "2u", "2u"], g: -1 }).name, "FAILED 2U");
assert.equal(reversal({ q: ["2u", "2u", "2u"], g: 1 }), null); // continuation, not a reversal
assert.equal(reversal({ q: ["2d", "1", "1"], g: 1 }), null);
assert.deepEqual(a.tf.W.q, ["2u"]); // only two weeks of data -> one scenario

// Chart shapes: scaled 0-999 inside the window, scenario per bar.
const sp = spark([b("a", 10, 12, 9, 11), b("b", 11, 14, 10, 13), b("c", 13, 13, 10, 10)], 2);
assert.deepEqual(sp.c, [250, 999, 0, 749, 749, 749, 0, 0]); // (13-10) * 999 / 4 = 749.25
assert.deepEqual(sp.s, ["2u", "1"]);
assert.equal(spark([b("a", 5, 5, 5, 5)]).c.every((v) => v === 0), true); // flat window
assert.equal(a.spark.D.c.length, 4 * 4);

console.log("strat engine: all tests pass");
