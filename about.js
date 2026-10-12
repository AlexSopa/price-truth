// Plain-words context for every market on the page: what it is, for a reader with no market experience.
// The page shows it in a tooltip on the market's name. Keyed by symbol (see universe.js).
// Rules for the text: say what it is, where it is from and why people watch it. Short sentences.
// No figures that go out of date fast (prices, weights, rankings that change each year).

// A US-listed country fund (the read on a country's stock market when there is no index feed).
const fund = (place, money, more = "") =>
  `A fund listed in the United States that holds the largest companies in ${place}. This page uses it to read the stock market of ${place}.${more ? ` ${more}` : ""} It is priced in US dollars${money ? `, so it also moves with the ${money}` : ""}.`;

const ABOUT = {
  // ---- Stock indices ----
  "^GSPC": "The 500 largest companies listed in the United States. It is the most-watched measure of the US stock market.",
  "^NDX": "The 100 largest non-financial companies on the Nasdaq exchange. Technology weighs the most: Nvidia, Apple, Microsoft.",
  "^DJI": "The Dow Jones Industrial Average: 30 large, well-known US companies. It started in 1896 and is one of the oldest stock indexes in the world.",
  "^RUT": "About 2,000 small US companies. It shows how smaller, mostly domestic businesses are doing, not the giants.",
  "^GSPTSE": "The main index of the Toronto Stock Exchange. It covers most of the value of the companies listed in Canada. Banks, energy and mining weigh the most.",
  "^MXX": "Mexico's main stock index: about 35 of the largest and most-traded companies on the Mexican Stock Exchange.",
  "^BVSP": "Brazil's main stock index, also called the Ibovespa. It follows the most-traded companies on the B3 exchange in São Paulo. Petrobras, Vale and the big banks weigh the most.",
  "^MERV": "Argentina's main stock index: the most-traded companies on the Buenos Aires exchange. It is priced in pesos, so high inflation pushes the number up.",
  "^FTSE": "The 100 largest companies on the London Stock Exchange. Many are global firms (Shell, AstraZeneca, HSBC) that earn most of their money outside the United Kingdom.",
  "^GDAXI": "Germany's main stock index: the 40 largest companies on the Frankfurt exchange, such as SAP, Siemens and Allianz.",
  "^FCHI": "France's main stock index: 40 of the largest companies on the Paris exchange, such as LVMH, TotalEnergies and L'Oréal.",
  "FTSEMIB.MI": "Italy's main stock index: the 40 largest companies on the Milan exchange. Banks and energy weigh the most.",
  "^IBEX": "Spain's main stock index: the 35 most-traded companies on the Madrid exchange. Banks, Inditex (Zara) and Iberdrola weigh the most.",
  "^AEX": "The main stock index of the Netherlands: the largest companies on the Amsterdam exchange. The chip-machine maker ASML weighs the most.",
  "^SSMI": "Switzerland's main stock index: the 20 largest Swiss companies. Nestlé, Novartis and Roche make up about half of it.",
  "^OMX": "Sweden's main stock index: the 30 most-traded companies on the Stockholm exchange. Industrial firms and banks weigh the most.",
  "^OMXC25": "Denmark's main stock index: the 25 largest and most-traded companies on the Copenhagen exchange. The drug maker Novo Nordisk weighs the most.",
  "^BFX": "Belgium's main stock index: up to 20 of the largest companies on the Brussels exchange.",
  "^ATX": "Austria's main stock index: the 20 largest companies on the Vienna exchange. Banks and energy weigh the most.",
  "^J203.JO": "The main index of the Johannesburg Stock Exchange. It covers almost all of the value of the companies listed in South Africa. Miners and large global firms weigh the most.",
  "^N225": "Japan's best-known stock index: 225 large companies on the Tokyo Stock Exchange.",
  "000001.SS": "Every stock on the Shanghai Stock Exchange. It is the best-known index for mainland China. Large state-owned banks and energy firms weigh the most.",
  "^HSI": "The largest companies listed in Hong Kong. Many are mainland Chinese firms such as Tencent and Alibaba, so it is also a read on China.",
  "^NSEI": "India's main stock index: 50 of the largest companies on the National Stock Exchange, such as Reliance and HDFC Bank.",
  "^KS11": "Every company on South Korea's main exchange. Samsung Electronics weighs the most.",
  "^TWII": "Every company on the Taiwan Stock Exchange. TSMC, the largest contract chip maker in the world, is a large part of it.",
  "^AXJO": "The 200 largest companies listed in Australia. Banks and miners weigh the most.",
  "^NZ50": "The 50 largest companies listed in New Zealand.",
  "^STI": "Singapore's main stock index: the 30 largest companies on the Singapore Exchange. Banks weigh the most.",
  "^JKSE": "Every stock on the Indonesia Stock Exchange in Jakarta.",
  "^KLSE": "Malaysia's main stock index: the 30 largest companies on the Kuala Lumpur exchange.",
  "TA35.TA": "Israel's main stock index: the 35 largest companies on the Tel Aviv Stock Exchange.",
  "XU100.IS": "Turkey's main stock index: 100 large companies on the Istanbul exchange. It is priced in lira, so high inflation pushes the number up.",

  // ---- Country funds (US-listed) ----
  EWC: fund("Canada", "Canadian dollar", "Banks, energy and mining weigh the most."),
  EWW: fund("Mexico", "Mexican peso"),
  EWZ: fund("Brazil", "Brazilian real", "Petrobras, Vale and the big banks weigh the most."),
  ARGT: fund("Argentina", "Argentine peso", "It also holds firms that do most of their business there, such as MercadoLibre."),
  ECH: fund("Chile", "Chilean peso"),
  EWU: fund("the United Kingdom", "British pound", "Shell, AstraZeneca and HSBC weigh the most."),
  EWG: fund("Germany", "euro", "SAP, Siemens and Allianz weigh the most."),
  EWQ: fund("France", "euro", "Luxury, energy and industry weigh the most."),
  EWI: fund("Italy", "euro", "Banks and energy weigh the most."),
  EWP: fund("Spain", "euro", "Banks weigh the most."),
  EWN: fund("the Netherlands", "euro", "The chip-machine maker ASML weighs the most."),
  EWL: fund("Switzerland", "Swiss franc", "Nestlé, Novartis and Roche weigh the most."),
  EWD: fund("Sweden", "Swedish krona", "Industrial firms and banks weigh the most."),
  EDEN: fund("Denmark", "Danish krone", "The drug maker Novo Nordisk weighs the most."),
  EWK: fund("Belgium", "euro"),
  EWO: fund("Austria", "euro", "Banks and energy weigh the most."),
  EPOL: fund("Poland", "Polish zloty", "Banks weigh the most."),
  NORW: fund("Norway", "Norwegian krone", "Oil, banks and fish farming weigh the most."),
  EZA: fund("South Africa", "South African rand"),
  EWJ: fund("Japan", "Japanese yen", "Toyota, Sony and the big banks weigh the most."),
  MCHI: fund("China", "Chinese yuan", "Tencent and Alibaba weigh the most. It holds Chinese companies listed in Hong Kong, in mainland China and in New York."),
  EWH: fund("Hong Kong", null, "Insurance, the stock exchange and property weigh the most."),
  INDA: fund("India", "Indian rupee", "Banks, Reliance and software-services firms weigh the most."),
  EWY: fund("South Korea", "South Korean won", "Samsung Electronics and SK Hynix weigh the most."),
  EWT: fund("Taiwan", "Taiwan dollar", "The chip maker TSMC weighs the most."),
  EWA: fund("Australia", "Australian dollar", "Banks and miners weigh the most."),
  ENZL: fund("New Zealand", "New Zealand dollar"),
  EWS: fund("Singapore", "Singapore dollar", "Banks weigh the most."),
  EIDO: fund("Indonesia", "Indonesian rupiah", "Banks weigh the most."),
  EWM: fund("Malaysia", "Malaysian ringgit", "Banks weigh the most."),
  THD: fund("Thailand", "Thai baht"),
  EPHE: fund("the Philippines", "Philippine peso"),
  KSA: fund("Saudi Arabia", null, "Banks and the oil company Saudi Aramco weigh the most."),
  EIS: fund("Israel", "Israeli shekel", "Banks and technology firms weigh the most."),
  TUR: fund("Turkey", "Turkish lira"),

  // ---- Government bonds (read through bond funds) ----
  TLT: "A fund that holds US government bonds with 20 years or more left to run. These long bonds move the most when the outlook for interest rates changes. When this fund falls, long-term US interest rates are rising.",
  IEF: "A fund that holds US government bonds with 7 to 10 years left to run. It follows the 10-year Treasury, the most important benchmark interest rate in the world.",
  "XGB.TO": "A fund that holds bonds from Canada's federal, provincial and city governments.",
  "IGLT.L": "\"Gilts\" are bonds from the UK government. This fund holds them across short and long terms.",
  "EXX6.DE": "\"Bunds\" are bonds from the German government. Investors treat them as the safest bonds in the euro area. This fund holds the ones with more than 10 years left to run.",
  "2561.T": "A fund that holds bonds from the Japanese government (JGBs). Japan has more government debt, compared with the size of its economy, than any other large country.",
  "BTP10.MI": "\"BTPs\" are bonds from the Italian government. This fund follows the 10-year ones. Italy has heavy debt, so investors compare its bonds with Germany's to measure stress in the euro area.",
  "148070.KS": "A fund that follows 10-year bonds from the South Korean government.",
  "LTGILTBEES.NS": "A fund that holds bonds from the Indian government with 8 to 13 years left to run.",
  "IMAB11.SA": "Bonds from the Brazilian government that pay the inflation rate plus a fixed interest rate on top. Inflation cannot eat the investment, so savers use them as protection. Their price falls when interest rates above inflation (\"real\" rates) rise. This fund follows the main index of those bonds, the IMA-B.",
  CBON: "A fund listed in the United States that holds bonds issued in mainland China in yuan: from the government, state banks and large companies. It is priced in US dollars, so it also moves with the yuan.",
  "IGB.AX": "A fund that holds bonds from Australia's federal government.",
  EMB: "A fund that holds US-dollar bonds from the governments of developing countries, such as Mexico, Turkey, Saudi Arabia and Indonesia. Investors sell it when they fear risk, so it behaves more like stocks than like safe bonds.",
  BWX: "A fund that holds government bonds from countries outside the United States, mostly rich ones such as Japan, the United Kingdom, France and Germany, in their own currencies.",

  // ---- World sectors (global sector funds) ----
  IXN: "The largest technology companies in the world: chips, software and devices. Nvidia, Apple and Microsoft weigh the most.",
  IXG: "The largest banks, insurers and payment firms in the world, such as JPMorgan, Berkshire Hathaway and Visa.",
  IXC: "The largest oil and gas companies in the world, such as ExxonMobil, Chevron and Shell. It usually follows the oil price.",
  IXJ: "The largest drug makers, medical-device makers and health insurers in the world, such as Eli Lilly, Johnson & Johnson and Novo Nordisk.",
  EXI: "The companies that build and move things: machines, aircraft, railways and defence. Examples: GE Aerospace, Caterpillar and Siemens.",
  RXI: "Companies that sell what people buy when they have money to spare: cars, online shopping, travel and luxury. Examples: Amazon, Tesla and Toyota.",
  KXI: "Companies that sell what people buy in good times and bad: food, drinks and household goods. Examples: Walmart, Nestlé and Coca-Cola. Investors treat it as a defensive sector.",
  JXI: "Electricity, gas and water companies. Their income is steady, so investors treat the sector as defensive.",
  MXI: "Companies that make raw materials: miners, chemical makers and building materials. Examples: Linde, BHP and Rio Tinto.",
  IXP: "Phone networks, media and internet platforms, such as Alphabet (Google), Meta (Facebook) and Netflix.",
  REET: "Companies around the world that own property and pay out the rent to shareholders (REITs): warehouses, data centres, apartments and shopping centres.",

  // ---- Major stocks ----
  AAPL: "Maker of the iPhone, Mac and iPad. One of the most valuable companies in the world.",
  MSFT: "Maker of Windows and Office, and owner of the Azure cloud. One of the most valuable companies in the world.",
  NVDA: "Designer of the chips that train and run most artificial intelligence. One of the most valuable companies in the world.",
  AMZN: "The largest online shop in the Western world. Its AWS unit is the largest cloud-computing provider.",
  GOOGL: "The parent company of Google, YouTube and Android. Most of its money comes from advertising.",
  META: "The parent company of Facebook, Instagram and WhatsApp. Most of its money comes from advertising.",
  TSLA: "Electric-car maker led by Elon Musk. It also sells batteries for homes and power grids.",
  JPM: "JPMorgan Chase, the largest bank in the United States. Traders read it as a gauge of the health of US banking.",
  "2330.TW": "Taiwan Semiconductor Manufacturing Company. It makes most of the world's most advanced chips, for Apple, Nvidia and others.",
  "005930.KS": "Samsung Electronics, the largest company in South Korea. One of the largest makers of memory chips, phones and TVs in the world.",
  "7203.T": "Japan's largest car maker, and the largest in the world by vehicles sold.",
  "6758.T": "Japanese electronics and entertainment group: PlayStation, music, films and camera sensors.",
  "0700.HK": "Chinese internet giant. It owns the WeChat app, which most people in China use to chat and to pay, and it is the largest video-game company in the world by revenue.",
  "9988.HK": "One of China's largest online-shopping groups (Taobao, Tmall), and a large cloud-computing provider.",
  "RELIANCE.NS": "Reliance Industries, one of India's largest companies: oil refining, the Jio mobile network and retail shops.",
  "HDFCBANK.NS": "India's largest private-sector bank.",
  "ASML.AS": "Dutch maker of the machines that print computer chips. It is the only company in the world that makes the machines needed for the most advanced chips.",
  "SAP.DE": "Europe's largest software company, from Germany. Its software runs the accounts and operations of many of the world's large companies.",
  "MC.PA": "The largest luxury group in the world, from France: Louis Vuitton, Dior, Tiffany and Moët & Chandon.",
  "NESN.SW": "The largest food and drink company in the world, from Switzerland: Nescafé, KitKat and Purina.",
  "NOVO-B.CO": "Danish drug maker. It makes Ozempic and Wegovy (diabetes and weight loss) and much of the world's insulin.",
  "SHEL.L": "One of the largest oil and gas companies in the world, based in London.",
  "AZN.L": "British-Swedish drug maker, strong in cancer medicines. One of the largest companies in the United Kingdom.",
  "HSBA.L": "Europe's largest bank, based in London. Most of its profit comes from Asia, mainly Hong Kong.",
  "2222.SR": "Saudi Arabia's state oil company. It produces more oil than any other company in the world.",
  "BHP.AX": "One of the largest mining companies in the world, from Australia: iron ore, copper and coal.",
  "RY.TO": "Canada's largest bank, and one of the largest companies in the country.",
  "PETR4.SA": "Brazil's state-controlled oil company and one of its largest companies. It pumps most of Brazil's oil, much of it from deep under the sea. The government holds control, so politics can move the share price.",
  INFY: "One of India's largest software-services companies. It writes and runs software for firms around the world.",

  // ---- Macro gauges ----
  "GC=F": "The price of gold. Investors buy gold when they fear inflation, a weak currency or a crisis.",
  "CL=F": "The price of US crude oil (WTI). Oil drives the cost of fuel and transport, so it touches inflation in every economy.",
  "HG=F": "The price of copper. Copper goes into wiring, buildings and electric cars, so demand rises when the world economy grows. Traders call it \"Dr. Copper\" for that reason.",
  "DX-Y.NYB": "The US Dollar Index: the dollar against six major currencies, mostly the euro and the yen. A rising dollar often puts pressure on stocks, commodities and emerging markets.",
  "BTC-USD": "The largest cryptocurrency, priced in US dollars. It trades day and night, every day of the week. Traders use it as a gauge of appetite for risk.",
};

