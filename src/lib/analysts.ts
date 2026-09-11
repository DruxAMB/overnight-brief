import { ANALYST_PERSONAS, SEED_FINDINGS, SEED_BRIEFING } from "@/lib/seed-data";
import type { AnalystId, AnalystFinding, Briefing, WatchlistItem } from "@/lib/types";
import {
  fetchCandles,
  fetchFundingRate,
  fetchOpenInterest,
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
  const [yieldCurve, dxy, vix, fomcNews, btcCorrelation] = await Promise.all([
    fetchYieldCurve(),
    fetchGlobalAssetPrice("DX-Y.NYB"),
    fetchGlobalAssetPrice("^VIX"),
    fetchFomcNews(3),
    fetchCrossAssetCorrelation("btc", "gold,dxy,ndx,spx", "1y", 30),
  ]);

  return { yieldCurve, dxy, vix, fomcNews, btcCorrelation };
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

function dynamicFallback(
  personaId: AnalystId,
  realDataContext: string,
  watchlist: WatchlistItem[],
): AnalystFinding {
  const persona = ANALYST_PERSONAS.find((p) => p.id === personaId)!;
  const seed = SEED_FINDINGS[personaId];

  // If we have real data, build a dynamic summary from it
  const hasRealData = !realDataContext.includes("temporarily unavailable") ||
    realDataContext.split("\n").some((l) => !l.includes("temporarily unavailable"));

  if (hasRealData) {
    const dataLines = realDataContext.split("\n").filter((l) => !l.includes("temporarily unavailable"));
    const summary = `${persona.name}: ${dataLines.slice(0, 2).join("; ")}`;
    const details = `Real market data analysis (LLM unavailable, using structured fallback):\n${realDataContext}`;
    const dataSources = ["Bitget public API", "bitget-signal MCP", ...dataLines.map((l) => l.split(":")[0])];

    // Derive signals from real data
    const signals: { label: string; value: string; direction: "bullish" | "bearish" | "neutral" }[] = [];
    for (const line of dataLines.slice(0, 4)) {
      const label = line.split(":")[0].trim();
      const value = line.split(":").slice(1).join(":").trim().substring(0, 50);
      const direction: "bullish" | "bearish" | "neutral" =
        /positive|bullish|up|rising|greed|risk-on/i.test(value) ? "bullish" :
        /negative|bearish|down|falling|fear|risk-off/i.test(value) ? "bearish" : "neutral";
      signals.push({ label, value, direction });
    }

    return {
      analystId: personaId,
      analystName: persona.name,
      emoji: persona.emoji,
      status: "done",
      summary,
      details,
      dataSources: dataSources.slice(0, 6),
      confidence: 65,
      signals: signals.slice(0, 6),
    };
  }

  // Last resort: seed data
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
  // Build a dynamic briefing from the analyst findings
  const bullish = findings.filter((f) =>
    f.signals.some((s) => s.direction === "bullish"),
  );
  const bearish = findings.filter((f) =>
    f.signals.some((s) => s.direction === "bearish"),
  );

  const regime = bullish.length > bearish.length
    ? "Risk-on overnight"
    : bearish.length > bullish.length
      ? "Risk-off overnight"
      : "Mixed overnight";

  const summary = findings
    .map((f) => `${f.analystName}: ${f.summary}`)
    .join(" ");

  // Build action items from findings
  const validIds: AnalystId[] = ["macro", "market-intel", "news", "sentiment", "technical"];
  const actionItems = watchlist.slice(0, 3).map((w, i) => {
    const relatedFindings = findings.filter((f) =>
      f.signals.some((s) => s.value.includes(w.symbol) || s.label.includes(w.underlying)),
    );
    const bearishCount = relatedFindings.filter((f) =>
      f.signals.some((s) => s.direction === "bearish"),
    ).length;
    const bullishCount = relatedFindings.filter((f) =>
      f.signals.some((s) => s.direction === "bullish"),
    ).length;

    const action = bearishCount > bullishCount
      ? `Consider reducing ${w.symbol}`
      : bullishCount > bearishCount
        ? `Watch ${w.symbol} for upside`
        : `Hold ${w.symbol}, monitor for changes`;

    return {
      id: `ai-${i + 1}`,
      rank: i + 1,
      symbol: w.symbol,
      action,
      rationale: `${relatedFindings.length} analysts flagged ${w.symbol}. ${bearishCount} bearish, ${bullishCount} bullish signals.`,
      analystIds: relatedFindings.map((f) => f.analystId).filter((id) => validIds.includes(id)),
      confidence: relatedFindings.length > 0
        ? Math.round(relatedFindings.reduce((s, f) => s + f.confidence, 0) / relatedFindings.length)
        : 50,
      riskLevel: bearishCount > bullishCount ? "high" as const : "medium" as const,
    };
  });

  return {
    executiveSummary: summary.substring(0, 500),
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
