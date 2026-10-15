// Crypto layer cake: the God's Eye View globe in another shape. Each tier of the cake is one layer of the
// crypto market, each slice of a tier is one market, and the arcs show rotation between the layers.
// Same TheStrat engine (strat.js), same data shape (signals.js), same owner vault (vault.js) as the globe.
// Owner prototype: the page reads data/crypto.json (run-your-own copy) or data/crypto.enc.json (owner password).
import { LAYERS } from "./crypto-universe.js?v=1";
import { TIMEFRAMES, control, continuity, reversal, isTurn, decodeState, periodKey } from "./strat.js?v=6";
import { unseal } from "./vault.js?v=6";

const TF_NAME = { D: "Today", W: "This week", M: "This month", Q: "This quarter", Y: "This year" };
const TF_WORD = { D: "day", W: "week", M: "month", Q: "quarter", Y: "year" };
const TF_HUD = { D: "DAY", W: "WEEK", M: "MONTH", Q: "QUARTER", Y: "YEAR" };
const TF_BTN = { D: "Day", W: "Week", M: "Month", Q: "Qtr", Y: "Year" };
const TF_PREV = { D: "yesterday's", W: "last week's", M: "last month's", Q: "last quarter's", Y: "last year's" };
const S_LABEL = { "1": "1", "2u": "2U", "2d": "2D", "3": "3" };
const ic = (inner) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const ICON = {
  play: ic('<path d="M7 5v14l11-7z" fill="currentColor" stroke="none"/>'),
  stop: ic('<rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" stroke="none"/>'),
};
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const LAYER = new Map(LAYERS.map((l, i) => [l.id, { ...l, i }]));

// Tooltip text quoted word for word from the TheStrat docs (thestrat.ai/docs). Same quotes as the globe page.
const DOCS = {
  "1": { t: "1 · Inside bar", src: "inside-bar", q: "The inside bar (Scenario 1) is an equilibrium: neither side took out the prior bar’s extremes. It must at least attempt to break, and which way it resolves is the signal." },
  "2u": { t: "2U · Directional bar up", src: "price-only-trades-in-3-ways", q: "A 2u took out the prior high: buyers were willing to pay up. … A 2 is a trend: it shows you which group has control." },
  "2d": { t: "2D · Directional bar down", src: "price-only-trades-in-3-ways", q: "A 2d took out the prior low: sellers were willing to sell down. A 2 is a trend: it shows you which group has control." },
  "3": { t: "3 · Outside bar", src: "price-only-trades-in-3-ways", q: "Both sides broke. And unlike a 2, a 3 shows you both buyer and seller aggression in the same bar: sellers sold down through the prior low, then buyers bought up through the prior high, or the reverse." },
  ftfc: { t: "FTFC · Full Timeframe Continuity", src: "full-timeframe-continuity", q: "Full timeframe continuity (FTFC) is the state where the last sale is on the same side of four aligned timeframe opens. … Investing continuity: yearly, quarterly, monthly, weekly. Or run them all at once: Y Q M W D 60 30 15 5.", note: "On this page: FTFC UP = last sale above the year, quarter, month, week and day opens. FTFC DN = below all five." },
  failed2: { t: "Failed 2", src: "price-only-trades-in-3-ways", q: "A 2u trading red is a failed 2: buyers broke the prior high and sellers took the bar back, so it is a 2 going 3 and counts as evidence toward the new direction, not proof that buyers still have control." },
  "2-2": { t: "2-2 REV", src: "2-2-reversal", q: "A 2-2 reversal is a breakout bar reversed straight back: a 2u followed by a 2d, or a 2d followed by a 2u." },
  "1-2-2": { t: "1-2-2 REV · Two-bar rev-strat", src: "1-2-2", q: "The 1-2-2 is the two-bar rev-strat: an inside bar breaks in one direction, the break fails, and the next bar reverses through the failed-break bar’s extreme." },
  "3-2-2": { t: "3-2-2 REV", src: "2-2-reversal", q: "The 3-2-2: an outside bar in front, a 2-2 reversal with a larger magnitude, trading back through a broadening formation." },
  "2-1-2r": { t: "2-1-2 REV", src: "inside-bar", q: "2d-1-2u or 2u-1-2d: the break goes against the first move, trapping everyone who rode it through the pause." },
  "2-1-2c": { t: "2-1-2 CONT", src: "inside-bar", q: "2u-1-2u or 2d-1-2d: the break goes with the first move. Most commonly used as a measured move: large move, brief pause, equal move." },
  "3-1-2": { t: "3-1-2 · 312 Chicago", src: "3-1-2", q: "The 3-1-2, also called the “312 Chicago,” is an expansion (3) followed by a contraction or consolidation (1) followed by a directional move (2). … Reversal: the 2 counters the color of the 3. Continuation: the 2 confirms the color of the 3." },
  "3-2": { t: "3-2", src: "3-2", q: "A 3-2 is an outside bar (3) followed directly by a 2 that breaks one of its sides. Break of the 3 bar’s opposite side is a reversal; break in the 3 bar’s direction is a continuation." },
  reversal: { t: "Reversal", src: "types-of-reversals", q: "A reversal is a sequence of scenarios that changes trend, with a defined trigger and target." },
};
const tipAttr = (key, extra = "") => (DOCS[key] ? ` data-tip="${key}"${extra ? ` data-tipx="${esc(extra)}"` : ""}` : "");
const docAttr = (key, extra = "") => (DOCS[key] ? `${tipAttr(key, extra)} data-doc="${key}" role="link"` : "");
const docsUrl = (key) => `https://thestrat.ai/docs/${DOCS[key].src}/`;
const SIGNAL_STORY = {
  rev: ["Sellers had control. Buyers took it back.", "Buyers had control. Sellers took it back."],
  cont: ["Buyers paused, then pushed on.", "Sellers paused, then pushed on."],
  failed: ["Sellers broke the low but buyers are taking the bar back.", "Buyers broke the high but sellers are taking the bar back."],
  signal: ["Breaking up out of the pattern.", "Breaking down out of the pattern."],
};
const story = (r) => SIGNAL_STORY[r.kind][r.dir > 0 ? 0 : 1];

const state = { tf: "D", sensor: "normal", flow: "control", replayStep: "bar", replayRange: null, data: null, views: {}, focus: null, focusSym: null, hover: null, frame: null, revAll: false };

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const gClass = (g) => (g > 0 ? "g-up" : g < 0 ? "g-down" : "");
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const mod = (v, n) => ((v % n) + n) % n;
const joinWords = (w) => (w.length < 2 ? w.join("") : `${w.slice(0, -1).join(", ")} and ${w.at(-1)}`);
const tk = (m) => `<span class="cc">${esc(m.t)}</span>`;
const local = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

/* ---------- Data and gates (same keys as the globe page, so one agreement and one password serve both) ---------- */

const GATE_KEY = "gev-personal-use-v1";
const GATE_DAYS = 30;
const PW_KEY = "gev-owner-pass";

function personalUseGate() {
  const t = Number(local.get(GATE_KEY));
  if (t && Date.now() - t < GATE_DAYS * 864e5) return Promise.resolve();
  const gate = $("#gate");
  gate.hidden = false;
  $("#gateAgree").focus();
  return new Promise((resolve) => {
    $("#gateAgree").addEventListener("click", () => {
      local.set(GATE_KEY, String(Date.now()));
      gate.hidden = true;
      resolve();
    }, { once: true });
  });
}

async function loadData() {
  try {
    const r = await fetch("data/crypto.json", { cache: "no-cache" });
    if (r.ok) return { plain: await r.json() };
  } catch {}
  try {
    const r = await fetch("data/crypto.enc.json", { cache: "no-cache" });
    if (r.ok) return { vault: await r.json() };
  } catch {}
  return {};
}

async function openVault(vault, pw) {
  try { return await unseal(vault, pw); } catch { return null; }
}

// Owner password. Without a vault there is nothing to open: the page says so and stops.
function ownerGate(vault) {
  $("#ownergate").hidden = false;
  if (!vault) {
    $("#ogText").textContent = "This page is an owner prototype. No data is published for it here yet.";
    $("#ogRow").hidden = true;
    $("#ogRemember").hidden = true;
    return new Promise(() => {});
  }
  $("#ownerPass").focus();
  return new Promise((resolve) => {
    $("#ogForm").onsubmit = async (e) => {
      e.preventDefault();
      const pw = $("#ownerPass").value;
      if (!pw) return;
      $("#ownerMsg").textContent = "Unlocking…";
      const data = await openVault(vault, pw);
      if (!data) { $("#ownerMsg").textContent = "Wrong password."; return; }
      if ($("#ownerRemember").checked) local.set(PW_KEY, pw);
      $("#ownergate").hidden = true;
      resolve(data);
    };
  });
}

/* ---------- Analysis ---------- */

