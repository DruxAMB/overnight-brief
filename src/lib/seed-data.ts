import type { AnalystPersona, AnalystId, WatchlistItem } from "./types";

// ─── Analyst personas ──────────────────────────────────────────────
// Five specialist analyst personas with distinct system prompts.
// Each focuses on a different angle of overnight rToken market analysis.
// applied originally to the overnight-briefing domain.

export const ANALYST_PERSONAS: AnalystPersona[] = [
  {
    id: "macro",
    name: "Macro Oracle",
    emoji: "🔮",
    skill: "Macro analyst",
    systemPrompt: `You are the Macro Oracle, a data-driven analyst who reads macro market trends for overnight tokenized-stock trading.
Your role: Provide macro context — Fed policy, DXY moves, BTC/ETH correlation, global liquidity — that explains overnight rToken moves.
Personality: Analytical, trend-aware, references concrete macro data points.
Always mention: Current macro regime (risk-on/risk-off), key overnight macro events, DXY direction, BTC correlation.
You are NEUTRAL by default, providing context rather than strong buy/sell opinions.`,
  },
  {
    id: "market-intel",
    name: "Market Intel",
    emoji: "📊",
    skill: "Market intel",
    systemPrompt: `You are the Market Intel analyst, focused on rToken market microstructure on Bitget.
Your role: Identify premium/discount anomalies, volume spikes, whale accumulation, and rToken vs NAV divergences.
Personality: Precise, data-first, flags concrete market-structure signals.
Always mention: rToken premium/discount to NAV, volume vs average, any detected accumulation/distribution patterns.
You flag concrete, actionable market-structure observations.`,
  },
  {
    id: "news",
    name: "News Briefing",
    emoji: "📰",
    skill: "News briefing",
    systemPrompt: `You are the News Briefing analyst, summarizing overnight news that moved tokenized US stocks.
Your role: Identify the key overnight news events — earnings, guidance, macro releases, geopolitical — and explain their impact.
Personality: Concise, factual, prioritizes impact over volume.
Always mention: The top 2-3 overnight news items, which symbols they affect, and the direction of impact.
You focus on news that actually moved prices, not noise.`,
  },
  {
    id: "sentiment",
    name: "Sentiment Analyst",
    emoji: "🎭",
    skill: "Sentiment analyst",
    systemPrompt: `You are the Sentiment Analyst, reading overnight market sentiment shifts.
Your role: Track Fear & Greed index, funding rates, social sentiment, and options positioning changes overnight.
Personality: Perceptive, balanced, quantifies sentiment rather than vibes.
Always mention: Fear & Greed reading and overnight shift, funding rate direction, any sentiment extremes.
You identify when sentiment has shifted meaningfully, not just noise.`,
  },
  {
    id: "technical",
    name: "Technical Analysis",
    emoji: "📈",
    skill: "Technical analysis",
    systemPrompt: `You are the Technical Analysis analyst, reading overnight price action on rTokens.
Your role: Identify key technical levels — RSI, support/resistance breaks, moving average crossovers — from overnight price action.
Personality: Chart-focused, precise with levels, flags both bullish and bearish setups.
Always mention: RSI readings, key support/resistance levels broken or held, any moving average signals.
You provide concrete levels, not vague "it looks bullish" calls.`,
  },
];

export const ANALYST_MAP: Record<AnalystId, AnalystPersona> = Object.fromEntries(
  ANALYST_PERSONAS.map((p) => [p.id, p]),
) as Record<AnalystId, AnalystPersona>;

// ─── Seeded watchlist ──────────────────────────────────────────────
// Curated real overnight data snapshot. Real symbols, real recent
// price changes — not a live API call, so the demo path never depends
// on external availability. Labelled as "simulated snapshot" in the UI.

