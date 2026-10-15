// The crypto markets on the layer cake. Shared by the cake page and the build script.
// LAYERS run from the bottom tier of the cake to the top tier.
// symbol: the Yahoo Finance symbol. t: the ticker shown on the cake. kind: coin | stock | fund.
//
// Yahoo trap: many plain tickers point to a different coin (ARB-USD is "ARbit", TON-USD is "TON Token",
// JUP-USD, STRK-USD, SKY-USD and MNT-USD are wrong too). Those coins need the symbol with the number
// suffix, as written here. Each symbol below was checked against the name Yahoo returns (2026-10-12).
// Left out: Toncoin and Gala (Yahoo has 1 bar only) and stablecoins (price stays at 1.00: nothing to read).

export const LAYERS = [
  { id: "base", name: "Base money", short: "BASE", about: "Coins made to be money or a store of value. Bitcoin is the base of the cake." },
  { id: "l1", name: "Layer 1 chains", short: "L1", about: "Blockchains that run programs. All the layers above are built on them." },
  { id: "l2", name: "Layer 2", short: "L2", about: "Networks on top of a Layer 1 that make it faster and cheaper." },
  { id: "infra", name: "Infrastructure", short: "INFRA", about: "Services the chains use: price feeds, data, storage, compute and AI networks." },
  { id: "defi", name: "DeFi", short: "DEFI", about: "Finance on the chains: exchanges, lending, staking and yield." },
  { id: "meme", name: "Memes and apps", short: "MEME", about: "Meme coins, games and consumer apps. The most speculative layer." },
  { id: "wall", name: "Wall Street", short: "WALL", about: "Crypto funds and crypto stocks on US exchanges. They trade on weekdays only." },
];

const c = (symbol, t, name, layer, kind = "coin") => ({ symbol, t, name, layer, kind });