function verdictOf(score, members, tf) {
  if (score >= 0.5) return "BUY";
  if (score <= -0.5) return "SELL";
  const inside = members.filter((m) => m.tf[tf]?.s === "1").length;
  if (inside * 2 >= members.length) return "COILING";
  return score > 0 ? "LEANING UP" : score < 0 ? "LEANING DOWN" : "UNDECIDED";
}
const VERDICT_WORDS = { BUY: "Buyers in control", SELL: "Sellers in control", COILING: "Coiling inside the last bar", "LEANING UP": "Leaning up", "LEANING DOWN": "Leaning down", UNDECIDED: "Undecided" };
const vClass = (v) => (v === "BUY" ? "buy" : v === "SELL" ? "sell" : "");
const coinVerdict = (st) => {
  if (!st) return "NO DATA";
  const s = control(st).score;
  return s >= 0.5 ? "BUYERS" : s <= -0.5 ? "SELLERS" : s === 0 ? "COILING" : s > 0 ? "LEANING UP" : "LEANING DOWN";
};

let tiers = {}; // layer id -> every market of the layer, in universe order (the slices of the tier)

// One view per layer: its markets on this timeframe and the mean of their control scores.
function buildViews(tf) {
  const views = {};
  for (const L of LAYER.values()) {
    const members = (tiers[L.id] ?? []).filter((m) => m.tf[tf]);
    if (!members.length) continue;
    const score = mean(members.map((m) => control(m.tf[tf]).score));
    views[L.id] = {
      ...L, members, score, verdict: verdictOf(score, members, tf),
      up: members.filter((m) => m.tf[tf].s === "2u").length, down: members.filter((m) => m.tf[tf].s === "2d").length,
    };
  }
  return views;
}

// Rotation pairs: from the layers where sellers control the bar to the layers where buyers do.
// The arcs show where pressure sits, not tracked transfers.
function flowPairs(scoreOf, min = 0.25) {
  const pts = Object.values(state.views).map((v) => ({ id: v.id, i: v.i, s: scoreOf(v.id) })).filter((p) => p.s !== undefined);
  const src = pts.filter((p) => p.s <= -min).sort((a, b) => a.s - b.s);
  const dst = pts.filter((p) => p.s >= min).sort((a, b) => b.s - a.s);
  if (!src.length || !dst.length) return { src, dst, pairs: [] };
  const pairs = [];
  const add = (a, b) => pairs.push({ a, b, w: -a.s * b.s, phase: (pairs.length * 0.37) % 1 });
  src.forEach((a, i) => { for (let j = 0; j < Math.min(2, dst.length); j++) add(a, dst[(i + j) % dst.length]); });
  dst.forEach((b, j) => { if (!pairs.some((p) => p.b === b)) add(src[j % src.length], b); });
  pairs.forEach((p) => { p.w = Math.max(p.w, 0.3); });
  return { src, dst, pairs };
}

// Net reversal direction of a layer's markets: +1 all reversing up, -1 all reversing down.
function revScore(id, tf = state.tf) {
  const v = state.views[id];
  if (!v) return undefined;
  return mean(v.members.map((m) => { const r = reversal(m.tf[tf]); return isTurn(r) ? r.dir : 0; }));
}
const FLOW_MIN = { control: 0.25, reversal: 0.01 };

function explain(st, word) {
  if (!st) return "Not enough history yet.";
  const { s, g } = st;
  if (s === "1") return `Still inside last ${word}'s range. Pressure is building. Watch which side breaks first.`;
  if (s === "3") return g === 0 ? `Broke BOTH sides of last ${word}'s range. The fight is a draw so far.` : `Broke BOTH sides of last ${word}'s range. ${g > 0 ? "Buyers" : "Sellers"} are winning the fight.`;
  if (s === "2u") return g >= 0 ? `Broke above last ${word}'s high and is holding. Buyers in control.` : `Broke above last ${word}'s high, but buyers cannot hold it. Watch for a turn down.`;
  return g <= 0 ? `Broke below last ${word}'s low and is staying down. Sellers in control.` : `Broke below last ${word}'s low, but buyers pushed it back. Watch for a turn up.`;
}

function counts(pool, tf) {
  const n = { "2u": 0, "2d": 0, "1": 0, "3": 0 };
  pool.forEach((m) => n[m.tf[tf].s]++);
  return n;
}

/* ---------- Render: situation report ---------- */

function renderIntel() {
  const { tf } = state;
  const pool = state.data.markets.filter((m) => m.tf[tf]);
  const n = counts(pool, tf);
  const views = Object.values(state.views);
  const buys = views.filter((v) => v.verdict === "BUY").length;
  const sells = views.filter((v) => v.verdict === "SELL").length;
  const when = tf === "D" ? "today" : `this ${TF_WORD[tf]}`;
  const names = (arr) => joinWords(arr.slice(0, 3).map((p) => esc(state.views[p.id].name)));

  let head;
  if (!n["2u"] && !n["2d"]) head = `${TF_NAME[tf]}, almost nothing broke out. Crypto is coiling.`;
  else if (n["2d"] > n["2u"]) head = `${TF_NAME[tf]}, <span class="down">${n["2d"]} of ${pool.length}</span> crypto markets broke below ${TF_PREV[tf]} low.`;
  else head = `${TF_NAME[tf]}, <span class="up">${n["2u"]} of ${pool.length}</span> crypto markets broke above ${TF_PREV[tf]} high.`;
  let sub = `Sellers control ${sells} of ${views.length} layers. Buyers control ${buys}. ${views.length - buys - sells} are undecided. Headlines tell stories. Price tells the truth.`;
  if (state.flow === "reversal") {
    const { src, dst } = flowPairs((id) => revScore(id), FLOW_MIN.reversal);
    head = src.length && dst.length
      ? `${TF_NAME[tf]}, money is leaving <span class="down">${names(src)}</span> and going to <span class="up">${names(dst)}</span>.`
      : `${TF_NAME[tf]}, money is not changing layers yet. No clear reversals on both sides.`;
    const turns = state.data.markets.map((m) => reversal(m.tf[tf])).filter(isTurn);
    const up = turns.filter((r) => r.dir > 0).length;
    sub = `${up} markets reversed up and ${turns.length - up} reversed down on the ${TF_WORD[tf]}. A reversal is the moment control of the price flips. Headlines tell stories. Price tells the truth.`;
  }
  $("#headline").innerHTML = head;
  $("#hudHeadline").innerHTML = head;
  $("#subline").textContent = sub;

  $("#counts").innerHTML = [
    ["up", n["2u"], "Broke the high", "2U"],
    ["down", n["2d"], "Broke the low", "2D"],
    ["", n["1"], "Coiling", "1"],
    ["out", n["3"], "Broke both", "3"],
  ].map(([c, v, l, code], i) => `<div class="count ${c}"${docAttr(["2u", "2d", "1", "3"][i])}><b>${v}</b><span>${l} <em>${code}</em></span></div>`).join("");

  // Bitcoin against every other coin (the Wall Street tier is left out: it is not a coin).
  const btc = state.data.markets.find((m) => m.symbol === "BTC-USD")?.tf[tf];
  const alts = state.data.markets.filter((m) => m.kind === "coin" && m.symbol !== "BTC-USD" && m.tf[tf]);
  const bs = btc ? control(btc).score : 0, as = mean(alts.map((m) => control(m.tf[tf]).score));
  const den = bs + as + 2, share = den ? (bs + 1) / den : 0.5, gap = bs - as;
  $("#tugBtc").style.width = `${share * 100}%`;
  $("#tugAlt").style.width = `${(1 - share) * 100}%`;
  $("#tugBtc").style.background = bs >= 0 ? "var(--up)" : "var(--down)";
  $("#tugAlt").style.background = as >= 0 ? "var(--up)" : "var(--down)";
  $("#tugVerdict").textContent = Math.abs(gap) < 0.15 ? "Dead even" : gap > 0 ? "← Money favors Bitcoin" : "Money favors altcoins →";
  $("#tugBtcTxt").textContent = btc ? `BTC ${S_LABEL[btc.s]} · ${control(btc).label}` : "BTC –";
  $("#tugAltTxt").textContent = `▲${alts.filter((m) => m.tf[tf].s === "2u").length} ▼${alts.filter((m) => m.tf[tf].s === "2d").length} of ${alts.length}`;

  // Layers, strongest first: the relative picture, also when every layer is on the same side.
  const ranked = [...views].sort((a, b) => b.score - a.score);
  $("#layerList").innerHTML = `<div class="ll-k">Layers, strongest first on the ${TF_WORD[tf]}</div>` + ranked.map((v) =>
    `<button class="rk-row" data-layer="${v.id}"><span class="rk-name">${esc(v.name)}</span>
      <span class="rk-acts"><span class="ll-n"><span class="up">▲${v.up}</span> <span class="down">▼${v.down}</span> of ${v.members.length}</span><span class="verdict ${vClass(v.verdict)}">${esc(v.verdict)}</span></span></button>`).join("");

  $("#insights").innerHTML = insights().map((t) => `<li>${t}</li>`).join("");

  const rev = state.flow === "reversal";
  const { src, dst } = rev ? flowPairs((id) => revScore(id), FLOW_MIN.reversal) : flowPairs((id) => state.views[id]?.score);
  const k = `<span class="flow-k">Rotation ${when}</span>`;
  let line;
  if (src.length && dst.length) line = `Out of <b class="down">${names(src)}</b> <span class="flow-arrow">→</span> into <b class="up">${names(dst)}</b>`;
  else if (views.length && src.length === views.length) line = "No rotation. Selling pressure is in every layer.";
  else if (views.length && dst.length === views.length) line = "No rotation. Buying pressure is in every layer.";
  else if (src.length) line = `Selling pressure is in <b class="down">${names(src)}</b>. No layer has buying pressure: money is leaving, not rotating.`;
  else if (dst.length) line = `Buying pressure is in <b class="up">${names(dst)}</b>. No layer has selling pressure: money is arriving, not rotating.`;
  else line = "No clear rotation. No layer has clear buying or selling pressure.";
  $("#flowLine").hidden = state.flow !== "control"; // in reversal mode the headline says it
  $("#flowLine").innerHTML = k + line;
}

