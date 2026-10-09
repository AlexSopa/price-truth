import { COUNTRIES, MARKETS } from "./universe.js?v=3";
import { TIMEFRAMES, control, continuity, analyze, reversal, decodeState, periodKey } from "./strat.js?v=3";
import { chartUrl, parseChart, isLive } from "./yahoo.js?v=3";

const TF_NAME = { D: "Today", W: "This week", M: "This month", Q: "This quarter", Y: "This year" };
const TF_WORD = { D: "day", W: "week", M: "month", Q: "quarter", Y: "year" };
const TF_HUD = { D: "DAY", W: "WEEK", M: "MONTH", Q: "QUARTER", Y: "YEAR" };
const TF_BTN = { D: "DAY", W: "WEEK", M: "MONTH", Q: "QTR", Y: "YEAR" };
const TF_PREV = { D: "yesterday's", W: "last week's", M: "last month's", Q: "last quarter's", Y: "last year's" };
const S_LABEL = { "1": "1", "2u": "2U", "2d": "2D", "3": "3" };
const WORLD_URL = "vendor/countries-110m.json";
const RELAYS = []; // Add your own CORS relay URL prefixes here to allow ?relay= live mode on the public site.
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const state = { tf: "D", asset: "stocks", sensor: "normal", flow: "control", view: "globe", replayStep: "bar", replayRange: null, data: null, views: {}, focus: null, hover: null, mine: null, frame: null };

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const assetOf = (m) => (m.kind === "bond" ? "bonds" : m.kind === "index" || m.kind === "stock" ? "stocks" : m.kind);
const gClass = (g) => (g > 0 ? "g-up" : g < 0 ? "g-down" : "");
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const store = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch {} },
};

/* ---------- Data ---------- */

function relayAllowed(r) {
  return /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(r) || RELAYS.some((p) => r.startsWith(p));
}

async function loadData() {
  const relay = new URLSearchParams(location.search).get("relay");
  if (relay && relayAllowed(relay)) return loadLive(relay);
  const r = await fetch("data/signals.json", { cache: "no-cache" });
  if (!r.ok) throw new Error("signals.json missing");
  return r.json();
}

