import { COUNTRIES, MARKETS } from "./universe.js";
import { TIMEFRAMES, control, continuity, analyze } from "./strat.js";
import { chartUrl, parseChart } from "./yahoo.js";

const TF_NAME = { D: "Today", W: "This week", M: "This month", Q: "This quarter", Y: "This year" };
const TF_WORD = { D: "day", W: "week", M: "month", Q: "quarter", Y: "year" };
const TF_HUD = { D: "DAY", W: "WEEK", M: "MONTH", Q: "QUARTER", Y: "YEAR" };
const S_LABEL = { "1": "1", "2u": "2U", "2d": "2D", "3": "3" };
const WORLD_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json";
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const state = { tf: "D", asset: "stocks", sensor: "normal", data: null, views: {}, focus: null, hover: null };

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const assetOf = (m) => (m.kind === "bond" ? "bonds" : m.kind === "index" || m.kind === "stock" ? "stocks" : m.kind);
const gClass = (g) => (g > 0 ? "g-up" : g < 0 ? "g-down" : "");
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const store = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch {} },
};

/* ---------- Data ---------- */

async function loadData() {
  const relay = new URLSearchParams(location.search).get("relay");
  if (relay) return loadLive(relay);
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
        const r = await fetch(relay + encodeURIComponent(chartUrl(m.symbol)));
        const bars = parseChart(await r.json());
        if (bars.length >= 30) markets.push({ ...m, ...analyze(bars) });
      } catch {}
      bootLine(`  FEED ${String(++done).padStart(3, "0")}/${MARKETS.length}  ${m.symbol}`, true);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
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
  return score > 0 ? "TURNING UP" : score < 0 ? "TURNING DOWN" : "NO EDGE";
}

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

function explain(st, word) {
  if (!st) return "Not enough history yet.";
  const { s, g } = st;
  if (s === "1") return `Still inside last ${word}'s range. Pressure is building; a breakout is coming.`;
  if (s === "3") return `Broke BOTH sides of last ${word}'s range. ${g >= 0 ? "Buyers" : "Sellers"} won the fight.`;
  if (s === "2u") return g >= 0 ? `Broke above last ${word}'s high and is holding. Buyers in control.` : `Broke above last ${word}'s high, but buyers cannot hold it. Watch for a turn down.`;
  return g <= 0 ? `Broke below last ${word}'s low and is staying down. Sellers in control.` : `Broke below last ${word}'s low, but buyers pushed it back. Watch for a turn up.`;
}

/* ---------- Render: intel ---------- */

