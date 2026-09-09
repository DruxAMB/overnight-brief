"use client";

import { useState, useRef, useCallback } from "react";
import {
  Send,
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
} from "lucide-react";
import { Card, Badge, Button, Skeleton, EmptyState } from "@/components/ui";
import { Grid, Stack } from "@/components/layout";
import { cn } from "@/lib/utils";
import {
  ANALYST_PERSONAS,
  SEED_WATCHLIST,
  DEFAULT_PROMPT,
  SEED_FINDINGS,
  SEED_BRIEFING,
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

// ─── Watchlist component ───────────────────────────────────────────

function Watchlist({ items, highlightSymbol }: { items: WatchlistItem[]; highlightSymbol?: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => {
        const isUp = item.overnightChangePct > 0;
        const isDown = item.overnightChangePct < 0;
        const isHighlighted = highlightSymbol === item.symbol;
        return (
          <div
            key={item.symbol}
            className={cn(
              "flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm transition-colors",
              isHighlighted && "ring-2 ring-ring",
            )}
          >
            <div className="flex flex-col">
              <span className="font-medium text-foreground">{item.symbol}</span>
              <span className="text-xs text-muted-foreground">{item.name}</span>
            </div>
            <div className="flex items-center gap-1">
              {isUp && <TrendingUp className="h-3.5 w-3.5 text-success" aria-hidden="true" />}
              {isDown && <TrendingDown className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />}
              {!isUp && !isDown && <Minus className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />}
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
              {isThinking && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden="true" />}
              {isDone && <Badge variant="success">Done</Badge>}
              {isError && <Badge variant="destructive">Error</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              bitget-signal: {persona.skill}
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

      {/* Thinking skeleton */}
      {isThinking && (
        <div className="mt-3 space-y-2" aria-label="Analyst thinking">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      )}

      {/* Error state */}
      {isError && finding?.error && (
        <div className="mt-3 flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <span>{finding.error}</span>
        </div>
      )}

      {/* Expanded details */}
      {expanded && isDone && finding && (
        <div className="mt-4 space-y-4 border-t border-border pt-4">
          <div>
            <p className="text-sm text-foreground">{finding.details}</p>
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
                className="h-full rounded-full bg-primary transition-all"
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
          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
            {item.rank}
          </span>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
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
          <p className="text-sm text-foreground">{item.rationale}</p>
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
                className="h-full rounded-full bg-primary transition-all"
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
  const abortRef = useRef<AbortController | null>(null);

  const runBriefing = useCallback(async (promptText: string) => {
    if (!promptText.trim() || runState === "running") return;

    // Reset state
    setRunState("running");
    setError(null);
    setBriefing(null);
    setDataIsLive(null);
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
      case "briefing-done":
        setBriefing(event.briefing);
        setRunState("done");
        break;
      case "error":
        setError(event.error);
        setRunState("error");
        break;
    }
  }

  const isRunning = runState === "running";
  const hasResults = briefing !== null;
  const highlightSymbol = briefing?.actionItems[0]?.symbol;

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
              className="w-full resize-none rounded-md border border-input bg-background px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              rows={2}
              style={{ fontSize: "16px" }} // ≥16px to prevent iOS zoom
              disabled={isRunning}
            />
          </div>
          <Button type="submit" disabled={isRunning || !prompt.trim()} className="sm:w-auto">
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Generate Briefing
              </>
            )}
          </Button>
        </form>
      </Card>

      {/* Watchlist */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-muted-foreground">Your Watchlist</h2>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" aria-hidden="true" />
            Overnight snapshot
          </span>
        </div>
        <Watchlist items={SEED_WATCHLIST} highlightSymbol={highlightSymbol} />
      </div>

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

      {/* Briefing (synthesized result) */}
      {hasResults && briefing && (
        <Card className="border-ring/30 bg-muted/30">
          <Stack gap="md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
                <h2 className="text-lg font-semibold text-foreground">Overnight Briefing</h2>
              </div>
              <Badge variant="info">{briefing.marketRegime}</Badge>
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
          </Stack>
        </Card>
      )}

      {/* Empty state (before first run) */}
      {runState === "idle" && !hasResults && (
        <EmptyState
          icon={<Sparkles className="h-10 w-10" aria-hidden="true" />}
          title="No briefing yet"
          description="Click Generate Briefing to run all five specialist analysts and synthesize your overnight briefing."
        />
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

      {/* Simulated data disclosure */}
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