// Optional: compute everything in this browser from Yahoo, through a CORS relay you control.
async function loadLive(relay) {
  const markets = [];
  let i = 0, done = 0;
  const worker = async () => {
    while (i < MARKETS.length) {
      const m = MARKETS[i++];
      try {
        const json = await (await fetch(relay + encodeURIComponent(chartUrl(m.symbol)))).json();
        const bars = parseChart(json);
        if (bars.length >= 30) markets.push({ ...m, ...analyze(bars), live: isLive(json) });
      } catch {}
      bootLine(`  FEED ${String(++done).padStart(3, "0")}/${MARKETS.length}  ${m.symbol}`, true);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  if (!markets.length) throw new Error("relay failed");
  const order = new Map(MARKETS.map((m, k) => [m.symbol, k]));
  markets.sort((a, b) => order.get(a.symbol) - order.get(b.symbol));
  return { generatedAt: new Date().toISOString(), source: "Yahoo Finance (live in your browser)", markets, live: true };
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

// Money-flow pairs: from the countries where sellers control the bar to the ones where buyers do.
// The arcs show where pressure sits, not tracked transfers.
function flowPairs(scoreOf, min = 0.25) {
  const pts = Object.values(state.views).map((v) => ({ code: v.code, at: v.at, s: scoreOf(v.code) })).filter((p) => p.at && p.s !== undefined);
  const src = pts.filter((p) => p.s <= -min).sort((a, b) => a.s - b.s).slice(0, 10);
  const dst = pts.filter((p) => p.s >= min).sort((a, b) => b.s - a.s).slice(0, 10);
  if (!src.length || !dst.length) return { src, dst, pairs: [] };
  const pairs = [];
  const add = (a, b) => pairs.push({ a, b, w: -a.s * b.s, phase: (pairs.length * 0.37) % 1 });
  src.forEach((a, i) => { for (let j = 0; j < Math.min(2, dst.length); j++) add(a, dst[(i + j) % dst.length]); });
  dst.forEach((b, j) => { if (!pairs.some((p) => p.b === b)) add(src[j % src.length], b); });
  pairs.forEach((p) => { p.w = Math.max(p.w, 0.3); });
  return { src, dst, pairs };
}

// Net reversal direction of a country's markets on a timeframe: +1 all reversing up, -1 all reversing down.
function revScore(code, tf = state.tf, asset = state.asset) {
  const g = state.views[code]?.groups[asset];
  if (!g) return undefined;
  return mean(g.members.map((m) => reversal(m.tf[tf])?.dir ?? 0));
}
const FLOW_MIN = { control: 0.25, reversal: 0.01 };

function buildViews(tf) {
  const views = {};
  for (const [code, c] of Object.entries(COUNTRIES)) {
    if (code === "GLOBAL") continue;
    const ms = state.data.markets.filter((m) => m.country === code);
    if (!ms.length) continue;
    const v = { code, ...c, groups: {} };
    for (const asset of ["stocks", "bonds"]) {
      const members = ms.filter((m) => assetOf(m) === asset && m.tf[tf]);
      if (!members.length) continue;
      const score = mean(members.map((m) => control(m.tf[tf]).score));
      const lead = members.find((m) => m.kind === "index" || m.kind === "bond") ?? members[0];
      v.groups[asset] = { members, lead, score, ftfc: continuity(lead.tf), verdict: verdictOf(score, members, tf) };
    }
    views[code] = v;
  }
  return views;
}

const callText = (v, asset, verdict) => `${verdict} ${v.name.toUpperCase()}${asset === "bonds" ? " BONDS" : ""}`;
const rateWords = (verdict) => (verdict === "SELL" ? "bonds sold, yields rising" : verdict === "BUY" ? "bonds bought, yields falling" : "");

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

/* ---------- Render: intel ---------- */

function renderIntel() {
  const { tf, asset } = state;
  const pool = state.data.markets.filter((m) => (asset === "bonds" ? m.kind === "bond" : m.kind === "index") && m.tf[tf]);
  const n = counts(pool, tf);
  const noun = asset === "bonds" ? "bond markets" : "stock markets";
  const views = Object.values(state.views).filter((v) => v.groups[asset]);
  const buys = views.filter((v) => v.groups[asset].verdict === "BUY").length;
  const sells = views.filter((v) => v.groups[asset].verdict === "SELL").length;
  const what = asset === "bonds" ? "bond markets" : "countries";

  $("#kicker").textContent = `SITUATION REPORT · ${TF_HUD[tf]} BARS · ${asset.toUpperCase()}`;
  let head;
  if (!n["2u"] && !n["2d"]) head = `${TF_NAME[tf]}, almost nothing broke out. The world is coiling.`;
  else if (n["2d"] > n["2u"]) head = `${TF_NAME[tf]}, <span class="down">${n["2d"]} of ${pool.length}</span> ${noun} on Earth broke below ${TF_PREV[tf]} low.`;
  else head = `${TF_NAME[tf]}, <span class="up">${n["2u"]} of ${pool.length}</span> ${noun} on Earth broke above ${TF_PREV[tf]} high.`;
  $("#headline").innerHTML = head;
  $("#hudHeadline").innerHTML = head;
  $("#subline").textContent = `Sellers control ${sells} ${what}. Buyers control ${buys}. ${views.length - buys - sells} are undecided. Headlines tell stories. Price tells the truth.`;

  $("#counts").innerHTML = [
    ["up", n["2u"], "2U · broke the high"],
    ["down", n["2d"], "2D · broke the low"],
    ["", n["1"], "1 · coiling"],
    ["out", n["3"], "3 · broke both"],
  ].map(([c, v, l]) => `<div class="count ${c}"><b>${v}</b><span>${l}</span></div>`).join("");

  // East vs West
  const side = (s) => {
    const ms = state.data.markets.filter((m) => COUNTRIES[m.country]?.side === s && assetOf(m) === asset && m.tf[tf]);
    return { score: mean(ms.map((m) => control(m.tf[tf]).score)), up: ms.filter((m) => m.tf[tf].s === "2u").length, down: ms.filter((m) => m.tf[tf].s === "2d").length };
  };
  const W = side("West"), E = side("East");
  const den = W.score + E.score + 2;
  const wShare = den ? (W.score + 1) / den : 0.5;
  $("#tugWest").style.width = `${wShare * 100}%`;
  $("#tugEast").style.width = `${(1 - wShare) * 100}%`;
  $("#tugWest").style.background = W.score >= 0 ? "var(--up)" : "var(--down)";
  $("#tugEast").style.background = E.score >= 0 ? "var(--up)" : "var(--down)";
  const gap = W.score - E.score;
  $("#tugVerdict").textContent = Math.abs(gap) < 0.15 ? "DEAD EVEN" : gap > 0 ? "◀ MONEY FAVORS THE WEST" : "MONEY FAVORS THE EAST ▶";
  $("#tugWestTxt").textContent = `▲${W.up} ▼${W.down}`;
  $("#tugEastTxt").textContent = `▲${E.up} ▼${E.down}`;

  // Calls: strongest first, full continuity breaks ties
  const calls = [];
  for (const v of views) {
    const g = v.groups[asset];
    if (g.verdict !== "BUY" && g.verdict !== "SELL") continue;
    const agree = g.ftfc === (g.verdict === "BUY" ? 1 : -1);
    calls.push({ v, g, agree, rank: Math.abs(g.score) + (agree ? 0.6 : 0) });
  }
  calls.sort((x, y) => y.rank - x.rank);
  const pick = (verdict) => calls.filter((c) => c.g.verdict === verdict).slice(0, 4);
  const cards = [...pick("BUY"), ...pick("SELL")];
  $("#calls").innerHTML = cards.length
    ? cards.map(({ v, g, agree }) => `<button class="call ${vClass(g.verdict)}" data-country="${v.code}">
          <b>${v.flag} ${esc(callText(v, asset, g.verdict))}</b>
          <span>${esc(g.lead.name)} · ${S_LABEL[g.lead.tf[tf].s]} on the ${TF_WORD[tf]}${asset === "bonds" ? ` · ${rateWords(g.verdict)}` : ""}${agree ? " · ALL 5 TIMEFRAMES AGREE" : ""}</span></button>`).join("")
    : `<div class="calls-empty">NO CLEAN CALLS ON THIS TIMEFRAME. THE WORLD IS UNDECIDED.</div>`;

  $("#insights").innerHTML = insights().map((t) => `<li>${t}</li>`).join("");
  const rev = state.flow === "reversal";
  const { src, dst } = rev ? flowPairs((code) => revScore(code), FLOW_MIN.reversal) : flowPairs((code) => state.views[code]?.groups[asset]?.score);
  const names = (arr) => arr.slice(0, 3).map((p) => `${state.views[p.code].flag} ${esc(state.views[p.code].name)}`).join(", ");
  const k = `<span class="flow-k">${rev ? "REVERSAL FLOW" : "MONEY FLOW"} · ${TF_HUD[tf]}</span>`;
  $("#flowLine").hidden = state.flow === "off";
  $("#flowLine").innerHTML = src.length && dst.length
    ? `${k}${rev ? "Reversing down, money leaving" : "Out of"} <b class="down">${names(src)}</b> <span class="flow-arrow">→</span> ${rev ? "reversing up, money arriving in" : "into"} <b class="up">${names(dst)}</b>`
    : `${k}${rev ? "No country is reversing on both sides of the flow right now." : "No clear flow. Buyers and sellers are not in control anywhere."}`;
  renderMine();
}

function insights() {
  const { tf } = state;
  const out = [];
  const revs = state.data.markets.map((m) => reversal(m.tf[tf])).filter(Boolean);
  const ru = revs.filter((r) => r.dir > 0).length, rd = revs.length - ru;
  if (revs.length) out.push(`↺ <b>${ru}</b> markets are reversing up and <b>${rd}</b> are reversing down this ${TF_WORD[tf]}. <a href="#reversals">See them</a>.`);
  for (const v of Object.values(state.views)) {
    const s = v.groups.stocks?.verdict, b = v.groups.bonds?.verdict;
    if (!s || !b) continue;
    const name = esc(v.name);
    if (s === "BUY" && b === "SELL") out.push(`<b>Risk-on in ${name}</b>: bonds sold (yields rising), stocks bought.`);
    else if (s === "SELL" && b === "BUY") out.push(`<b>Flight to safety in ${name}</b>: stocks sold, bonds bought (yields falling).`);
    else if (s === "SELL" && b === "SELL") out.push(`<b>Capital leaving ${name}</b>: stocks <b>and</b> bonds sold (yields rising).`);
    else if (s === "BUY" && b === "BUY") out.push(`<b>Liquidity wave in ${name}</b>: stocks and bonds both bought (yields falling).`);
  }
  const sectors = state.data.markets.filter((m) => m.kind === "sector" && m.tf[tf]);
  if (sectors.length) {
    const ranked = [...sectors].sort((a, b) => control(b.tf[tf]).score - control(a.tf[tf]).score);
    const top = ranked[0], bot = ranked[ranked.length - 1];
    if (control(top.tf[tf]).score >= 0.5) out.push(`Strongest world sector: <b>${esc(top.name)}</b> (${S_LABEL[top.tf[tf].s]}).`);
    if (control(bot.tf[tf]).score <= -0.5) out.push(`Weakest world sector: <b>${esc(bot.name)}</b> (${S_LABEL[bot.tf[tf].s]}).`);
  }
  const gold = state.data.markets.find((m) => m.symbol === "GC=F")?.tf[tf];
  if (gold?.s === "2u" && gold.g > 0) out.push(`<b>Gold</b> is breaking out this ${TF_WORD[tf]}.`);
  const usd = state.data.markets.find((m) => m.symbol === "DX-Y.NYB")?.tf[tf];
  if (usd?.s === "2d" && usd.g < 0) out.push(`The <b>US dollar</b> is breaking down this ${TF_WORD[tf]}.`);
  return out.slice(0, 6);
}

/* ---------- Your market ---------- */

const TZ = {
  "America/New_York": "US", "America/Chicago": "US", "America/Denver": "US", "America/Los_Angeles": "US", "America/Phoenix": "US", "America/Anchorage": "US", "Pacific/Honolulu": "US",
  "America/Toronto": "CA", "America/Vancouver": "CA", "America/Edmonton": "CA", "America/Winnipeg": "CA", "America/Halifax": "CA", "America/Montreal": "CA",
  "America/Mexico_City": "MX", "America/Monterrey": "MX", "America/Sao_Paulo": "BR", "America/Santiago": "CL",
  "Europe/London": "GB", "Europe/Berlin": "DE", "Europe/Paris": "FR", "Europe/Rome": "IT", "Europe/Madrid": "ES", "Europe/Amsterdam": "NL",
  "Europe/Zurich": "CH", "Europe/Stockholm": "SE", "Europe/Copenhagen": "DK", "Europe/Brussels": "BE", "Europe/Vienna": "AT", "Europe/Warsaw": "PL",
  "Europe/Oslo": "NO", "Africa/Johannesburg": "ZA", "Asia/Tokyo": "JP", "Asia/Shanghai": "CN", "Asia/Hong_Kong": "HK", "Asia/Kolkata": "IN", "Asia/Calcutta": "IN",
  "Asia/Seoul": "KR", "Asia/Taipei": "TW", "Pacific/Auckland": "NZ", "Asia/Singapore": "SG", "Asia/Jakarta": "ID", "Asia/Kuala_Lumpur": "MY",
  "Asia/Bangkok": "TH", "Asia/Manila": "PH", "Asia/Riyadh": "SA", "Asia/Jerusalem": "IL", "Europe/Istanbul": "TR",
};

function detectCountry() {
  const me = new URLSearchParams(location.search).get("me")?.toUpperCase();
  if (me && COUNTRIES[me] && me !== "GLOBAL") return me;
  let tz = "";
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch {}
  if (TZ[tz]) return TZ[tz];
  if (tz.startsWith("Australia/")) return "AU";
  if (tz.startsWith("America/Argentina")) return "AR";
  const region = (navigator.language || "").split("-")[1]?.toUpperCase();
  if (region && COUNTRIES[region] && region !== "GLOBAL") return region;
  return tz.startsWith("America/") ? "US" : null;
}

function renderMine() {
  const v = state.mine && state.views[state.mine];
  const g = v?.groups.stocks ?? v?.groups.bonds;
  if (!g) { $("#mine").hidden = true; return; }
  const green = TIMEFRAMES.filter((t) => g.lead.tf[t]?.g > 0).length;
  const rev = reversal(g.lead.tf[state.tf]);
  $("#mine").hidden = false;
  $("#mine").innerHTML = `<button class="mine ${vClass(g.verdict)}" data-country="${v.code}">
    <span class="mine-k">YOUR MARKET · ${esc(v.name.toUpperCase())}</span>
    <b>${v.flag} ${esc(VERDICT_WORDS[g.verdict])} ${state.tf === "D" ? "today" : `this ${TF_WORD[state.tf]}`}.</b>
    <span>${esc(g.lead.name)}: ${green} of 5 timeframes green${rev ? ` · ↺ ${rev.name}` : ""} · SEE INSIDE →</span></button>`;
}

/* ---------- Render: tiles ---------- */

function cells(m, selTf) {
  return TIMEFRAMES.map((t) => {
    const st = m?.tf[t];
    if (!st) return `<span class="cell none"><small>${t}</small>–</span>`;
    const rev = reversal(st);
    return `<span class="cell ${gClass(st.g)} s-${esc(st.s)}${t === selTf ? " sel" : ""}${rev ? " rev" : ""}" title="${esc(m.name)} · ${TF_WORD[t]}: ${esc(explain(st, TF_WORD[t]))}${rev ? ` Reversal: ${esc(rev.name)}.` : ""}"><small>${t}</small>${S_LABEL[st.s] ?? "?"}</span>`;
  }).join("");
}

const ftfcTag = (ftfc) => (ftfc ? `<div class="ftfc-tag ${ftfc > 0 ? "up" : "down"}">${ftfc > 0 ? "▲ ALL 5 TIMEFRAMES GREEN" : "▼ ALL 5 TIMEFRAMES RED"}</div>` : "");

function renderCountries() {
  const { tf, asset } = state;
  const views = Object.values(state.views).sort((a, b) => (b.groups[asset]?.score ?? -9) - (a.groups[asset]?.score ?? -9));
  $("#countryMeta").textContent = `${views.length} NATIONS · SORTED BY ${asset.toUpperCase()} ON THE ${TF_HUD[tf]} · CLICK FOR EVERY MARKET INSIDE`;
  $("#countryGrid").innerHTML = views.map((v) => {
    const g = v.groups[asset];
    const verdict = g ? g.verdict : `NO ${asset.toUpperCase()}`;
    const rows = ["stocks", "bonds"].filter((a) => v.groups[a]).map((a) =>
      `<div class="row"><span class="lbl">${a.toUpperCase()}</span>${cells(v.groups[a].lead, tf)}</div>`).join("");
    const rev = g && reversal(g.lead.tf[tf]);
    return `<button class="tile ${g?.ftfc > 0 ? "ftfc-up" : g?.ftfc < 0 ? "ftfc-down" : ""}${g ? "" : " dim"}" data-country="${v.code}">
      <div class="cap"><span class="name">${v.flag} ${esc(v.name)}<span class="side">${v.side.toUpperCase()}</span></span>
      <span class="verdict ${vClass(verdict)}">${esc(verdict)}</span></div>
      ${rows}${ftfcTag(g?.ftfc)}${rev ? `<div class="rev-tag ${rev.dir > 0 ? "up" : "down"}">↺ ${esc(rev.name)} on the ${TF_WORD[tf]}</div>` : ""}
    </button>`;
  }).join("");

  const others = state.data.markets.filter((m) => m.kind === "sector" || m.kind === "macro");
  $("#sectorGrid").innerHTML = others.map((m) => {
    const c = control(m.tf[tf]);
    const ftfc = continuity(m.tf);
    return `<div class="tile ${ftfc > 0 ? "ftfc-up" : ftfc < 0 ? "ftfc-down" : ""}">
      <div class="cap"><span class="name">${esc(m.name)}</span><span class="verdict ${c.score >= 0.5 ? "buy" : c.score <= -0.5 ? "sell" : ""}">${c.score >= 0.5 ? "BUYERS" : c.score <= -0.5 ? "SELLERS" : c.score === 0 ? "COILING" : c.score > 0 ? "LEANING UP" : "LEANING DOWN"}</span></div>
      <div class="row five">${cells(m, tf)}</div></div>`;
  }).join("");
}

/* ---------- Render: reversals ---------- */

const REV_RANK = (r) => (r.name.startsWith("FAILED") ? 2 : r.name.startsWith("2-2") ? 1 : 0);

function renderReversals() {
  const { tf } = state;
  const all = state.data.markets.map((m) => ({ m, r: reversal(m.tf[tf]) })).filter((x) => x.r);
  const byTf = TIMEFRAMES.map((t) => `<button data-tf="${t}" class="${t === tf ? "on" : ""}">${TF_BTN[t]} <b>${state.data.markets.filter((m) => reversal(m.tf[t])).length}</b></button>`).join("");
  $("#revTfs").innerHTML = byTf;
  const col = (dir) => {
    const rows = all.filter((x) => x.r.dir === dir).sort((a, b) => REV_RANK(a.r) - REV_RANK(b.r));
    if (!rows.length) return `<div class="rev-empty">No ${dir > 0 ? "upside" : "downside"} reversals on the ${TF_WORD[tf]}.</div>`;
    const open = state.revAll;
    const more = !open && rows.length > 12 ? `<button class="rev-more" data-revall="1">SHOW ALL ${rows.length} ↓</button>` : "";
    return rows.slice(0, open ? rows.length : 12).map(({ m, r }) => {
      const c = COUNTRIES[m.country];
      return `<button class="rev-row" ${m.country !== "GLOBAL" ? `data-country="${m.country}"` : ""}>
        <span class="rev-name">${c.flag} ${esc(m.name)}<small>${esc(m.country === "GLOBAL" ? m.kind.toUpperCase() : c.name.toUpperCase())}</small></span>
        <span class="rev-chip ${dir > 0 ? "up" : "down"}">${esc(r.name)}</span>
        <span class="rev-story">${esc(r.story)}</span></button>`;
    }).join("") + more;
  };
  $("#revUp").innerHTML = col(1);
  $("#revDown").innerHTML = col(-1);
  $("#revMeta").textContent = `${all.length} MARKETS REVERSING ON THE ${TF_HUD[tf]} · PATTERNS: 2-1-2 · 3-1-2 · 1-2-2 · 2-2 · FAILED 2`;
}

/* ---------- Render: global pulse (daily breadth) ---------- */

let pulseDays = [];
const PULSE = { w: 1000, h: 190, mid: 95, pad: 18 };

function renderPulse() {
  const byDate = new Map();
  for (const m of state.data.markets) {
    if (m.symbol === "BTC-USD") continue;
    for (const [d, s] of m.hist) {
      const e = byDate.get(d) ?? { up: 0, down: 0, n: 0 };
      e.n++; if (s === "2u") e.up++; if (s === "2d") e.down++;
      byDate.set(d, e);
    }
  }
  const min = state.data.markets.length * 0.4;
  pulseDays = [...byDate.entries()].filter(([, e]) => e.n >= min).sort(([a], [b]) => (a < b ? -1 : 1)).slice(-60);
  if (!pulseDays.length) return;
  const { w, h, mid, pad } = PULSE;
  const max = Math.max(...pulseDays.map(([, e]) => Math.max(e.up, e.down)), 1);
  const bw = (w - pad * 2) / pulseDays.length;
  const y = (v) => (v / max) * (mid - 16);
  let bars = "", line = "";
  pulseDays.forEach(([d, e], i) => {
    const x = pad + i * bw, tip = `<title>${esc(d)}: ${e.up} broke up, ${e.down} broke down (of ${e.n})</title>`;
    bars += `<rect x="${x + 1}" y="${mid - y(e.up)}" width="${Math.max(bw - 2, 1)}" height="${y(e.up)}" fill="var(--up)" opacity=".85">${tip}</rect>`;
    bars += `<rect x="${x + 1}" y="${mid}" width="${Math.max(bw - 2, 1)}" height="${y(e.down)}" fill="var(--down)" opacity=".85">${tip}</rect>`;
    line += `${i ? "L" : "M"}${x + bw / 2},${mid - y(e.up - e.down)}`;
  });
  const labels = [0, Math.floor(pulseDays.length / 2), pulseDays.length - 1].map((i) =>
    `<text class="axis" x="${pad + i * bw + bw / 2}" y="${h - 2}" text-anchor="middle">${esc(pulseDays[i][0].slice(5))}</text>`).join("");
  $("#pulse").innerHTML = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Daily count of markets breaking up versus down">
    <line x1="${pad}" x2="${w - pad}" y1="${mid}" y2="${mid}" stroke="var(--border-hi)"/>${bars}
    <path d="${line}" fill="none" stroke="var(--fg)" stroke-width="1.5" vector-effect="non-scaling-stroke" opacity=".8"/>
    <line id="pulseCursor" y1="0" y2="${h - 12}" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke" visibility="hidden"/>
    <text class="axis" x="${pad}" y="11">▲ BROKE UP</text><text class="axis" x="${pad}" y="${h - 14}">▼ BROKE DOWN</text>${labels}</svg>`;
}

/* ---------- Replay: the selected timeframe over the last 3, 6 or 12 months ---------- */

// Frames from the per-day timeline. BY BAR: one frame per completed bar of the timeframe.
// BY DAY: the bar in force on every trading day, as it stood that day.
function buildReplay(asset, tf, step, days) {
  const axis = state.data.axis;
  if (!axis?.length) return [];
  const from = Math.max(0, axis.length - days);
  const keys = axis.map((d) => periodKey(d, tf));
  const idx = [];
  for (let i = from; i < axis.length; i++) {
    if (step === "day" || tf === "D" || i === axis.length - 1 || keys[i + 1] !== keys[i]) idx.push(i);
  }
  const frames = idx.map((i) => ({ d: axis[i], i, sum: {}, cnt: {}, rsum: {}, up: 0, down: 0 }));
  const at = new Map(idx.map((i, k) => [i, frames[k]]));
  for (const m of state.data.markets) {
    const line = m.tl?.[tf];
    if (!line || assetOf(m) !== asset || m.country === "GLOBAL") continue;
    const done = []; // final scenario of each completed bar
    let lastKey = null, last = null;
    for (let i = 0; i < axis.length; i++) {
      if (lastKey !== null && keys[i] !== lastKey && last) done.push(last.s);
      lastKey = keys[i];
      last = decodeState(line[i]);
      const f = at.get(i);
      if (!f || !last) continue;
      f.sum[m.country] = (f.sum[m.country] ?? 0) + control(last).score;
      f.cnt[m.country] = (f.cnt[m.country] ?? 0) + 1;
      f.rsum[m.country] = (f.rsum[m.country] ?? 0) + (reversal({ q: [...done.slice(-2), last.s], g: last.g })?.dir ?? 0);
      if (last.s === "2u") f.up++;
      if (last.s === "2d") f.down++;
    }
  }
  return frames.map((f) => {
    const scores = {}, rev = {};
    for (const c in f.sum) { scores[c] = f.sum[c] / f.cnt[c]; rev[c] = f.rsum[c] / f.cnt[c]; }
    return { d: f.d, scores, rev, up: f.up, down: f.down };
  });
}

const RANGE_DAYS = { "3M": 63, "6M": 126, "1Y": 260 };
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
  if (!replayTimer) $("#replayBtn").textContent = `▶ REPLAY ${TF_HUD[tf]} BARS`;
  $("#replayBtn").disabled = !state.data.axis;
  $("#replayBtn").title = state.data.axis ? "" : "Replay starts after the next hourly update";
}

let replayTimer = null, replayEnds = 0;
function stopReplay() {
  clearInterval(replayTimer); replayTimer = null;
  state.frame = null;
  $("#hudReplay").textContent = "";
  $("#replayProg").style.width = "0";
  $("#pulseCursor")?.setAttribute("visibility", "hidden");
  renderReplayControls();
  globe?.redraw();
}
function startReplay() {
  if (replayTimer) return stopReplay();
  const { tf, step, range } = replayPlan();
  const frames = buildReplay(state.asset, tf, step, RANGE_DAYS[range]);
  if (!frames.length) return;
  let i = 0;
  $("#replayBtn").textContent = "■ STOP";
  const every = Math.max(60, Math.min(700, 12000 / frames.length));
  replayEnds = performance.now() + every * frames.length;
  const pulseIdx = new Map(pulseDays.map(([d], k) => [d, k]));
  const bw = (PULSE.w - PULSE.pad * 2) / Math.max(pulseDays.length, 1);
  replayTimer = setInterval(() => {
    if (i >= frames.length) { stopReplay(); return; }
    const f = frames[i];
    state.frame = f;
    $("#hudReplay").textContent = `REPLAY · ${TF_HUD[tf]} BARS · ${step === "day" ? "BY DAY" : "BY BAR"} · ${f.d} · ▲${f.up} ▼${f.down}`;
    $("#replayProg").style.width = `${((i + 1) / frames.length) * 100}%`;
    const cur = $("#pulseCursor"), k = pulseIdx.get(f.d);
    if (cur && k !== undefined) { const x = PULSE.pad + k * bw + bw / 2; cur.setAttribute("x1", x); cur.setAttribute("x2", x); cur.setAttribute("visibility", "visible"); }
    else cur?.setAttribute("visibility", "hidden");
    globe?.redraw();
    i++;
  }, every);
}

/* ---------- Mini candlestick chart (shape only) ---------- */

function sparkSvg(m, tf) {
  const sp = m.spark?.[tf];
  if (!sp?.c?.length) return "";
  const n = sp.c.length / 4, W = 300, H = 80, top = 6, bot = 6, plot = H - top - bot;
  const y = (v) => top + plot - (v / 999) * plot;
  const step = W / n, bw = Math.max(3, step * 0.56);
  let out = "";
  if (n >= 2) {
    const ph = sp.c[(n - 2) * 4 + 1], pl = sp.c[(n - 2) * 4 + 2];
    out += `<line x1="0" x2="${W}" y1="${y(ph)}" y2="${y(ph)}" class="trig"/><line x1="0" x2="${W}" y1="${y(pl)}" y2="${y(pl)}" class="trig"/>`;
  }
  for (let i = 0; i < n; i++) {
    const [o, h, l, c] = sp.c.slice(i * 4, i * 4 + 4);
    const x = i * step + step / 2, cls = c > o ? "up" : c < o ? "down" : "flat";
    out += `<line x1="${x}" x2="${x}" y1="${y(h)}" y2="${y(l)}" class="wick ${cls}"/>`;
    out += `<rect x="${x - bw / 2}" y="${y(Math.max(o, c))}" width="${bw}" height="${Math.max(1.2, Math.abs(y(o) - y(c)))}" class="body ${cls}${i === n - 1 ? " cur" : ""}"/>`;
  }
  const labels = sp.s.map((s) => `<i class="s-${esc(s)}">${S_LABEL[s] ?? ""}</i>`).join("");
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Last ${n} ${TF_WORD[tf]} bars of ${esc(m.name)}">${out}</svg>
    <div class="spark-lbls" style="grid-template-columns:repeat(${n},1fr)">${labels}</div>
    <div class="spark-cap"><span>LAST ${n} ${TF_HUD[tf]} BARS · SHAPE ONLY</span><span>${m.live ? "● CURRENT BAR LIVE" : "DOTTED = LAST BAR'S HIGH / LOW"}</span></div>`;
}

/* ---------- Drawer ---------- */

function openCountry(code, refocus = true) {
  const v = state.views[code];
  if (!v) return;
  const { tf } = state;
  state.focus = code;
  if (refocus) globe?.focus(code);
  const say = Object.entries(v.groups).map(([a, g]) =>
    g.verdict === "BUY" || g.verdict === "SELL" ? `${callText(v, a, g.verdict)}${a === "bonds" ? ` (${rateWords(g.verdict)})` : ""}` : `${v.name} ${a}: ${VERDICT_WORDS[g.verdict].toLowerCase()}`).join(" · ");
  const item = (m) => {
    const rev = reversal(m.tf[tf]);
    const others = TIMEFRAMES.filter((t) => t !== tf).map((t) => [t, reversal(m.tf[t])]).filter(([, r]) => r);
    return `<div class="dr-item"><div class="top"><b>${esc(m.name)}</b><span>${esc(m.symbol)} · ${m.live ? '<em class="live">● LIVE BAR</em>' : `LAST BAR ${esc(m.asOf)}`}${m.stale ? " · DATA DELAYED" : ""}</span></div>
      ${sparkSvg(m, tf)}
      <div class="row five">${cells(m, tf)}</div>
      <p>${esc(explain(m.tf[tf], TF_WORD[tf]))}</p>
      ${rev ? `<p class="dr-rev ${rev.dir > 0 ? "up" : "down"}">↺ ${esc(rev.name)} on the ${TF_WORD[tf]}: ${esc(rev.story)}</p>` : ""}
      ${others.length ? `<p class="dr-also">Also reversing: ${others.map(([t, r]) => `${esc(r.name)} (${TF_WORD[t]})`).join(" · ")}</p>` : ""}
      <div class="seq"><em>LAST 12 DAYS</em>${m.hist.slice(-12).map(([d, s, gg]) => `<i class="${gClass(gg)}" title="${esc(d)}">${S_LABEL[s] ?? "?"}</i>`).join("")}</div></div>`;
  };
  $("#drawerBody").innerHTML = `<div class="dr-kicker">TARGET ACQUIRED · ${v.side.toUpperCase()} · ${TF_HUD[tf]} BARS</div>
    <h3 id="drawerTitle">${v.flag} ${esc(v.name)}</h3><p class="dr-say">${esc(say)}</p>
    ${Object.entries(v.groups).map(([a, g]) => `<div class="dr-group"><h4>${a.toUpperCase()} <span class="verdict ${vClass(g.verdict)}">${esc(g.verdict)}</span></h4>${g.members.map(item).join("")}</div>`).join("")}
    <p class="disclaim">Education only. Not investment advice.</p>`;
  const wasHidden = $("#drawer").hidden;
  if (wasHidden) lastFocus = document.activeElement;
  $("#drawer").hidden = false;
  if (wasHidden) $("#drawerClose").focus();
  writeHash();
}
let lastFocus = null;
function closeDrawer() {
  if ($("#drawer").hidden) return;
  $("#drawer").hidden = true; state.focus = null; globe?.focus(null); writeHash();
  lastFocus?.focus?.();
}

/* ---------- Globe ---------- */

let globe = null;

function heat(score, alpha = 1) {
  const s = Math.sign(score) * Math.sqrt(Math.abs(score)); // lift weak scores so the map is not muddy
  const t = (s + 1) / 2;
  if (state.sensor === "flir") return d3.interpolateInferno(0.12 + t * 0.82);
  if (state.sensor === "nvg") return d3.interpolateRgb("#0b2a0e", "#c6ffb5")(t);
  const c = s >= 0 ? d3.interpolateRgb("#2a281e", "#10b981")(s) : d3.interpolateRgb("#2a281e", "#ef4444")(-s);
  return alpha === 1 ? c : d3.color(c).copy({ opacity: alpha }).formatRgb();
}
const SENSOR = {
  normal: { ocean: "#0c0b09", land: "#1b1a14", line: "#2a281e", grat: "rgba(179,175,162,0.07)", glow: "rgba(99,102,241,0.25)", text: "#ece9e0" },
  flir: { ocean: "#07031a", land: "#1a0b3a", line: "#2b1660", grat: "rgba(255,160,60,0.08)", glow: "rgba(255,122,26,0.28)", text: "#ffe9c2" },
  nvg: { ocean: "#020803", land: "#08200c", line: "#12401a", grat: "rgba(109,255,94,0.08)", glow: "rgba(109,255,94,0.22)", text: "#b9ffa8" },
};

function initGlobe(world, start) {
  const canvas = $("#globe");
  const ctx = canvas.getContext("2d");
  const features = topojson.feature(world, world.objects.countries).features;
  const byIso = new Map(Object.entries(COUNTRIES).filter(([, c]) => c.iso).map(([code, c]) => [c.iso, code]));
  const globeProj = d3.geoOrthographic().clipAngle(90).precision(0.6);
  const flatProj = d3.geoNaturalEarth1().rotate([-10, 0]).precision(0.6);
  let proj = globeProj, path = d3.geoPath(proj, ctx);
  const isFlat = () => state.view === "flat";
  function useView() {
    const p = isFlat() ? flatProj : globeProj;
    if (p !== proj) { proj = p; path = d3.geoPath(proj, ctx); }
  }
  const grat = d3.geoGraticule10();
  const at = start && COUNTRIES[start]?.at;
  let rot = at ? [-at[0] + 25, -at[1] * 0.6, 0] : [-10, -25, 0];
  let spin = !reduceMotion, anim = null, w = 0, h = 0, resumeAt = 0, dirty = true;
  let zoom = 1, zoomAnim = null, base = 1, flatBase = 1, flatT = [0, 0], pan = [0, 0], panTarget = null, panHome = false;
  const ZMIN = 1, ZMAX = 6;
  // Globe: zoom = scale. Flat map: zoom about the canvas centre, plus a pan offset in pixels.
  function applyScale() {
    globeProj.translate([w / 2, h / 2]).scale(base * zoom);
    const lim = (w * zoom) / 2;
    pan = [Math.max(-lim, Math.min(lim, pan[0])), Math.max(-lim, Math.min(lim, pan[1]))];
    flatProj.scale(flatBase * zoom).translate([w / 2 + (flatT[0] - w / 2) * zoom + pan[0], h / 2 + (flatT[1] - h / 2) * zoom + pan[1]]);
    dirty = true;
  }
  const setZoom = (z) => {
    const nz = Math.max(ZMIN, Math.min(ZMAX, z));
    pan = pan.map((v) => (v * nz) / zoom);
    zoom = nz;
    applyScale();
    $("#zoomLvl").textContent = `${zoom.toFixed(1)}×`;
  };
  let visible = true, held = false, lastDraw = 0, lastHud = 0, lastT = performance.now();

  function resize() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, innerWidth < 700 ? 1.5 : 2);
    w = r.width; h = r.height;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    base = Math.min(w, h) * 0.42;
    flatProj.fitExtent([[12, 24], [w - 12, h - 24]], { type: "Sphere" });
    flatBase = flatProj.scale(); flatT = flatProj.translate();
    applyScale();
  }
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);
  resize();

  const scoreOf = (code) => (state.frame ? state.frame.scores[code] : state.views[code]?.groups[state.asset]?.score);

  // Project a point lifted h globe-radii above the surface. Hidden when behind the planet.
  function lift(p, h) {
    const [l, f] = d3.geoRotation(rot)(p).map((x) => (x * Math.PI) / 180);
    const [cx, cy] = proj.translate(), R = proj.scale(), r = R * (1 + h);
    const x = cx + r * Math.cos(f) * Math.sin(l), y = cy - r * Math.sin(f);
    return [x, y, Math.cos(f) * Math.cos(l) > 0 || Math.hypot(x - cx, y - cy) > R];
  }
  let flowKey = "", flows = [];
  function currentFlows() {
    const key = `${state.flow}|${state.asset}|${state.tf}|${state.frame?.d ?? ""}|${Object.keys(state.views).length}`;
    if (key !== flowKey) {
      flowKey = key;
      const rev = state.flow === "reversal";
      const fn = rev ? (code) => (state.frame ? state.frame.rev[code] : revScore(code)) : scoreOf;
      flows = flowPairs(fn, FLOW_MIN[state.flow]).pairs.map((f) => {
        const dist = d3.geoDistance(f.a.at, f.b.at);
        return { ...f, dist, interp: d3.geoInterpolate(f.a.at, f.b.at), h: 0.06 + 0.2 * (dist / Math.PI) };
      });
    }
    return flows;
  }
  function drawFlows(t, P) {
    const list = currentFlows();
    if (!list.length) return;
    const lo = heat(-1), hi = heat(1);
    const flat = isFlat();
    for (const f of list) {
      let pos;
      if (flat) {
        // Flat map: a curve that bows upward between the two countries.
        const a0 = proj(f.a.at), b0 = proj(f.b.at);
        const c = [(a0[0] + b0[0]) / 2, (a0[1] + b0[1]) / 2 - Math.hypot(b0[0] - a0[0], b0[1] - a0[1]) * 0.32];
        pos = (u) => [(1 - u) ** 2 * a0[0] + 2 * u * (1 - u) * c[0] + u * u * b0[0], (1 - u) ** 2 * a0[1] + 2 * u * (1 - u) * c[1] + u * u * b0[1], true];
      } else {
        pos = (u) => lift(f.interp(u), f.h * Math.sin(Math.PI * u));
      }
      const pts = [];
      for (let i = 0; i <= 40; i++) pts.push(pos(i / 40));
      const a = pts[0], b = pts[40];
      const grad = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
      grad.addColorStop(0, d3.color(lo).copy({ opacity: 0.55 }).formatRgb());
      grad.addColorStop(1, d3.color(hi).copy({ opacity: 0.75 }).formatRgb());
      ctx.strokeStyle = grad;
      ctx.lineWidth = 0.8 + f.w * 1.6;
      ctx.beginPath();
      let pen = false;
      for (const [x, y, vis] of pts) { if (vis) { pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y); pen = true; } else pen = false; }
      ctx.stroke();
      // Particles: money moving from the selling side to the buying side.
      const n = 2 + Math.round(f.w * 3);
      for (let k = 0; k < n; k++) {
        const u = reduceMotion ? (k + 0.5) / n : ((t * 0.00022) / (0.35 + f.dist) + f.phase + k / n) % 1;
        const [x, y, vis] = pos(u);
        if (!vis) continue;
        const c = d3.interpolateRgb(lo, hi)(u);
        ctx.beginPath(); ctx.arc(x, y, 5, 0, 2 * Math.PI); ctx.fillStyle = d3.color(c).copy({ opacity: 0.18 }).formatRgb(); ctx.fill();
        ctx.beginPath(); ctx.arc(x, y, 1.9, 0, 2 * Math.PI); ctx.fillStyle = P.text; ctx.fill();
      }
    }
  }

  function draw(t) {
    const P = SENSOR[state.sensor];
    useView();
    const flat = isFlat();
    if (!flat) globeProj.rotate(rot);
    ctx.clearRect(0, 0, w, h);
    if (!flat) {
      const [cx, cy] = proj.translate(), R = proj.scale();
      const glow = ctx.createRadialGradient(cx, cy, R * 0.95, cx, cy, R * 1.18);
      glow.addColorStop(0, P.glow); glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, R * 1.18, 0, 2 * Math.PI); ctx.fill();
    }
    ctx.beginPath(); path({ type: "Sphere" }); ctx.fillStyle = P.ocean; ctx.fill();
    ctx.beginPath(); path(grat); ctx.strokeStyle = P.grat; ctx.lineWidth = 0.6; ctx.stroke();

    for (const f of features) {
      const code = byIso.get(f.id);
      const s = code ? scoreOf(code) : undefined;
      ctx.beginPath(); path(f);
      ctx.fillStyle = s === undefined ? P.land : heat(s);
      ctx.fill();
      const hot = code && (code === state.hover || code === state.focus || code === state.mine);
      ctx.strokeStyle = hot ? P.text : P.line;
      ctx.lineWidth = hot ? 1.4 : 0.5;
      ctx.stroke();
    }

    if (state.flow !== "off") drawFlows(t, P);

    // Markers with Strat labels on the visible side. Labels that would overlap are skipped.
    const center = [-rot[0], -rot[1]];
    ctx.font = "600 9.5px 'JetBrains Mono', monospace";
    ctx.textBaseline = "middle";
    const placed = [];
    let k = 0;
    for (const [code, v] of Object.entries(state.views)) {
      k++;
      if (!v.at || (!flat && d3.geoDistance(v.at, center) > 1.45)) continue;
      const g = v.groups[state.asset];
      const s = scoreOf(code);
      if (!g || s === undefined) continue;
      const [x, y] = proj(v.at);
      const st = g.lead.tf[state.tf];
      const rev = !state.frame && reversal(st);
      const pulse = reduceMotion ? 0 : (Math.sin(t / 380 + k) + 1) / 2;
      ctx.beginPath(); ctx.arc(x, y, 3 + pulse * 6, 0, 2 * Math.PI);
      ctx.strokeStyle = heat(s, 0.5 * (1 - pulse)); ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, 2.6, 0, 2 * Math.PI); ctx.fillStyle = P.text; ctx.fill();
      if (rev) { ctx.beginPath(); ctx.arc(x, y, 7, -Math.PI / 2, Math.PI); ctx.strokeStyle = P.text; ctx.lineWidth = 1.2; ctx.stroke(); }
      const label = state.frame ? code : `${code} ${st ? S_LABEL[st.s] : ""}${rev ? " ↺" : ""}`;
      const lw = ctx.measureText(label).width;
      if (placed.some((b) => x + 9 < b.x + b.w && x + 9 + lw > b.x && Math.abs(y - b.y) < 11)) continue;
      placed.push({ x: x + 9, y, w: lw });
      ctx.fillStyle = P.text;
      ctx.fillText(label, x + 9, y);
    }

    // Target reticle on the focused country.
    const fv = state.focus && state.views[state.focus];
    if (fv?.at && (flat || d3.geoDistance(fv.at, center) < 1.45)) {
      const [x, y] = proj(fv.at), s = 22;
      ctx.strokeStyle = P.text; ctx.lineWidth = 1.2;
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        ctx.beginPath(); ctx.moveTo(x + dx * s, y + dy * (s - 8)); ctx.lineTo(x + dx * s, y + dy * s); ctx.lineTo(x + dx * (s - 8), y + dy * s); ctx.stroke();
      }
    }
    if (t - lastHud > 250) {
      lastHud = t;
      $("#hudOrbit").textContent = flat ? `SAT-01 // FLAT MAP · NATURAL EARTH · ${zoom.toFixed(1)}×` : `SAT-01 // LAT ${(-rot[1]).toFixed(1)} LON ${(((-rot[0] + 540) % 360) - 180).toFixed(1)}`;
    }
  }

  function frame(t) {
    requestAnimationFrame(frame);
    const dt = Math.min(t - lastT, 100);
    lastT = t;
    if (!visible && !held) return; // off-screen: skip (browsers already pause frames in background tabs)
    if (anim) {
      const p = Math.min(1, (t - anim.t0) / 1100);
      rot = anim.i(d3.easeCubicInOut(p));
      if (p >= 1) anim = null;
      dirty = true;
    }
    if (zoomAnim) {
      const p = reduceMotion ? 1 : Math.min(1, (t - zoomAnim.t0) / 900);
      setZoom(zoomAnim.from + (zoomAnim.to - zoomAnim.from) * d3.easeCubicInOut(p));
      if (p >= 1) zoomAnim = null;
    }
    if (isFlat() && panTarget) {
      const p = flatProj(panTarget), dx = w / 2 - p[0], dy = h / 2 - p[1];
      pan = [pan[0] + dx * (reduceMotion ? 1 : 0.18), pan[1] + dy * (reduceMotion ? 1 : 0.18)];
      applyScale();
      if (Math.hypot(dx, dy) < 0.5) panTarget = null;
    }
    if (panHome) {
      pan = pan.map((v) => v * (reduceMotion ? 0 : 0.8));
      applyScale();
      if (Math.hypot(...pan) < 0.5) { pan = [0, 0]; panHome = false; }
    }
    if (anim || isFlat()) {
      // rotation handled above; the flat map does not spin
    } else if (spin && t > resumeAt) {
      rot[0] = (rot[0] + 0.0042 * dt) % 360;
      dirty = true;
    }
    if (state.flow !== "off" && !reduceMotion) dirty = true;
    if (!dirty && reduceMotion) return;
    if (t - lastDraw < 33) return; // 30 fps is enough and saves battery
    lastDraw = t;
    dirty = false;
    draw(t);
  }
  draw(performance.now());
  requestAnimationFrame(frame);

  // Mouse: d3.drag rotates freely. Touch is handled below so a vertical swipe still scrolls the page.
  d3.select(canvas).call(d3.drag()
    .filter((e) => e.type === "mousedown" && !e.button)
    .on("start", () => { anim = null; panTarget = null; panHome = false; resumeAt = Infinity; })
    .on("drag", (e) => {
      if (isFlat()) { pan = [pan[0] + e.dx, pan[1] + e.dy]; applyScale(); return; }
      const k = 70 / proj.scale();
      rot = [rot[0] + e.dx * k, Math.max(-80, Math.min(80, rot[1] - e.dy * k)), 0];
      dirty = true;
    })
    .on("end", () => { resumeAt = performance.now() + 5000; }));
  canvas.style.touchAction = "pan-y";

  function countryAt(evt) {
    const r = canvas.getBoundingClientRect();
    const ll = proj.invert([evt.clientX - r.left, evt.clientY - r.top]);
    if (!ll || (!isFlat() && d3.geoDistance(ll, [-rot[0], -rot[1]]) > Math.PI / 2)) return null;
    // Small places (Hong Kong, Singapore) have no polygon at this scale: snap to the nearest marker.
    for (const [code, v] of Object.entries(state.views)) if (v.at && d3.geoDistance(ll, v.at) < 0.035) return code;
    const f = features.find((f) => byIso.has(f.id) && d3.geoContains(f, ll));
    return f ? byIso.get(f.id) : null;
  }
  canvas.addEventListener("pointermove", (e) => {
    const code = countryAt(e);
    if (code === state.hover) return;
    state.hover = code;
    dirty = true;
    const v = code && state.views[code], g = v?.groups[state.asset];
    $("#hudTarget").innerHTML = g
      ? `<b>${v.flag} ${esc(v.name)}</b><span class="v-${vClass(g.verdict)}">${esc(g.verdict === "BUY" || g.verdict === "SELL" ? callText(v, state.asset, g.verdict) : g.verdict)}</span><br>${esc(g.lead.name)} · ${S_LABEL[g.lead.tf[state.tf]?.s] ?? "–"} · ${TF_HUD[state.tf]}`
      : "";
  });
  canvas.addEventListener("pointerleave", () => { state.hover = null; dirty = true; $("#hudTarget").innerHTML = ""; });
  canvas.addEventListener("click", (e) => { const code = countryAt(e); if (code && state.views[code]) openCountry(code); });
  canvas.addEventListener("wheel", (e) => {
    if ((e.deltaY > 0 && zoom <= ZMIN) || (e.deltaY < 0 && zoom >= ZMAX)) return;
    e.preventDefault(); zoomAnim = null; setZoom(zoom * Math.exp(-e.deltaY * 0.0015));
  }, { passive: false });
  canvas.addEventListener("dblclick", (e) => { e.preventDefault(); zoomAnim = { t0: performance.now(), from: zoom, to: zoom * 1.8 }; });
  const touches = new Map();
  let pinch = null;
  canvas.addEventListener("pointerdown", (e) => { if (e.pointerType === "touch") touches.set(e.pointerId, [e.clientX, e.clientY]); });
  canvas.addEventListener("pointermove", (e) => {
    if (!touches.has(e.pointerId)) return;
    const prev = touches.get(e.pointerId);
    touches.set(e.pointerId, [e.clientX, e.clientY]);
    if (touches.size === 1) {
      anim = null; panTarget = null; panHome = false; resumeAt = performance.now() + 5000;
      if (isFlat()) { pan = [pan[0] + (e.clientX - prev[0]), pan[1]]; applyScale(); return; }
      rot = [rot[0] + (e.clientX - prev[0]) * (70 / proj.scale()), rot[1], 0];
      dirty = true;
      return;
    }
    if (touches.size !== 2) { pinch = null; return; }
    const [a, b] = [...touches.values()];
    const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    if (pinch) setZoom(pinch.z * (d / pinch.d)); else pinch = { d, z: zoom };
  });
  const lift2 = (e) => { touches.delete(e.pointerId); pinch = null; };
  canvas.addEventListener("pointerup", lift2);
  canvas.addEventListener("pointercancel", lift2);
  $("#zoomIn").addEventListener("click", () => { zoomAnim = { t0: performance.now(), from: zoom, to: zoom * 1.6 }; });
  $("#zoomOut").addEventListener("click", () => { zoomAnim = { t0: performance.now(), from: zoom, to: zoom / 1.6 }; });
  $("#zoomReset").addEventListener("click", () => { panTarget = null; panHome = true; zoomAnim = { t0: performance.now(), from: zoom, to: 1 }; });

  return {
    redraw() { dirty = true; },
    hold(on) { held = on; dirty = true; },
    focus(code) {
      dirty = true;
      const v = code && state.views[code];
      if (!v?.at) { resumeAt = performance.now() + 3000; return; }
      resumeAt = Infinity;
      panHome = false;
      panTarget = v.at; // used by the flat map
      const to = [-v.at[0], -v.at[1], 0];
      const from = [...rot];
      while (to[0] - from[0] > 180) to[0] -= 360;
      while (from[0] - to[0] > 180) to[0] += 360;
      anim = { t0: performance.now(), i: d3.interpolate(from, to) };
      if (zoom < 2.2) zoomAnim = { t0: performance.now(), from: zoom, to: 2.2 };
    },
  };
}

