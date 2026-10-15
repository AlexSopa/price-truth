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

### 4. Owner access (your own full data, password-protected)

Your hourly Yahoo build (97 markets, local indices and local bond funds) can sit on the same site for you only:

1. Settings → Pages → Source: **GitHub Actions** (the workflow publishes the site; no data is ever committed to git).
2. Add a repository secret named `GEV_PASSWORD` with a long passphrase (12+ characters): `gh secret set GEV_PASSWORD`.
3. Run "Build and deploy" once (Actions tab, or `gh workflow run daily.yml`). It then refreshes hourly on trading days.

The build encrypts the data (gzip → AES-256-GCM, key from your passphrase by PBKDF2-SHA256, 310,000 rounds) and publishes only `data/signals.enc.json`. On the site, open **Owner access 🔒** on the landing and enter the passphrase; the data is decrypted in your browser. Without the passphrase the file is unreadable. A weak passphrase can be guessed offline, so use a long one. **LOCK 🔒** forgets it on that device.

## Crypto layer cake (owner prototype)

`crypto.html` shows the crypto market in another shape: a cake of 7 tiers, one tier per layer of crypto, one slice per market, 81 markets in all.

| Tier (bottom to top) | What is in it |
|---|---|
| Base money | Bitcoin and the coins made to be money |
| Layer 1 chains | Ethereum, Solana and the other chains that run programs |
| Layer 2 | Networks on top of a Layer 1 |
| Infrastructure | Price feeds, data, storage, compute, AI networks |
| DeFi | Exchanges, lending, staking, yield |
| Memes and apps | Meme coins, games, consumer apps |
| Wall Street | Crypto funds and crypto stocks on US exchanges |

A slice is green when buyers control the bar and red when sellers do. The arcs on the right run from the layers with selling pressure to the layers with buying pressure. Click a slice for its chart. Replay works as on the globe.

```
npm run build:crypto          # fetches Yahoo Finance for your personal use, writes data/crypto.json
```

It has no bring-your-own-key mode yet. The page reads `data/crypto.json` (your own copy) or `data/crypto.enc.json` (owner access: the workflow builds it when `GEV_PASSWORD` is set, and the same passphrase opens it). Without one of these files the page shows a notice only. A Globe | Crypto toggle at the top left switches between the two pages. On the globe it shows in own-copy and owner mode.

Two free extras come with the build (`scripts/crypto-extras.mjs`), with no key and no account:

| Extra | Source | What it adds |
|---|---|---|
| Stablecoin supply | [DefiLlama](https://defillama.com/stablecoins) | The plate under the cake: the dollars inside crypto, one value a day, read on D / W / M / Q / Y bars. Green = new dollars arrive, red = dollars leave. Tracked money, not price. |
| Market value shares | [CoinGecko](https://www.coingecko.com/) | Each coin's share of the cake's value, each tier's share, Bitcoin's share of all crypto, and a "by value" bar: every dollar gets one vote, where the counts give every market one vote. |

Each extra is optional. When its source does not answer, the build leaves it out and the page hides that part.

Limits: the arcs show pressure, not tracked transfers; stablecoins have no slice (they are the plate); 10 years of daily history at most; the Wall Street tier trades on weekdays only. The workflow also runs every 3 hours on Saturday and Sunday for the coins. Yahoo symbols for coins are a trap: see the note at the top of `crypto-universe.js`.

## How it works

| File | Job |
|---|---|
| `crypto-universe.js`, `crypto.js`, `crypto.html`, `crypto.css` | The crypto layer cake: its layers and markets, and its page. |
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
- Risk regime, from BUY / SELL on stocks and on government bonds: BUY stocks + SELL bonds = risk-on; SELL stocks + BUY bonds = flight to safety; both sold = everything sold (capital leaving); both bought = everything bought (liquidity wave). A country uses its own stocks and its own bonds (score ≥ 0.5 / ≤ −0.5). The world uses every country's stock market against safe-haven government bonds only (`HAVEN_BONDS` in `universe.js`; net 20% of markets on one side). Emerging-market bonds are not safe havens.
- Money flow arcs show pressure (sellers in control → buyers in control, or reversing down → reversing up), not tracked transfers.
- West = Americas, Europe, Africa. East = Asia (incl. Middle East) and Oceania.

Price action terms: [thestrat.ai/docs](https://thestrat.ai/docs/). Personal, non-commercial use only. Education, not investment advice.
