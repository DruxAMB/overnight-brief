import { ANALYST_PERSONAS, SEED_FINDINGS, SEED_BRIEFING } from "@/lib/seed-data";
import type {
  AnalystId,
  AnalystFinding,
  AnalystSignal,
  Briefing,
  WatchlistItem,
} from "@/lib/types";
import {
  fetchCandles,
  fetchFundingRate,
  fetchOpenInterest,
  fetchCryptoTickers,
  type Candle,
} from "@/lib/bitget-market";
import { analyzeCandles, type TechnicalSummary } from "@/lib/indicators";
import {
  fetchFearGreedIndex,
  fetchCryptoNews,
  fetchLongShortRatio,
  fetchTakerRatio,
  fetchYieldCurve,
  fetchFomcNews,
  fetchCrossAssetCorrelation,
  fetchGlobalAssetPrice,
  fetchRedditTrending,
} from "@/lib/bitget-signal";

// ─── LLM configuration ────────────────────────────────────────────
// Primary: Qwen 3.6 Plus via Bitget hackathon proxy (sponsor LLM)
// Fallback: dynamic analysis from real Bitget market data + MCP signal data

const QWEN_API_URL = "https://hackathon.bitgetops.com/v1/chat/completions";
const QWEN_MODEL = "qwen3.6-plus";

function hasQwenKey(): boolean {
  return !!(process.env.BITGET_QWEN_API_KEY || process.env.DASHSCOPE_API_KEY);
}

function getQwenKey(): string {
  return process.env.BITGET_QWEN_API_KEY || process.env.DASHSCOPE_API_KEY || "";
}

export function hasLLMKey(): boolean {
  return hasQwenKey();
}

