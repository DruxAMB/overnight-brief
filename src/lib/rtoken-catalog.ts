// ─── Available rToken catalog ──────────────────────────────────────
// All known tokenized US stock rTokens tradable on Bitget.
// Users can add any of these to their personalized watchlist.
// No signup required: selection persists in localStorage.

export interface RTokenMeta {
  symbol: string; // e.g. "rNVDA"
  underlying: string; // e.g. "NVDA"
  name: string; // e.g. "NVIDIA Corp"
  sector: string; // e.g. "Semiconductors"
}

export const RTOKEN_CATALOG: RTokenMeta[] = [
  { symbol: "rNVDA", underlying: "NVDA", name: "NVIDIA Corp", sector: "Semiconductors" },
  { symbol: "rTSLA", underlying: "TSLA", name: "Tesla Inc", sector: "Automotive / EV" },
  { symbol: "rAAPL", underlying: "AAPL", name: "Apple Inc", sector: "Consumer Tech" },
  { symbol: "rCOIN", underlying: "COIN", name: "Coinbase Global", sector: "Crypto / Exchanges" },
  { symbol: "rMSTR", underlying: "MSTR", name: "MicroStrategy", sector: "Crypto Treasury" },
  { symbol: "rAMZN", underlying: "AMZN", name: "Amazon.com Inc", sector: "E-commerce / Cloud" },
  { symbol: "rMSFT", underlying: "MSFT", name: "Microsoft Corp", sector: "Software / Cloud" },
  { symbol: "rGOOG", underlying: "GOOG", name: "Alphabet Inc", sector: "Internet / Search" },
  { symbol: "rMETA", underlying: "META", name: "Meta Platforms", sector: "Social / Ads" },
  { symbol: "rNFLX", underlying: "NFLX", name: "Netflix Inc", sector: "Streaming / Media" },
  { symbol: "rAMD", underlying: "AMD", name: "Advanced Micro Devices", sector: "Semiconductors" },
  { symbol: "rPLTR", underlying: "PLTR", name: "Palantir Technologies", sector: "Data / AI" },
];

/** Default watchlist symbols (the original 5) */
export const DEFAULT_WATCHLIST_SYMBOLS = ["rNVDA", "rTSLA", "rAAPL", "rCOIN", "rMSTR"];

/** Look up metadata for a symbol */
export function getRTokenMeta(symbol: string): RTokenMeta | undefined {
  return RTOKEN_CATALOG.find((r) => r.symbol === symbol);
}
