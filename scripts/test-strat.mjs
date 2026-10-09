import assert from "node:assert/strict";
import { scenario, aggregate, analyze, control, continuity } from "../strat.js";

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

console.log("strat engine: all tests pass");