function renderIntel() {
  const { tf, asset } = state;
  const all = state.data.markets.filter((m) => m.tf[tf]);
  const n = { "2u": 0, "2d": 0, "1": 0, "3": 0 };
  all.forEach((m) => n[m.tf[tf].s]++);

  const views = Object.values(state.views);
  const withAsset = views.filter((v) => v.groups[asset]);
  const buys = withAsset.filter((v) => v.groups[asset].verdict === "BUY");
  const sells = withAsset.filter((v) => v.groups[asset].verdict === "SELL");
  const what = asset === "bonds" ? "bond markets" : "countries";

  $("#kicker").textContent = `SITUATION REPORT · ${TF_HUD[tf]} BARS · ${asset.toUpperCase()}`;
  const buyersWin = buys.length > sells.length || (buys.length === sells.length && n["2u"] >= n["2d"]);
  $("#headline").innerHTML = buyersWin
    ? `${TF_NAME[tf]}, <span class="up">buyers</span> control ${buys.length} of ${withAsset.length} ${what}.`
    : `${TF_NAME[tf]}, <span class="down">sellers</span> control ${sells.length} of ${withAsset.length} ${what}.`;
  $("#subline").textContent = `${n["2u"]} of ${all.length} markets broke above last ${TF_WORD[tf]}'s high. ${n["2d"]} broke below its low. Headlines tell stories. Price tells the truth.`;

  $("#counts").innerHTML = [
    ["up", n["2u"], "2U · breaking up"],
    ["down", n["2d"], "2D · breaking down"],
    ["", n["1"], "1 · coiling"],
    ["out", n["3"], "3 · fighting"],
  ].map(([c, v, l]) => `<div class="count ${c}"><b>${v}</b><span>${l}</span></div>`).join("");

  // East vs West
  const side = (s) => {
    const ms = state.data.markets.filter((m) => COUNTRIES[m.country]?.side === s && assetOf(m) === asset && m.tf[tf]);
    return { score: mean(ms.map((m) => control(m.tf[tf]).score)), up: ms.filter((m) => m.tf[tf].s === "2u").length, down: ms.filter((m) => m.tf[tf].s === "2d").length, n: ms.length };
  };
  const W = side("West"), E = side("East");
  const wShare = (W.score + 1) / (W.score + E.score + 2 || 1);
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
  for (const v of views) for (const a of [asset]) {
    const g = v.groups[a];
    if (!g || (g.verdict !== "BUY" && g.verdict !== "SELL")) continue;
    const agree = g.ftfc === (g.verdict === "BUY" ? 1 : -1);
    calls.push({ v, a, g, rank: Math.abs(g.score) + (agree ? 0.6 : 0) });
  }
  calls.sort((x, y) => y.rank - x.rank);
  const pick = (verdict) => calls.filter((c) => c.g.verdict === verdict).slice(0, 4);
  const cards = [...pick("BUY"), ...pick("SELL")];
  $("#calls").innerHTML = cards.length
    ? cards.map(({ v, a, g }) => {
        const agree = g.ftfc === (g.verdict === "BUY" ? 1 : -1);
        return `<button class="call ${g.verdict.toLowerCase()}" data-country="${v.code}">
          <b>${v.flag} ${esc(callText(v, a, g.verdict))}</b>
          <span>${esc(g.lead.name)} · ${S_LABEL[g.lead.tf[tf].s]} on the ${TF_WORD[tf]}${agree ? " · FULL CONTINUITY" : ""}</span></button>`;
      }).join("")
    : `<div class="calls-empty">NO CLEAN CALLS ON THIS TIMEFRAME. THE WORLD IS UNDECIDED.</div>`;

  $("#insights").innerHTML = insights().map((t) => `<li>${t}</li>`).join("");
}

function insights() {
  const { tf } = state;
  const out = [];
  for (const v of Object.values(state.views)) {
    const s = v.groups.stocks?.verdict, b = v.groups.bonds?.verdict;
    if (!s || !b) continue;
    if (s === "BUY" && b === "SELL") out.push(`Money is leaving <b>${v.name} bonds</b> and moving into <b>${v.name} stocks</b>.`);
    else if (s === "SELL" && b === "BUY") out.push(`Fear trade in <b>${v.name}</b>: money is running from stocks into bonds.`);
    else if (s === "SELL" && b === "SELL") out.push(`<b>${v.name}</b> is being sold across the board: stocks <b>and</b> bonds.`);
    else if (s === "BUY" && b === "BUY") out.push(`Everything in <b>${v.name}</b> is being bought: stocks and bonds.`);
  }
  const sectors = state.data.markets.filter((m) => m.kind === "sector" && m.tf[tf]);
  if (sectors.length) {
    const ranked = [...sectors].sort((a, b) => control(b.tf[tf]).score - control(a.tf[tf]).score);
    const top = ranked[0], bot = ranked[ranked.length - 1];
    if (control(top.tf[tf]).score >= 0.5) out.push(`Strongest world sector: <b>${top.name}</b> (${S_LABEL[top.tf[tf].s]}).`);
    if (control(bot.tf[tf]).score <= -0.5) out.push(`Weakest world sector: <b>${bot.name}</b> (${S_LABEL[bot.tf[tf].s]}).`);
  }
  const gold = state.data.markets.find((m) => m.symbol === "GC=F")?.tf[tf];
  if (gold?.s === "2u" && gold.g > 0) out.push(`<b>Gold</b> is breaking out this ${TF_WORD[tf]}.`);
  const usd = state.data.markets.find((m) => m.symbol === "DX-Y.NYB")?.tf[tf];
  if (usd?.s === "2d" && usd.g < 0) out.push(`The <b>US dollar</b> is breaking down this ${TF_WORD[tf]}.`);
  return out.slice(0, 5);
}

/* ---------- Render: tiles ---------- */