function insights() {
  const { tf } = state;
  const out = [];
  const ms = state.data.markets;
  const revs = ms.map((m) => reversal(m.tf[tf])).filter(isTurn);
  const ru = revs.filter((r) => r.dir > 0).length, rd = revs.length - ru;
  if (revs.length) out.push(`↺ <b>${ru}</b> ${ru === 1 ? "market is" : "markets are"} reversing up and <b>${rd}</b> ${rd === 1 ? "is" : "are"} reversing down this ${TF_WORD[tf]}. <a href="#reversals">See them</a>.`);
  const full = (dir) => ms.filter((m) => continuity(m.tf) === dir);
  const some = (arr) => `${joinWords(arr.slice(0, 4).map((m) => esc(m.name)))}${arr.length > 4 ? ` and ${arr.length - 4} more` : ""}`;
  const up = full(1), dn = full(-1);
  if (up.length) out.push(`<b${docAttr("ftfc")}>FTFC UP</b> (green on all 5 timeframes): ${some(up)}.`);
  if (dn.length) out.push(`<b${docAttr("ftfc")}>FTFC DN</b> (red on all 5 timeframes): ${some(dn)}.`);
  const btc = ms.find((m) => m.symbol === "BTC-USD");
  if (btc?.tf[tf]) out.push(`<b>Bitcoin</b>, ${S_LABEL[btc.tf[tf].s]} on the ${TF_WORD[tf]}: ${esc(explain(btc.tf[tf], TF_WORD[tf]))}`);
  return out;
}

/* ---------- Render: layer tiles ---------- */

function cells(m, selTf) {
  return TIMEFRAMES.map((t) => {
    const st = m?.tf[t];
    if (!st) return `<span class="cell none"><small>${t}</small>–</span>`;
    const rev = reversal(st);
    const extra = `${m.name} · ${TF_WORD[t]}: ${explain(st, TF_WORD[t])}${rev ? ` Signal: ${rev.name}.` : ""}`;
    return `<span class="cell ${gClass(st.g)} s-${esc(st.s)}${t === selTf ? " sel" : ""}${rev ? " rev" : ""}"${tipAttr(st.s, extra)}><small>${t}</small>${S_LABEL[st.s] ?? "?"}</span>`;
  }).join("");
}

function renderLayers() {
  const { tf } = state;
  $("#layerMeta").textContent = `${state.data.markets.length} markets in ${LAYERS.length} layers, bottom tier first. Strongest first inside a layer on the ${TF_WORD[tf]}. Click one for its chart.`;
  $("#layerPanels").innerHTML = LAYERS.map((L) => {
    const v = state.views[L.id], all = tiers[L.id] ?? [];
    if (!all.length) return "";
    const sc = (m) => (m.tf[tf] ? control(m.tf[tf]).score : -9);
    const rows = [...all].sort((a, b) => sc(b) - sc(a)).map((m) => {
      const verdict = coinVerdict(m.tf[tf]), ftfc = continuity(m.tf);
      return `<button class="tile ${ftfc > 0 ? "ftfc-up" : ftfc < 0 ? "ftfc-down" : ""}${m.tf[tf] ? "" : " dim"}" data-coin="${esc(m.symbol)}">
        <div class="cap"><span class="name">${tk(m)}${esc(m.name)}</span><span class="verdict ${verdict === "BUYERS" ? "buy" : verdict === "SELLERS" ? "sell" : ""}">${verdict}</span></div>
        <div class="row five">${cells(m, tf)}</div></button>`;
    }).join("");
    return `<div class="layer-block"><h3 class="rk-group"><button data-layer="${L.id}">${esc(L.name)}</button>${v ? `<span class="verdict ${vClass(v.verdict)}">${esc(v.verdict)}</span><small>▲${v.up} ▼${v.down} OF ${v.members.length}</small>` : ""}</h3>
      <p class="rk-words">${esc(L.about)}</p><div class="grid small">${rows}</div></div>`;
  }).join("");
}

/* ---------- Render: reversals ---------- */

const REV_RANK = (r) => ({ rev: 0, failed: 1, cont: 2, signal: 3 })[r.kind] * 10 + (r.name.startsWith("2-2") ? 1 : 0);

function renderReversals() {
  const { tf } = state;
  const all = state.data.markets.map((m) => ({ m, r: reversal(m.tf[tf]) })).filter((x) => x.r);
  $("#revTfs").innerHTML = TIMEFRAMES.map((t) => `<button data-tf="${t}" class="${t === tf ? "on" : ""}">${TF_BTN[t]} <b>${state.data.markets.filter((m) => reversal(m.tf[t])).length}</b></button>`).join("");
  const col = (dir) => {
    const rows = all.filter((x) => x.r.dir === dir).sort((a, b) => REV_RANK(a.r) - REV_RANK(b.r));
    if (!rows.length) return `<div class="rev-empty">No ${dir > 0 ? "upside" : "downside"} signals on the ${TF_WORD[tf]}.</div>`;
    const open = state.revAll;
    const more = !open && rows.length > 8 ? `<button class="rev-more" data-revall="1">Show all ${rows.length}</button>` : "";
    let lastStory = "";
    return rows.slice(0, open ? rows.length : 8).map(({ m, r }) => {
      const st = story(r);
      const head = st !== lastStory ? `<h4 class="rev-group">${esc(st)}</h4>` : "";
      lastStory = st;
      return `${head}<button class="rev-row" data-coin="${esc(m.symbol)}">
        <span class="rev-name">${tk(m)}${esc(m.name)}<small>${esc(LAYER.get(m.layer)?.name ?? "")}</small></span>
        <span class="rev-chip ${dir > 0 ? "up" : "down"} k-${r.kind}"${docAttr(r.doc)}>${esc(r.name)}</span></button>`;
    }).join("") + more;
  };
  $("#revUp").innerHTML = col(1);
  $("#revDown").innerHTML = col(-1);
  const turns = all.filter((x) => isTurn(x.r)).length;
  $("#revMeta").textContent = `${turns} reversing and ${all.length - turns} continuing on the ${TF_WORD[tf]}. Hover a signal for its definition. Click it to open the TheStrat.ai docs.`;
}

/* ---------- Replay: the selected timeframe over the last 3, 6 or 12 months ---------- */

// Frames from the per-day timeline. BY BAR: one frame per completed bar. BY DAY: the bar in force on every day.
function buildReplay(tf, step, days) {
  const axis = state.data.axis;
  if (!axis?.length) return [];
  const from = Math.max(0, axis.length - days);
  const keys = axis.map((d) => periodKey(d, tf));
  const idx = [];
  for (let i = from; i < axis.length; i++) {
    if (step === "day" || tf === "D" || i === axis.length - 1 || keys[i + 1] !== keys[i]) idx.push(i);
  }
  const frames = idx.map((i) => ({ d: axis[i], scores: {}, st: {}, sum: {}, cnt: {}, rsum: {}, up: 0, down: 0 }));
  const at = new Map(idx.map((i, k) => [i, frames[k]]));
  for (const m of state.data.markets) {
    const line = m.tl?.[tf];
    if (!line) continue;
    const done = []; // final state of each completed bar
    let lastKey = null, last = null;
    for (let i = 0; i < axis.length; i++) {
      if (lastKey !== null && keys[i] !== lastKey && last) done.push(last);
      lastKey = keys[i];
      last = decodeState(line[i]);
      const f = at.get(i);
      if (!f || !last) continue;
      const sc = control(last).score;
      f.scores[m.symbol] = sc;
      f.st[m.symbol] = last.s;
      f.sum[m.layer] = (f.sum[m.layer] ?? 0) + sc;
      f.cnt[m.layer] = (f.cnt[m.layer] ?? 0) + 1;
      const prev2 = done.slice(-2);
      const r = reversal({ q: [...prev2.map((x) => x.s), last.s], qg: [...prev2.map((x) => x.g), last.g], g: last.g });
      f.rsum[m.layer] = (f.rsum[m.layer] ?? 0) + (isTurn(r) ? r.dir : 0);
      if (last.s === "2u") f.up++;
      if (last.s === "2d") f.down++;
    }
  }
  return frames.map((f) => {
    const layer = {}, rev = {};
    for (const id in f.sum) { layer[id] = f.sum[id] / f.cnt[id]; rev[id] = f.rsum[id] / f.cnt[id]; }
    return { d: f.d, scores: f.scores, st: f.st, layer, rev, up: f.up, down: f.down };
  });
}

