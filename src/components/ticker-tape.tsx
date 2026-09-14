"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { SEED_WATCHLIST } from "@/lib/seed-data";

interface TapeItem {
  symbol: string;
  price: number;
  changePct: number;
  kind: "rtoken" | "crypto";
}

interface TapeResponse {
  items: TapeItem[];
  isLive: boolean;
  timestamp: string;
}

const POLL_MS = 60_000;

// Seed fallback so the tape still reads as a market strip if the API is
// unreachable. Marked DEMO via the parent badge; no fake "live" claim.
const SEED_TAPE: TapeItem[] = SEED_WATCHLIST.map((w) => ({
  symbol: w.symbol,
  price: w.lastPrice,
  changePct: w.overnightChangePct,
  kind: "rtoken",
}));

function formatPrice(p: number): string {
  if (p >= 1000) return p.toFixed(0);
  if (p >= 10) return p.toFixed(1);
  return p.toFixed(2);
}

function TapeEntry({ item }: { item: TapeItem }) {
  const up = item.changePct > 0;
  const down = item.changePct < 0;
  return (
    <span className="flex items-center gap-1.5 px-5 whitespace-nowrap">
      <span className="font-mono text-xs text-muted-foreground">{item.symbol}</span>
      <span className="font-mono text-xs text-foreground">${formatPrice(item.price)}</span>
      <span
        className={cn(
          "flex items-center gap-0.5 font-mono text-xs",
          up && "text-success",
          down && "text-destructive",
          !up && !down && "text-muted-foreground",
        )}
      >
        {up && <TrendingUp className="h-3 w-3" aria-hidden="true" />}
        {down && <TrendingDown className="h-3 w-3" aria-hidden="true" />}
        {!up && !down && <Minus className="h-3 w-3" aria-hidden="true" />}
        {up ? "+" : ""}{item.changePct.toFixed(2)}%
      </span>
    </span>
  );
}

export function TickerTape() {
  const [items, setItems] = useState<TapeItem[]>(SEED_TAPE);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/tape");
        if (!res.ok) return;
        const data = (await res.json()) as TapeResponse;
        if (!cancelled && data.items.length > 0) {
          setItems(data.items);
          setIsLive(data.isLive);
        }
      } catch {
        // Keep seed values; the tape is ambient context, not critical path.
      }
    }

    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div
      className="relative flex h-9 items-center overflow-hidden border-b border-border bg-card/60"
      role="marquee"
      aria-label="Market ticker"
    >
      <div className="marquee-mask w-full overflow-hidden">
        <div className="flex w-max marquee-track" style={{ animationDuration: "45s" }}>
          {[...items, ...items].map((item, i) => (
            <TapeEntry key={`${item.symbol}-${i}`} item={item} />
          ))}
        </div>
      </div>
      <span
        className={cn(
          "absolute right-0 top-1/2 -translate-y-1/2 rounded-l-sm border-l border-border px-2 py-1 font-mono text-[10px] tracking-wide",
          isLive ? "bg-card text-success" : "bg-card text-muted-foreground",
        )}
      >
        {isLive ? "LIVE" : "SNAPSHOT"}
      </span>
    </div>
  );
}