function cells(m, selTf) {
  return TIMEFRAMES.map((t) => {
    const st = m?.tf[t];
    if (!st) return `<span class="cell none"><small>${t}</small>–</span>`;
    return `<span class="cell ${gClass(st.g)} s-${st.s}${t === selTf ? " sel" : ""}" title="${esc(m.name)} · ${TF_WORD[t]}: ${esc(explain(st, TF_WORD[t]))}"><small>${t}</small>${S_LABEL[st.s]}</span>`;
  }).join("");
}

function renderCountries() {
  const { tf, asset } = state;
  const views = Object.values(state.views).sort((a, b) => {
    const sa = a.groups[asset]?.score ?? -9, sb = b.groups[asset]?.score ?? -9;
    return sb - sa;
  });
  $("#countryMeta").textContent = `${views.length} NATIONS · SORTED BY ${asset.toUpperCase()} ON THE ${TF_HUD[tf]} · CLICK FOR EVERY MARKET INSIDE`;
  $("#countryGrid").innerHTML = views.map((v) => {
    const g = v.groups[asset];
    const ftfc = g?.ftfc ?? 0;
    const verdict = g ? g.verdict : `NO ${asset.toUpperCase()}`;
    const rows = ["stocks", "bonds"].filter((a) => v.groups[a]).map((a) =>
      `<div class="row"><span class="lbl">${a === "stocks" ? "STOCKS" : "BONDS"}</span>${cells(v.groups[a].lead, tf)}</div>`).join("");
    return `<button class="tile ${ftfc > 0 ? "ftfc-up" : ftfc < 0 ? "ftfc-down" : ""}${g ? "" : " dim"}" data-country="${v.code}">
      <div class="cap"><span class="name">${v.flag} ${esc(v.name)}<span class="side">${v.side.toUpperCase()}</span></span>
      <span class="verdict ${verdict === "BUY" ? "buy" : verdict === "SELL" ? "sell" : ""}">${verdict}</span></div>
      ${rows}
      ${ftfc ? `<div class="ftfc-tag ${ftfc > 0 ? "up" : "down"}">FULL CONTINUITY ${ftfc > 0 ? "▲ ALL 5 TIMEFRAMES GREEN" : "▼ ALL 5 TIMEFRAMES RED"}</div>` : ""}
    </button>`;
  }).join("");

  const others = state.data.markets.filter((m) => m.kind === "sector" || m.kind === "macro");
  $("#sectorGrid").innerHTML = others.map((m) => {
    const c = control(m.tf[tf]);
    const ftfc = continuity(m.tf);
    return `<div class="tile ${ftfc > 0 ? "ftfc-up" : ftfc < 0 ? "ftfc-down" : ""}">
      <div class="cap"><span class="name">${esc(m.name)}</span><span class="verdict ${c.score > 0 ? "buy" : c.score < 0 ? "sell" : ""}">${c.score >= 0.5 ? "BUYERS" : c.score <= -0.5 ? "SELLERS" : c.score === 0 ? "COILING" : "TURNING"}</span></div>
      <div class="row" style="grid-template-columns:repeat(5,1fr)">${cells(m, tf)}</div></div>`;
  }).join("");
}