const RANGE_DAYS = { "3M": 92, "6M": 183, "1Y": 366 }; // calendar days: coins trade every day
function replayPlan() {
  const tf = state.tf;
  const step = tf === "D" ? "day" : tf === "Y" && state.replayStep === "bar" ? "day" : state.replayStep;
  const range = state.replayRange ?? (tf === "D" ? "3M" : "1Y");
  return { tf, step, range };
}
function renderReplayControls() {
  const { tf, step, range } = replayPlan();
  setPressed("stepSeg", step);
  setPressed("rangeSeg", range);
  document.querySelector('#stepSeg [data-v="bar"]').disabled = tf === "D" || tf === "Y";
  if (!replayTimer) $("#replayBtn").innerHTML = `${ICON.play}<span>Replay ${TF_WORD[tf]} bars</span>`;
  $("#replayBtn").disabled = !state.data.axis;
}

let replayTimer = null;
function stopReplay() {
  clearInterval(replayTimer); replayTimer = null;
  state.frame = null;
  $("#hudReplay").textContent = "";
  $("#replayProg").style.width = "0";
  renderReplayControls();
  cake?.redraw();
}
function startReplay() {
  if (replayTimer) return stopReplay();
  const { tf, step, range } = replayPlan();
  const frames = buildReplay(tf, step, RANGE_DAYS[range]);
  if (!frames.length) return;
  let i = 0;
  $("#replayBtn").innerHTML = `${ICON.stop}<span>Stop</span>`;
  const every = Math.max(60, Math.min(700, 12000 / frames.length));
  replayTimer = setInterval(() => {
    if (i >= frames.length) { stopReplay(); return; }
    const f = frames[i];
    state.frame = f;
    $("#hudReplay").textContent = `REPLAY · ${TF_HUD[tf]} BARS · ${step === "day" ? "BY DAY" : "BY BAR"} · ${f.d} · ▲${f.up} ▼${f.down}`;
    $("#replayProg").style.width = `${((i + 1) / frames.length) * 100}%`;
    cake?.redraw();
    i++;
  }, every);
}

/* ---------- Mini candlestick chart (shape only): the globe page's "Precision ledger", at a fixed height ---------- */

function sparkSvg(m, tf) {
  const sp = m.spark?.[tf];
  if (!sp?.c?.length) return "";
  const n = Math.floor(sp.c.length / 4);
  if (n < 1) return "";

  const VW = 600, PT = 24, SH = 124, PH = SH - 28;
  const cw = VW / n, bw = cw * 0.56;
  const f = (v) => v.toFixed(2);
  const cl = (v) => Math.min(999, Math.max(0, Number(v) || 0));
  const yOf = (v) => PT + (1 - cl(v) / 999) * PH;
  const xOf = (i) => (i + 0.5) * cw;
  const word = TF_WORD[tf] ?? "bar";
  const live = Boolean(m.live);

  const bars = [];
  for (let i = 0; i < n; i++) {
    const [o, hi, lo, c] = sp.c.slice(i * 4, i * 4 + 4).map((v) => cl(v));
    bars.push({ o, c, hi: Math.max(hi, o, c), lo: Math.min(lo, o, c), s: String(sp.s?.[i] ?? "").toLowerCase() });
  }
  const pri = n >= 2 ? bars[n - 2] : null;
  const cur = bars[n - 1];
  const sig = reversal(m.tf[tf]);
  const dirTone = (d) => (d > 0 ? "spk-u" : d < 0 ? "spk-d" : "spk-f");

  let svg = [0.25, 0.5, 0.75].map((t) => `<line class="spk-gl" x1="0" x2="${VW}" y1="${f(PT + PH * t)}" y2="${f(PT + PH * t)}"/>`).join("");
  svg += `<rect class="spk-band" x="${f(xOf(n - 1) - cw * 0.4)}" y="${PT}" width="${f(cw * 0.8)}" height="${PH}"/>`;
  if (pri) {
    for (const v of [pri.hi, pri.lo]) svg += `<line class="spk-ln" x1="${f(xOf(n - 2))}" x2="${VW}" y1="${f(yOf(v))}" y2="${f(yOf(v))}"/>`;
  }
  bars.forEach((b, i) => {
    const k = b.c > b.o ? "spk-u" : b.c < b.o ? "spk-d" : "spk-f";
    const x = xOf(i), yo = yOf(b.o), yc = yOf(b.c);
    svg += `<line class="spk-wk ${k}" x1="${f(x)}" x2="${f(x)}" y1="${f(yOf(b.hi))}" y2="${f(yOf(b.lo))}"/>`;
    svg += `<rect class="spk-bd ${k}" x="${f(x - bw / 2)}" y="${f(Math.min(yo, yc))}" width="${f(bw)}" height="${f(Math.max(1.5, Math.abs(yo - yc)))}"/>`;
  });

  let nameHtml = "";
  if (sig) {
    const k = Math.min(n, Math.max(1, (String(sig.name).match(/\d+/g) || []).length));
    const xl = xOf(n - k) - bw / 2, xr = xOf(n - 1) + bw / 2, tone = dirTone(sig.dir);
    svg += `<path class="spk-br ${tone}" d="M${f(xl)} 20V16H${f(xr)}V20"/>`;
    nameHtml = `<span class="spk-sig ${tone}"${docAttr(sig.doc)} style="right:${f(((VW - xr) / VW) * 100)}%">${esc(sig.name)}</span>`;
  }

  let gut = "";
  if (pri) {
    let a = yOf(pri.hi) - 6, b = yOf(pri.lo) - 6;
    if (b - a < 12) { const mid = (a + b) / 2; a = mid - 6; b = mid + 6; }
    gut = `<span class="spk-lv" style="top:${f(a)}px">prior high</span><span class="spk-lv" style="top:${f(b)}px">prior low</span>`;
  }

  const lbls = bars.map((b) => {
    const k = b.s === "2u" ? "spk-u" : b.s === "2d" ? "spk-d" : b.s === "3" ? "spk-gold" : "spk-f";
    return `<span class="${k}"${b.s ? tipAttr(b.s) : ""}>${esc(S_LABEL[b.s] ?? "")}</span>`;
  }).join("");
  const nowCells = bars.map((_, i) => (i === n - 1
    ? `<div><span class="spk-tk"></span><span class="spk-nw${live ? " spk-live" : ""}">${live ? "live" : "now"}</span></div>`
    : "<div></div>")).join("");

  const unit = n === 1 ? word : `${word}s`;
  const aria = [
    `Last ${n} ${unit} of ${m.name}.`,
    S_LABEL[cur.s] ? `Current bar ${S_LABEL[cur.s]}${pri ? " against the prior bar" : ""}.` : "",
    pri ? "Dashed lines: prior bar high and low." : "",
    sig ? `Signal ${sig.name}${sig.dir > 0 ? ", up" : ", down"}.` : "",
    live ? "Current bar still trading." : "",
  ].filter(Boolean).join(" ");

  return `<div class="spk">
    <div class="spk-row">
      <div class="spk-plot" role="img" aria-label="${esc(aria)}">
        <svg class="spk-svg" viewBox="0 0 ${VW} ${SH}" style="height:${SH}px" preserveAspectRatio="none" aria-hidden="true">${svg}</svg>
        ${nameHtml}
        <div class="spk-lbls" style="grid-template-columns:repeat(${n},minmax(0,1fr))">${lbls}</div>
        <div class="spk-nows" style="grid-template-columns:repeat(${n},minmax(0,1fr))">${nowCells}</div>
      </div>
      <div class="spk-gut">${gut}</div>
    </div>
    <div class="spk-cap">Last ${n} ${unit}. Dashed lines: last ${word}'s high and low.</div>
  </div>`;
}

/* ---------- Drawer: one layer, every market in it ---------- */

