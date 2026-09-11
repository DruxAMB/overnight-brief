// ─── Bitget Signal MCP client ─────────────────────────────────────
// Wraps the public bitget-signal MCP server (https://datahub.noxiaohao.com/mcp)
// for market analysis data: news feeds, sentiment indices, macro indicators,
// derivatives positioning, and cross-asset correlations.
//
// No API key required. The MCP server is maintained by Bitget.
// Falls back gracefully to null on any error so callers can use seed data.

const MCP_URL = "https://datahub.noxiaohao.com/mcp";
const MCP_TIMEOUT_MS = 8000;

let sessionId: string | null = null;
let sessionInitTime = 0;
const SESSION_TTL_MS = 5 * 60 * 1000; // 5 min

interface McpResponse {
  jsonrpc: string;
  id: number;
  result?: {
    content: { type: string; text: string }[];
    isError?: boolean;
  };
  error?: { code: number; message: string };
}

async function ensureSession(): Promise<string | null> {
  // Reuse session if still valid
  if (sessionId && Date.now() - sessionInitTime < SESSION_TTL_MS) {
    return sessionId;
  }

  try {
    const body = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "overnight-brief", version: "1.0" },
      },
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MCP_TIMEOUT_MS);
    const r = await fetch(MCP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const sid = r.headers.get("mcp-session-id");
    if (!sid) return null;

    sessionId = sid;
    sessionInitTime = Date.now();

    // Send initialized notification (fire and forget)
    await fetch(MCP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "mcp-session-id": sid,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      }),
      signal: AbortSignal.timeout(MCP_TIMEOUT_MS),
    }).catch(() => {});

    return sid;
  } catch {
    sessionId = null;
    return null;
  }
}

async function callMcpTool<T = unknown>(
  toolName: string,
  args: Record<string, unknown>,
): Promise<T | null> {
  const sid = await ensureSession();
  if (!sid) return null;

  try {
    const body = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: toolName, arguments: args },
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MCP_TIMEOUT_MS);
    const r = await fetch(MCP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "mcp-session-id": sid,
      },
      body,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const text = await r.text();
    const lines = text.split("\n");
    const dataLine = lines.find((l) => l.startsWith("data: "));
    if (!dataLine) return null;

    const json: McpResponse = JSON.parse(dataLine.slice(6));
    if (json.error || json.result?.isError) return null;

    const contentText = json.result?.content
      ?.map((c) => c.text)
      .join("");
    if (!contentText) return null;

    return JSON.parse(contentText) as T;
  } catch {
    return null;
  }
}

// ─── Typed data accessors for each analyst domain ─────────────────

/** Fear & Greed Index from alternative.me via MCP */
export async function fetchFearGreedIndex(): Promise<{
  value: number;
  classification: string;
  timestamp: string;
} | null> {
  const data = await callMcpTool<{
    value?: number;
    classification?: string;
    alt_me_error?: string;
  }>("sentiment_index", { action: "current" });

  if (!data || data.alt_me_error !== undefined) return null;
  if (typeof data.value !== "number") return null;

  return {
    value: data.value,
    classification: data.classification || "Neutral",
    timestamp: new Date().toISOString(),
  };
}

/** Crypto news from RSS feeds via MCP */
export async function fetchCryptoNews(limit = 8): Promise<
  { title: string; source: string; url?: string; publishedAt?: string }[]
> {
  const data = await callMcpTool<
    { feed: string; error: string; items: { title: string; link?: string; published?: string }[] }[]
  >("news_feed", {
    action: "latest",
    feeds: "cointelegraph,coindesk,decrypt,blockworks",
    limit,
  });

  if (!data || !Array.isArray(data)) return [];

  const items: { title: string; source: string; url?: string; publishedAt?: string }[] = [];
  for (const feed of data) {
    if (feed.error || !feed.items) continue;
    for (const item of feed.items) {
      items.push({
        title: item.title,
        source: feed.feed,
        url: item.link,
        publishedAt: item.published,
      });
    }
  }
  return items.slice(0, limit);
}

