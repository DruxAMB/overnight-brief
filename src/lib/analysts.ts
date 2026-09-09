import { ANALYST_PERSONAS, SEED_FINDINGS, SEED_BRIEFING } from "@/lib/seed-data";
import type { AnalystId, AnalystFinding, Briefing, WatchlistItem } from "@/lib/types";

// ─── LLM configuration ────────────────────────────────────────────
// Primary: Qwen 3.6 Plus via Bitget hackathon proxy (sponsor LLM)
// Fallback: seed data when no API key or API fails

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
          "Authorization": `Bearer ${apiKey}`,
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
      // Retry on transient errors (429, 503, network)
      if (attempt < maxRetries && (msg.includes("429") || msg.includes("503") || msg.includes("502") || msg.includes("Service Unavailable") || msg.includes("Too Many Requests"))) {
        console.warn(`[Qwen] attempt ${attempt + 1} failed (${msg.substring(0, 80)}), retrying in ${1000 * (attempt + 1)}ms...`);
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      break;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Qwen API failed after retries");
}

// ─── Single analyst call ───────────────────────────────────────────

function buildAnalystPrompt(
  personaId: AnalystId,
  userPrompt: string,
  watchlist: WatchlistItem[],
): QwenMessage[] {
  const persona = ANALYST_PERSONAS.find((p) => p.id === personaId)!;
  const watchlistStr = watchlist
    .map(
      (w) =>
        `${w.symbol} (${w.name}): overnight ${w.overnightChangePct > 0 ? "+" : ""}${w.overnightChangePct.toFixed(1)}%, premium ${w.premiumToNavPct > 0 ? "+" : ""}${w.premiumToNavPct.toFixed(1)}%, volume $${(w.volume24h / 1_000_000).toFixed(1)}M, position $${w.positionSize.toLocaleString()}`,
    )
    .join("\n");

  return [
    { role: "system", content: persona.systemPrompt },
    {
      role: "user",
      content: `User's question: "${sanitizePrompt(userPrompt)}"

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

export async function runAnalyst(
  personaId: AnalystId,
  userPrompt: string,
  watchlist: WatchlistItem[],
): Promise<AnalystFinding> {
  const persona = ANALYST_PERSONAS.find((p) => p.id === personaId)!;

  // Fallback to seed data if no Qwen key
  if (!hasQwenKey()) {
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

  try {
    const messages = buildAnalystPrompt(personaId, userPrompt, watchlist);
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
      content: `You are the Briefing Synthesizer. Five specialist analysts have analyzed overnight tokenized US-stock market activity. Your job is to synthesize their findings into a concise, actionable morning briefing.`,
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
- Never recommend executing a trade — only "consider", "watch", "monitor", "hold"`,
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

export async function synthesizeBriefing(
  userPrompt: string,
  watchlist: WatchlistItem[],
  findings: AnalystFinding[],
): Promise<Briefing> {
  // Fallback to seed briefing if no Qwen key
  if (!hasQwenKey()) {
    return {
      ...SEED_BRIEFING,
      generatedAt: new Date().toISOString(),
      watchlistSnapshot: watchlist,
    };
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
    return {
      ...SEED_BRIEFING,
      generatedAt: new Date().toISOString(),
      watchlistSnapshot: watchlist,
    };
  }
}