function renderLegend() {
  const stops = d3.range(0, 1.01, 0.1).map((t) => heat(t * 2 - 1)).join(",");
  $("#legendBar").style.background = `linear-gradient(90deg, ${stops})`;
}

/* ---------- Share ---------- */

function topCalls() {
  const { asset } = state;
  const views = Object.values(state.views).filter((v) => v.groups[asset]);
  const pick = (verdict) => views.filter((v) => v.groups[asset].verdict === verdict)
    .sort((a, b) => Math.abs(b.groups[asset].score) - Math.abs(a.groups[asset].score)).slice(0, 2)
    .map((v) => ({ v, verdict, text: `${v.flag} ${callText(v, asset, verdict)}` }));
  return [...pick("BUY"), ...pick("SELL")];
}

function shareText() {
  return [
    `GOD'S EYE VIEW of the world's money (${TF_HUD[state.tf]} bars):`,
    $("#headline").textContent,
    ...(state.flow === "off" ? [] : [`Money flow: ${$("#flowLine").textContent.slice($("#flowLine .flow-k")?.textContent.length ?? 0)}`]),
    ...topCalls().map((c) => c.text),
    `Headlines tell stories. Price tells the truth.`,
    `Not advice. Just price.`,
  ].join("\n");
}

async function share() {
  const text = shareText(), url = location.href;
  try { await navigator.clipboard.writeText(`${text}\n${url}`); } catch {}
  if (navigator.share) { try { await navigator.share({ text, url }); return; } catch {} }
  window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, "_blank", "noopener");
}