/* ---------- Render: global pulse (daily breadth) ---------- */

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
  const days = [...byDate.entries()].filter(([, e]) => e.n >= min).sort(([a], [b]) => (a < b ? -1 : 1)).slice(-60);
  if (!days.length) return;
  const w = 1000, h = 190, mid = 95, pad = 18;
  const max = Math.max(...days.map(([, e]) => Math.max(e.up, e.down)), 1);
  const bw = (w - pad * 2) / days.length;
  const y = (v) => (v / max) * (mid - 16);
  let bars = "", line = "";
  days.forEach(([d, e], i) => {
    const x = pad + i * bw;
    bars += `<rect x="${x + 1}" y="${mid - y(e.up)}" width="${Math.max(bw - 2, 1)}" height="${y(e.up)}" fill="var(--up)" opacity=".85"><title>${d}: ${e.up} broke up, ${e.down} broke down (of ${e.n})</title></rect>`;
    bars += `<rect x="${x + 1}" y="${mid}" width="${Math.max(bw - 2, 1)}" height="${y(e.down)}" fill="var(--down)" opacity=".85"><title>${d}: ${e.up} broke up, ${e.down} broke down (of ${e.n})</title></rect>`;
    line += `${i ? "L" : "M"}${x + bw / 2},${mid - y(e.up - e.down)}`;
  });
  const labels = [0, Math.floor(days.length / 2), days.length - 1].map((i) =>
    `<text class="axis" x="${pad + i * bw + bw / 2}" y="${h - 2}" text-anchor="middle">${days[i][0].slice(5)}</text>`).join("");
  $("#pulse").innerHTML = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Daily count of markets breaking up versus down">
    <line x1="${pad}" x2="${w - pad}" y1="${mid}" y2="${mid}" stroke="var(--border-hi)"/>${bars}
    <path d="${line}" fill="none" stroke="var(--fg)" stroke-width="1.5" vector-effect="non-scaling-stroke" opacity=".8"/>
    <text class="axis" x="${pad}" y="11">▲ BROKE UP</text><text class="axis" x="${pad}" y="${h - 14}">▼ BROKE DOWN</text>${labels}</svg>`;
}

/* ---------- Drawer ---------- */

function openCountry(code) {
  const v = state.views[code];
  if (!v) return;
  const { tf } = state;
  state.focus = code;
  globe?.focus(code);
  const say = Object.entries(v.groups).map(([a, g]) =>
    `${g.verdict === "BUY" || g.verdict === "SELL" ? callText(v, a, g.verdict) : `${v.name} ${a}: ${g.verdict.toLowerCase()}`}`).join(" · ");
  const group = (a, g) => `<div class="dr-group"><h4>${a.toUpperCase()} <span class="verdict ${g.verdict === "BUY" ? "buy" : g.verdict === "SELL" ? "sell" : ""}">${g.verdict}</span></h4>
    ${g.members.map((m) => `<div class="dr-item"><div class="top"><b>${esc(m.name)}</b><span>${esc(m.symbol)} · AS OF ${m.asOf}</span></div>
      <div class="row">${cells(m, tf)}</div>
      <p>${esc(explain(m.tf[tf], TF_WORD[tf]))}</p>
      <div class="seq"><em>LAST 12 DAYS</em>${m.hist.slice(-12).map(([d, s, gg]) => `<i class="${gClass(gg)}" title="${d}">${S_LABEL[s]}</i>`).join("")}</div></div>`).join("")}</div>`;
  $("#drawerBody").innerHTML = `<div class="dr-kicker">TARGET ACQUIRED · ${v.side.toUpperCase()} · ${TF_HUD[tf]} BARS</div>
    <h3 id="drawerTitle">${v.flag} ${esc(v.name)}</h3><p class="dr-say">${esc(say)}</p>
    ${Object.entries(v.groups).map(([a, g]) => group(a, g)).join("")}`;
  $("#drawer").hidden = false;
  $("#drawerClose").focus();
}
function closeDrawer() { $("#drawer").hidden = true; state.focus = null; globe?.focus(null); }

/* ---------- Globe ---------- */

let globe = null;

function heat(score, alpha = 1) {
  const t = (score + 1) / 2;
  if (state.sensor === "flir") return d3.interpolateInferno(0.12 + t * 0.82);
  if (state.sensor === "nvg") return d3.interpolateRgb("#0b2a0e", "#c6ffb5")(t);
  const c = score >= 0 ? d3.interpolateRgb("#2a281e", "#10b981")(score) : d3.interpolateRgb("#2a281e", "#ef4444")(-score);
  return alpha === 1 ? c : d3.color(c).copy({ opacity: alpha }).formatRgb();
}
const SENSOR = {
  normal: { ocean: "#0c0b09", land: "#1b1a14", line: "#2a281e", grat: "rgba(179,175,162,0.07)", glow: "rgba(99,102,241,0.25)", text: "#ece9e0" },
  flir: { ocean: "#07031a", land: "#1a0b3a", line: "#2b1660", grat: "rgba(255,160,60,0.08)", glow: "rgba(255,122,26,0.28)", text: "#ffe9c2" },
  nvg: { ocean: "#020803", land: "#08200c", line: "#12401a", grat: "rgba(109,255,94,0.08)", glow: "rgba(109,255,94,0.22)", text: "#b9ffa8" },
};

function initGlobe(world) {
  const canvas = $("#globe");
  const ctx = canvas.getContext("2d");
  const features = topojson.feature(world, world.objects.countries).features;
  const byIso = new Map(Object.entries(COUNTRIES).filter(([, c]) => c.iso).map(([code, c]) => [c.iso, code]));
  const proj = d3.geoOrthographic().clipAngle(90).precision(0.6);
  const path = d3.geoPath(proj, ctx);
  const grat = d3.geoGraticule10();
  let rot = [-10, -25, 0], spin = !reduceMotion, anim = null, w = 0, h = 0, resumeAt = 0;

  function resize() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = r.width; h = r.height;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    proj.translate([w / 2, h / 2]).scale(Math.min(w, h) * 0.42);
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  const scoreOf = (code) => state.views[code]?.groups[state.asset]?.score;

  function draw(t) {
    const P = SENSOR[state.sensor];
    proj.rotate(rot);
    ctx.clearRect(0, 0, w, h);
    const [cx, cy] = proj.translate(), R = proj.scale();
    const glow = ctx.createRadialGradient(cx, cy, R * 0.95, cx, cy, R * 1.18);
    glow.addColorStop(0, P.glow); glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, R * 1.18, 0, 2 * Math.PI); ctx.fill();
    ctx.beginPath(); path({ type: "Sphere" }); ctx.fillStyle = P.ocean; ctx.fill();
    ctx.beginPath(); path(grat); ctx.strokeStyle = P.grat; ctx.lineWidth = 0.6; ctx.stroke();

    for (const f of features) {
      const code = byIso.get(f.id);
      const s = code ? scoreOf(code) : undefined;
      ctx.beginPath(); path(f);
      ctx.fillStyle = s === undefined ? P.land : heat(s);
      ctx.fill();
      ctx.strokeStyle = code && (code === state.hover || code === state.focus) ? P.text : P.line;
      ctx.lineWidth = code && (code === state.hover || code === state.focus) ? 1.4 : 0.5;
      ctx.stroke();
    }

    // Markers with Strat labels on the visible side.
    const center = [-rot[0], -rot[1]];
    ctx.font = "600 9.5px 'JetBrains Mono', monospace";
    ctx.textBaseline = "middle";
    const placed = [];
    let k = 0;
    for (const [code, v] of Object.entries(state.views)) {
      k++;
      if (!v.at || d3.geoDistance(v.at, center) > 1.45) continue;
      const g = v.groups[state.asset];
      if (!g) continue;
      const [x, y] = proj(v.at);
      const st = g.lead.tf[state.tf];
      const pulse = reduceMotion ? 0 : (Math.sin(t / 380 + k) + 1) / 2;
      ctx.beginPath(); ctx.arc(x, y, 3 + pulse * 6, 0, 2 * Math.PI);
      ctx.strokeStyle = heat(g.score, 0.5 * (1 - pulse)); ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, 2.6, 0, 2 * Math.PI); ctx.fillStyle = P.text; ctx.fill();
      const label = `${code} ${st ? S_LABEL[st.s] : ""}`;
      const lw = ctx.measureText(label).width;
      if (placed.some((b) => x + 6 < b.x + b.w && x + 6 + lw > b.x && Math.abs(y - b.y) < 11)) continue;
      placed.push({ x: x + 6, y, w: lw });
      ctx.fillStyle = P.text;
      ctx.fillText(label, x + 6, y);
    }

    // Target reticle on the focused country.
    const fv = state.focus && state.views[state.focus];
    if (fv?.at && d3.geoDistance(fv.at, center) < 1.45) {
      const [x, y] = proj(fv.at), s = 22;
      ctx.strokeStyle = P.text; ctx.lineWidth = 1.2;
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        ctx.beginPath(); ctx.moveTo(x + dx * s, y + dy * (s - 8)); ctx.lineTo(x + dx * s, y + dy * s); ctx.lineTo(x + dx * (s - 8), y + dy * s); ctx.stroke();
      }
    }
    $("#hudOrbit").textContent = `SAT-01 // LAT ${(-rot[1]).toFixed(1)} LON ${(((-rot[0] + 540) % 360) - 180).toFixed(1)}`;
  }

  function frame(t) {
    if (anim) {
      const p = Math.min(1, (t - anim.t0) / 1100);
      rot = anim.i(d3.easeCubicInOut(p));
      if (p >= 1) anim = null;
    } else if (spin && t > resumeAt) {
      rot[0] = (rot[0] + 0.07) % 360;
    }
    draw(t);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  d3.select(canvas).call(d3.drag()
    .on("start", () => { anim = null; resumeAt = Infinity; })
    .on("drag", (e) => {
      const k = 70 / proj.scale();
      rot = [rot[0] + e.dx * k, Math.max(-80, Math.min(80, rot[1] - e.dy * k)), 0];
    })
    .on("end", () => { resumeAt = performance.now() + 5000; }));

  function countryAt(evt) {
    const r = canvas.getBoundingClientRect();
    const ll = proj.invert([evt.clientX - r.left, evt.clientY - r.top]);
    if (!ll || d3.geoDistance(ll, [-rot[0], -rot[1]]) > Math.PI / 2) return null;
    // Small places (Hong Kong, Singapore) have no polygon at this scale: snap to the nearest marker.
    for (const [code, v] of Object.entries(state.views)) if (v.at && d3.geoDistance(ll, v.at) < 0.035) return code;
    const f = features.find((f) => byIso.has(f.id) && d3.geoContains(f, ll));
    return f ? byIso.get(f.id) : null;
  }
  canvas.addEventListener("pointermove", (e) => {
    const code = countryAt(e);
    if (code === state.hover) return;
    state.hover = code;
    const v = code && state.views[code], g = v?.groups[state.asset];
    $("#hudTarget").innerHTML = g
      ? `<b>${v.flag} ${esc(v.name)}</b><span class="${g.verdict === "BUY" ? "v-buy" : g.verdict === "SELL" ? "v-sell" : ""}">${esc(g.verdict === "BUY" || g.verdict === "SELL" ? callText(v, state.asset, g.verdict) : g.verdict)}</span><br>${esc(g.lead.name)} · ${S_LABEL[g.lead.tf[state.tf]?.s] ?? "–"} · ${TF_HUD[state.tf]}`
      : "";
  });
  canvas.addEventListener("pointerleave", () => { state.hover = null; $("#hudTarget").innerHTML = ""; });
  canvas.addEventListener("click", (e) => { const code = countryAt(e); if (code && state.views[code]) openCountry(code); });

  return {
    focus(code) {
      const v = code && state.views[code];
      if (!v?.at) { resumeAt = performance.now() + 3000; return; }
      resumeAt = Infinity;
      const to = [-v.at[0], -v.at[1], 0];
      const from = [...rot];
      while (to[0] - from[0] > 180) to[0] -= 360;
      while (from[0] - to[0] > 180) to[0] += 360;
      anim = { t0: performance.now(), i: d3.interpolate(from, to) };
    },
  };
}