// ─── Prompt sanitization ──────────────────────────────────────────
function sanitizePrompt(prompt: string): string {
  let cleaned = prompt
    .replace(/[\x00-\x1F\x7F-\x9F]/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();

  const MAX = 2000;
  if (cleaned.length > MAX) cleaned = cleaned.substring(0, MAX);

  cleaned = cleaned
    .replace(/```/g, "'''")
    .replace(/<\|.*?\|>/g, "")
    .replace(/\bSystem:/gi, "User said System:")
    .replace(/\bAssistant:/gi, "User said Assistant:");

  return cleaned;
}

// ─── Qwen API call (OpenAI-compatible) ─────────────────────────────

interface QwenMessage {
  role: "system" | "user";
  content: string;
}

interface QwenResponse {
  choices: { message: { content: string } }[];
  error?: { message: string; code: string };
}

async function callQwen(messages: QwenMessage[], maxRetries = 2): Promise<string> {
  const apiKey = getQwenKey();
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(QWEN_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: QWEN_MODEL,
          messages,
          response_format: { type: "json_object" },
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Qwen API ${response.status}: ${errorText.substring(0, 200)}`);
      }

      const data = (await response.json()) as QwenResponse;
      if (data.error) {
        throw new Error(`Qwen API error: ${data.error.message}`);
      }

      if (!data.choices || data.choices.length === 0) {
        throw new Error("Qwen API returned no choices");
      }

      return data.choices[0].message.content;
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (attempt < maxRetries && (msg.includes("429") || msg.includes("503") || msg.includes("502") || msg.includes("Service Unavailable") || msg.includes("Too Many Requests"))) {
        console.warn(`[Qwen] attempt ${attempt + 1} failed (${msg.substring(0, 80)}), retrying...`);
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      break;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Qwen API failed after retries");
}

// ─── Real data fetchers per analyst domain ────────────────────────
// Each fetcher pulls data from Bitget public APIs + bitget-signal MCP server.
// All return null on failure so callers can fall back gracefully.

interface MacroData {
  yieldCurve: { t10y: number; t2y: number; spread10y2y: number; inverted: boolean } | null;
  dxy: { price: number; change?: number } | null;
  vix: { price: number; change?: number } | null;
  fomcNews: { title: string; date?: string }[];
  btcCorrelation: Record<string, number> | null;
  btc: { price: number; changePct: number; volume: number } | null;
  eth: { price: number; changePct: number; volume: number } | null;
}

interface MarketIntelData {
  fundingRates: { symbol: string; rate: number; interval: number }[];
  openInterest: { symbol: string; size: number }[];
  longShortRatios: { symbol: string; ratio: number; long: number; short: number }[];
}

interface SentimentData {
  fearGreed: { value: number; classification: string } | null;
  takerRatios: { symbol: string; buy: number; sell: number }[];
  redditTrending: { coin: string; mentions: number; sentiment: string }[];
}

interface NewsData {
  headlines: { title: string; source: string; url?: string }[];
}

interface TechnicalData {
  summaries: TechnicalSummary[];
}

async function fetchMacroData(watchlist: WatchlistItem[]): Promise<MacroData> {
  const [yieldCurve, dxy, vix, fomcNews, btcCorrelation, cryptoTickers] = await Promise.all([
    fetchYieldCurve(),
    fetchGlobalAssetPrice("DX-Y.NYB"),
    fetchGlobalAssetPrice("^VIX"),
    fetchFomcNews(3),
    fetchCrossAssetCorrelation("btc", "gold,dxy,ndx,spx", "1y", 30),
    fetchCryptoTickers(),
  ]);

  return {
    yieldCurve,
    dxy,
    vix,
    fomcNews,
    btcCorrelation,
    btc: cryptoTickers.btc,
    eth: cryptoTickers.eth,
  };
}

async function fetchMarketIntelData(watchlist: WatchlistItem[]): Promise<MarketIntelData> {
  const symbols = watchlist.map((w) => w.underlying);

  const [fundingResults, oiResults, lsResults] = await Promise.all([
    Promise.all(symbols.map(async (s) => {
      const r = await fetchFundingRate(s);
      return r.fundingRate
        ? { symbol: s, rate: r.fundingRate.fundingRate, interval: r.fundingRate.fundingRateInterval }
        : null;
    })),
    Promise.all(symbols.map(async (s) => {
      const r = await fetchOpenInterest(s);
      return r.openInterest
        ? { symbol: s, size: r.openInterest.size }
        : null;
    })),
    Promise.all(symbols.map(async (s) => {
      const r = await fetchLongShortRatio(s, "4h");
      return r
        ? { symbol: s, ratio: r.longShortRatio, long: r.longAccount, short: r.shortAccount }
        : null;
    })),
  ]);

  return {
    fundingRates: fundingResults.filter(Boolean) as { symbol: string; rate: number; interval: number }[],
    openInterest: oiResults.filter(Boolean) as { symbol: string; size: number }[],
    longShortRatios: lsResults.filter(Boolean) as { symbol: string; ratio: number; long: number; short: number }[],
  };
}

async function fetchSentimentData(watchlist: WatchlistItem[]): Promise<SentimentData> {
  const symbols = watchlist.map((w) => w.underlying);

  const [fearGreed, takerResults, redditTrending] = await Promise.all([
    fetchFearGreedIndex(),
    Promise.all(symbols.map(async (s) => {
      const r = await fetchTakerRatio(s, "4h");
      return r ? { symbol: s, buy: r.takerBuyRatio, sell: r.takerSellRatio } : null;
    })),
    fetchRedditTrending(8),
  ]);

  return {
    fearGreed,
    takerRatios: takerResults.filter(Boolean) as { symbol: string; buy: number; sell: number }[],
    redditTrending,
  };
}

async function fetchNewsData(): Promise<NewsData> {
  const headlines = await fetchCryptoNews(8);
  return { headlines };
}

async function fetchTechnicalData(watchlist: WatchlistItem[]): Promise<TechnicalData> {
  const results = await Promise.all(
    watchlist.map(async (w) => {
      const { candles } = await fetchCandles(w.underlying, "1h", 200);
      if (candles.length < 30) return null;
      return analyzeCandles(candles, w.symbol);
    }),
  );

  return { summaries: results.filter(Boolean) as TechnicalSummary[] };
}

// ─── Format real data as context for Qwen ─────────────────────────

function formatWatchlist(watchlist: WatchlistItem[]): string {
  return watchlist
    .map(
      (w) =>
        `${w.symbol} (${w.name}): overnight ${w.overnightChangePct > 0 ? "+" : ""}${w.overnightChangePct.toFixed(1)}%, premium ${w.premiumToNavPct > 0 ? "+" : ""}${w.premiumToNavPct.toFixed(1)}%, volume $${(w.volume24h / 1_000_000).toFixed(1)}M, position $${w.positionSize.toLocaleString()}`,
    )
    .join("\n");
}

function formatMacroData(data: MacroData): string {
  const parts: string[] = [];
  if (data.btc) {
    parts.push(`BTC: $${data.btc.price.toLocaleString()} (${data.btc.changePct > 0 ? "+" : ""}${data.btc.changePct.toFixed(2)}% 24h)`);
  }
  if (data.eth) {
    parts.push(`ETH: $${data.eth.price.toLocaleString()} (${data.eth.changePct > 0 ? "+" : ""}${data.eth.changePct.toFixed(2)}% 24h)`);
  }
  if (data.yieldCurve) {
    parts.push(`Yield curve: 10Y=${data.yieldCurve.t10y.toFixed(2)}%, 2Y=${data.yieldCurve.t2y.toFixed(2)}%, spread=${data.yieldCurve.spread10y2y.toFixed(2)}%, ${data.yieldCurve.inverted ? "INVERTED" : "normal"}`);
  }
  if (data.dxy) {
    parts.push(`DXY: ${data.dxy.price.toFixed(2)}${data.dxy.change !== undefined ? ` (${data.dxy.change > 0 ? "+" : ""}${data.dxy.change.toFixed(2)}%)` : ""}`);
  }
  if (data.vix) {
    parts.push(`VIX: ${data.vix.price.toFixed(2)}`);
  }
  if (data.fomcNews.length > 0) {
    parts.push(`FOMC news: ${data.fomcNews.map((n) => n.title).join("; ")}`);
  }
  if (data.btcCorrelation) {
    const corr = Object.entries(data.btcCorrelation)
      .map(([k, v]) => `${k}=${v.toFixed(2)}`)
      .join(", ");
    parts.push(`BTC correlations: ${corr}`);
  }
  return parts.length > 0 ? parts.join("\n") : "Macro data temporarily unavailable";
}

function formatMarketIntelData(data: MarketIntelData): string {
  const parts: string[] = [];
  if (data.fundingRates.length > 0) {
    parts.push(`Funding rates: ${data.fundingRates.map((f) => `${f.symbol}=${(f.rate * 100).toFixed(4)}%/${f.interval}h`).join(", ")}`);
  }
  if (data.openInterest.length > 0) {
    parts.push(`Open interest: ${data.openInterest.map((o) => `${o.symbol}=${o.size.toFixed(0)}`).join(", ")}`);
  }
  if (data.longShortRatios.length > 0) {
    parts.push(`Long/short ratios: ${data.longShortRatios.map((l) => `${l.symbol}=${l.ratio.toFixed(2)} (L:${(l.long * 100).toFixed(0)}%/S:${(l.short * 100).toFixed(0)}%)`).join(", ")}`);
  }
  return parts.length > 0 ? parts.join("\n") : "Market structure data temporarily unavailable";
}

function formatSentimentData(data: SentimentData): string {
  const parts: string[] = [];
  if (data.fearGreed) {
    parts.push(`Fear & Greed Index: ${data.fearGreed.value} (${data.fearGreed.classification})`);
  }
  if (data.takerRatios.length > 0) {
    parts.push(`Taker ratios: ${data.takerRatios.map((t) => `${t.symbol} buy/sell=${t.buy.toFixed(2)}/${t.sell.toFixed(2)}`).join(", ")}`);
  }
  if (data.redditTrending.length > 0) {
    parts.push(`Reddit trending: ${data.redditTrending.map((r) => `${r.coin} (${r.mentions} mentions, ${r.sentiment})`).join(", ")}`);
  }
  return parts.length > 0 ? parts.join("\n") : "Sentiment data temporarily unavailable";
}

function formatNewsData(data: NewsData): string {
  if (data.headlines.length === 0) return "News feeds temporarily unavailable";
  return data.headlines
    .map((h, i) => `${i + 1}. ${h.title} (${h.source})`)
    .join("\n");
}

function formatTechnicalData(data: TechnicalData): string {
  if (data.summaries.length === 0) return "Technical data temporarily unavailable";
  return data.summaries
    .map((t) => {
      const parts = [
        `${t.symbol}: price=${t.lastPrice}`,
        `RSI=${t.rsi} (${t.rsiSignal})`,
        `MACD hist=${t.macdHist} (${t.macdSignal})`,
        `EMA20=${t.ema20} vs EMA50=${t.ema50} (${t.emaTrend})`,
        `BB width=${t.bollingerWidth}`,
        `support=${t.support} resistance=${t.resistance}`,
        `volume ${t.volumeTrend} (avg=${t.avgVolume})`,
        `overall=${t.overall}`,
      ];
      return parts.join(", ");
    })
    .join("\n");
}

// ─── Build LLM prompts with real data context ─────────────────────

function buildAnalystPrompt(
  personaId: AnalystId,
  userPrompt: string,
  watchlist: WatchlistItem[],
  realDataContext: string,
): QwenMessage[] {
  const persona = ANALYST_PERSONAS.find((p) => p.id === personaId)!;

  return [
    { role: "system", content: persona.systemPrompt },
    {
      role: "user",
      content: `User's question: "${sanitizePrompt(userPrompt)}"

User's watchlist (overnight snapshot):
${formatWatchlist(watchlist)}

Real-time market data from Bitget + bitget-signal:
${realDataContext}

Analyze what happened overnight for these tokenized US-stock positions from your specialist perspective. Use the real market data above to ground your analysis in concrete data points.

Respond with valid JSON only (no markdown, no code blocks):
{
  "summary": "1-2 sentence headline finding",
  "details": "Full analysis paragraph (3-5 sentences) with specific data points from the real data above",
  "dataSources": ["list the specific data sources you referenced"],
  "confidence": 0-100,
  "signals": [
    {"label": "Signal name", "value": "value", "direction": "bullish|bearish|neutral"}
  ]
}`,
    },
  ];
}

interface AnalystResponse {
  summary: string;
  details: string;
  dataSources: string[];
  confidence: number;
  signals: { label: string; value: string; direction: "bullish" | "bearish" | "neutral" }[];
}

// ─── Dynamic fallback: generate findings from real data without LLM ─
// Each domain has its own reasoning logic that interprets the actual
// data values rather than just formatting them with regex labels.

function dynamicFallback(
  personaId: AnalystId,
  realDataContext: string,
  watchlist: WatchlistItem[],
): AnalystFinding {
  const persona = ANALYST_PERSONAS.find((p) => p.id === personaId)!;
  const seed = SEED_FINDINGS[personaId];

  // Check if we have any real data at all
  const dataLines = realDataContext.split("\n").filter(
    (l) => !l.includes("temporarily unavailable") && l.trim().length > 0,
  );

  if (dataLines.length === 0) {
    // No real data: use seed as last resort
    return {
      analystId: personaId,
      analystName: persona.name,
      emoji: persona.emoji,
      status: "done",
      summary: seed.summary,
      details: seed.details,
      dataSources: seed.dataSources,
      confidence: seed.confidence,
      signals: seed.signals,
    };
  }

  // Domain-specific reasoning
  switch (personaId) {
    case "macro":
      return reasonMacroFallback(realDataContext, watchlist, persona, seed);
    case "market-intel":
      return reasonMarketIntelFallback(realDataContext, watchlist, persona, seed);
    case "news":
      return reasonNewsFallback(realDataContext, watchlist, persona, seed);
    case "sentiment":
      return reasonSentimentFallback(realDataContext, watchlist, persona, seed);
    case "technical":
      return reasonTechnicalFallback(realDataContext, watchlist, persona, seed);
    default:
      return {
        analystId: personaId,
        analystName: persona.name,
        emoji: persona.emoji,
        status: "done",
        summary: seed.summary,
        details: seed.details,
        dataSources: seed.dataSources,
        confidence: seed.confidence,
        signals: seed.signals,
      };
  }
}

function reasonMacroFallback(
  data: string,
  watchlist: WatchlistItem[],
  persona: { name: string; emoji: string },
  seed: typeof SEED_FINDINGS["macro"],
): AnalystFinding {
  const signals: AnalystSignal[] = [];
  const sources: string[] = [];
  const details: string[] = [];

  // BTC analysis (our most reliable macro proxy)
  const btcMatch = data.match(/BTC: \$([\d,.]+) \(([+-]?[\d.]+)%/);
  if (btcMatch) {
    const btcPrice = parseFloat(btcMatch[1].replace(/,/g, ""));
    const btcChange = parseFloat(btcMatch[2]);
    const direction = btcChange > 2 ? "bullish" : btcChange < -2 ? "bearish" : "neutral";
    signals.push({
      label: "BTC 24h",
      value: `${btcChange > 0 ? "+" : ""}${btcChange.toFixed(1)}%`,
      direction,
    });
    sources.push("Bitget BTCUSDT ticker");
    details.push(
      `BTC at $${btcPrice.toLocaleString()} (${btcChange > 0 ? "+" : ""}${btcChange.toFixed(1)}% 24h), ` +
      (btcChange > 2
        ? "strong crypto rally supporting risk-on sentiment for rTokens."
        : btcChange < -2
          ? "crypto weakness creating headwind for rToken premiums."
          : "BTC flat, neutral macro backdrop for rTokens."),
    );
  }

  // ETH analysis
  const ethMatch = data.match(/ETH: \$([\d,.]+) \(([+-]?[\d.]+)%/);
  if (ethMatch) {
    const ethChange = parseFloat(ethMatch[2]);
    signals.push({
      label: "ETH 24h",
      value: `${ethChange > 0 ? "+" : ""}${ethChange.toFixed(1)}%`,
      direction: ethChange > 2 ? "bullish" : ethChange < -2 ? "bearish" : "neutral",
    });
    sources.push("Bitget ETHUSDT ticker");
  }

  // Yield curve
  const yieldMatch = data.match(/Yield curve:.*?(INVERTED|normal)/);
  if (yieldMatch) {
    const inverted = yieldMatch[1] === "INVERTED";
    signals.push({
      label: "Yield curve",
      value: inverted ? "Inverted" : "Normal",
      direction: inverted ? "bearish" : "neutral",
    });
    sources.push("US Treasury yield curve");
    details.push(
      inverted
        ? "Yield curve inverted (10Y < 2Y), a classic recession warning that historically pressures risk assets."
        : "Yield curve normal, no recession signal from rates.",
    );
  }

  // DXY
  const dxyMatch = data.match(/DXY: ([\d.]+)/);
  if (dxyMatch) {
    const dxy = parseFloat(dxyMatch[1]);
    signals.push({
      label: "DXY",
      value: dxy.toFixed(2),
      direction: dxy > 105 ? "bearish" : dxy < 100 ? "bullish" : "neutral",
    });
    sources.push("DXY dollar index");
  }

  // VIX
  const vixMatch = data.match(/VIX: ([\d.]+)/);
  if (vixMatch) {
    const vix = parseFloat(vixMatch[1]);
    signals.push({
      label: "VIX",
      value: vix.toFixed(1),
      direction: vix > 25 ? "bearish" : vix < 15 ? "bullish" : "neutral",
    });
    sources.push("VIX volatility index");
    details.push(
      vix > 25
        ? `VIX elevated at ${vix.toFixed(1)}, indicating fear in traditional markets.`
        : vix < 15
          ? `VIX low at ${vix.toFixed(1)}, complacency in traditional markets.`
          : `VIX at ${vix.toFixed(1)}, normal volatility regime.`,
    );
  }

  // Determine overall regime
  const bullCount = signals.filter((s) => s.direction === "bullish").length;
  const bearCount = signals.filter((s) => s.direction === "bearish").length;
  const regime = bullCount > bearCount ? "risk-on" : bearCount > bullCount ? "risk-off" : "mixed";

  const summary = signals.length > 0
    ? `Macro backdrop is ${regime}: ${signals.slice(0, 2).map((s) => `${s.label} ${s.value}`).join(", ")}.`
    : "Macro data partially available, limited signal strength.";

  return {
    analystId: "macro",
    analystName: persona.name,
    emoji: persona.emoji,
    status: "done",
    summary,
    details: details.length > 0 ? details.join(" ") : `Real market data retrieved. ${data}`,
    dataSources: sources.length > 0 ? sources.slice(0, 6) : ["Bitget public API"],
    confidence: signals.length > 2 ? 72 : 55,
    signals: signals.slice(0, 6),
  };
}

function reasonMarketIntelFallback(
  data: string,
  watchlist: WatchlistItem[],
  persona: { name: string; emoji: string },
  seed: typeof SEED_FINDINGS["market-intel"],
): AnalystFinding {
  const signals: AnalystSignal[] = [];
  const sources: string[] = [];
  const details: string[] = [];

  // Funding rates
  const fundingMatches = [...data.matchAll(/(\w+)=(?:rate=)?([-\d.]+)%\/(\d+)h/g)];
  for (const m of fundingMatches) {
    const sym = m[1];
    const rate = parseFloat(m[2]);
    const direction = rate > 0.01 ? "bullish" : rate < -0.01 ? "bearish" : "neutral";
    signals.push({
      label: `${sym} funding`,
      value: `${rate > 0 ? "+" : ""}${(rate * 100).toFixed(4)}%`,
      direction,
    });
    sources.push(`Bitget ${sym}USDT funding rate`);
    details.push(
      rate > 0.01
        ? `${sym} funding rate positive at ${(rate * 100).toFixed(4)}%, longs paying shorts, bullish positioning.`
        : rate < -0.01
          ? `${sym} funding rate negative at ${(rate * 100).toFixed(4)}%, shorts paying longs, bearish positioning.`
          : `${sym} funding rate near zero, balanced positioning.`,
    );
  }

  // Open interest
  const oiMatches = [...data.matchAll(/Open interest: ([\w, ]+?)(?:=|: )([\d.]+)/g)];
  for (const m of oiMatches) {
    const symbols = m[1].trim();
    const oi = parseFloat(m[2]);
    signals.push({
      label: `${symbols} OI`,
      value: oi.toFixed(0),
      direction: "neutral",
    });
    sources.push(`Bitget ${symbols} open interest`);
  }

  // Long/short ratios
  const lsMatches = [...data.matchAll(/(\w+)=([\d.]+) \(L:(\d+)%\/S:(\d+)%\)/g)];
  for (const m of lsMatches) {
    const sym = m[1];
    const ratio = parseFloat(m[2]);
    const longPct = parseInt(m[3]);
    const shortPct = parseInt(m[4]);
    const direction = ratio > 1.5 ? "bearish" : ratio < 0.67 ? "bullish" : "neutral";
    signals.push({
      label: `${sym} L/S`,
      value: `${ratio.toFixed(2)} (${longPct}/${shortPct})`,
      direction,
    });
    sources.push(`Bitget ${sym}USDT long/short ratio`);
    details.push(
      ratio > 1.5
        ? `${sym} long/short ratio at ${ratio.toFixed(2)}, longs crowded, squeeze risk if price reverses.`
        : ratio < 0.67
          ? `${sym} long/short ratio at ${ratio.toFixed(2)}, shorts crowded, short squeeze fuel.`
          : `${sym} long/short balanced at ${ratio.toFixed(2)}.`,
    );
  }

  // Watchlist price action context
  const topGainer = [...watchlist].sort((a, b) => b.overnightChangePct - a.overnightChangePct)[0];
  const topLoser = [...watchlist].sort((a, b) => a.overnightChangePct - b.overnightChangePct)[0];
  if (topGainer && topGainer.overnightChangePct > 0) {
    details.push(`${topGainer.symbol} led the watchlist at +${topGainer.overnightChangePct.toFixed(1)}%.`);
  }
  if (topLoser && topLoser.overnightChangePct < 0) {
    details.push(`${topLoser.symbol} was the weakest at ${topLoser.overnightChangePct.toFixed(1)}%.`);
  }

  const summary = signals.length > 0
    ? `${signals.slice(0, 2).map((s) => `${s.label}: ${s.value}`).join("; ")}.`
    : "Market structure data partially available.";

  return {
    analystId: "market-intel",
    analystName: persona.name,
    emoji: persona.emoji,
    status: "done",
    summary,
    details: details.length > 0 ? details.join(" ") : `Real market data: ${data}`,
    dataSources: sources.length > 0 ? sources.slice(0, 6) : ["Bitget public API"],
    confidence: signals.length > 2 ? 70 : 50,
    signals: signals.slice(0, 6),
  };
}

function reasonNewsFallback(
  data: string,
  watchlist: WatchlistItem[],
  persona: { name: string; emoji: string },
  seed: typeof SEED_FINDINGS["news"],
): AnalystFinding {
  const signals: AnalystSignal[] = [];
  const sources: string[] = [];
  const details: string[] = [];

  // Parse headlines from news_feed format
  const headlineMatches = [...data.matchAll(/\d+\.\s+(.+?)\s+\((\w+)\)/g)];
  if (headlineMatches.length > 0) {
    for (const m of headlineMatches.slice(0, 5)) {
      const title = m[1];
      const source = m[2];
      sources.push(`${source} RSS feed`);

      // Determine direction from headline keywords
      const direction: "bullish" | "bearish" | "neutral" =
        /surge|rally|jump|beat|gain|soar|record|approval|adopt|bullish|upgrade/i.test(title)
          ? "bullish"
          : /crash|plunge|drop|miss|fall|hack|ban|lawsuit|bearish|downgrade|fear|sell/i.test(title)
            ? "bearish"
            : "neutral";

      signals.push({
        label: source,
        value: title.substring(0, 60),
        direction,
      });
    }
    details.push(`Top headlines: ${headlineMatches.slice(0, 3).map((m) => m[1]).join("; ")}.`);
  }

  // Check if any headlines mention watchlist symbols
  for (const w of watchlist) {
    const symRegex = new RegExp(w.underlying, "i");
    if (symRegex.test(data)) {
      details.push(`${w.symbol} (${w.underlying}) mentioned in overnight news.`);
    }
  }

  const summary = headlineMatches.length > 0
    ? `${headlineMatches.length} headlines tracked. Top: ${headlineMatches[0][1].substring(0, 60)}.`
    : "News feeds returned no headlines for this period.";

  return {
    analystId: "news",
    analystName: persona.name,
    emoji: persona.emoji,
    status: "done",
    summary,
    details: details.length > 0 ? details.join(" ") : "No major overnight news detected from RSS feeds.",
    dataSources: sources.length > 0 ? sources.slice(0, 6) : ["RSS news feeds (via bitget-signal MCP)"],
    confidence: headlineMatches.length > 2 ? 68 : 40,
    signals: signals.slice(0, 6),
  };
}

function reasonSentimentFallback(
  data: string,
  watchlist: WatchlistItem[],
  persona: { name: string; emoji: string },
  seed: typeof SEED_FINDINGS["sentiment"],
): AnalystFinding {
  const signals: AnalystSignal[] = [];
  const sources: string[] = [];
  const details: string[] = [];

  // Fear & Greed Index
  const fgMatch = data.match(/Fear & Greed Index: (\d+) \((\w+)\)/);
  if (fgMatch) {
    const value = parseInt(fgMatch[1]);
    const classification = fgMatch[2];
    const direction: "bullish" | "bearish" | "neutral" =
      value < 25 ? "bullish" : value > 75 ? "bearish" : "neutral";
    signals.push({
      label: "Fear & Greed",
      value: `${value} (${classification})`,
      direction,
    });
    sources.push("alternative.me Fear & Greed Index");
    details.push(
      value < 25
        ? `Fear & Greed at ${value} (Extreme Fear), contrarian buy signal.`
        : value > 75
          ? `Fear & Greed at ${value} (Extreme Greed), caution zone.`
          : `Fear & Greed at ${value} (${classification}), neutral sentiment.`,
    );
  }

  // Taker ratios
  const takerMatches = [...data.matchAll(/(\w+) buy\/sell=([\d.]+)\/([\d.]+)/g)];
  for (const m of takerMatches) {
    const sym = m[1];
    const buy = parseFloat(m[2]);
    const sell = parseFloat(m[3]);
    const ratio = buy / sell;
    const direction = ratio > 1.2 ? "bullish" : ratio < 0.8 ? "bearish" : "neutral";
    signals.push({
      label: `${sym} taker ratio`,
      value: `${buy.toFixed(2)}/${sell.toFixed(2)}`,
      direction,
    });
    sources.push(`Bitget ${sym}USDT taker ratio`);
    details.push(
      ratio > 1.2
        ? `${sym} aggressive buying (taker ratio ${ratio.toFixed(2)}), bullish order flow.`
        : ratio < 0.8
          ? `${sym} aggressive selling (taker ratio ${ratio.toFixed(2)}), bearish order flow.`
          : `${sym} balanced order flow.`,
    );
  }

  // Reddit trending
  const redditMatch = data.match(/Reddit trending: (.+)/);
  if (redditMatch) {
    sources.push("Reddit crypto trending (via bitget-signal MCP)");
    details.push(`Reddit trending: ${redditMatch[1].substring(0, 100)}.`);
  }

  const summary = signals.length > 0
    ? `${signals.slice(0, 2).map((s) => `${s.label}: ${s.value}`).join("; ")}.`
    : "Sentiment data partially available.";

  return {
    analystId: "sentiment",
    analystName: persona.name,
    emoji: persona.emoji,
    status: "done",
    summary,
    details: details.length > 0 ? details.join(" ") : `Real sentiment data: ${data}`,
    dataSources: sources.length > 0 ? sources.slice(0, 6) : ["Bitget public API"],
    confidence: signals.length > 1 ? 68 : 45,
    signals: signals.slice(0, 6),
  };
}

function reasonTechnicalFallback(
  data: string,
  watchlist: WatchlistItem[],
  persona: { name: string; emoji: string },
  seed: typeof SEED_FINDINGS["technical"],
): AnalystFinding {
  const signals: AnalystSignal[] = [];
  const sources: string[] = [];
  const details: string[] = [];

  // Parse technical summaries: "rNVDA: price=132.4, RSI=45.2 (neutral), MACD hist=0.5 (bullish), ..."
  const techMatches = [...data.matchAll(/(\w+): price=([\d.]+), RSI=([\d.]+) \((\w+)\), MACD hist=([-\d.]+) \((\w+)\), EMA20=([\d.]+) vs EMA50=([\d.]+) \((\w+)\).*?overall=(\w+)/g)];
  for (const m of techMatches) {
    const sym = m[1];
    const price = parseFloat(m[2]);
    const rsi = parseFloat(m[3]);
    const rsiSignal = m[4];
    const macdHist = parseFloat(m[5]);
    const macdSignal = m[6];
    const ema20 = parseFloat(m[7]);
    const ema50 = parseFloat(m[8]);
    const emaTrend = m[9];
    const overall = m[10];

    sources.push(`Bitget ${sym}USDT candles (200x 1h)`);

    signals.push({
      label: `${sym} RSI`,
      value: `${rsi} (${rsiSignal})`,
      direction: rsiSignal === "oversold" ? "bullish" : rsiSignal === "overbought" ? "bearish" : "neutral",
    });

    signals.push({
      label: `${sym} MACD`,
      value: `hist=${macdHist}`,
      direction: macdSignal as "bullish" | "bearish" | "neutral",
    });

    signals.push({
      label: `${sym} EMA trend`,
      value: `${emaTrend}`,
      direction: emaTrend as "bullish" | "bearish" | "neutral",
    });

    signals.push({
      label: `${sym} overall`,
      value: overall,
      direction: overall as "bullish" | "bearish" | "neutral",
    });

    details.push(
      `${sym} at $${price}: RSI ${rsi} (${rsiSignal}), MACD ${macdSignal} (hist ${macdHist}), ` +
      `EMA20 ${ema20} vs EMA50 ${ema50} (${emaTrend}), overall ${overall}.`,
    );
  }

  // Support/resistance
  const srMatches = [...data.matchAll(/support=([\d.]+) resistance=([\d.]+)/g)];
  for (const m of srMatches) {
    const support = parseFloat(m[1]);
    const resistance = parseFloat(m[2]);
    if (support > 0 && resistance > 0) {
      details.push(`Key levels: support $${support}, resistance $${resistance}.`);
    }
  }

  // Volume trend
  const volMatches = [...data.matchAll(/volume (\w+) \(avg=(\d+)\)/g)];
  for (const m of volMatches) {
    const trend = m[1];
    if (trend === "increasing") {
      details.push("Volume increasing, confirming price action.");
    } else if (trend === "decreasing") {
      details.push("Volume decreasing, price action may lack conviction.");
    }
  }

  const summary = techMatches.length > 0
    ? `${techMatches.length} symbols analyzed. ${signals.filter((s) => s.direction === "bullish").length} bullish, ${signals.filter((s) => s.direction === "bearish").length} bearish signals.`
    : "Technical data partially available.";

  return {
    analystId: "technical",
    analystName: persona.name,
    emoji: persona.emoji,
    status: "done",
    summary,
    details: details.length > 0 ? details.join(" ") : `Real technical data: ${data}`,
    dataSources: sources.length > 0 ? sources.slice(0, 6) : ["Bitget public API"],
    confidence: techMatches.length > 0 ? 75 : 45,
    signals: signals.slice(0, 6),
  };
}

// ─── Run a single analyst with real data ──────────────────────────

export async function runAnalyst(
  personaId: AnalystId,
  userPrompt: string,
  watchlist: WatchlistItem[],
): Promise<AnalystFinding> {
  const persona = ANALYST_PERSONAS.find((p) => p.id === personaId)!;

  // Fetch real data for this analyst's domain (in parallel)
  let realDataContext = "";
  try {
    let data: string = "";
    switch (personaId) {
      case "macro": {
        const d = await fetchMacroData(watchlist);
        data = formatMacroData(d);
        break;
      }
      case "market-intel": {
        const d = await fetchMarketIntelData(watchlist);
        data = formatMarketIntelData(d);
        break;
      }
      case "news": {
        const d = await fetchNewsData();
        data = formatNewsData(d);
        break;
      }
      case "sentiment": {
        const d = await fetchSentimentData(watchlist);
        data = formatSentimentData(d);
        break;
      }
      case "technical": {
        const d = await fetchTechnicalData(watchlist);
        data = formatTechnicalData(d);
        break;
      }
    }
    realDataContext = data;
  } catch (err) {
    console.error(`[Analyst ${personaId}] data fetch error:`, err);
    realDataContext = "Market data temporarily unavailable for this domain.";
  }

  // If no Qwen key, use dynamic fallback with real data
  if (!hasQwenKey()) {
    return dynamicFallback(personaId, realDataContext, watchlist);
  }

  // Call Qwen with real data context
  try {
    const messages = buildAnalystPrompt(personaId, userPrompt, watchlist, realDataContext);
    const text = await callQwen(messages);
    const parsed = JSON.parse(text) as AnalystResponse;

    const confidence = Math.max(0, Math.min(100, parsed.confidence || 50));
    const signals = (parsed.signals || []).slice(0, 6).map((s) => ({
      label: String(s.label || ""),
      value: String(s.value || ""),
      direction: s.direction === "bullish" || s.direction === "bearish" || s.direction === "neutral" ? s.direction : "neutral",
    }));

    return {
      analystId: personaId,
      analystName: persona.name,
      emoji: persona.emoji,
      status: "done",
      summary: String(parsed.summary || "Analysis complete"),
      details: String(parsed.details || ""),
      dataSources: (parsed.dataSources || []).slice(0, 6).map(String),
      confidence,
      signals,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Analyst failed";
    console.error(`[Analyst ${personaId}] LLM error:`, msg);
    // Fallback to dynamic analysis from real data
    return dynamicFallback(personaId, realDataContext, watchlist);
  }
}

// ─── Synthesizer ───────────────────────────────────────────────────

function buildSynthesisMessages(
  userPrompt: string,
  watchlist: WatchlistItem[],
  findings: AnalystFinding[],
): QwenMessage[] {
  const watchlistStr = watchlist
    .map((w) => `${w.symbol} (${w.name}): ${w.overnightChangePct > 0 ? "+" : ""}${w.overnightChangePct.toFixed(1)}%`)
    .join(", ");

  const findingsStr = findings
    .map((f) => `${f.emoji} ${f.analystName} (${f.confidence}% confident): ${f.summary}`)
    .join("\n");

  return [
    {
      role: "system",
      content: `You are the Briefing Synthesizer. Five specialist analysts have analyzed overnight tokenized US-stock market activity using real Bitget market data and bitget-signal MCP data. Your job is to synthesize their findings into a concise, actionable morning briefing.`,
    },
    {
      role: "user",
      content: `User's question: "${sanitizePrompt(userPrompt)}"

Watchlist: ${watchlistStr}

Analyst findings:
${findingsStr}

Create a synthesized briefing. Respond with valid JSON only:
{
  "executiveSummary": "2-3 sentence summary of what happened overnight",
  "marketRegime": "e.g. 'Risk-on overnight' or 'Risk-off overnight'",
  "actionItems": [
    {
      "symbol": "rTSLA",
      "action": "Consider reducing rTSLA",
      "rationale": "Why: cite which analysts flagged it",
      "analystIds": ["news", "market-intel", "technical"],
      "confidence": 0-100,
      "riskLevel": "low|medium|high"
    }
  ]
}

Rules:
- 3 action items, ranked by importance (most urgent first)
- analystIds must be from: macro, market-intel, news, sentiment, technical
- Only include analysts that actually flagged the signal
- Be honest about uncertainty: if analysts disagree, say so
- Never recommend executing a trade: only "consider", "watch", "monitor", "hold"`,
    },
  ];
}

interface SynthesisResponse {
  executiveSummary: string;
  marketRegime: string;
  actionItems: {
    symbol: string;
    action: string;
    rationale: string;
    analystIds: AnalystId[];
    confidence: number;
    riskLevel: "low" | "medium" | "high";
  }[];
}

function dynamicSynthesisFallback(
  userPrompt: string,
  watchlist: WatchlistItem[],
  findings: AnalystFinding[],
): Briefing {
  // Count bullish vs bearish signals across all analysts
  const allSignals = findings.flatMap((f) => f.signals);
  const bullCount = allSignals.filter((s) => s.direction === "bullish").length;
  const bearCount = allSignals.filter((s) => s.direction === "bearish").length;
  const neutralCount = allSignals.filter((s) => s.direction === "neutral").length;

  const regime = bullCount > bearCount + neutralCount
    ? "Risk-on overnight"
    : bearCount > bullCount + neutralCount
      ? "Risk-off overnight"
      : "Mixed overnight";

  // Build executive summary from the strongest signals
  const topGainer = [...watchlist].sort((a, b) => b.overnightChangePct - a.overnightChangePct)[0];
  const topLoser = [...watchlist].sort((a, b) => a.overnightChangePct - b.overnightChangePct)[0];

  const summaryParts: string[] = [];
  if (topGainer && topGainer.overnightChangePct > 0) {
    summaryParts.push(`${topGainer.symbol} led overnight at +${topGainer.overnightChangePct.toFixed(1)}%`);
  }
  if (topLoser && topLoser.overnightChangePct < 0) {
    summaryParts.push(`${topLoser.symbol} lagged at ${topLoser.overnightChangePct.toFixed(1)}%`);
  }
  summaryParts.push(`${bullCount} bullish vs ${bearCount} bearish signals across ${findings.length} analysts`);
  if (regime === "Risk-on overnight") {
    summaryParts.push("Overall risk-on regime");
  } else if (regime === "Risk-off overnight") {
    summaryParts.push("Overall risk-off regime");
  } else {
    summaryParts.push("Mixed signals, no clear directional bias");
  }

  const executiveSummary = summaryParts.join(". ") + ".";

  // Build action items: rank watchlist by signal strength
  const validIds: AnalystId[] = ["macro", "market-intel", "news", "sentiment", "technical"];

  const ranked = watchlist.map((w) => {
    // Find signals that mention this symbol or its underlying
    const relatedFindings = findings.filter((f) =>
      f.signals.some((s) =>
        s.label.includes(w.symbol) ||
        s.label.includes(w.underlying) ||
        s.value.includes(w.symbol) ||
        s.value.includes(w.underlying),
      ),
    );

    const symBearish = relatedFindings.flatMap((f) => f.signals).filter((s) =>
      (s.label.includes(w.symbol) || s.label.includes(w.underlying)) && s.direction === "bearish",
    ).length;
    const symBullish = relatedFindings.flatMap((f) => f.signals).filter((s) =>
      (s.label.includes(w.symbol) || s.label.includes(w.underlying)) && s.direction === "bullish",
    ).length;

    // Score: bearish signals make it more urgent (rank higher)
    const urgencyScore = symBearish * 2 + Math.abs(w.overnightChangePct) * 0.5;

    return { w, relatedFindings, symBearish, symBullish, urgencyScore };
  }).sort((a, b) => b.urgencyScore - a.urgencyScore);

  const actionItems = ranked.slice(0, 3).map((r, i) => {
    const { w, relatedFindings, symBearish, symBullish } = r;

    let action: string;
    let riskLevel: "low" | "medium" | "high";

    if (symBearish > symBullish && symBearish > 0) {
      action = `Consider reducing ${w.symbol}`;
      riskLevel = symBearish > 2 ? "high" : "medium";
    } else if (symBullish > symBearish && symBullish > 0) {
      action = `Watch ${w.symbol} for upside momentum`;
      riskLevel = "low";
    } else if (w.overnightChangePct < -3) {
      action = `Monitor ${w.symbol} for stabilization`;
      riskLevel = "medium";
    } else if (w.overnightChangePct > 3) {
      action = `Hold ${w.symbol}, watch for profit-taking`;
      riskLevel = "low";
    } else {
      action = `Hold ${w.symbol}, no urgent signals`;
      riskLevel = "low";
    }

    const rationale = relatedFindings.length > 0
      ? `${relatedFindings.length} analysts flagged ${w.symbol}: ${symBearish} bearish, ${symBullish} bullish signals. ${w.overnightChangePct > 0 ? "+" : ""}${w.overnightChangePct.toFixed(1)}% overnight.`
      : `${w.symbol} moved ${w.overnightChangePct > 0 ? "+" : ""}${w.overnightChangePct.toFixed(1)}% overnight with no specific analyst flags.`;

    return {
      id: `ai-${i + 1}`,
      rank: i + 1,
      symbol: w.symbol,
      action,
      rationale,
      analystIds: relatedFindings.map((f) => f.analystId).filter((id) => validIds.includes(id)),
      confidence: relatedFindings.length > 0
        ? Math.round(relatedFindings.reduce((s, f) => s + f.confidence, 0) / relatedFindings.length)
        : 50,
      riskLevel,
    };
  });

  return {
    executiveSummary,
    marketRegime: regime,
    actionItems,
    generatedAt: new Date().toISOString(),
    watchlistSnapshot: watchlist,
  };
}

export async function synthesizeBriefing(
  userPrompt: string,
  watchlist: WatchlistItem[],
  findings: AnalystFinding[],
): Promise<Briefing> {
  // If no Qwen key, use dynamic synthesis from findings
  if (!hasQwenKey()) {
    return dynamicSynthesisFallback(userPrompt, watchlist, findings);
  }

  try {
    const messages = buildSynthesisMessages(userPrompt, watchlist, findings);
    const text = await callQwen(messages);
    const parsed = JSON.parse(text) as SynthesisResponse;

    const validIds: AnalystId[] = ["macro", "market-intel", "news", "sentiment", "technical"];
    const actionItems = (parsed.actionItems || []).slice(0, 3).map((item, i) => {
      const riskLevel: "low" | "medium" | "high" =
        item.riskLevel === "high" || item.riskLevel === "low" ? item.riskLevel : "medium";
      return {
        id: `ai-${i + 1}`,
        rank: i + 1,
        symbol: String(item.symbol || ""),
        action: String(item.action || ""),
        rationale: String(item.rationale || ""),
        analystIds: (item.analystIds || []).filter((id) => validIds.includes(id)),
        confidence: Math.max(0, Math.min(100, item.confidence || 50)),
        riskLevel,
      };
    });

    return {
      executiveSummary: String(parsed.executiveSummary || ""),
      marketRegime: String(parsed.marketRegime || "Neutral"),
      actionItems,
      generatedAt: new Date().toISOString(),
      watchlistSnapshot: watchlist,
    };
  } catch (err) {
    console.error("[Synthesizer] error:", err);
    return dynamicSynthesisFallback(userPrompt, watchlist, findings);
  }
}