function wrapText(ctx, text, x, y, maxW, lh) {
  let line = "";
  for (const word of text.split(" ")) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, y); line = word; y += lh; } else line = test;
  }
  ctx.fillText(line, x, y);
  return y + lh;
}

// One vertical 9:16 frame (Shorts / Reels / TikTok size): headline, the live map or globe, flow, calls, link.
function composeCard(x, W, H) {
  const k = W / 1080;
  const css = getComputedStyle(document.body);
  const v = (n) => css.getPropertyValue(n).trim();
  const font = (wgt, px, fam) => `${wgt} ${Math.round(px * k)}px ${fam}`;
  const MONO = "'JetBrains Mono', monospace", DISP = "'Space Grotesk', sans-serif", SANS = "'Geist', sans-serif";
  x.fillStyle = v("--bg"); x.fillRect(0, 0, W, H);
  x.fillStyle = v("--accent"); x.fillRect(0, 0, W, 70 * k);
  x.fillStyle = v("--accent-fg"); x.font = font(600, 25, MONO); x.textAlign = "center"; x.textBaseline = "alphabetic";
  x.fillText(`GOD'S EYE VIEW // PRICE TRUTH // ${TF_HUD[state.tf]} BARS`, W / 2, 46 * k);
  x.textAlign = "left";
  x.fillStyle = v("--accent"); x.font = font(600, 26, MONO);
  x.fillText(`SITUATION REPORT · ${state.asset.toUpperCase()} · ${state.data.generatedAt.slice(0, 10)}`, 60 * k, 150 * k);
  x.fillStyle = v("--fg"); x.font = font(700, 68, DISP);
  wrapText(x, $("#headline").textContent, 60 * k, 235 * k, 960 * k, 78 * k);

  // Map area: y 520..1480
  const g = $("#globe"), top = 520 * k, areaH = 960 * k;
  if (state.view === "flat") {
    const dw = 1040 * k, dh = (dw * g.height) / g.width;
    x.drawImage(g, 0, 0, g.width, g.height, 20 * k, top + (areaH - dh) / 2, dw, dh);
  } else {
    const sq = Math.min(g.width, g.height);
    x.drawImage(g, (g.width - sq) / 2, (g.height - sq) / 2, sq, sq, 60 * k, top, areaH, areaH);
  }
  if (state.frame) {
    x.fillStyle = v("--accent"); x.font = font(600, 26, MONO);
    x.fillText($("#hudReplay").textContent, 60 * k, top + 20 * k);
  }

  const flowTxt = state.flow === "off" ? "" : $("#flowLine").textContent.slice($("#flowLine .flow-k")?.textContent.length ?? 0);
  if (flowTxt) {
    x.fillStyle = v("--fg-2"); x.font = font(500, 32, SANS);
    wrapText(x, `→ ${flowTxt}`, 60 * k, 1540 * k, 960 * k, 40 * k);
  }
  x.font = font(700, 36, DISP);
  topCalls().forEach((call, i) => {
    x.fillStyle = call.verdict === "BUY" ? v("--up") : v("--down");
    x.fillText(call.text.replace(/^\S+\s/, ""), (60 + (i % 2) * 490) * k, (1665 + Math.floor(i / 2) * 52) * k);
  });
  x.fillStyle = v("--fg-3"); x.font = font(400, 25, MONO);
  x.fillText(`${location.host}${location.pathname}`, 60 * k, 1835 * k);
  x.fillText("Headlines tell stories. Price tells the truth. Not advice.", 60 * k, 1875 * k);
}