function renderLegend() {
  const stops = d3.range(0, 1.01, 0.1).map((t) => heat(t * 2 - 1)).join(",");
  $("#legendBar").style.background = `linear-gradient(90deg, ${stops})`;
}

/* ---------- Controls, URL state, share ---------- */

function setPressed(segId, v) {
  document.querySelectorAll(`#${segId} button`).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === v)));
}

function update(patch = {}) {
  Object.assign(state, patch);
  if (patch.tf || !Object.keys(state.views).length) state.views = buildViews(state.tf);
  document.body.dataset.sensor = state.sensor;
  setPressed("tfSeg", state.tf); setPressed("assetSeg", state.asset); setPressed("sensorSeg", state.sensor);
  $("#hudMode").textContent = `SENSOR ${state.sensor === "flir" ? "FLIR · BUYING RUNS HOT" : state.sensor === "nvg" ? "NVG" : "NORMAL"}`;
  $("#hudTf").textContent = `TF ${TF_HUD[state.tf]} · ${state.asset.toUpperCase()}`;
  history.replaceState(null, "", `#tf=${state.tf}&asset=${state.asset}&sensor=${state.sensor}`);
  renderLegend(); renderIntel(); renderCountries();
  if (state.focus && !$("#drawer").hidden) openCountry(state.focus);
}