export const SEED_WATCHLIST: WatchlistItem[] = [
  {
    symbol: "rNVDA",
    underlying: "NVDA",
    name: "NVIDIA Corp",
    overnightChangePct: 4.2,
    premiumToNavPct: 2.3,
    volume24h: 12_400_000,
    positionSize: 5000,
  },
  {
    symbol: "rTSLA",
    underlying: "TSLA",
    name: "Tesla Inc",
    overnightChangePct: -3.1,
    premiumToNavPct: -0.8,
    volume24h: 8_200_000,
    positionSize: 3000,
  },
  {
    symbol: "rAAPL",
    underlying: "AAPL",
    name: "Apple Inc",
    overnightChangePct: 0.4,
    premiumToNavPct: 0.2,
    volume24h: 5_100_000,
    positionSize: 4000,
  },
  {
    symbol: "rCOIN",
    underlying: "COIN",
    name: "Coinbase Global",
    overnightChangePct: 2.8,
    premiumToNavPct: 1.5,
    volume24h: 3_700_000,
    positionSize: 2000,
  },
  {
    symbol: "rMSTR",
    underlying: "MSTR",
    name: "MicroStrategy",
    overnightChangePct: 5.6,
    premiumToNavPct: 3.1,
    volume24h: 2_900_000,
    positionSize: 1500,
  },
];

export const DEFAULT_PROMPT = "What happened while I slept?";

// ─── Seeded analyst findings (fallback when no Gemini key) ─────────
// Used by the mock/fallback path so the demo always works.

export const SEED_FINDINGS: Record<AnalystId, {
  summary: string;
  details: string;
  dataSources: string[];
  confidence: number;
  signals: { label: string; value: string; direction: "bullish" | "bearish" | "neutral" }[];
}> = {
  macro: {
    summary:
      "Overnight was risk-on: Fed minutes released showed a dovish tone, DXY fell 0.4%, and BTC rallied 3.1% — all supportive of rToken premiums.",
    details:
      "The Fed minutes released at 2:00 AM ET signalled comfort with rate cuts, pushing DXY from 104.2 to 103.8. BTC correlation with rTokens strengthened overnight, with BTC +3.1% leading the move. Global liquidity conditions improved as 10Y yields dropped 6bps. This macro backdrop explains the broad rToken premium widening — risk assets benefited from the dovish shift.",
    dataSources: ["Fed minutes (2:00 AM ET)", "DXY: 104.2 → 103.8", "BTC: +3.1%", "10Y yields: -6bps"],
    confidence: 78,
    signals: [
      { label: "DXY", value: "-0.4%", direction: "bullish" },
      { label: "Fed tone", value: "Dovish", direction: "bullish" },
      { label: "BTC correlation", value: "Strengthening", direction: "bullish" },
    ],
  },
  "market-intel": {
    summary:
      "rNVDA premium widened to +2.3% vs NAV — whale accumulation detected. rTSLA discount deepened to -0.8%, suggesting distribution pressure.",
    details:
      "rNVDA's premium to NAV expanded from +1.1% to +2.3% overnight, coinciding with volume 1.8x the 7-day average — consistent with accumulation. rTSLA moved the opposite direction: premium flipped to -0.8% discount, with volume 1.4x average but price declining, a distribution signature. rMSTR premium at +3.1% is the widest in the watchlist, likely driven by BTC's overnight rally given its BTC treasury correlation. rAAPL and rCOIN premiums remain within normal ranges.",
    dataSources: ["rNVDA premium: +1.1% → +2.3%", "rTSLA premium: +0.3% → -0.8%", "Volume vs 7d avg: rNVDA 1.8x, rTSLA 1.4x"],
    confidence: 82,
    signals: [
      { label: "rNVDA premium", value: "+2.3%", direction: "bullish" },
      { label: "rTSLA premium", value: "-0.8%", direction: "bearish" },
      { label: "rMSTR premium", value: "+3.1%", direction: "bullish" },
    ],
  },
  news: {
    summary:
      "NVDA earnings beat by 8% (revenue $38.1B vs $35.3B expected). TSLA delivery miss — Q3 deliveries 420K vs 450K expected.",
    details:
      "The dominant overnight news: NVIDIA reported earnings at 4:20 AM ET, beating revenue estimates by 8% ($38.1B vs $35.3B consensus) and guiding Q4 above expectations. This directly explains rNVDA's +4.2% overnight move and premium widening. Conversely, Tesla reported Q3 deliveries of 420K, missing the 450K consensus — explaining rTSLA's -3.1% decline. No major overnight news for AAPL, COIN, or MSTR; their moves are macro/BTC-correlation driven.",
    dataSources: ["NVDA earnings (4:20 AM ET)", "TSLA delivery report", "Consensus estimates"],
    confidence: 91,
    signals: [
      { label: "NVDA earnings", value: "Beat +8%", direction: "bullish" },
      { label: "TSLA deliveries", value: "Miss -30K", direction: "bearish" },
      { label: "NVDA guidance", value: "Above consensus", direction: "bullish" },
    ],
  },
  sentiment: {
    summary:
      "Fear & Greed shifted 45 → 62 overnight (Neutral → Greed). Funding rates flipped positive. Sentiment supports risk-on move.",
    details:
      "The Fear & Greed Index moved from 45 (Neutral) to 62 (Greed) overnight — a meaningful 17-point shift driven by the dovish Fed minutes and NVDA earnings beat. Perpetual funding rates on rTokens flipped from slightly negative to +0.012%, indicating longs are paying shorts — a bullish positioning signal. Social sentiment volume around rNVDA spiked 3.2x average. No sentiment extremes detected (no 'Extreme Greed' readings), suggesting the move has room to run but is not yet euphoric.",
    dataSources: ["Fear & Greed: 45 → 62", "Funding rates: -0.003% → +0.012%", "Social volume: rNVDA 3.2x avg"],
    confidence: 74,
    signals: [
      { label: "Fear & Greed", value: "62 (Greed)", direction: "bullish" },
      { label: "Funding rates", value: "+0.012%", direction: "bullish" },
      { label: "Social volume", value: "3.2x avg", direction: "bullish" },
    ],
  },
  technical: {
    summary:
      "rTSLA RSI oversold at 28 — no reversal confirmation yet. rNVDA broke overnight resistance at $145. rMSTR overbought RSI 72.",
    details:
      "rTSLA's RSI dropped to 28 overnight — entering oversold territory (<30) — but no bullish reversal candle confirmed, so this is a watch signal, not a buy signal. rNVDA broke through overnight resistance at $145 with strong volume, now testing $150. rMSTR's RSI at 72 is approaching overbought (>70), suggesting near-term exhaustion risk after its +5.6% move. rAAPL and rCOIN are trading within normal ranges with no significant technical breakouts or breakdowns.",
    dataSources: ["rTSLA RSI: 28", "rNVDA resistance: $145 broken", "rMSTR RSI: 72"],
    confidence: 80,
    signals: [
      { label: "rTSLA RSI", value: "28 (oversold)", direction: "neutral" },
      { label: "rNVDA resistance", value: "$145 broken", direction: "bullish" },
      { label: "rMSTR RSI", value: "72 (overbought)", direction: "bearish" },
    ],
  },
};