function deliver(blob, ext) {
  const file = new File([blob], `gods-eye-view-${state.view}-${state.tf}-${state.data.generatedAt.slice(0, 10)}.${ext}`, { type: blob.type });
  if (matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files: [file] })) {
    return navigator.share({ files: [file], text: shareText() }).catch(() => {});
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = file.name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

const VIDEO_TYPES = ["video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp9", "video/webm"];
let recording = false;
function clipStatus(text) { $("#clip").textContent = text; }

// Save a clip of the moving map: VIDEO (MP4 or WebM), GIF, or a still PNG.
// If a replay is running, the clip records the rest of the replay (up to 20 s).
async function saveClip(kind) {
  if (recording) return;
  $("#clipMenu").hidden = true;
  recording = true;
  globe?.hold(true);
  try {
    const gif = kind === "gif";
    const W = gif ? 540 : 1080, H = gif ? 960 : 1920;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const x = c.getContext("2d", { willReadFrequently: gif });
    if (kind === "png") {
      composeCard(x, W, H);
      const blob = await new Promise((r) => c.toBlob(r, "image/png"));
      if (blob) await deliver(blob, "png");
      return;
    }
    const dur = replayTimer ? Math.min(20000, Math.max(3000, replayEnds - performance.now())) : 8000;
    const t0 = performance.now();
    const tick = () => clipStatus(`● REC ${Math.ceil((dur - (performance.now() - t0)) / 1000)}s`);

    if (!gif) {
      const mime = window.MediaRecorder && VIDEO_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
      if (!mime) return saveClip("gif");
      const rec = new MediaRecorder(c.captureStream(30), { mimeType: mime, videoBitsPerSecond: 8e6 });
      const chunks = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      const stopped = new Promise((r) => { rec.onstop = r; });
      composeCard(x, W, H);
      rec.start(250);
      await new Promise((done) => {
        const loop = () => { composeCard(x, W, H); tick(); performance.now() - t0 < dur ? requestAnimationFrame(loop) : done(); };
        requestAnimationFrame(loop);
      });
      rec.stop();
      await stopped;
      const type = mime.split(";")[0];
      await deliver(new Blob(chunks, { type }), type === "video/mp4" ? "mp4" : "webm");
      return;
    }

    const { GIFEncoder, quantize, applyPalette } = await import("./vendor/gifenc.esm.js");
    const enc = GIFEncoder();
    const fps = 10, frames = Math.round((dur / 1000) * fps);
    for (let i = 0; i < frames; i++) {
      const due = t0 + (i * 1000) / fps;
      await new Promise((r) => setTimeout(r, Math.max(0, due - performance.now())));
      composeCard(x, W, H);
      const { data } = x.getImageData(0, 0, W, H);
      const palette = quantize(data, 128, { format: "rgb444" });
      enc.writeFrame(applyPalette(data, palette, "rgb444"), W, H, { palette, delay: 1000 / fps });
      tick();
    }
    enc.finish();
    clipStatus("ENCODING…");
    await deliver(new Blob([enc.bytes()], { type: "image/gif" }), "gif");
  } finally {
    recording = false;
    globe?.hold(false);
    clipStatus("SAVE CLIP ⤓");
  }
}

/* ---------- Controls, URL state ---------- */

function setPressed(segId, v) {
  document.querySelectorAll(`#${segId} button`).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === v)));
}