function openLayer(id, sym = null, refocus = true) {
  const L = LAYER.get(id), all = tiers[id];
  if (!L || !all?.length) return;
  const { tf } = state;
  const v = state.views[id];
  state.focus = id;
  state.focusSym = sym;
  if (refocus) cake?.focus(sym);
  const sc = (m) => (m.tf[tf] ? control(m.tf[tf]).score : -9);
  const item = (m) => {
    const rev = reversal(m.tf[tf]);
    const others = TIMEFRAMES.filter((t) => t !== tf).map((t) => [t, reversal(m.tf[t])]).filter(([, r]) => r);
    return `<div class="dr-item${m.symbol === sym ? " hot" : ""}" data-sym="${esc(m.symbol)}"><div class="top"><b>${tk(m)}${esc(m.name)}</b><span>${esc(m.symbol)} · ${m.live ? '<em class="live">● LIVE BAR</em>' : `LAST BAR ${esc(m.asOf)}`}${m.stale ? " · DATA DELAYED" : ""}</span></div>
      ${sparkSvg(m, tf)}
      <div class="row five">${cells(m, tf)}</div>
      <p>${esc(explain(m.tf[tf], TF_WORD[tf]))}</p>
      ${rev ? `<p class="dr-rev ${rev.dir > 0 ? "up" : "down"}"><span${docAttr(rev.doc)}>↺ ${esc(rev.name)}</span> on the ${TF_WORD[tf]}: ${esc(story(rev))}</p>` : ""}
      ${others.length ? `<p class="dr-also">Also in force: ${others.map(([t, r]) => `${esc(r.name)} (${TF_WORD[t]})`).join(" · ")}</p>` : ""}
      <div class="seq"><em>LAST 12 DAYS</em>${m.hist.slice(-12).map(([d, s, gg]) => `<i class="${gClass(gg)}" title="${esc(d)}">${S_LABEL[s] ?? "?"}</i>`).join("")}</div></div>`;
  };
  $("#drawerBody").innerHTML = `<div class="dr-kicker">Tier ${L.i + 1} of ${LAYERS.length}, ${TF_WORD[tf]} bars.</div>
    <h3 id="drawerTitle">${esc(L.name)}</h3>
    <p class="dr-say">${esc(L.about)}${v ? ` ${esc(VERDICT_WORDS[v.verdict])} on the ${TF_WORD[tf]}: ${v.up} of ${v.members.length} broke the high, ${v.down} broke the low.` : ""}</p>
    <div class="dr-group"><h4>MARKETS, STRONGEST FIRST ${v ? `<span class="verdict ${vClass(v.verdict)}">${esc(v.verdict)}</span>` : ""}</h4>${[...all].sort((a, b) => sc(b) - sc(a)).map(item).join("")}</div>
    <p class="disclaim">Education only. Not investment advice.</p>`;
  const wasHidden = $("#drawer").hidden;
  if (wasHidden) lastFocus = document.activeElement;
  $("#drawer").hidden = false;
  if (wasHidden) $("#drawerClose").focus();
  if (sym && refocus) $("#drawerBody .dr-item.hot")?.scrollIntoView({ block: "center" });
  writeHash();
}
let lastFocus = null;
function closeDrawer() {
  if ($("#drawer").hidden) return;
  $("#drawer").hidden = true; state.focus = null; state.focusSym = null; cake?.redraw(); writeHash();
  lastFocus?.focus?.();
}
const openCoin = (sym) => { const m = state.data.markets.find((x) => x.symbol === sym); if (m) openLayer(m.layer, sym); };

/* ---------- The cake ---------- */

let cake = null;

function heat(score, alpha = 1) {
  const s = Math.sign(score) * Math.sqrt(Math.abs(score)); // lift weak scores so the cake is not muddy
  const t = (s + 1) / 2;
  if (state.sensor === "flir") return d3.interpolateInferno(0.12 + t * 0.82);
  if (state.sensor === "nvg") return d3.interpolateRgb("#0b2a0e", "#c6ffb5")(t);
  const c = s >= 0 ? d3.interpolateRgb("#2a281e", "#10b981")(s) : d3.interpolateRgb("#2a281e", "#ef4444")(-s);
  return alpha === 1 ? c : d3.color(c).copy({ opacity: alpha }).formatRgb();
}
const SENSOR = {
  normal: { land: "#1b1a14", line: "#2a281e", glow: "rgba(99,102,241,0.22)", text: "#ece9e0" },
  flir: { land: "#1a0b3a", line: "#2b1660", glow: "rgba(255,122,26,0.25)", text: "#ffe9c2" },
  nvg: { land: "#08200c", line: "#12401a", glow: "rgba(109,255,94,0.2)", text: "#b9ffa8" },
};

