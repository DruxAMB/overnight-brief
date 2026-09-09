// ─── Core domain types ─────────────────────────────────────────────
// Shared across server and client. Serializable (no class instances,
// no functions) so they can pass through RSC boundaries.

/** A tokenized US-stock position in the user's seeded watchlist. */
export interface WatchlistItem {
  symbol: string; // e.g. "rNVDA" — the rToken symbol on Bitget
  underlying: string; // e.g. "NVDA" — the native US stock
  name: string; // e.g. "NVIDIA Corp"
  overnightChangePct: number; // e.g. +2.3 or -1.2
  premiumToNavPct: number; // rToken premium/discount to NAV
  volume24h: number; // 24h volume in USD
  positionSize: number; // user's seeded position in USD
}

/** A specialist analyst persona — maps 1:1 to a bitget-signal skill. */
export interface AnalystPersona {
  id: AnalystId;
  name: string;
  emoji: string;
  skill: string; // the bitget-signal skill name it maps to
  systemPrompt: string;
}

export type AnalystId =
  | "macro"
  | "market-intel"
  | "news"
  | "sentiment"
  | "technical";

/** The status of a single analyst during a briefing run. */
export type AnalystStatus = "idle" | "thinking" | "done" | "error";

/** A single analyst's finding — structured for predictable UI. */
export interface AnalystFinding {
  analystId: AnalystId;
  analystName: string;
  emoji: string;
  status: AnalystStatus;
  summary: string; // 1-2 sentence headline finding
  details: string; // full analysis paragraph
  dataSources: string[]; // e.g. ["DXY", "Fed minutes", "BTC correlation"]
  confidence: number; // 0-100
  signals: AnalystSignal[]; // specific signals flagged
  error?: string; // if status === "error"
}

/** A specific signal an analyst flagged (e.g. "RSI oversold at 28"). */
export interface AnalystSignal {
  label: string;
  value: string;
  direction: "bullish" | "bearish" | "neutral";
}

/** A ranked action item in the synthesized briefing. */
export interface ActionItem {
  id: string;
  rank: number;
  symbol: string; // which watchlist item it concerns
  action: string; // e.g. "Consider reducing rTSLA"
  rationale: string; // why
  analystIds: AnalystId[]; // which analysts flagged it
  confidence: number; // 0-100, aggregate
  riskLevel: "low" | "medium" | "high";
}

/** The complete synthesized briefing. */
export interface Briefing {
  executiveSummary: string;
  marketRegime: string; // e.g. "Risk-on overnight"
  actionItems: ActionItem[];
  generatedAt: string; // ISO timestamp
  watchlistSnapshot: WatchlistItem[];
}

/** A streaming event from the briefing API. */
export type BriefingStreamEvent =
  | { type: "analyst-start"; analystId: AnalystId; analystName: string; emoji: string }
  | { type: "analyst-chunk"; analystId: AnalystId; chunk: string }
  | { type: "analyst-done"; analystId: AnalystId; finding: AnalystFinding }
  | { type: "analyst-error"; analystId: AnalystId; error: string }
  | { type: "synthesis-start" }
  | { type: "synthesis-chunk"; chunk: string }
  | { type: "briefing-done"; briefing: Briefing }
  | { type: "error"; error: string };