function writeHash() {
  history.replaceState(null, "", `${location.pathname}${location.search}#tf=${state.tf}&asset=${state.asset}&sensor=${state.sensor}&flow=${state.flow}&view=${state.view}${state.focus ? `&c=${state.focus}` : ""}`);
}

function update(patch = {}) {
  if (replayTimer && (patch.asset || patch.tf)) stopReplay();
  Object.assign(state, patch);
  if (patch.tf) state.revAll = false;
  if (patch.tf || !Object.keys(state.views).length) state.views = buildViews(state.tf);
  document.body.dataset.sensor = state.sensor;
  setPressed("tfSeg", state.tf); setPressed("assetSeg", state.asset); setPressed("sensorSeg", state.sensor);
  $("#hudMode").textContent = `SENSOR ${state.sensor === "flir" ? "FLIR · BUYING RUNS HOT" : state.sensor === "nvg" ? "NVG" : "NORMAL"}`;
  $("#hudTf").textContent = `TF ${TF_HUD[state.tf]} · ${state.asset.toUpperCase()}`;
  setPressed("flowSeg", state.flow);
  setPressed("viewSeg", state.view);
  document.body.dataset.view = state.view;
  $("#dragHint").textContent = state.view === "flat" ? "DRAG TO PAN · CLICK A COUNTRY" : "DRAG TO ROTATE · CLICK A COUNTRY";
  $("#flowHint").textContent = state.flow === "reversal" ? "ARCS: REVERSING DOWN → REVERSING UP" : state.flow === "control" ? "ARCS: MONEY LEAVING SELLERS → BUYERS" : "";
  renderLegend(); renderIntel(); renderCountries(); renderReversals(); renderReplayControls();
  globe?.redraw();
  if (state.focus && !$("#drawer").hidden) openCountry(state.focus, false);
  else writeHash();
}

