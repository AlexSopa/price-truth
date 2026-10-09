# God's Eye View · Price Truth

A spy satellite for the world's money. Every major stock market, bond market and sector on Earth, plus gold, oil and bitcoin, read with TheStrat on D / W / M / Q / Y bars: who controls each country, where reversals fire, and where the money is flowing.

Free and open source. This repo publishes **code only**. It does not fetch, store or hand out market data.

## Three ways to use it

### 1. In your browser with your own free key (no install)

Open the site, get a free key (1 minute, email only), paste it, launch.

| Provider | Free key | Speed for 83 markets |
|---|---|---|
| [FMP](https://site.financialmodelingprep.com/register) | 250 calls a day | about 1 minute |
| [Twelve Data](https://twelvedata.com/register) | 800 calls a day, 8 a minute | about 10 minutes the first time |

One key is enough. Both together load fastest and fill each other's gaps. Your browser calls your provider directly with your key. The key and the data stay on your device (localStorage and IndexedDB). Later visits draw from your device cache at once and refresh every 3 hours.

The free-key universe is US-listed: a fund for every country (EWJ Japan, EWG Germany, EWZ Brazil, INDA India and more), US index funds, bond funds, world sector funds, gold / oil / copper / dollar funds, bitcoin and major stocks and ADRs (`BYOK_MARKETS` in `universe.js`). Country funds are priced in US dollars, so their moves include the currency.

### 2. On your own computer

```
git clone https://github.com/AlexSopa/price-truth
cd price-truth
npm run build                 # fetches Yahoo Finance for your personal use, writes data/signals.json
python -m http.server 8765    # open http://127.0.0.1:8765
```

With a local `data/signals.json`, the page uses it (97 markets, including local indices and local government bond funds), after a personal-use agreement. `data/` is git-ignored.

### 3. Your own copy on GitHub

Fork or "Use this template", then in your copy: Actions → enable workflows, run "Market update (your own copy)" once, and Settings → Pages → deploy from `main`. The workflow refreshes your copy hourly on trading days. It is switched off in this original repo. Note: free GitHub Pages sites are public, so you are the one publishing your copy.

## How it works

| File | Job |
|---|---|
| `universe.js` | Market lists: `MARKETS` (run-your-own, Yahoo) and `BYOK_MARKETS` (free keys). |
| `strat.js` | TheStrat engine: scenarios, roll-ups, continuity (FTFC), signals (REV / CONT), chart shapes, replay timeline. |
| `signals.js` | Turns daily bars into the signals the page reads. Shared by the browser and the build. |
| `byok.js` | Free-key providers (FMP, Twelve Data), rate limits, device cache. |
| `yahoo.js`, `scripts/build.mjs` | Run-your-own build. |
| `app.js`, `index.html`, `style.css` | The page. `vendor/` holds d3, topojson, the world map and gifenc. |

```
npm test   # engine, parsers, providers, signals
```

## Rules used

- Scenarios: 1 inside, 2U / 2D one side broken, 3 both sides. Equal highs or lows do not break.
- Signals, named as in the [TheStrat docs](https://thestrat.ai/docs/): 2-2 REV, 1-2-2 REV, 3-2-2 REV, 2-1-2 REV / CONT, 3-1-2 REV / CONT and 3-2 REV / CONT (by the color of the 3), FAILED 2U / 2D.
- FTFC UP / DN: the last sale above / below the year, quarter, month, week and day opens.
- Country verdict per timeframe = average of its markets: 2U green +1, 2D red −1, 3 ±0.5 by close, failed 2 ±0.25, 1 = 0. ≥ 0.5 BUY, ≤ −0.5 SELL. BUY / SELL only names who controls the bar.
- Bonds are bond-fund prices: 2D on a bond fund = that country's debt is being sold = its yields are rising.
- Money flow arcs show pressure (sellers in control → buyers in control, or reversing down → reversing up), not tracked transfers.
- West = Americas, Europe, Africa. East = Asia (incl. Middle East) and Oceania.

Price action terms: [thestrat.ai/docs](https://thestrat.ai/docs/). Personal, non-commercial use only. Education, not investment advice.
