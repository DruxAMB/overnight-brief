"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Loader2,
  Clock,
  Database,
  X,
} from "lucide-react";
import { Card, Badge, Button, Skeleton } from "@/components/ui";
import { Stack } from "@/components/layout";
import { StockLogo } from "@/components/stock-logo";
import { ThinkingOrb } from "thinking-orbs";
import { BorderBeam } from "border-beam";
import { cn } from "@/lib/utils";
import {
  ANALYST_PERSONAS,
  SEED_WATCHLIST,
  DEFAULT_PROMPT,
} from "@/lib/seed-data";
import type {
  AnalystId,
  AnalystStatus,
  AnalystFinding,
  Briefing,
  ActionItem,
  BriefingStreamEvent,
  WatchlistItem,
} from "@/lib/types";

// ─── Follow-up prompt suggestions ───────────────────────────────────
const FOLLOW_UP_PROMPTS = [
  "Should I adjust my rNVDA position?",
  "What's the biggest risk on my watchlist?",
  "Is rTSLA a buy or a wait right now?",
  "Which position should I trim first?",
];

const EXAMPLE_PROMPTS = [
  "What happened while I slept?",
  "Should I adjust my rNVDA position?",
  "What's the biggest overnight risk?",
  "Which rToken looks strongest today?",
];

// ─── Analyst orb states ────────────────────────────────────────────
// Each analyst gets a distinct ThinkingOrb state so the five panels
// feel like different kinds of work happening, not five identical spinners.
const ANALYST_ORB_STATES: Record<AnalystId, "searching" | "working" | "listening" | "weaving" | "solving"> = {
  macro: "searching",
  "market-intel": "working",
  news: "listening",
  sentiment: "weaving",
  technical: "solving",
};

// ─── Watchlist component ───────────────────────────────────────────