function wireControls() {
  $("#tfSeg").innerHTML = TIMEFRAMES.map((t) => `<button data-v="${t}" title="${TF_WORD[t]} bars (key ${t})">${TF_BTN[t]}</button>`).join("");
  $("#tfSeg").addEventListener("click", (e) => e.target.dataset.v && update({ tf: e.target.dataset.v }));
  $("#assetSeg").addEventListener("click", (e) => e.target.dataset.v && update({ asset: e.target.dataset.v }));
  $("#sensorSeg").addEventListener("click", (e) => e.target.dataset.v && update({ sensor: e.target.dataset.v }));
  $("#revTfs").addEventListener("click", (e) => { const b = e.target.closest("[data-tf]"); if (b) update({ tf: b.dataset.tf }); });
  $("#reversals").addEventListener("click", (e) => { if (e.target.closest("[data-revall]")) { state.revAll = true; renderReversals(); } });
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-country]");
    if (t) openCountry(t.dataset.country);
  });
  $("#drawerClose").addEventListener("click", closeDrawer);
  $("#drawer").addEventListener("click", (e) => { if (e.target.id === "drawer" && e.detail < 2) closeDrawer(); });
  $("#share").addEventListener("click", share);
  $("#clip").addEventListener("click", (e) => { e.stopPropagation(); if (!recording) $("#clipMenu").hidden = !$("#clipMenu").hidden; });
  $("#clipMenu").addEventListener("click", (e) => { const b = e.target.closest("[data-kind]"); if (b) saveClip(b.dataset.kind); });
  document.addEventListener("click", (e) => { if (!e.target.closest(".clip-wrap")) $("#clipMenu").hidden = true; });
  $("#replayBtn").addEventListener("click", startReplay);
  $("#stepSeg").addEventListener("click", (e) => { if (e.target.dataset.v && !e.target.disabled) { stopReplay(); state.replayStep = e.target.dataset.v; renderReplayControls(); } });
  $("#rangeSeg").addEventListener("click", (e) => { if (e.target.dataset.v) { stopReplay(); state.replayRange = e.target.dataset.v; renderReplayControls(); } });
  $("#flowSeg").addEventListener("click", (e) => e.target.dataset.v && update({ flow: e.target.dataset.v }));
  $("#viewSeg").addEventListener("click", (e) => e.target.dataset.v && update({ view: e.target.dataset.v }));
  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.target.matches("input, textarea")) return;
    const k = e.key.toUpperCase();
    if (k === "ESCAPE") closeDrawer();
    else if (TIMEFRAMES.includes(k)) update({ tf: k });
    else if (k === "S") update({ asset: "stocks" });
    else if (k === "B") update({ asset: "bonds" });
    else if (k === "1") update({ sensor: "normal" });
    else if (k === "2") update({ sensor: "flir" });
    else if (k === "3") update({ sensor: "nvg" });
    else if (k === "R") startReplay();
    else if (k === "G") update({ view: state.view === "flat" ? "globe" : "flat" });
    else if (k === "F") update({ flow: { control: "reversal", reversal: "off", off: "control" }[state.flow] });
    else if (k === "+" || k === "=") $("#zoomIn").click();
    else if (k === "-") $("#zoomOut").click();
  });
}

