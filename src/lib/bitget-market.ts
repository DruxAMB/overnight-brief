import { loadConfig, BitgetRestClient } from "@bitget-ai/bitget-agent-sdk";
import type { WatchlistItem } from "./types";
import { SEED_WATCHLIST } from "./seed-data";
import { getRTokenMeta } from "./rtoken-catalog";

// ─── Bitget market data adapter ───────────────────────────────────
// Fetches real rToken market data from Bitget's public API endpoints.
// No API key required: all market data is public.
// Falls back to seed data if the API is unreachable.
//
// Data sources (all public, no auth):
//   1. Tickers: price, 24h change, volume (spot)
//   2. Candles: OHLCV for technical analysis (spot)
//   3. Funding rates: perp funding rate (futures)
//   4. Open interest: perp OI (futures)

let client: BitgetRestClient | null = null;

function getClient(): BitgetRestClient {
  if (client) return client;
  const config = loadConfig({ modules: "market", readOnly: true });
  client = new BitgetRestClient(config);
  return client;
}

/** Build the symbol list from the user's selection, mapped to Bitget pair format. */
function buildSymbolList(symbols: string[]) {
  return symbols.map((symbol) => {
    const meta = getRTokenMeta(symbol);
    const seed = SEED_WATCHLIST.find((w) => w.symbol === symbol);
    return {
      symbol,
      bitgetSymbol: `${symbol}USDT`,
      underlying: meta?.underlying || seed?.underlying || symbol.replace("r", ""),
      name: meta?.name || seed?.name || symbol,
      positionSize: seed?.positionSize || 0,
    };
  });
}

interface BitgetTicker {
  symbol: string;
  lastPr: string;
  high24h: string;
  low24h: string;
  change24h: string;
  change24hPct: string;
  baseVolume: string;
  quoteVolume: string;
  bidPr: string;
  askPr: string;
}

/** A single OHLCV candle. */
export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** Funding rate data for a perpetual contract. */
export interface FundingRate {
  symbol: string;
  fundingRate: number;
  fundingRateInterval: number;
  nextUpdate: number;
  minFundingRate: number;
  maxFundingRate: number;
}

/** Open interest data. */
export interface OpenInterest {
  symbol: string;
  size: number;
  timestamp: number;
}

/**
 * Fetch real rToken market data from Bitget for the user's selected symbols.
 * Returns a watchlist with live prices, changes, and volumes.
 * Falls back to seed data on any error.
 */
