"use client";

import { useState, useEffect, useCallback } from "react";
import { Moon, Sparkles, ArrowRight, TrendingUp, Brain, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui";

// ─── Hero section ─────────────────────────────────────────────────

function Hero({ onTryDemo }: { onTryDemo: () => void }) {
  return (
    <div className="flex flex-col items-center gap-8 py-12 sm:py-20 text-center">
      {/* Badge */}
      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-4 py-1.5 text-xs text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        <span>AI Trading Desk · Bitget Hackathon S2</span>
      </div>

      {/* Headline */}
      <div className="max-w-3xl">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-[1.1]">
          Your overnight research desk for tokenized markets
        </h1>
        <p className="mt-6 text-lg sm:text-xl text-muted-foreground leading-relaxed">
          Five specialist analysts examine what happened in tokenized US-stock
          markets while you slept. One ranked briefing. Clear action items.
        </p>
      </div>

      {/* CTA */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <Button size="lg" onClick={onTryDemo} className="w-full sm:w-auto">
          Try the demo
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
        <a
          href="https://github.com/DruxAMB/overnight-brief"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full sm:w-auto"
        >
          <Button variant="secondary" size="lg" className="w-full">
            View source
          </Button>
        </a>
      </div>

      {/* How it works */}
      <div className="mt-8 w-full max-w-4xl">
        <div className="grid gap-6 sm:grid-cols-3 text-left">
          <div className="flex flex-col gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Brain className="h-5 w-5 text-foreground" aria-hidden="true" />
            </div>
            <h3 className="font-medium text-foreground">Five analysts, one question</h3>
            <p className="text-sm text-muted-foreground">
              Macro, market intel, news, sentiment, and technical — each examines
              your watchlist from its own perspective.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Zap className="h-5 w-5 text-foreground" aria-hidden="true" />
            </div>
            <h3 className="font-medium text-foreground">Watch them work</h3>
            <p className="text-sm text-muted-foreground">
              Each analyst streams its findings in real time. You see the
              reasoning, not just the answer.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <TrendingUp className="h-5 w-5 text-foreground" aria-hidden="true" />
            </div>
            <h3 className="font-medium text-foreground">Ranked action items</h3>
            <p className="text-sm text-muted-foreground">
              A synthesizer merges all five analyses into a briefing with
              three ranked actions tied to your positions.
            </p>
          </div>
        </div>
      </div>

      {/* Tech stack */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
        <span>Built on</span>
        <span className="rounded-md bg-muted px-2 py-1">Bitget Agent SDK</span>
        <span className="rounded-md bg-muted px-2 py-1">bitget-signal (5 skills)</span>
        <span className="rounded-md bg-muted px-2 py-1">Gemini 2.0 Flash</span>
        <span className="rounded-md bg-muted px-2 py-1">Next.js 16</span>
      </div>
    </div>
  );
}

// ─── Landing shell — manages hero ↔ app transition ────────────────
// Both hero and workbench are server-rendered. The transition is purely
// visual (opacity + transform). URL reflects state via ?app=1.
// Direct arrival at /?app=1 renders the tool with no hero flash.

export function LandingShell({
  initialApp,
  children,
}: {
  initialApp: boolean;
  children: React.ReactNode;
}) {
  const [showApp, setShowApp] = useState(initialApp);

  // Sync with URL changes (back/forward buttons)
  useEffect(() => {
    const handler = () => {
      const params = new URLSearchParams(window.location.search);
      setShowApp(params.has("app"));
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  const goToApp = useCallback(() => {
    setShowApp(true);
    const url = new URL(window.location.href);
    url.searchParams.set("app", "1");
    window.history.pushState({}, "", url);
  }, []);

  const goToHero = useCallback(() => {
    setShowApp(false);
    const url = new URL(window.location.href);
    url.searchParams.delete("app");
    window.history.pushState({}, "", url);
  }, []);

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background">
      {/* Header — always visible, logo returns to hero */}
      <header className="border-b border-border sticky top-0 z-10 bg-background/95 backdrop-blur">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={goToHero}
              className="flex items-center gap-2 transition-opacity hover:opacity-80"
              aria-label="Overnight Brief — back to home"
            >
              <Moon className="h-5 w-5 text-primary" aria-hidden="true" />
              <span className="font-semibold text-foreground">Overnight Brief</span>
            </button>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">AI Trading Desk · Bitget Hackathon S2</span>
              <span className="sm:hidden">Bitget S2</span>
            </div>
          </div>
        </div>
      </header>

      {/* Hero — hidden when app is active */}
      <div
        className={cn(
          "transition-all duration-300 ease-out",
          showApp
            ? "opacity-0 -translate-y-4 pointer-events-none absolute inset-0"
            : "opacity-100 translate-y-0",
        )}
        aria-hidden={showApp}
      >
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <Hero onTryDemo={goToApp} />
        </div>
      </div>

      {/* Workbench — hidden when hero is active, but in the DOM */}
      <div
        className={cn(
          "transition-all duration-300 ease-out",
          showApp
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-4 pointer-events-none absolute inset-0",
        )}
        aria-hidden={!showApp}
      >
        <main className="flex-1 py-6 sm:py-8">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  Your overnight research desk
                </h1>
                <p className="mt-2 text-base text-muted-foreground max-w-2xl">
                  Five specialist analysts — macro, market intel, news,
                  sentiment, and technical — examine what happened in tokenized
                  US-stock markets while you slept, then synthesize a ranked
                  briefing with clear action items.
                </p>
              </div>
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