function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  const out = {};
  if (TIMEFRAMES.includes(p.get("tf"))) out.tf = p.get("tf");
  if (["stocks", "bonds"].includes(p.get("asset"))) out.asset = p.get("asset");
  if (["normal", "flir", "nvg"].includes(p.get("sensor"))) out.sensor = p.get("sensor");
  if (["control", "reversal", "off"].includes(p.get("flow"))) out.flow = p.get("flow");
  if (["globe", "flat"].includes(p.get("view"))) out.view = p.get("view");
  return { patch: out, country: p.get("c")?.toUpperCase() };
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
    ["→ Money flow", "CONTROL arcs run from countries where sellers control the bar to countries where buyers do. REVERSALS arcs run from markets reversing down to markets reversing up. They show pressure, not tracked transfers.", candle([20, 50, 45, 25], [35, 80, 40, 75], "var(--accent)")],
    ["↺ Reversal", "Control flipped. Example 2-1-2: sellers broke the low, price paused inside, then buyers broke the high.", candle([20, 50, 45, 25], [35, 80, 40, 75], "var(--up)")],
  ].map(([t, p, svg]) => `<div class="card">${svg}<div><h3>${t}</h3><p>${p}</p></div></div>`).join("");
}

/* ---------- Boot ---------- */

const bootEl = $("#bootlog");
function bootLine(s, replaceLast = false) {
  if (!bootEl) return;
  const lines = bootEl.textContent.split("\n");
  if (replaceLast && lines.at(-1).startsWith("  FEED")) lines[lines.length - 1] = s; else lines.push(s);
  bootEl.textContent = lines.join("\n");
}
const wait = (ms) => new Promise((r) => setTimeout(r, reduceMotion ? 0 : ms));
function endBoot() { $("#boot").classList.add("done"); store.set("gev-booted", "1"); }

async function main() {
  const quick = store.get("gev-booted") === "1";
  $("#boot").addEventListener("click", endBoot);
  if (quick) endBoot();
  bootLine("> ESTABLISHING UPLINK ............ OK");
  const worldP = fetch(WORLD_URL).then((r) => r.json());
  await wait(quick ? 0 : 350);
  bootLine(`> ACQUIRING ${MARKETS.length} MARKET FEEDS ..... `);
  try {
    if (typeof d3 === "undefined" || typeof topojson === "undefined") throw new Error("libraries missing");
    state.data = await loadData();
  } catch (e) {
    bootLine("> SIGNAL LOST. TRY AGAIN IN A MINUTE.");
    $("#headline").textContent = "Signal lost. Try again in a minute.";
    setTimeout(endBoot, 1500);
    return;
  }
  const bars = state.data.markets.length * TIMEFRAMES.length;
  bootLine(`> CLASSIFYING ${bars} PRICE BARS [1 · 2U · 2D · 3] .. OK`);
  bootLine("> SCANNING FOR REVERSALS .......... OK");
  await wait(quick ? 0 : 450);
  bootLine("> GOD'S EYE VIEW ONLINE.");

  const gen = new Date(state.data.generatedAt);
  const liveN = state.data.markets.filter((m) => m.live).length;
  const ageDays = (Date.now() - gen) / 864e5;
  $("#asof").textContent = `${ageDays > 4 ? "DATA DELAYED · " : ""}UPDATED ${state.data.generatedAt.slice(0, 10)} ${state.data.generatedAt.slice(11, 16)} UTC${liveN ? ` · ${liveN} MARKETS LIVE` : ""}`;
  const nations = new Set(state.data.markets.map((m) => m.country).filter((c) => c !== "GLOBAL")).size;
  $("#tracking").innerHTML = `TRACKING <b>${nations}</b> NATIONS · <b>${state.data.markets.length}</b> MARKETS · <b>5</b> TIMEFRAMES${state.data.live ? " · LIVE MODE" : ""}`;
  $("#footData").textContent = `Data: ${state.data.source}. Generated ${state.data.generatedAt}. Bars still trading are shown live and can change until they close.${state.data.failed?.length ? ` Delayed today: ${state.data.failed.join(", ")}.` : ""}`;

  state.mine = detectCountry();
  wireControls();
  renderHow();
  renderPulse();
  const { patch, country } = readHash();
  update(patch);
  addEventListener("hashchange", () => {
    const h = readHash();
    update(h.patch);
    if (h.country && h.country !== state.focus) openCountry(h.country);
    else if (!h.country) closeDrawer();
  });
  try {
    globe = initGlobe(await worldP, country || state.mine);
  } catch {
    $("#hudTarget").textContent = "MAP OFFLINE";
  }
  if (country && state.views[country]) openCountry(country);
  await wait(quick ? 0 : 400);
  endBoot();
}

main();