// Geometry. The cake is a stack of cylinders seen from the front and a little from above (orthographic).
// World: y up, tier i from y = i*HT to (i+1)*HT with radius radius(i); the bottom tier has radius 1.
// A point at angle b around the axis (b = slice angle + yaw) lands on the screen at
//   x = cx + S*r*cos(b),   y = cyBase - S*(height*cos(pitch) - r*sin(b)*sin(pitch))
// so a circle is an ellipse whose canvas angle is b itself, and 0 < b < PI is the half that faces the viewer.
function initCake() {
  const canvas = $("#cake");
  const ctx = canvas.getContext("2d");
  const N = LAYERS.length, HT = 0.27, TAU = Math.PI * 2;
  const radius = (i) => 1 - 0.5 * (i / (N - 1));
  const offset = (i) => i * 0.37; // turn each tier a little so the slice seams do not line up
  const SEAM = "rgba(0,0,0,0.5)";
  let yaw = 0.35, pitch = 0.5, w = 0, h = 0, S = 1, cx = 0, cyBase = 0, narrow = false;
  let anim = null, dirty = true, visible = true, over = false, drag = null, moved = 0, resumeAt = 0;
  let lastDraw = 0, lastHud = 0, lastT = performance.now(), drawn = false;
  let labelBoxes = [];

  function resize() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, innerWidth < 700 ? 1.5 : 2);
    w = r.width; h = r.height;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dirty = true;
    if (drawn) draw(performance.now()); // a new size clears the canvas: draw in the same frame, no flash
  }

  // Scale and place the cake in the free band of the canvas: layer names on the left, arcs on the right,
  // the HUD at the top and the replay bar at the bottom.
  function fit() {
    narrow = w < 560;
    const stacked = innerWidth <= 900; // the headline sits over the canvas
    const left = narrow ? 66 : 176, right = narrow ? 44 : 100, top = stacked ? 150 : 34, bottom = narrow ? 134 : 100;
    const sp = Math.sin(pitch), cp = Math.cos(pitch);
    const k = N * HT * cp + (1 + radius(N - 1)) * sp; // screen height of the cake, in units of S
    S = Math.max(40, Math.min((w - left - right) / 2, (h - top - bottom) / k));
    cx = left + (w - left - right) / 2;
    cyBase = top + (h - top - bottom - S * k) / 2 + S * (N * HT * cp + radius(N - 1) * sp);
  }
  function geom(i) {
    const sp = Math.sin(pitch), cp = Math.cos(pitch), r = radius(i);
    return { r, rx: S * r, ry: S * r * sp, cyB: cyBase - S * i * HT * cp, cyT: cyBase - S * (i + 1) * HT * cp, wallH: S * HT * cp };
  }

  const coinScore = (m) => (state.frame ? state.frame.scores[m.symbol] : m.tf[state.tf] ? control(m.tf[state.tf]).score : undefined);
  const layerScore = (id) => (state.frame ? state.frame.layer[id] : state.views[id]?.score);

  let flowKey = "", flows = [];
  function currentFlows() {
    const key = `${state.flow}|${state.tf}|${state.frame?.d ?? ""}|${state.data.generatedAt}`;
    if (key !== flowKey) {
      flowKey = key;
      const rev = state.flow === "reversal";
      const fn = rev ? (id) => (state.frame ? state.frame.rev[id] : revScore(id)) : layerScore;
      flows = flowPairs(fn, FLOW_MIN[state.flow]).pairs;
    }
    return flows;
  }
  // Rotation arcs run up the right side of the cake, from the selling tier to the buying tier.
  function drawFlows(t, P) {
    const list = currentFlows();
    if (!list.length) return;
    const lo = heat(-1), hi = heat(1), k = narrow ? 0.42 : 1;
    for (const f of list) {
      const A = geom(f.a.i), B = geom(f.b.i);
      const a0 = [cx + A.rx + 6 + 6 * k, (A.cyT + A.cyB) / 2], b0 = [cx + B.rx + 6 + 6 * k, (B.cyT + B.cyB) / 2];
      const c = [Math.max(a0[0], b0[0]) + (30 + 18 * Math.abs(f.a.i - f.b.i)) * k, (a0[1] + b0[1]) / 2];
      const pos = (u) => [(1 - u) ** 2 * a0[0] + 2 * u * (1 - u) * c[0] + u * u * b0[0], (1 - u) ** 2 * a0[1] + 2 * u * (1 - u) * c[1] + u * u * b0[1]];
      const grad = ctx.createLinearGradient(a0[0], a0[1], b0[0], b0[1]);
      grad.addColorStop(0, d3.color(lo).copy({ opacity: 0.6 }).formatRgb());
      grad.addColorStop(1, d3.color(hi).copy({ opacity: 0.8 }).formatRgb());
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1 + f.w * 1.8;
      ctx.beginPath(); ctx.moveTo(a0[0], a0[1]); ctx.quadraticCurveTo(c[0], c[1], b0[0], b0[1]); ctx.stroke();
      ctx.beginPath(); ctx.arc(a0[0], a0[1], 3, 0, TAU); ctx.strokeStyle = lo; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.beginPath(); ctx.arc(b0[0], b0[1], 3.4, 0, TAU); ctx.fillStyle = hi; ctx.fill();
      // Particles: pressure moving from the selling layer to the buying layer.
      const n = 2 + Math.round(f.w * 3);
      for (let j = 0; j < n; j++) {
        const u = reduceMotion ? (j + 0.5) / n : (t * 0.00035 + f.phase + j / n) % 1;
        const [x, y] = pos(u);
        const col = d3.interpolateRgb(lo, hi)(u);
        ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.fillStyle = d3.color(col).copy({ opacity: 0.18 }).formatRgb(); ctx.fill();
        ctx.beginPath(); ctx.arc(x, y, 1.9, 0, TAU); ctx.fillStyle = P.text; ctx.fill();
      }
    }
  }

  function text(s, x, y) {
    ctx.strokeStyle = "rgba(0,0,0,0.55)"; ctx.lineWidth = 2.6; ctx.lineJoin = "round";
    ctx.strokeText(s, x, y);
    ctx.fillText(s, x, y);
  }

  function draw(t) {
    const P = SENSOR[state.sensor];
    fit();
    ctx.clearRect(0, 0, w, h);
    const sp = Math.sin(pitch);
    const mute = d3.color(P.text).copy({ opacity: 0.55 }).formatRgb();

    // Glow and plate under the cake.
    const g0 = geom(0);
    ctx.save();
    ctx.translate(cx, g0.cyB + 4); ctx.scale(1, sp);
    const glow = ctx.createRadialGradient(0, 0, S * 0.95, 0, 0, S * 1.5);
    glow.addColorStop(0, P.glow); glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, S * 1.5, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.ellipse(cx, g0.cyB + 5, S * 1.13, S * 1.13 * sp, 0, 0, TAU); ctx.fillStyle = P.line; ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx, g0.cyB, S * 1.13, S * 1.13 * sp, 0, 0, TAU); ctx.fillStyle = P.land; ctx.fill();
    ctx.strokeStyle = P.line; ctx.lineWidth = 1; ctx.stroke();

    labelBoxes = [];
    // Bottom tier first: each tier is smaller than the one under it, so it only covers that tier's top face.
    for (let i = 0; i < N; i++) {
      const L = LAYERS[i], coins = tiers[L.id] ?? [], n = coins.length;
      if (!n) continue;
      const G = geom(i), d = TAU / n, rIn = i < N - 1 ? radius(i + 1) : 0;
      const segs = [];
      let hot = null;
      for (let k = 0; k < n; k++) {
        const m = coins[k];
        const b0 = mod(offset(i) + k * d + yaw, TAU), b1 = b0 + d;
        const s = coinScore(m);
        const fill = s === undefined ? P.land : heat(s);
        // Top face of the slice: a ring sector (the tier above covers the middle).
        ctx.beginPath();
        ctx.ellipse(cx, G.cyT, G.rx, G.ry, 0, b0, b1);
        if (rIn) ctx.ellipse(cx, G.cyT, S * rIn, S * rIn * sp, 0, b1, b0, true); else ctx.lineTo(cx, G.cyT);
        ctx.closePath();
        ctx.fillStyle = fill; ctx.fill();
        ctx.strokeStyle = SEAM; ctx.lineWidth = 1; ctx.stroke();
        // Side of the slice: only the part on the half of the tier that faces the viewer.
        for (const base of [0, TAU]) {
          const a = Math.max(b0, base), b = Math.min(b1, base + Math.PI);
          if (b - a > 1e-3) segs.push({ m, a, b, fill });
        }
        if (state.hover?.sym === m.symbol || (state.focusSym === m.symbol && state.focus === L.id)) hot = { b0, b1 };
      }
      const wall = (a, b) => {
        ctx.beginPath();
        ctx.ellipse(cx, G.cyT, G.rx, G.ry, 0, a, b);
        ctx.ellipse(cx, G.cyB, G.rx, G.ry, 0, b, a, true);
        ctx.closePath();
      };
      for (const sg of segs) {
        wall(sg.a, sg.b);
        ctx.fillStyle = sg.fill; ctx.fill();
        ctx.strokeStyle = SEAM; ctx.lineWidth = 1; ctx.stroke();
      }
      // Round the tier: darker toward the left and right edges.
      const shade = ctx.createLinearGradient(cx - G.rx, 0, cx + G.rx, 0);
      shade.addColorStop(0, "rgba(0,0,0,0.5)"); shade.addColorStop(0.5, "rgba(0,0,0,0.1)"); shade.addColorStop(1, "rgba(0,0,0,0.5)");
      wall(0, Math.PI);
      ctx.fillStyle = shade; ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx, G.cyT, G.rx, G.ry, 0, 0, Math.PI);
      ctx.strokeStyle = "rgba(255,255,255,0.14)"; ctx.lineWidth = 1; ctx.stroke();

      // Outline: the slice under the pointer or in the open panel, and the whole tier when its name is hot.
      ctx.strokeStyle = P.text; ctx.lineWidth = 1.6;
      if (hot) {
        ctx.beginPath(); ctx.ellipse(cx, G.cyT, G.rx, G.ry, 0, hot.b0, hot.b1);
        if (rIn) ctx.ellipse(cx, G.cyT, S * rIn, S * rIn * sp, 0, hot.b1, hot.b0, true); else ctx.lineTo(cx, G.cyT);
        ctx.closePath(); ctx.stroke();
        for (const base of [0, TAU]) {
          const a = Math.max(hot.b0, base), b = Math.min(hot.b1, base + Math.PI);
          if (b - a > 1e-3) { wall(a, b); ctx.stroke(); }
        }
      }
      const tierHot = (state.hover?.layer === L.id && !state.hover.sym) || (state.focus === L.id && !state.focusSym);
      if (tierHot) {
        wall(0, Math.PI); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(cx, G.cyT, G.rx, G.ry, 0, Math.PI, TAU); ctx.stroke();
      }

      // Ticker and bar label on each slice that is wide enough to hold them.
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = P.text;
      const two = G.wallH >= 30;
      for (const sg of segs) {
        const ca = Math.cos(sg.a), cb = Math.cos(sg.b);
        ctx.font = "600 11px 'JetBrains Mono', monospace";
        if (G.rx * (ca - cb) < ctx.measureText(sg.m.t).width + 8) continue;
        const x = cx + (G.rx * (ca + cb)) / 2;
        const y = G.cyT + G.ry * Math.sin(Math.acos((ca + cb) / 2)) + G.wallH / 2;
        text(sg.m.t, x, two ? y - 6 : y);
        if (!two) continue;
        const st = state.frame ? state.frame.st[sg.m.symbol] : sg.m.tf[state.tf]?.s;
        if (!st) continue;
        const rev = !state.frame && reversal(sg.m.tf[state.tf]);
        ctx.font = "500 9.5px 'JetBrains Mono', monospace";
        text(`${S_LABEL[st]}${rev ? " ↺" : ""}`, x, y + 7);
      }

      // Layer name on the left, with who controls the layer.
      const v = state.views[L.id], ls = layerScore(L.id);
      // The names stand in one column left of the plate; a thin leader runs to the edge of the tier.
      const lx = cx - S * 1.13 - (narrow ? 8 : 14), ly = (G.cyT + G.cyB) / 2;
      ctx.beginPath(); ctx.moveTo(lx + (narrow ? 12 : 6), ly); ctx.lineTo(cx - G.rx - 3, ly);
      ctx.strokeStyle = d3.color(P.text).copy({ opacity: tierHot ? 0.7 : 0.22 }).formatRgb(); ctx.lineWidth = 1; ctx.stroke();
      const verdict = state.frame ? (ls >= 0.5 ? "BUY" : ls <= -0.5 ? "SELL" : "") : v?.verdict ?? "";
      ctx.textAlign = "right";
      ctx.font = `600 ${narrow ? 10 : 11}px 'JetBrains Mono', monospace`;
      const name = narrow ? L.short : L.name.toUpperCase();
      const one = narrow || G.wallH < 30;
      ctx.fillStyle = tierHot ? P.text : d3.color(P.text).copy({ opacity: 0.85 }).formatRgb();
      ctx.fillText(name, lx, one ? ly : ly - 6);
      let wide = ctx.measureText(name).width;
      if (one) {
        if (verdict === "BUY" || verdict === "SELL") { ctx.beginPath(); ctx.arc(lx + 7, ly, 2.6, 0, TAU); ctx.fillStyle = heat(verdict === "BUY" ? 1 : -1); ctx.fill(); }
      } else {
        ctx.font = "500 9.5px 'JetBrains Mono', monospace";
        const tail = !state.frame && v ? ` ▲${v.up} ▼${v.down}` : "";
        ctx.fillStyle = mute;
        ctx.fillText(tail, lx, ly + 7);
        const tw = ctx.measureText(tail).width;
        ctx.fillStyle = verdict === "BUY" ? heat(1) : verdict === "SELL" ? heat(-1) : mute;
        ctx.fillText(verdict, lx - tw, ly + 7);
        wide = Math.max(wide, tw + ctx.measureText(verdict).width);
      }
      labelBoxes.push({ id: L.id, x0: lx - wide - 4, x1: lx + 10, y0: ly - 14, y1: ly + 14 });
    }

    if (state.flow !== "off") drawFlows(t, P);

    if (t - lastHud > 250) {
      lastHud = t;
      $("#hudOrbit").textContent = `CAKE-01 // TURN ${Math.round(mod((yaw * 180) / Math.PI, 360))}° TILT ${Math.round((pitch * 180) / Math.PI)}°`;
    }
  }

  // What is under a canvas point: a layer name, or a slice of a tier (top tier first: it is drawn last).
  function hit(px, py) {
    for (const b of labelBoxes) if (px >= b.x0 && px <= b.x1 && py >= b.y0 && py <= b.y1) return { layer: b.id };
    const sp = Math.sin(pitch);
    for (let i = N - 1; i >= 0; i--) {
      const L = LAYERS[i], coins = tiers[L.id] ?? [], n = coins.length;
      if (!n) continue;
      const G = geom(i), u = (px - cx) / S, v = (py - G.cyT) / (S * sp);
      let beta = null;
      if (u * u + v * v <= G.r * G.r) beta = Math.atan2(v, u);
      else if (Math.abs(u) < G.r) {
        const b = Math.acos(u / G.r), top = G.cyT + G.ry * Math.sin(b);
        if (py >= top && py <= top + G.wallH) beta = b;
      }
      if (beta === null) continue;
      const k = Math.min(n - 1, Math.floor(mod(beta - yaw - offset(i), TAU) / (TAU / n)));
      return { layer: L.id, sym: coins[k].symbol };
    }
    return null;
  }

  function frame(t) {
    requestAnimationFrame(frame);
    const dt = Math.min(t - lastT, 100);
    lastT = t;
    if (!visible) return;
    if (anim) {
      const p = reduceMotion ? 1 : Math.min(1, (t - anim.t0) / 900);
      yaw = anim.from + (anim.to - anim.from) * d3.easeCubicInOut(p);
      if (p >= 1) anim = null;
      dirty = true;
    } else if (!reduceMotion && !over && !drag && t > resumeAt && $("#drawer").hidden) {
      yaw = mod(yaw + 0.00006 * dt, TAU); // a slow turn; it stops while the pointer is on the cake
      dirty = true;
    }
    if (state.flow !== "off" && !reduceMotion) dirty = true;
    if (!dirty) return;
    if (t - lastDraw < 33) return; // 30 fps is enough and saves battery
    lastDraw = t;
    dirty = false;
    draw(t);
  }

  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);
  resize();
  draw(performance.now());
  drawn = true;
  requestAnimationFrame(frame);

  const at = (e) => { const r = canvas.getBoundingClientRect(); return hit(e.clientX - r.left, e.clientY - r.top); };
  function setHover(hv) {
    if (hv?.layer === state.hover?.layer && hv?.sym === state.hover?.sym) return;
    state.hover = hv;
    dirty = true;
    canvas.classList.toggle("point", !!hv);
    const tf = state.tf;
    if (!hv) { $("#hudTarget").innerHTML = ""; return; }
    const L = LAYER.get(hv.layer), v = state.views[hv.layer];
    const m = hv.sym && state.data.markets.find((x) => x.symbol === hv.sym);
    if (m) {
      const st = m.tf[tf], c = st && control(st);
      $("#hudTarget").innerHTML = `<b>${esc(m.t)} · ${esc(m.name)}</b><span class="${c?.score >= 0.5 ? "v-buy" : c?.score <= -0.5 ? "v-sell" : ""}">${esc(c?.label ?? "NO DATA")}</span><br>${esc(L.name)} · ${S_LABEL[st?.s] ?? "–"} · ${TF_HUD[tf]}`;
    } else {
      $("#hudTarget").innerHTML = `<b>${esc(L.name)}</b>${v ? `<span class="v-${vClass(v.verdict)}">${esc(v.verdict)}</span><br>▲${v.up} ▼${v.down} OF ${v.members.length} · ${TF_HUD[tf]}` : ""}`;
    }
  }
  // Drag: left / right turns the cake; with a mouse, up / down tilts it. A vertical touch swipe scrolls the page.
  canvas.addEventListener("pointerdown", (e) => {
    if (e.button) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, touch: e.pointerType === "touch" };
    moved = 0;
    anim = null;
    if (!drag.touch) canvas.setPointerCapture?.(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (drag && e.pointerId === drag.id) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.x = e.clientX; drag.y = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      yaw = mod(yaw - dx / (S * 0.8), TAU); // the front of the cake follows the pointer
      if (!drag.touch) pitch = clamp(pitch + dy * 0.004, 0.22, 1.05);
      dirty = true;
      return;
    }
    if (e.pointerType !== "touch") { over = true; setHover(at(e)); }
  });
  const drop = (e) => { if (drag && e.pointerId === drag.id) { drag = null; resumeAt = performance.now() + 4000; } };
  canvas.addEventListener("pointerup", drop);
  canvas.addEventListener("pointercancel", drop);
  canvas.addEventListener("pointerleave", () => { over = false; setHover(null); });
  canvas.addEventListener("click", (e) => {
    if (moved > 6) return; // the end of a drag
    const hv = at(e);
    if (hv) openLayer(hv.layer, hv.sym ?? null);
  });

  return {
    redraw() { dirty = true; },
    // Turn the cake so the slice faces the viewer.
    focus(sym) {
      dirty = true;
      for (let i = 0; i < N; i++) {
        const coins = tiers[LAYERS[i].id] ?? [], k = coins.findIndex((m) => m.symbol === sym);
        if (k < 0) continue;
        let to = Math.PI / 2 - (offset(i) + (k + 0.5) * (TAU / coins.length));
        while (to - yaw > Math.PI) to -= TAU;
        while (yaw - to > Math.PI) to += TAU;
        anim = { t0: performance.now(), from: yaw, to };
        return;
      }
    },
  };
}

