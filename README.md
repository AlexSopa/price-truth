# God's Eye View · Price Truth

A spy satellite for the world's money. 97 markets in 36 countries (stock indices, government bonds, world sectors, major stocks, macro), read with TheStrat on D / W / M / Q / Y bars.

## How it works

1. `scripts/build.mjs` runs every hour on trading days (GitHub Actions, `.github/workflows/daily.yml`). The workflow also re-enables its own schedule, so GitHub never turns it off.
2. It reads 2 years of daily bars per market from Yahoo Finance, builds W/M/Q/Y bars, and labels each bar `1`, `2u`, `2d` or `3` with its color. Bars still trading are kept (the bar in force) and flagged `live`. If a market fails, its last good entry is kept and flagged `stale`.
3. It writes **only those labels** to `data/signals.json`. No prices are stored or published.
4. `index.html` + `app.js` load that file. All counting, country verdicts, reversals, East vs West, the 60-day replay, the share card and the globe run in the viewer's browser. d3, topojson and the world map are in `vendor/`, so no CDN is needed.

Why not fetch Yahoo directly from the browser: Yahoo sends no CORS header, so a browser on github.io cannot read it. Free public CORS relays are down or paid. Optional: run your own relay, add its URL prefix to `RELAYS` in `app.js`, and open `index.html?relay=<prefix>`. The page then fetches Yahoo and computes everything in the browser. Local relays (`http://127.0.0.1`, `http://localhost`) are always allowed.

## Files

| File | Job |
|---|---|
| `universe.js` | The market list. Add or remove symbols here. |
| `strat.js` | TheStrat engine: roll-ups, scenarios, continuity. |
| `yahoo.js` | Yahoo chart URL and parser. |
| `scripts/build.mjs` | Daily fetch, writes `data/signals.json`. |
| `app.js`, `index.html`, `style.css` | The site. |

## Commands

```
npm test        # engine tests
npm run build   # refresh data/signals.json
python -m http.server 8765   # preview at http://127.0.0.1:8765
```

## Rules used

- Verdict per country, per timeframe = average of its markets: 2U green = +1, 2D red = −1, 3 = ±0.5 by close, failed 2U/2D = ±0.25, 1 = 0. ≥ 0.5 BUY, ≤ −0.5 SELL.
- Full continuity = the lead market's D, W, M, Q and Y bars are all green (or all red).
- Reversals (current bar, any timeframe): 2-1-2, 3-1-2, 1-2-2 (RevStrat), 2-2, and failed 2 (a 2U closing red / 2D closing green).
- Sunday-Thursday markets (Saudi Arabia) use Sunday-start weeks. Dates use each exchange's own time zone.
- Bonds are bond-fund prices: 2D on a bond fund = that country's debt is being sold.
- West = Americas, Europe, Africa. East = Asia (incl. Middle East) and Oceania.

URL hash keeps the view, for sharing: `#tf=M&asset=bonds&sensor=flir&c=JP` (`c` opens a country). `?me=GB` sets the "your market" card; without it the page guesses from the time zone.

Education, not investment advice.