export async function fetchWatchlist(symbols?: string[]): Promise<{
  items: WatchlistItem[];
  isLive: boolean;
  error?: string;
}> {
  const symbolList = symbols && symbols.length > 0
    ? buildSymbolList(symbols)
    : buildSymbolList(SEED_WATCHLIST.map((w) => w.symbol));

  try {
    const restClient = getClient();
    const items: WatchlistItem[] = [];

    for (const rt of symbolList) {
      try {
        const result = await restClient.callOperation("getTickers", {
          category: "SPOT",
          symbol: rt.bitgetSymbol,
        });

        const tickers = (result.data as { data?: BitgetTicker[] }).data;
        if (!tickers || tickers.length === 0) {
          const seed = SEED_WATCHLIST.find((w) => w.symbol === rt.symbol);
          if (seed) items.push(seed);
          continue;
        }

        const t = tickers[0];
        const changePct = parseFloat(t.change24hPct) || 0;
        const quoteVolume = parseFloat(t.quoteVolume) || 0;
        const lastPrice = parseFloat(t.lastPr) || 0;

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

/**
 * Fetch OHLCV candles from Bitget's public spot API.
 * Used by the Technical Analysis analyst for indicator calculations.
 */
export async function fetchCandles(
  symbol: string,
  granularity = "1h",
  limit = 200,
): Promise<{ candles: Candle[]; isLive: boolean; error?: string }> {
  try {
    const bitgetSymbol = `${symbol}USDT`;
    const url = `https://api.bitget.com/api/v2/spot/market/candles?symbol=${bitgetSymbol}&granularity=${granularity}&limit=${limit}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const r = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!r.ok) throw new Error(`Bitget candles API ${r.status}`);

    const data = await r.json() as {
      code: string;
      msg: string;
      data: string[][];
    };

    if (data.code !== "00000" || !data.data) {
      throw new Error(`Bitget API error: ${data.msg}`);
    }

    // Bitget returns candles in descending order (newest first).
    // Each row: [timestamp, open, high, low, close, volume, quoteVol, amount]
    const candles: Candle[] = data.data
      .map((row) => ({
        timestamp: parseInt(row[0]),
        open: parseFloat(row[1]),
        high: parseFloat(row[2]),
        low: parseFloat(row[3]),
        close: parseFloat(row[4]),
        volume: parseFloat(row[5]),
      }))
      .reverse(); // oldest first for indicator calculations

    return { candles, isLive: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error(`[Bitget] Candles fetch failed for ${symbol}:`, msg);
    return { candles: [], isLive: false, error: msg };
  }
}

/**
 * Fetch funding rate for a perpetual contract from Bitget's public API.
 * Used by the Sentiment Analyst for positioning analysis.
 */
export async function fetchFundingRate(
  symbol: string,
): Promise<{ fundingRate: FundingRate | null; isLive: boolean; error?: string }> {
  try {
    const bitgetSymbol = `${symbol}USDT`;
    const url = `https://api.bitget.com/api/v2/mix/market/current-fund-rate?symbol=${bitgetSymbol}&productType=USDT-FUTURES`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const r = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!r.ok) throw new Error(`Bitget funding rate API ${r.status}`);

    const data = await r.json() as {
      code: string;
      msg: string;
      data: Array<{
        symbol: string;
        fundingRate: string;
        fundingRateInterval: string;
        nextUpdate: string;
        minFundingRate: string;
        maxFundingRate: string;
      }>;
    };

    if (data.code !== "00000" || !data.data || data.data.length === 0) {
      throw new Error(`Bitget API error: ${data.msg}`);
    }

    const d = data.data[0];
    const fundingRate: FundingRate = {
      symbol: d.symbol,
      fundingRate: parseFloat(d.fundingRate),
      fundingRateInterval: parseInt(d.fundingRateInterval),
      nextUpdate: parseInt(d.nextUpdate),
      minFundingRate: parseFloat(d.minFundingRate),
      maxFundingRate: parseFloat(d.maxFundingRate),
    };

    return { fundingRate, isLive: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error(`[Bitget] Funding rate fetch failed for ${symbol}:`, msg);
    return { fundingRate: null, isLive: false, error: msg };
  }
}

/**
 * Fetch open interest for a perpetual contract from Bitget's public API.
 * Used by the Market Intel analyst for market structure analysis.
 */
export async function fetchOpenInterest(
  symbol: string,
): Promise<{ openInterest: OpenInterest | null; isLive: boolean; error?: string }> {
  try {
    const bitgetSymbol = `${symbol}USDT`;
    const url = `https://api.bitget.com/api/v2/mix/market/open-interest?symbol=${bitgetSymbol}&productType=USDT-FUTURES`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const r = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!r.ok) throw new Error(`Bitget OI API ${r.status}`);

    const data = await r.json() as {
      code: string;
      msg: string;
      data: {
        openInterestList: Array<{ symbol: string; size: string }>;
        ts: string;
      };
    };

    if (data.code !== "00000" || !data.data?.openInterestList?.length) {
      throw new Error(`Bitget API error: ${data.msg}`);
    }

    const oi = data.data.openInterestList[0];
    const openInterest: OpenInterest = {
      symbol: oi.symbol,
      size: parseFloat(oi.size),
      timestamp: parseInt(data.data.ts),
    };

    return { openInterest, isLive: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error(`[Bitget] Open interest fetch failed for ${symbol}:`, msg);
    return { openInterest: null, isLive: false, error: msg };
  }
}

/**
 * Fetch BTC and ETH spot tickers from Bitget as a macro proxy.
 * Used by the Macro Oracle when MCP global_assets / cross_asset are unavailable.
 * BTC is the primary crypto market benchmark and correlates with rToken sentiment.
 */
export async function fetchCryptoTickers(): Promise<{
  btc: { price: number; changePct: number; volume: number } | null;
  eth: { price: number; changePct: number; volume: number } | null;
  isLive: boolean;
}> {
  try {
    const symbols = ["BTCUSDT", "ETHUSDT"];
    const results = await Promise.all(
      symbols.map(async (sym) => {
        const url = `https://api.bitget.com/api/v2/spot/market/tickers?symbol=${sym}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const r = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        if (!r.ok) return null;
        const data = await r.json() as {
          code: string;
          data: Array<{ lastPr: string; change24hPct: string; quoteVolume: string }>;
        };
        if (data.code !== "00000" || !data.data?.length) return null;
        const t = data.data[0];
        return {
          price: parseFloat(t.lastPr) || 0,
          changePct: parseFloat(t.change24hPct) || 0,
          volume: parseFloat(t.quoteVolume) || 0,
        };
      }),
    );

    return {
      btc: results[0],
      eth: results[1],
      isLive: results[0] !== null || results[1] !== null,
    };
  } catch (err) {
    console.error("[Bitget] Crypto tickers fetch failed:", err);
    return { btc: null, eth: null, isLive: false };
  }
}