function renderLegend() {
  const stops = d3.range(0, 1.01, 0.1).map((t) => heat(t * 2 - 1)).join(",");
  $("#legend").innerHTML = `<span>SELLING</span><i class="lg-bar" style="background:linear-gradient(90deg, ${stops})"></i><span>BUYING</span>`;
}

/* ---------- Tooltips: TheStrat docs (data-tip) ---------- */

function showTip(el) {
  const d = DOCS[el.dataset.tip];
  if (!d) return;
  const tip = $("#tip");
  tip.innerHTML = `${el.dataset.tipx ? `<span class="tip-x">${esc(el.dataset.tipx)}</span>` : ""}<a class="tip-t" href="${docsUrl(el.dataset.tip)}" target="_blank" rel="noopener"><b>${esc(d.t)}</b></a><q>${esc(d.q)}</q>${d.note ? `<span class="tip-note">${esc(d.note)}</span>` : ""}<cite><a href="${docsUrl(el.dataset.tip)}" target="_blank" rel="noopener">Read the full definition on TheStrat.ai →</a>${el.dataset.doc ? " (or click the label)" : ""}</cite>`;
  tip.hidden = false;
  tipEl = el;
  const r = el.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
  const x = Math.min(Math.max(8, r.left + r.width / 2 - tw / 2), innerWidth - tw - 8);
  let y = r.bottom + 8;
  if (y + th > innerHeight - 8) y = Math.max(8, r.top - th - 8);
  tip.style.left = `${x}px`; tip.style.top = `${y}px`;
}
let tipTimer = 0, switchTimer = 0, tipEl = null;
function hideTip() { clearTimeout(tipTimer); clearTimeout(switchTimer); $("#tip").hidden = true; tipEl = null; }
function hideTipSoon() { clearTimeout(tipTimer); tipTimer = setTimeout(hideTip, 350); }
function wireTips() {
  // The tooltip stays open while the pointer moves onto it, so its link can be clicked.
  document.addEventListener("mouseover", (e) => {
    if (e.target.closest("#tip")) { clearTimeout(tipTimer); clearTimeout(switchTimer); return; }
    const el = e.target.closest("[data-tip]");
    if (!el) { clearTimeout(switchTimer); hideTipSoon(); return; }
    clearTimeout(tipTimer);
    clearTimeout(switchTimer);
    if (el === tipEl) return;
    if ($("#tip").hidden) showTip(el);
    else switchTimer = setTimeout(() => showTip(el), 260);
  });
  document.addEventListener("focusin", (e) => { const el = e.target.closest("[data-tip]"); el ? showTip(el) : hideTip(); });
  document.addEventListener("scroll", hideTip, { passive: true, capture: true });
  addEventListener("resize", hideTip);
  document.addEventListener("touchstart", (e) => {
    if (e.target.closest("#tip")) return;
    const el = e.target.closest("[data-tip]");
    el ? showTip(el) : hideTip();
  }, { passive: true });
}

/* ---------- Controls, URL state ---------- */

function setPressed(segId, v) {
  document.querySelectorAll(`#${segId} button`).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === v)));
}

function writeHash() {
  history.replaceState(null, "", `${location.pathname}${location.search}#tf=${state.tf}&sensor=${state.sensor}&flow=${state.flow}${state.focus ? `&l=${state.focus}` : ""}`);
}
function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  const out = {};
  if (TIMEFRAMES.includes(p.get("tf"))) out.tf = p.get("tf");
  if (["normal", "flir", "nvg"].includes(p.get("sensor"))) out.sensor = p.get("sensor");
  if (["control", "reversal", "off"].includes(p.get("flow"))) out.flow = p.get("flow");
  return { patch: out, layer: LAYER.has(p.get("l")) ? p.get("l") : null };
}