// Markets that are read through another listing or a fund: [the entry above, how this page reads it].
const NY = "Read here through its New York listing, priced in US dollars.";
const VIA = {
  SPY: ["^GSPC", "Read here through the fund SPY, which holds the same companies."],
  QQQ: ["^NDX", "Read here through the fund QQQ, which holds the same companies."],
  DIA: ["^DJI", "Read here through the fund DIA, which holds the same companies."],
  IWM: ["^RUT", "Read here through the fund IWM, which holds the same companies."],
  GLD: ["GC=F", "Read here through the fund GLD, which holds gold bars."],
  USO: ["CL=F", "Read here through the fund USO, which holds oil futures."],
  CPER: ["HG=F", "Read here through the fund CPER, which holds copper futures."],
  UUP: ["DX-Y.NYB", "Read here through the fund UUP, which follows the dollar index."],
  BTC: ["BTC-USD", ""],
  TSM: ["2330.TW", NY], SONY: ["6758.T", NY], TM: ["7203.T", NY], BABA: ["9988.HK", NY], HDB: ["HDFCBANK.NS", NY],
  ASML: ["ASML.AS", NY], SAP: ["SAP.DE", NY], NVO: ["NOVO-B.CO", NY], SHEL: ["SHEL.L", NY], AZN: ["AZN.L", NY],
  HSBC: ["HSBA.L", NY], BHP: ["BHP.AX", NY], RY: ["RY.TO", NY], PBR: ["PETR4.SA", NY], INFY: ["INFY", NY],
  "GC=F": ["GC=F", "Read here through gold futures."],
  "CL=F": ["CL=F", "Read here through oil futures."],
  "HG=F": ["HG=F", "Read here through copper futures."],
  "PETR4.SA": ["PETR4.SA", "Read here through its preferred shares (PETR4), the most-traded ones in São Paulo."],
};

const KIND = { index: "Stock market", bond: "Bonds", stock: "Company", sector: "World sector", macro: "World gauge" };
const MACRO = { "GC=F": "Commodity", "CL=F": "Commodity", "HG=F": "Commodity", "DX-Y.NYB": "Currency", "BTC-USD": "Cryptocurrency" };

// What a market is, in plain words: { kind, text, via }. null when we have no text for it.
export function about(m) {
  const [key, via] = VIA[m.symbol] ?? [m.symbol, ""];
  const text = ABOUT[key];
  if (!text) return null;
  return { kind: MACRO[key] ?? KIND[m.kind] ?? "", text, via };
}

// One line for every bond market: the idea a new reader needs before the rest makes sense.
export const BOND_BASICS = "Bond basics: a bond is a loan. When its price falls, its interest rate (yield) rises.";