export const CRYPTO_MARKETS = [
  // Base money
  c("BTC-USD", "BTC", "Bitcoin", "base"),
  c("XRP-USD", "XRP", "XRP", "base"),
  c("LTC-USD", "LTC", "Litecoin", "base"),
  c("BCH-USD", "BCH", "Bitcoin Cash", "base"),
  c("XLM-USD", "XLM", "Stellar", "base"),
  c("XMR-USD", "XMR", "Monero", "base"),
  c("ZEC-USD", "ZEC", "Zcash", "base"),

  // Layer 1 chains
  c("ETH-USD", "ETH", "Ethereum", "l1"),
  c("SOL-USD", "SOL", "Solana", "l1"),
  c("BNB-USD", "BNB", "BNB", "l1"),
  c("ADA-USD", "ADA", "Cardano", "l1"),
  c("TRX-USD", "TRX", "TRON", "l1"),
  c("AVAX-USD", "AVAX", "Avalanche", "l1"),
  c("SUI20947-USD", "SUI", "Sui", "l1"),
  c("DOT-USD", "DOT", "Polkadot", "l1"),
  c("NEAR-USD", "NEAR", "NEAR Protocol", "l1"),
  c("APT21794-USD", "APT", "Aptos", "l1"),
  c("ATOM-USD", "ATOM", "Cosmos", "l1"),
  c("HBAR-USD", "HBAR", "Hedera", "l1"),
  c("ICP-USD", "ICP", "Internet Computer", "l1"),
  c("INJ-USD", "INJ", "Injective", "l1"),
  c("SEI-USD", "SEI", "Sei", "l1"),
  c("TIA-USD", "TIA", "Celestia", "l1"),
  c("KAS-USD", "KAS", "Kaspa", "l1"),

  // Layer 2
  c("ARB11841-USD", "ARB", "Arbitrum", "l2"),
  c("OP-USD", "OP", "Optimism", "l2"),
  c("POL28321-USD", "POL", "Polygon", "l2"),
  c("MNT27075-USD", "MNT", "Mantle", "l2"),
  c("STX4847-USD", "STX", "Stacks", "l2"),
  c("IMX10603-USD", "IMX", "Immutable", "l2"),
  c("STRK22691-USD", "STRK", "Starknet", "l2"),
  c("ZK24091-USD", "ZK", "ZKsync", "l2"),

  // Infrastructure
  c("LINK-USD", "LINK", "Chainlink", "infra"),
  c("TAO22974-USD", "TAO", "Bittensor", "infra"),
  c("RENDER-USD", "RENDER", "Render", "infra"),
  c("FET-USD", "FET", "Artificial Superintelligence Alliance", "infra"),
  c("FIL-USD", "FIL", "Filecoin", "infra"),
  c("GRT6719-USD", "GRT", "The Graph", "infra"),
  c("AR-USD", "AR", "Arweave", "infra"),
  c("PYTH-USD", "PYTH", "Pyth Network", "infra"),
  c("QNT-USD", "QNT", "Quant", "infra"),
  c("HNT-USD", "HNT", "Helium", "infra"),
  c("AKT-USD", "AKT", "Akash Network", "infra"),

  // DeFi
  c("HYPE32196-USD", "HYPE", "Hyperliquid", "defi"),
  c("UNI7083-USD", "UNI", "Uniswap", "defi"),
  c("AAVE-USD", "AAVE", "Aave", "defi"),
  c("MKR-USD", "MKR", "Maker", "defi"),
  c("LDO-USD", "LDO", "Lido DAO", "defi"),
  c("ENA-USD", "ENA", "Ethena", "defi"),
  c("ONDO-USD", "ONDO", "Ondo", "defi"),
  c("JUP29210-USD", "JUP", "Jupiter", "defi"),
  c("PENDLE-USD", "PENDLE", "Pendle", "defi"),
  c("CRV-USD", "CRV", "Curve DAO", "defi"),
  c("COMP5692-USD", "COMP", "Compound", "defi"),
  c("SNX-USD", "SNX", "Synthetix", "defi"),
  c("RAY-USD", "RAY", "Raydium", "defi"),
  c("CAKE-USD", "CAKE", "PancakeSwap", "defi"),

  // Memes and apps
  c("DOGE-USD", "DOGE", "Dogecoin", "meme"),
  c("SHIB-USD", "SHIB", "Shiba Inu", "meme"),
  c("PEPE24478-USD", "PEPE", "Pepe", "meme"),
  c("TRUMP35336-USD", "TRUMP", "Official Trump", "meme"),
  c("BONK-USD", "BONK", "Bonk", "meme"),
  c("WIF-USD", "WIF", "dogwifhat", "meme"),
  c("FLOKI-USD", "FLOKI", "Floki", "meme"),
  c("FARTCOIN-USD", "FART", "Fartcoin", "meme"),
  c("PENGU34466-USD", "PENGU", "Pudgy Penguins", "meme"),
  c("SAND-USD", "SAND", "The Sandbox", "meme"),
  c("MANA-USD", "MANA", "Decentraland", "meme"),
  c("AXS-USD", "AXS", "Axie Infinity", "meme"),

  // Wall Street: funds and stocks on US exchanges
  c("IBIT", "IBIT", "iShares Bitcoin Trust", "wall", "fund"),
  c("ETHA", "ETHA", "iShares Ethereum Trust", "wall", "fund"),
  c("BITO", "BITO", "ProShares Bitcoin futures fund", "wall", "fund"),
  c("BLOK", "BLOK", "Amplify Blockchain fund", "wall", "fund"),
  c("COIN", "COIN", "Coinbase", "wall", "stock"),
  c("MSTR", "MSTR", "Strategy", "wall", "stock"),
  c("HOOD", "HOOD", "Robinhood", "wall", "stock"),
  c("CRCL", "CRCL", "Circle", "wall", "stock"),
  c("GLXY", "GLXY", "Galaxy Digital", "wall", "stock"),
  c("MARA", "MARA", "MARA Holdings", "wall", "stock"),
  c("RIOT", "RIOT", "Riot Platforms", "wall", "stock"),
  c("CLSK", "CLSK", "CleanSpark", "wall", "stock"),
];