function Watchlist({
  items,
  highlightSymbol,
  onSelect,
  isLoading,
}: {
  items: WatchlistItem[];
  highlightSymbol?: string;
  onSelect?: (symbol: string) => void;
  isLoading?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => {
        const isUp = item.overnightChangePct > 0;
        const isDown = item.overnightChangePct < 0;
        const isHighlighted = highlightSymbol === item.symbol;
        return (
          <button
            key={item.symbol}
            onClick={() => onSelect?.(item.symbol)}
            className={cn(
              "flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 text-sm transition-all text-left",
              onSelect && "hover:border-ring cursor-pointer",
              isHighlighted && "ring-2 ring-ring border-transparent",
              isLoading && "opacity-60",
            )}
          >
            {/* Actual brand logo */}
            <StockLogo symbol={item.symbol} size={32} className="flex-shrink-0" />
            <div className="flex flex-col">
              <span className="font-medium text-foreground">{item.symbol}</span>
              <span className="text-xs text-muted-foreground">{item.name}</span>
            </div>
            <div className="flex flex-col items-end ml-1">
              {item.lastPrice > 0 && (
                <span className="font-mono text-xs text-muted-foreground">
                  ${item.lastPrice >= 1000 ? item.lastPrice.toFixed(0) : item.lastPrice.toFixed(2)}
                </span>
              )}
              <div className="flex items-center gap-1">
                {isUp && <TrendingUp className="h-3 w-3 text-success" aria-hidden="true" />}
                {isDown && <TrendingDown className="h-3 w-3 text-destructive" aria-hidden="true" />}
                {!isUp && !isDown && <Minus className="h-3 w-3 text-muted-foreground" aria-hidden="true" />}
                <span
                  className={cn(
                    "font-mono text-xs",
                    isUp && "text-success",
                    isDown && "text-destructive",
                    !isUp && !isDown && "text-muted-foreground",
                  )}
                >
                  {isUp ? "+" : ""}{item.overnightChangePct.toFixed(1)}%
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Analyst panel component ───────────────────────────────────────

function AnalystPanel({
  persona,
  status,
  finding,
  expanded,
  onToggle,
}: {
  persona: (typeof ANALYST_PERSONAS)[number];
  status: AnalystStatus;
  finding: AnalystFinding | null;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isThinking = status === "thinking";
  const isDone = status === "done";
  const isError = status === "error";

  return (
    <Card className={cn("transition-all", isThinking && "ring-1 ring-ring")}>
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 text-left"
        aria-label={`${persona.name} panel — click to ${expanded ? "collapse" : "expand"}`}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden="true">{persona.emoji}</span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">{persona.name}</span>
              {isThinking && (
                <ThinkingOrb
                  state={ANALYST_ORB_STATES[persona.id]}
                  size={20}
                  theme="dark"
                  speed={1.2}
                />
              )}
              {isDone && <Badge variant="success">Done</Badge>}
              {isError && <Badge variant="destructive">Error</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              {persona.skill}
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        )}
      </button>

      {/* Summary line (always visible when done) */}
      {isDone && finding && !expanded && (
        <p className="mt-3 text-sm text-muted-foreground line-clamp-2">{finding.summary}</p>
      )}

      {/* Thinking state — orb + status text */}
      {isThinking && (
        <div className="mt-4 flex items-center gap-3" aria-label="Analyst thinking">
          <ThinkingOrb
            state={ANALYST_ORB_STATES[persona.id]}
            size={64}
            theme="dark"
            speed={1.2}
          />
          <div className="flex-1 space-y-2">
            <p className="text-xs text-primary">Analyzing {persona.name.toLowerCase()} signals...</p>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      )}

      {/* Error state */}
      {isError && finding?.error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <span>{finding.error}</span>
        </div>
      )}

      {/* Expanded details */}
      {expanded && isDone && finding && (
        <div className="mt-4 space-y-4 border-t border-border pt-4">
          <div>
            <p className="text-sm text-foreground leading-relaxed">{finding.details}</p>
          </div>
          {finding.signals.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Signals</p>
              <div className="flex flex-wrap gap-2">
                {finding.signals.map((sig, i) => (
                  <Badge
                    key={i}
                    variant={sig.direction === "bullish" ? "success" : sig.direction === "bearish" ? "destructive" : "default"}
                  >
                    {sig.label}: {sig.value}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Data Sources</p>
            <div className="flex flex-wrap gap-1.5">
              {finding.dataSources.map((src, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                  <Database className="h-3 w-3" aria-hidden="true" />
                  {src}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Confidence</span>
            <div className="h-2 flex-1 max-w-32 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  finding.confidence >= 75 ? "bg-success" : finding.confidence >= 50 ? "bg-warning" : "bg-destructive",
                )}
                style={{ width: `${finding.confidence}%` }}
                role="progressbar"
                aria-valuenow={finding.confidence}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
            <span className="text-xs font-mono text-foreground">{finding.confidence}%</span>
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── Action item component ─────────────────────────────────────────

function ActionItemCard({
  item,
  analysts,
  expanded,
  onToggle,
}: {
  item: ActionItem;
  analysts: { id: AnalystId; name: string; emoji: string }[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const riskVariant = item.riskLevel === "high" ? "destructive" : item.riskLevel === "medium" ? "warning" : "success";
  return (
    <Card className="transition-all hover:border-ring">
      <button
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-3 text-left"
        aria-label={`Action item ${item.rank}: ${item.action} — click to ${expanded ? "collapse" : "expand"}`}
        aria-expanded={expanded}
      >
        <div className="flex items-start gap-3 flex-1">
          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
            {item.rank}
          </span>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Symbol badge with actual logo */}
              <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs font-mono font-medium text-foreground">
                <StockLogo symbol={item.symbol} size={14} />
                {item.symbol}
              </span>
              <span className="font-medium text-foreground">{item.action}</span>
              <Badge variant={riskVariant}>{item.riskLevel} risk</Badge>
            </div>
            {!expanded && <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{item.rationale}</p>}
          </div>
        </div>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" aria-hidden="true" />
        )}
      </button>
      {expanded && (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <p className="text-sm text-foreground leading-relaxed">{item.rationale}</p>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Flagged by {item.analystIds.length}/5 analysts</p>
            <div className="flex flex-wrap gap-2">
              {item.analystIds.map((id) => {
                const a = analysts.find((x) => x.id === id);
                if (!a) return null;
                return (
                  <span key={id} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-foreground">
                    <span aria-hidden="true">{a.emoji}</span>
                    {a.name}
                  </span>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Confidence</span>
            <div className="h-2 flex-1 max-w-32 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  item.confidence >= 75 ? "bg-success" : item.confidence >= 50 ? "bg-warning" : "bg-destructive",
                )}
                style={{ width: `${item.confidence}%` }}
                role="progressbar"
                aria-valuenow={item.confidence}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
            <span className="text-xs font-mono text-foreground">{item.confidence}%</span>
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── Main workbench ────────────────────────────────────────────────

type RunState = "idle" | "running" | "done" | "error";

export function Workbench() {
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [runState, setRunState] = useState<RunState>("idle");
  const [analystStatuses, setAnalystStatuses] = useState<Record<AnalystId, AnalystStatus>>(
    Object.fromEntries(ANALYST_PERSONAS.map((p) => [p.id, "idle"])) as Record<AnalystId, AnalystStatus>,
  );
  const [analystFindings, setAnalystFindings] = useState<Record<AnalystId, AnalystFinding | null>>(
    Object.fromEntries(ANALYST_PERSONAS.map((p) => [p.id, null])) as Record<AnalystId, AnalystFinding | null>,
  );
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [expandedAnalyst, setExpandedAnalyst] = useState<AnalystId | null>(null);
  const [expandedAction, setExpandedAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dataIsLive, setDataIsLive] = useState<boolean | null>(null);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(SEED_WATCHLIST);
  const [dataTimestamp, setDataTimestamp] = useState<string | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const briefingRef = useRef<HTMLDivElement>(null);

  const runBriefing = useCallback(async (promptText: string) => {
    if (!promptText.trim() || runState === "running") return;

    // Reset state
    setRunState("running");
    setError(null);
    setBriefing(null);
    setDataIsLive(null);
    setDataTimestamp(null);
    setIsSynthesizing(false);
    setExpandedAnalyst(null);
    setExpandedAction(null);
    setAnalystStatuses(
      Object.fromEntries(ANALYST_PERSONAS.map((p) => [p.id, "idle"])) as Record<AnalystId, AnalystStatus>,
    );
    setAnalystFindings(
      Object.fromEntries(ANALYST_PERSONAS.map((p) => [p.id, null])) as Record<AnalystId, AnalystFinding | null>,
    );

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptText }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error("No response stream");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event: BriefingStreamEvent = JSON.parse(line);
            handleStreamEvent(event);
          } catch {
            // partial line — skip
          }
        }
      }
      // Process any remaining buffer
      if (buffer.trim()) {
        try {
          const event: BriefingStreamEvent = JSON.parse(buffer);
          handleStreamEvent(event);
        } catch {
          // ignore
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      setRunState("error");
    }
  }, [runState]);

  function handleStreamEvent(event: BriefingStreamEvent) {
    switch (event.type) {
      case "market-data":
        setDataIsLive(event.isLive);
        setDataTimestamp(event.timestamp);
        if (event.watchlist && event.watchlist.length > 0) {
          setWatchlist(event.watchlist);
        }
        break;
      case "analyst-start":
        setAnalystStatuses((prev) => ({ ...prev, [event.analystId]: "thinking" }));
        break;
      case "analyst-done":
        setAnalystStatuses((prev) => ({ ...prev, [event.analystId]: "done" }));
        setAnalystFindings((prev) => ({ ...prev, [event.analystId]: event.finding }));
        break;
      case "analyst-error":
        setAnalystStatuses((prev) => ({ ...prev, [event.analystId]: "error" }));
        setAnalystFindings((prev) => ({
          ...prev,
          [event.analystId]: {
            analystId: event.analystId,
            analystName: ANALYST_PERSONAS.find((p) => p.id === event.analystId)?.name || event.analystId,
            emoji: ANALYST_PERSONAS.find((p) => p.id === event.analystId)?.emoji || "",
            status: "error",
            summary: "",
            details: "",
            dataSources: [],
            confidence: 0,
            signals: [],
            error: event.error,
          },
        }));
        break;
      case "synthesis-start":
        setIsSynthesizing(true);
        break;
      case "briefing-done":
        setBriefing(event.briefing);
        setRunState("done");
        setIsSynthesizing(false);
        break;
      case "error":
        setError(event.error);
        setRunState("error");
        setIsSynthesizing(false);
        break;
    }
  }

  // Auto-expand first completed analyst and scroll to briefing when done
  useEffect(() => {
    if (runState === "done" && briefing) {
      // Scroll to briefing
      briefingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      // Auto-expand the first analyst after a short delay
      const timer = setTimeout(() => {
        if (expandedAnalyst === null) {
          setExpandedAnalyst(ANALYST_PERSONAS[0].id);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [runState, briefing, expandedAnalyst]);

  // Keyboard shortcut: Cmd/Ctrl+Enter to submit
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && runState !== "running") {
        e.preventDefault();
        runBriefing(prompt);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [prompt, runState, runBriefing]);

  const isRunning = runState === "running";
  const hasResults = briefing !== null;
  const highlightSymbol = briefing?.actionItems[0]?.symbol;

  // Progress counter: how many analysts are done
  const doneCount = Object.values(analystStatuses).filter((s) => s === "done" || s === "error").length;
  const totalAnalysts = ANALYST_PERSONAS.length;
  const progressLabel = isSynthesizing
    ? "Synthesizing briefing..."
    : isRunning && doneCount < totalAnalysts
      ? `Analyst ${doneCount + 1} of ${totalAnalysts} running...`
      : null;

  const handleWatchlistSelect = useCallback((symbol: string) => {
    // Clicking a watchlist item fills the prompt with a focus on that symbol
    setPrompt(`Should I adjust my ${symbol} position?`);
  }, []);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    setRunState("idle");
    setIsSynthesizing(false);
    // Reset analyst statuses to idle
    setAnalystStatuses(
      Object.fromEntries(ANALYST_PERSONAS.map((p) => [p.id, "idle"])) as Record<AnalystId, AnalystStatus>,
    );
  }, []);

  // Format timestamp for display
  const formattedTimestamp = dataTimestamp
    ? new Date(dataTimestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC"
    : null;

  const briefingTimestamp = briefing?.generatedAt
    ? new Date(briefing.generatedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC"
    : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Prompt input */}
      <Card>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runBriefing(prompt);
          }}
          className="flex flex-col gap-3 sm:flex-row sm:items-end gap-3"
        >
          <div className="flex-1">
            <label htmlFor="prompt" className="sr-only">
              Ask your overnight research question
            </label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="What happened while I slept?"
              className="w-full resize-none rounded-lg border border-input bg-background px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              rows={2}
              style={{ fontSize: "16px" }}
              disabled={isRunning}
            />
          </div>
          <div className="flex gap-2 sm:flex-col">
            <Button type="submit" disabled={isRunning || !prompt.trim()} className="sm:w-auto">
              {isRunning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  {progressLabel || "Analyzing..."}
                </>
              ) : hasResults ? (
                <>
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  Regenerate
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  Generate Briefing
                </>
              )}
            </Button>
            {isRunning && (
              <Button type="button" variant="ghost" size="md" onClick={handleCancel} className="sm:w-auto">
                <X className="h-4 w-4" aria-hidden="true" />
                Cancel
              </Button>
            )}
          </div>
        </form>
        {/* Keyboard hint */}
        {!isRunning && (
          <p className="mt-2 text-xs text-muted-foreground">
            Press <kbd className="rounded border border-border px-1 py-0.5 text-xs">⌘/Ctrl + Enter</kbd> to generate
          </p>
        )}
      </Card>

      {/* Watchlist */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-muted-foreground">Your Watchlist</h2>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" aria-hidden="true" />
            {formattedTimestamp ? `Updated ${formattedTimestamp}` : "Overnight snapshot"}
            {dataIsLive !== null && (
              <Badge variant={dataIsLive ? "success" : "warning"} className="ml-1">
                {dataIsLive ? "LIVE" : "DEMO"}
              </Badge>
            )}
          </span>
        </div>
        <Watchlist
          items={watchlist}
          highlightSymbol={highlightSymbol}
          onSelect={handleWatchlistSelect}
          isLoading={isRunning && dataIsLive === null}
        />
      </div>

      {/* Progress bar during analysis */}
      {isRunning && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {progressLabel || "Starting..."}
            </span>
            <span className="font-mono text-muted-foreground">
              {Math.round((doneCount / totalAnalysts) * 100)}%
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${(doneCount / totalAnalysts) * 100}%` }}
              role="progressbar"
              aria-valuenow={doneCount}
              aria-valuemin={0}
              aria-valuemax={totalAnalysts}
            />
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1">
              <p className="font-medium text-destructive">Something went wrong</p>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setError(null);
                setRunState("idle");
              }}
            >
              Dismiss
            </Button>
          </div>
        </Card>
      )}

      {/* Synthesis state — orb while the synthesizer assembles the briefing */}
      {isSynthesizing && !hasResults && (
        <Card className="border-border bg-muted/50 flex items-center justify-center gap-4 py-12">
          <ThinkingOrb state="composing" size={64} theme="dark" speed={1} />
          <div>
            <p className="font-medium text-foreground">Synthesizing briefing</p>
            <p className="text-sm text-muted-foreground mt-1">Merging all five analyst findings into a ranked briefing...</p>
          </div>
        </Card>
      )}

      {/* Briefing (synthesized result) */}
      {hasResults && briefing && (
        <div ref={briefingRef}>
          <BorderBeam
            size="md"
            colorVariant="mono"
            strength={0.4}
            active={false}
            theme="dark"
          >
            <Card className="border-border bg-muted/50">
              <Stack gap="md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
                    <h2 className="text-lg font-medium text-foreground">Overnight Briefing</h2>
                    {briefingTimestamp && (
                      <span className="text-xs text-muted-foreground ml-2">{briefingTimestamp}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {dataIsLive !== null && (
                      <Badge variant={dataIsLive ? "success" : "warning"}>
                        {dataIsLive ? "LIVE DATA" : "DEMO DATA"}
                      </Badge>
                    )}
                    <Badge variant="info">{briefing.marketRegime}</Badge>
                  </div>
                </div>
                <p className="text-base text-foreground leading-relaxed">{briefing.executiveSummary}</p>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Ranked Action Items</h3>
                  <Stack gap="md">
                    {briefing.actionItems.map((item) => (
                      <ActionItemCard
                        key={item.id}
                        item={item}
                        analysts={ANALYST_PERSONAS}
                        expanded={expandedAction === item.id}
                        onToggle={() => setExpandedAction(expandedAction === item.id ? null : item.id)}
                      />
                    ))}
                  </Stack>
                </div>
                {/* Follow-up prompt chips */}
                <div className="border-t border-border pt-4">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Ask a follow-up</p>
                  <div className="flex flex-wrap gap-2">
                    {FOLLOW_UP_PROMPTS.map((p) => (
                      <button
                        key={p}
                        onClick={() => {
                          setPrompt(p);
                          runBriefing(p);
                        }}
                        className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground transition-colors hover:border-ring hover:bg-muted"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </Stack>
            </Card>
          </BorderBeam>
        </div>
      )}

      {/* Empty state (before first run) */}
      {runState === "idle" && !hasResults && (
        <Card className="border-dashed">
          <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Sparkles className="h-6 w-6 text-primary" aria-hidden="true" />
            </div>
            <div>
              <p className="font-medium text-foreground">No briefing yet</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Click Generate Briefing to run all five specialist analysts and synthesize your overnight briefing.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 max-w-lg">
              {EXAMPLE_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setPrompt(p);
                    runBriefing(p);
                  }}
                  className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground transition-colors hover:border-ring hover:bg-muted"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Analyst panels */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Specialist Analysts</h2>
        <Stack gap="md">
          {ANALYST_PERSONAS.map((persona) => (
            <AnalystPanel
              key={persona.id}
              persona={persona}
              status={analystStatuses[persona.id]}
              finding={analystFindings[persona.id]}
              expanded={expandedAnalyst === persona.id}
              onToggle={() => setExpandedAnalyst(expandedAnalyst === persona.id ? null : persona.id)}
            />
          ))}
        </Stack>
      </div>

      {/* Data disclosure */}
      <p className="text-xs text-muted-foreground text-center">
        {dataIsLive === null
          ? "Market data loads when you generate a briefing."
          : dataIsLive
            ? "Live market data from Bitget. Analysis by Qwen 3.6 Plus."
            : "Bitget API unreachable — using curated seed data for demo reliability."}
      </p>
    </div>
  );
}