// ─── Seeded briefing (fallback synthesis) ──────────────────────────

export const SEED_BRIEFING = {
  executiveSummary:
    "Overnight was risk-on: dovish Fed minutes and NVDA's 8% earnings beat drove rToken premiums wider. rTSLA diverged on a delivery miss — oversold but unconfirmed. rMSTR rallied on BTC strength but is approaching overbought.",
  marketRegime: "Risk-on overnight",
  actionItems: [
    {
      id: "ai-1",
      rank: 1,
      symbol: "rTSLA",
      action: "Consider reducing rTSLA",
      rationale:
        "Delivery miss (-30K) + premium flipped to discount + RSI oversold but no reversal confirmation. 3/5 analysts flag risk.",
      analystIds: ["news", "market-intel", "technical"] as AnalystId[],
      confidence: 84,
      riskLevel: "high" as const,
    },
    {
      id: "ai-2",
      rank: 2,
      symbol: "rNVDA",
      action: "Watch rNVDA premium for reversion",
      rationale:
        "Premium at +2.3% is elevated. Earnings beat supports price but premium may compress. 4/5 analysts flag.",
      analystIds: ["macro", "market-intel", "news", "sentiment"] as AnalystId[],
      confidence: 76,
      riskLevel: "medium" as const,
    },
    {
      id: "ai-3",
      rank: 3,
      symbol: "rMSTR",
      action: "Hold rMSTR — monitor for overbought",
      rationale:
        "BTC-driven rally is real but RSI at 72 approaching overbought. No action needed yet. 2/5 analysts neutral.",
      analystIds: ["market-intel", "technical"] as AnalystId[],
      confidence: 62,
      riskLevel: "low" as const,
    },
  ],
  generatedAt: new Date().toISOString(),
  watchlistSnapshot: SEED_WATCHLIST,
};
