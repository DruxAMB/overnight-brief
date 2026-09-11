"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, X, Pencil, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { RTOKEN_CATALOG, DEFAULT_WATCHLIST_SYMBOLS, getRTokenMeta } from "@/lib/rtoken-catalog";

const STORAGE_KEY = "overnight-brief:watchlist-symbols";

/** Load the user's watchlist symbols from localStorage, falling back to defaults. */
export function loadWatchlistSymbols(): string[] {
  if (typeof window === "undefined") return DEFAULT_WATCHLIST_SYMBOLS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_WATCHLIST_SYMBOLS;
    const parsed = JSON.parse(stored) as string[];
    // Filter to known symbols only
    const valid = parsed.filter((s) => getRTokenMeta(s));
    return valid.length > 0 ? valid : DEFAULT_WATCHLIST_SYMBOLS;
  } catch {
    return DEFAULT_WATCHLIST_SYMBOLS;
  }
}

/** Persist watchlist symbols to localStorage. */
function saveWatchlistSymbols(symbols: string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(symbols));
  } catch {
    // localStorage might be unavailable (private browsing, etc.)
  }
}

export function EditableWatchlist({
  symbols,
  onSymbolsChange,
  disabled,
}: {
  symbols: string[];
  onSymbolsChange: (symbols: string[]) => void;
  disabled?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const handleRemove = useCallback((symbol: string) => {
    const next = symbols.filter((s) => s !== symbol);
    if (next.length === 0) return; // Keep at least 1
    onSymbolsChange(next);
    saveWatchlistSymbols(next);
  }, [symbols, onSymbolsChange]);

  const handleAdd = useCallback((symbol: string) => {
    if (symbols.includes(symbol)) return;
    const next = [...symbols, symbol];
    onSymbolsChange(next);
    saveWatchlistSymbols(next);
  }, [symbols, onSymbolsChange]);

  const handleReset = useCallback(() => {
    onSymbolsChange(DEFAULT_WATCHLIST_SYMBOLS);
    saveWatchlistSymbols(DEFAULT_WATCHLIST_SYMBOLS);
  }, [onSymbolsChange]);

  const availableToAdd = RTOKEN_CATALOG.filter((r) => !symbols.includes(r.symbol));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        {symbols.map((symbol) => {
          const meta = getRTokenMeta(symbol);
          return (
            <div
              key={symbol}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm"
            >
              <span className="font-mono font-medium text-foreground">{symbol}</span>
              {meta && <span className="text-xs text-muted-foreground">{meta.name}</span>}
              {isEditing && (
                <button
                  onClick={() => handleRemove(symbol)}
                  disabled={symbols.length <= 1}
                  className="ml-0.5 text-muted-foreground hover:text-destructive disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                  aria-label={`Remove ${symbol} from watchlist`}
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          );
        })}

        {isEditing && showPicker && availableToAdd.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border border-border rounded-lg p-2 bg-muted/50">
            {availableToAdd.map((r) => (
              <button
                key={r.symbol}
                onClick={() => handleAdd(r.symbol)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground transition-colors hover:border-ring hover:bg-muted cursor-pointer"
              >
                <Plus className="h-3 w-3" aria-hidden="true" />
                <span className="font-mono">{r.symbol}</span>
                <span className="text-muted-foreground">{r.name}</span>
              </button>
            ))}
          </div>
        )}

        {isEditing && !showPicker && availableToAdd.length > 0 && (
          <button
            onClick={() => setShowPicker(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-dashed border-border bg-transparent px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:border-ring hover:text-foreground cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Add symbol
          </button>
        )}

        {isEditing && showPicker && (
          <button
            onClick={() => setShowPicker(false)}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-transparent px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
          >
            Done adding
          </button>
        )}
      </div>

      {/* Edit / Done / Reset controls */}
      <div className="flex items-center gap-2">
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            disabled={disabled}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            <Pencil className="h-3 w-3" aria-hidden="true" />
            Edit watchlist
          </button>
        ) : (
          <>
            <button
              onClick={() => { setIsEditing(false); setShowPicker(false); }}
              className="inline-flex items-center gap-1 text-xs text-foreground cursor-pointer"
            >
              <Check className="h-3 w-3" aria-hidden="true" />
              Done
            </button>
            <button
              onClick={handleReset}
              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Reset to default
            </button>
          </>
        )}
      </div>
    </div>
  );
}