function shareText() {
  const { tf, asset } = state;
  const views = Object.values(state.views).filter((v) => v.groups[asset]);
  const buys = views.filter((v) => v.groups[asset].verdict === "BUY");
  const sells = views.filter((v) => v.groups[asset].verdict === "SELL");
  const top = (arr, verdict) => arr.sort((a, b) => Math.abs(b.groups[asset].score) - Math.abs(a.groups[asset].score)).slice(0, 2).map((v) => `${v.flag} ${callText(v, asset, verdict)}`);
  return [
    `GOD'S EYE VIEW of the world's money (${TF_HUD[tf]} bars):`,
    `Buyers control ${buys.length} ${asset === "bonds" ? "bond markets" : "countries"}. Sellers control ${sells.length}.`,
    ...top(buys, "BUY"), ...top(sells, "SELL"),
    `Headlines tell stories. Price tells the truth.`,
  ].join("\n");
}

async function share() {
  const text = shareText(), url = location.href;
  try { await navigator.clipboard.writeText(`${text}\n${url}`); } catch {}
  if (navigator.share) { try { await navigator.share({ text, url }); return; } catch {} }
  window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, "_blank", "noopener");
}

function wireControls() {
  $("#tfSeg").innerHTML = TIMEFRAMES.map((t) => `<button data-v="${t}" title="${TF_WORD[t]} bars">${t}</button>`).join("");
  $("#tfSeg").addEventListener("click", (e) => e.target.dataset.v && update({ tf: e.target.dataset.v }));
  $("#assetSeg").addEventListener("click", (e) => e.target.dataset.v && update({ asset: e.target.dataset.v }));
  $("#sensorSeg").addEventListener("click", (e) => e.target.dataset.v && update({ sensor: e.target.dataset.v }));
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-country]");
    if (t) openCountry(t.dataset.country);
  });
  $("#drawerClose").addEventListener("click", closeDrawer);
  $("#drawer").addEventListener("click", (e) => { if (e.target.id === "drawer") closeDrawer(); });
  $("#share").addEventListener("click", share);
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
  });
}

