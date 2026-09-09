import { GoogleGenerativeAI } from "@google/generative-ai";
import { ANALYST_PERSONAS, SEED_FINDINGS, SEED_BRIEFING } from "@/lib/seed-data";
import type { AnalystId, AnalystFinding, Briefing, WatchlistItem } from "@/lib/types";

// ─── Prompt sanitization ──────────────────────────────────────────
// Mitigate prompt injection — adapted from Agentropolis's pattern.
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

// ─── Gemini client (lazy init) ─────────────────────────────────────

let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI | null {
  if (genAI) return genAI;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  genAI = new GoogleGenerativeAI(key);
  return genAI;
}

export function hasGeminiKey(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

// ─── Single analyst call ───────────────────────────────────────────

function buildAnalystPrompt(
  personaId: AnalystId,
  userPrompt: string,
  watchlist: WatchlistItem[],
): string {
  const persona = ANALYST_PERSONAS.find((p) => p.id === personaId)!;
  const watchlistStr = watchlist
    .map(
      (w) =>
        `${w.symbol} (${w.name}): overnight ${w.overnightChangePct > 0 ? "+" : ""}${w.overnightChangePct.toFixed(1)}%, premium ${w.premiumToNavPct > 0 ? "+" : ""}${w.premiumToNavPct.toFixed(1)}%, volume $${(w.volume24h / 1_000_000).toFixed(1)}M, position $${w.positionSize.toLocaleString()}`,
    )
    .join("\n");

  return `${persona.systemPrompt}

User's question: "${sanitizePrompt(userPrompt)}"

User's watchlist (overnight snapshot):
${watchlistStr}

Analyze what happened overnight for these tokenized US-stock positions from your specialist perspective.

Respond with valid JSON only (no markdown, no code blocks):
{
  "summary": "1-2 sentence headline finding",
  "details": "Full analysis paragraph (3-5 sentences) with specific data points",
  "dataSources": ["source1", "source2", "source3"],
  "confidence": 0-100,
  "signals": [
    {"label": "Signal name", "value": "value", "direction": "bullish|bearish|neutral"}
  ]
}`;
}

interface AnalystResponse {
  summary: string;
  details: string;
  dataSources: string[];
  confidence: number;
  signals: { label: string; value: string; direction: "bullish" | "bearish" | "neutral" }[];
}

export async function runAnalyst(
  personaId: AnalystId,
  userPrompt: string,
  watchlist: WatchlistItem[],
): Promise<AnalystFinding> {
  const persona = ANALYST_PERSONAS.find((p) => p.id === personaId)!;

  // Fallback to seed data if no Gemini key
  if (!hasGeminiKey()) {
    const seed = SEED_FINDINGS[personaId];
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

  const ai = getGenAI()!;
  const model = ai.getGenerativeModel({ model: "gemini-2.0-flash", generationConfig: { responseMimeType: "application/json" } });

  const prompt = buildAnalystPrompt(personaId, userPrompt, watchlist);

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = JSON.parse(text) as AnalystResponse;

    // Validate and clamp
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
    console.error(`[Analyst ${personaId}] error:`, msg);
    // Fallback to seed data on error
    const seed = SEED_FINDINGS[personaId];
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

// ─── Synthesizer ───────────────────────────────────────────────────

function buildSynthesisPrompt(
  userPrompt: string,
  watchlist: WatchlistItem[],
  findings: AnalystFinding[],
): string {
  const watchlistStr = watchlist
    .map((w) => `${w.symbol} (${w.name}): ${w.overnightChangePct > 0 ? "+" : ""}${w.overnightChangePct.toFixed(1)}%`)
    .join(", ");

  const findingsStr = findings
    .map((f) => `${f.emoji} ${f.analystName} (${f.confidence}% confident): ${f.summary}`)
    .join("\n");

  return `You are the Briefing Synthesizer. Five specialist analysts have analyzed overnight tokenized US-stock market activity. Your job is to synthesize their findings into a concise, actionable morning briefing.

User's question: "${sanitizePrompt(userPrompt)}"

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
      "rationale": "Why — cite which analysts flagged it",
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
- Be honest about uncertainty — if analysts disagree, say so
- Never recommend executing a trade — only "consider", "watch", "monitor", "hold"`;
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

export async function synthesizeBriefing(
  userPrompt: string,
  watchlist: WatchlistItem[],
  findings: AnalystFinding[],
): Promise<Briefing> {
  // Fallback to seed briefing if no Gemini key
  if (!hasGeminiKey()) {
    return {
      ...SEED_BRIEFING,
      generatedAt: new Date().toISOString(),
      watchlistSnapshot: watchlist,
    };
  }

  const ai = getGenAI()!;
  const model = ai.getGenerativeModel({ model: "gemini-2.0-flash", generationConfig: { responseMimeType: "application/json" } });

  try {
    const prompt = buildSynthesisPrompt(userPrompt, watchlist, findings);
    const result = await model.generateContent(prompt);
    const text = result.response.text();
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
    // Fallback to seed briefing
    return {
      ...SEED_BRIEFING,
      generatedAt: new Date().toISOString(),
      watchlistSnapshot: watchlist,
    };
  }
}
