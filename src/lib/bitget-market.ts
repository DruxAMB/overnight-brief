import { loadConfig, BitgetRestClient } from "@bitget-ai/bitget-agent-sdk";
import type { WatchlistItem } from "./types";
import { SEED_WATCHLIST } from "./seed-data";

// ─── Bitget market data adapter ───────────────────────────────────
// Fetches real rToken ticker data from Bitget's public market endpoint.
// No API key required: market data is public.
// Falls back to seed data if the API is unreachable.

let client: BitgetRestClient | null = null;

function getClient(): BitgetRestClient {
  if (client) return client;
  const config = loadConfig({ modules: "market", readOnly: true });
  client = new BitgetRestClient(config);
  return client;
}

/** The rToken symbols we track, mapped to Bitget spot pair format. */
const RTOKEN_SYMBOLS = SEED_WATCHLIST.map((w) => ({
  symbol: w.symbol,
  bitgetSymbol: `${w.symbol}USDT`,
  underlying: w.underlying,
  name: w.name,
  positionSize: w.positionSize,
}));

interface BitgetTicker {
  symbol: string;
  lastPr: string;       // last price
  high24h: string;      // 24h high
  low24h: string;      // 24h low
  change24h: string;   // 24h change (absolute)
  change24hPct: string; // 24h change percentage
  baseVolume: string;   // base volume
  quoteVolume: string;  // quote volume (USDT)
  bidPr: string;
  askPr: string;
}

/**
 * Fetch real rToken market data from Bitget.
 * Returns a watchlist with live prices, changes, and volumes.
 * Falls back to seed data on any error.
 */
export async function fetchWatchlist(): Promise<{
  items: WatchlistItem[];
  isLive: boolean;
  error?: string;
}> {
  try {
    const restClient = getClient();
    const items: WatchlistItem[] = [];

    for (const rt of RTOKEN_SYMBOLS) {
      try {
        const result = await restClient.callOperation("getTickers", {
          category: "SPOT",
          symbol: rt.bitgetSymbol,
        });

        const tickers = (result.data as { data?: BitgetTicker[] }).data;
        if (!tickers || tickers.length === 0) {
          // Symbol not found: use seed for this one
          const seed = SEED_WATCHLIST.find((w) => w.symbol === rt.symbol);
          if (seed) items.push(seed);
          continue;
        }

        const t = tickers[0];
        const changePct = parseFloat(t.change24hPct) || 0;
        const quoteVolume = parseFloat(t.quoteVolume) || 0;
        const lastPrice = parseFloat(t.lastPr) || 0;

        // Premium to NAV: we don't have NAV from the ticker API directly.
        // For rTokens, the "premium" is the spread between the rToken price
        // and the underlying stock price. We approximate this as 0 for now
        // since we don't have a separate stock price feed. In production,
        // this would come from a stock price API or a dedicated rToken NAV endpoint.
        const premiumToNavPct = 0;

        items.push({
          symbol: rt.symbol,
          underlying: rt.underlying,
          name: rt.name,
          lastPrice: lastPrice,
          overnightChangePct: changePct,
          premiumToNavPct,
          volume24h: quoteVolume,
          positionSize: rt.positionSize,
        });
      } catch (err) {
        // Individual symbol failed: use seed for this one
        console.error(`[Bitget] Failed to fetch ${rt.symbol}:`, err);
        const seed = SEED_WATCHLIST.find((w) => w.symbol === rt.symbol);
        if (seed) items.push(seed);
      }
    }

    if (items.length === 0) {
      return { items: SEED_WATCHLIST, isLive: false, error: "All ticker fetches failed" };
    }

    return { items, isLive: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[Bitget] Market data fetch failed:", msg);
    return { items: SEED_WATCHLIST, isLive: false, error: msg };
  }
}

/**
 * Fetch a single rToken's market data (for follow-up Q&A on a specific symbol).
 */
export async function fetchSingleTicker(symbol: string): Promise<{
  item: WatchlistItem | null;
  isLive: boolean;
  error?: string;
}> {
  try {
    const restClient = getClient();
    const bitgetSymbol = `${symbol}USDT`;
    const result = await restClient.callOperation("getTickers", {
      category: "SPOT",
      symbol: bitgetSymbol,
    });

    const tickers = (result.data as { data?: BitgetTicker[] }).data;
    if (!tickers || tickers.length === 0) {
      const seed = SEED_WATCHLIST.find((w) => w.symbol === symbol);
      return { item: seed || null, isLive: false };
    }

    const t = tickers[0];
    const seed = SEED_WATCHLIST.find((w) => w.symbol === symbol);
    const item: WatchlistItem = {
      symbol,
      underlying: seed?.underlying || symbol.replace("r", ""),
      name: seed?.name || symbol,
      lastPrice: parseFloat(t.lastPr) || 0,
      overnightChangePct: parseFloat(t.change24hPct) || 0,
      premiumToNavPct: 0,
      volume24h: parseFloat(t.quoteVolume) || 0,
      positionSize: seed?.positionSize || 0,
    };

    return { item, isLive: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error(`[Bitget] Failed to fetch ${symbol}:`, msg);
    const seed = SEED_WATCHLIST.find((w) => w.symbol === symbol);
    return { item: seed || null, isLive: false, error: msg };
  }
}