function update(patch = {}) {
  if (replayTimer && patch.tf) stopReplay();
  Object.assign(state, patch);
  if (patch.tf) state.revAll = false;
  state.views = buildViews(state.tf);
  document.body.dataset.sensor = state.sensor;
  setPressed("tfSeg", state.tf); setPressed("sensorSeg", state.sensor); setPressed("flowSeg", state.flow);
  $("#hudMode").textContent = `SENSOR ${state.sensor === "flir" ? "FLIR · BUYING RUNS HOT" : state.sensor === "nvg" ? "NVG" : "NORMAL"}`;
  $("#hudTf").textContent = `TF ${TF_HUD[state.tf]} · CRYPTO`;
  $("#flowHint").textContent = state.flow === "reversal" ? "ARCS: LAYERS REVERSING DOWN → REVERSING UP" : state.flow === "control" ? "ARCS: OUT OF SELLERS' LAYERS → INTO BUYERS' LAYERS" : "";
  renderLegend(); renderIntel(); renderLayers(); renderReversals(); renderReplayControls();
  cake?.redraw();
  if (state.focus && !$("#drawer").hidden) openLayer(state.focus, state.focusSym, false);
  else writeHash();
}

function wireControls() {
  $("#tfSeg").innerHTML = TIMEFRAMES.map((t) => `<button data-v="${t}" title="${TF_WORD[t]} bars (key ${t})">${TF_BTN[t]}</button>`).join("");
  $("#tfSeg").addEventListener("click", (e) => e.target.dataset.v && update({ tf: e.target.dataset.v }));
  $("#sensorSeg").addEventListener("click", (e) => e.target.dataset.v && update({ sensor: e.target.dataset.v }));
  $("#flowSeg").addEventListener("click", (e) => e.target.dataset.v && update({ flow: e.target.dataset.v }));
  $("#revTfs").addEventListener("click", (e) => { const b = e.target.closest("[data-tf]"); if (b) update({ tf: b.dataset.tf }); });
  $("#reversals").addEventListener("click", (e) => { if (e.target.closest("[data-revall]")) { state.revAll = true; renderReversals(); } });
  document.addEventListener("click", (e) => {
    const doc = e.target.closest("[data-doc]");
    if (doc && DOCS[doc.dataset.doc]) {
      e.preventDefault();
      window.open(docsUrl(doc.dataset.doc), "_blank", "noopener");
      return;
    }
    const coin = e.target.closest("[data-coin]");
    if (coin) { openCoin(coin.dataset.coin); return; }
    const layer = e.target.closest("[data-layer]");
    if (layer) openLayer(layer.dataset.layer);
  });
  $("#drawerClose").addEventListener("click", closeDrawer);
  $("#drawer").addEventListener("click", (e) => { if (e.target.id === "drawer") closeDrawer(); });
  $("#replayBtn").addEventListener("click", startReplay);
  $("#stepSeg").addEventListener("click", (e) => { if (e.target.dataset.v && !e.target.disabled) { stopReplay(); state.replayStep = e.target.dataset.v; renderReplayControls(); } });
  $("#rangeSeg").addEventListener("click", (e) => { if (e.target.dataset.v) { stopReplay(); state.replayRange = e.target.dataset.v; renderReplayControls(); } });
  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.target.matches("input, textarea")) return;
    const k = e.key.toUpperCase();
    if (k === "ESCAPE") closeDrawer();
    else if (TIMEFRAMES.includes(k)) update({ tf: k });
    else if (k === "1") update({ sensor: "normal" });
    else if (k === "2") update({ sensor: "flir" });
    else if (k === "3") update({ sensor: "nvg" });
    else if (k === "R") startReplay();
    else if (k === "F") update({ flow: { control: "reversal", reversal: "off", off: "control" }[state.flow] });
  });
}

/* ---------- How-to cards ---------- */

function candle(prev, cur, color) {
  const y = (v) => 60 - v * 0.55;
  const bar = (x, [l, h, o, c], col) => `<line x1="${x}" x2="${x}" y1="${y(h)}" y2="${y(l)}" stroke="${col}" stroke-width="1.5"/>
    <rect x="${x - 6}" y="${y(Math.max(o, c))}" width="12" height="${Math.max(2, Math.abs(o - c) * 0.55)}" fill="${col}"/>`;
  return `<svg viewBox="0 0 64 64" aria-hidden="true">
    <line x1="10" x2="58" y1="${y(prev[1])}" y2="${y(prev[1])}" stroke="var(--fg-4)" stroke-dasharray="2 2"/>
    <line x1="10" x2="58" y1="${y(prev[0])}" y2="${y(prev[0])}" stroke="var(--fg-4)" stroke-dasharray="2 2"/>
    ${bar(22, prev, "var(--fg-3)")}${bar(44, cur, color)}</svg>`;
}
function renderHow() {
  const prev = [30, 70, 40, 60];
  $("#howCards").innerHTML = [
    ["2U · Broke the high", "Price went above the last high. If it closes green, buyers are in control.", candle(prev, [45, 92, 50, 85], "var(--up)")],
    ["2D · Broke the low", "Price went below the last low. If it closes red, sellers are in control.", candle(prev, [8, 62, 55, 15], "var(--down)")],
    ["1 · Coiling", "Price stayed inside the last range. Nobody has won yet. Watch which side breaks.", candle(prev, [38, 62, 42, 55], "var(--fg-2)")],
    ["3 · Broke both", "Price broke both sides. Buyers and sellers fought, and the close shows who is winning.", candle(prev, [10, 95, 30, 85], "var(--gold)")],
    ["→ Rotation", "ROTATION arcs run from the layers where sellers control the bar to the layers where buyers do. REVERSALS arcs run from layers reversing down to layers reversing up. They show pressure, not tracked transfers.", candle([20, 50, 45, 25], [35, 80, 40, 75], "var(--accent)")],
    ["↺ Reversal (REV)", "Control flipped. Example 2-1-2 REV: sellers broke the low, price paused inside, then buyers broke the high. CONT = the break goes with the first move.", candle([20, 50, 45, 25], [35, 80, 40, 75], "var(--up)")],
    ["FTFC UP / DN", "Full Timeframe Continuity: price above (UP) or below (DN) the open of the year, quarter, month, week and day.", candle([30, 70, 40, 60], [45, 92, 50, 85], "var(--up)")],
  ].map(([t, p, svg], i) => `<div class="card"${docAttr(["2u", "2d", "1", "3", null, "reversal", "ftfc"][i])}>${svg}<div><h3>${t}</h3><p>${p}</p></div></div>`).join("");
  $("#layerNotes").innerHTML = `The layers, bottom tier to top tier. ${LAYERS.map((L) => `<b>${esc(L.name)}</b>: ${esc(L.about)}`).join(" ")} The layers are one way to sort the market; some coins fit more than one.`;
}

/* ---------- Boot ---------- */

function renderHeader() {
  const d = state.data;
  const liveN = d.markets.filter((m) => m.live).length;
  const ageDays = (Date.now() - new Date(d.generatedAt)) / 864e5;
  $("#asof").textContent = `${ageDays > 2 ? "DATA DELAYED · " : ""}UPDATED ${d.generatedAt.slice(0, 10)} ${d.generatedAt.slice(11, 16)} UTC${liveN ? ` · ${liveN} ${liveN === 1 ? "MARKET" : "MARKETS"} LIVE` : ""}`;
  $("#tracking").innerHTML = `TRACKING <b>${LAYERS.filter((L) => tiers[L.id]?.length).length}</b> LAYERS · <b>${d.markets.length}</b> MARKETS · <b>5</b> TIMEFRAMES`;
  $("#footData").textContent = `Data: ${d.source}. Generated ${d.generatedAt}.${d.failed?.length ? ` Not loaded: ${d.failed.join(", ")}.` : ""}`;
}

function applyData(data) {
  state.data = data;
  tiers = {};
  for (const m of data.markets) if (LAYER.has(m.layer)) (tiers[m.layer] ??= []).push(m);
  renderHeader();
  wireControls();
  renderHow();
  const { patch, layer } = readHash();
  update(patch);
  cake = initCake();
  if (layer) openLayer(layer);
  addEventListener("hashchange", () => {
    const h = readHash();
    update(h.patch);
    if (h.layer && h.layer !== state.focus) openLayer(h.layer);
    else if (!h.layer) closeDrawer();
  });
}

async function main() {
  wireTips();
  if (typeof d3 === "undefined") { $("#headline").textContent = "Signal lost. Try again in a minute."; return; }
  const found = await loadData();
  if (found.plain) {
    // Run-your-own copy: personal-use agreement, then the copy's own data file.
    await personalUseGate();
    $("#srcTag").textContent = "SOURCE: YOUR OWN COPY";
    applyData(found.plain);
    return;
  }
  // Owner access: the remembered password from this page or the globe page opens the vault at once.
  const pw = found.vault && local.get(PW_KEY);
  let data = pw ? await openVault(found.vault, pw) : null;
  if (!data) data = await ownerGate(found.vault ?? null);
  data.source = `${data.source} · owner access`;
  $("#srcTag").textContent = "SOURCE: OWNER DATA (ENCRYPTED)";
  $("#lockBtn").hidden = false;
  $("#lockBtn").addEventListener("click", () => { local.set(PW_KEY, ""); location.reload(); });
  applyData(data);
}

main();
