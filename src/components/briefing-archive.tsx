"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, History, RotateCcw } from "lucide-react";
import { Card, Badge } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { AnalystFinding, AnalystId, Briefing } from "@/lib/types";

const STORAGE_KEY = "overnight-brief:archive";
const MAX_ENTRIES = 8;

export interface ArchiveEntry {
  id: string;
  prompt: string;
  briefing: Briefing;
  findings: Partial<Record<AnalystId, AnalystFinding>>;
  savedAt: string; // ISO timestamp
}

/** Load archived briefings from localStorage (newest first). */
export function loadArchive(): ArchiveEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as ArchiveEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Persist a briefing run to the local archive. */
export function saveToArchive(entry: ArchiveEntry): ArchiveEntry[] {
  if (typeof window === "undefined") return [entry];
  const next = [entry, ...loadArchive()].slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage might be unavailable (private browsing, quota, etc.)
  }
  return next;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) +
    " UTC"
  );
}

export function BriefingArchive({
  entries,
  onRestore,
  disabled,
}: {
  entries: ArchiveEntry[];
  onRestore: (entry: ArchiveEntry) => void;
  disabled?: boolean;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (entries.length === 0) return null;

  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <History className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-sm font-medium text-muted-foreground">Briefing archive</h2>
        <span className="text-xs text-muted-foreground/60">
          {entries.length} saved this session
        </span>
      </div>
      <div className="space-y-1">
        {entries.map((entry) => {
          const expanded = expandedId === entry.id;
          return (
            <div key={entry.id} className="rounded-lg border border-border">
              <div className="flex items-center gap-2 px-3 py-2">
                <button
                  onClick={() => setExpandedId(expanded ? null : entry.id)}
                  className="flex flex-1 items-center gap-2 text-left min-w-0 overflow-hidden"
                  aria-expanded={expanded}
                  aria-label={`Briefing from ${formatTime(entry.savedAt)}: click to ${expanded ? "collapse" : "expand"}`}
                >
                  {expanded ? (
                    <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" aria-hidden="true" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" aria-hidden="true" />
                  )}
                  <span className="font-mono text-xs text-muted-foreground flex-shrink-0">
                    {formatTime(entry.savedAt)}
                  </span>
                  <Badge variant="info" className="max-w-20 truncate">
                    {entry.briefing.marketRegime}
                  </Badge>
                  <span className="truncate text-xs text-foreground">
                    {entry.prompt}
                  </span>
                </button>
                <button
                  onClick={() => onRestore(entry)}
                  disabled={disabled}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors",
                    disabled
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-muted hover:text-foreground",
                  )}
                  aria-label={`Restore briefing from ${formatTime(entry.savedAt)}`}
                >
                  <RotateCcw className="h-3 w-3" aria-hidden="true" />
                  View
                </button>
              </div>
              {expanded && (
                <div className="border-t border-border px-3 py-3 space-y-2">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {entry.briefing.executiveSummary}
                  </p>
                  <div className="space-y-1">
                    {entry.briefing.actionItems.map((item) => (
                      <p key={item.id} className="text-xs text-foreground">
                        <span className="font-mono text-muted-foreground">
                          {item.rank}. {item.symbol}
                        </span>{" "}
                        — {item.action}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