function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  const out = {};
  if (TIMEFRAMES.includes(p.get("tf"))) out.tf = p.get("tf");
  if (["stocks", "bonds"].includes(p.get("asset"))) out.asset = p.get("asset");
  if (["normal", "flir", "nvg"].includes(p.get("sensor"))) out.sensor = p.get("sensor");
  return out;
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
    ["2U · Breaking up", "Price went above the last high and held. Buyers are in control.", candle(prev, [45, 92, 50, 85], "var(--up)")],
    ["2D · Breaking down", "Price went below the last low. Sellers are in control.", candle(prev, [8, 62, 55, 15], "var(--down)")],
    ["1 · Coiling", "Price stayed inside the last range. Nobody won yet. A big move is loading.", candle(prev, [38, 62, 42, 55], "var(--fg-2)")],
    ["3 · Fighting", "Price broke both sides. Buyers and sellers fought, and the close shows who won.", candle(prev, [10, 95, 30, 85], "var(--gold)")],
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
    state.data = await loadData();
  } catch (e) {
    bootLine("> SIGNAL LOST. RUN THE DAILY BUILD (npm run build).");
    $("#headline").textContent = "No data yet. Run the daily build.";
    return;
  }
  const bars = state.data.markets.length * TIMEFRAMES.length;
  bootLine(`> CLASSIFYING ${bars} PRICE BARS [1 · 2U · 2D · 3] .. OK`);
  await wait(quick ? 0 : 450);
  bootLine("> GOD'S EYE VIEW ONLINE.");

  const asOf = state.data.markets.map((m) => m.asOf).sort().at(-1);
  $("#asof").textContent = `UPDATED ${asOf} · END OF DAY`;
  const nations = new Set(state.data.markets.map((m) => m.country).filter((c) => c !== "GLOBAL")).size;
  $("#tracking").innerHTML = `TRACKING <b>${nations}</b> NATIONS · <b>${state.data.markets.length}</b> MARKETS · <b>5</b> TIMEFRAMES${state.data.live ? " · LIVE MODE" : ""}`;
  $("#footData").textContent = `Data: ${state.data.source}. Generated ${state.data.generatedAt}.${state.data.failed?.length ? ` Missing today: ${state.data.failed.join(", ")}.` : ""}`;

  wireControls();
  renderHow();
  update(readHash());
  addEventListener("hashchange", () => update(readHash()));
  renderPulse();
  try {
    globe = initGlobe(await worldP);
  } catch {
    $("#hudTarget").textContent = "MAP OFFLINE";
  }
  await wait(quick ? 0 : 400);
  endBoot();
}

main();