/** Long/short ratio from Binance futures via MCP */
export async function fetchLongShortRatio(
  symbol: string,
  period = "4h",
): Promise<{
  longShortRatio: number;
  longAccount: number;
  shortAccount: number;
} | null> {
  const data = await callMcpTool<{
    error?: string;
    longShortRatio?: number;
    longAccount?: number;
    shortAccount?: number;
  }>("derivatives_sentiment", {
    action: "long_short",
    symbol: `${symbol}USDT`,
    period,
  });

  if (!data || data.error !== undefined) return null;
  if (typeof data.longShortRatio !== "number") return null;

  return {
    longShortRatio: data.longShortRatio,
    longAccount: data.longAccount || 0,
    shortAccount: data.shortAccount || 0,
  };
}

/** Taker buy/sell ratio via MCP */
export async function fetchTakerRatio(
  symbol: string,
  period = "4h",
): Promise<{
  takerBuyRatio: number;
  takerSellRatio: number;
} | null> {
  const data = await callMcpTool<{
    error?: string;
    buyRatio?: number;
    sellRatio?: number;
    takerBuyRatio?: number;
    takerSellRatio?: number;
  }>("derivatives_sentiment", {
    action: "taker_ratio",
    symbol: `${symbol}USDT`,
    period,
  });

  if (!data || data.error !== undefined) return null;

  return {
    takerBuyRatio: data.takerBuyRatio || data.buyRatio || 0,
    takerSellRatio: data.takerSellRatio || data.sellRatio || 0,
  };
}

/** US Treasury yield curve via MCP */
export async function fetchYieldCurve(): Promise<{
  t3m: number;
  t2y: number;
  t10y: number;
  t30y: number;
  spread10y2y: number;
  inverted: boolean;
} | null> {
  const data = await callMcpTool<{
    yield_curve?: {
      t3m?: { error?: string; yield?: number };
      t2y?: { error?: string; yield?: number };
      t10y?: { error?: string; yield?: number };
      t30y?: { error?: string; yield?: number };
    };
    spread_10y2y?: number;
    inverted?: boolean;
  }>("rates_yields", { action: "yield_curve" });

  if (!data?.yield_curve) return null;

  const t10y = data.yield_curve.t10y?.yield;
  const t2y = data.yield_curve.t2y?.yield;
  if (typeof t10y !== "number" || typeof t2y !== "number") return null;

  return {
    t3m: data.yield_curve.t3m?.yield || 0,
    t2y,
    t10y,
    t30y: data.yield_curve.t30y?.yield || 0,
    spread10y2y: data.spread_10y2y || t10y - t2y,
    inverted: data.inverted || t10y < t2y,
  };
}

/** FOMC / Fed news via MCP */
export async function fetchFomcNews(limit = 5): Promise<
  { title: string; date?: string }[]
> {
  const data = await callMcpTool<{
    error?: string;
    news?: { title: string; date?: string }[];
  }>("macro_indicators", { action: "fomc_news", limit });

  if (!data || data.error !== undefined) return [];
  return data.news || [];
}

/** Cross-asset correlations via MCP */
export async function fetchCrossAssetCorrelation(
  base = "btc",
  targets = "gold,dxy,ndx,spx",
  period = "1y",
  window = 30,
): Promise<Record<string, number> | null> {
  const data = await callMcpTool<
    Record<string, number> | { error?: string }
  >(
    "cross_asset",
    { action: "correlation", base, targets, period, window },
  );

  if (!data || typeof data !== "object" || "error" in data) return null;
  return data as Record<string, number>;
}

/** Global asset price (DXY, VIX, S&P, Gold, etc.) via MCP */
export async function fetchGlobalAssetPrice(
  symbol: string,
): Promise<{ price: number; change?: number } | null> {
  const data = await callMcpTool<{
    price?: number;
    change?: number;
    error?: string;
  }>("global_assets", { action: "price", symbol });

  if (!data || data.error !== undefined) return null;
  if (typeof data.price !== "number") return null;

  return { price: data.price, change: data.change };
}

/** Reddit crypto trending via MCP */
export async function fetchRedditTrending(limit = 10): Promise<
  { coin: string; mentions: number; sentiment: string }[]
> {
  const data = await callMcpTool<
    { error?: string; trending?: { coin: string; mentions: number; sentiment: string }[] }
  >("derivatives_sentiment", { action: "reddit_trending", limit });

  if (!data || data.error !== undefined) return [];
  return data.trending || [];
}

/** Check if the MCP server is reachable */
export async function isMcpAvailable(): Promise<boolean> {
  const sid = await ensureSession();
  return sid !== null;
}
