"use client";

import { ScrollText } from "lucide-react";
import { Card } from "@/components/ui";
import { cn } from "@/lib/utils";

export type LedgerTone = "info" | "success" | "error" | "muted";

export interface LedgerEntry {
  id: number;
  ts: string; // HH:MM:SS UTC
  text: string;
  tone: LedgerTone;
}

function now(): string {
  return new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });
}

let nextId = 0;
export function ledgerEntry(text: string, tone: LedgerTone = "info"): LedgerEntry {
  return { id: nextId++, ts: now(), text, tone };
}

const TONE_CLASS: Record<LedgerTone, string> = {
  info: "text-muted-foreground",
  success: "text-success",
  error: "text-destructive",
  muted: "text-muted-foreground/60",
};

export function DeskLedger({ entries }: { entries: LedgerEntry[] }) {
  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <ScrollText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-sm font-medium text-muted-foreground">Desk activity</h2>
      </div>
      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground/70">
          Pipeline events land here while a briefing runs: data fetches, analyst
          findings, synthesis.
        </p>
      ) : (
        <ol className="themed-scrollbar space-y-1.5 max-h-72 overflow-y-auto pr-1" aria-live="polite">
          {[...entries].reverse().map((e) => (
            <li key={e.id} className="flex items-baseline gap-2 text-xs">
              <span className="font-mono text-muted-foreground/50 flex-shrink-0">
                {e.ts}
              </span>
              <span className={cn("font-mono leading-snug", TONE_CLASS[e.tone])}>
                {e.text}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
