"use client";

import { useState, useEffect, useCallback } from "react";
import { Moon, Sparkles, ArrowRight, TrendingUp, Brain, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui";

// ─── Tech marquee items: actual project logos (inline SVG) ────────
const TECH_MARQUEE_ITEMS = [
  {
    name: "Bitget",
    color: "#00F0FF",
    path: "M11.1211 9.45984H15.4039L19.7853 14.015C20.0704 14.3113 20.0718 14.7933 19.7883 15.0911L14.1694 21H9.75741L11.0912 19.6432L15.9885 14.5513L11.1535 9.45947M12.8789 14.5405H8.59609L4.21467 9.98542C3.92966 9.68912 3.92821 9.20718 4.21176 8.90933L9.83067 3H14.2426L12.9088 4.35683L8.01147 9.4487L12.8466 14.5405",
  },
  {
    name: "Qwen 3.6 Plus",
    color: "#6950EF",
    path: "M23.919 14.545 20.817 9.17l1.47-2.544a.56.56 0 0 0 0-.566l-1.633-2.83a.57.57 0 0 0-.49-.283h-6.207L12.487.402a.57.57 0 0 0-.49-.284H8.732a.56.56 0 0 0-.49.284L5.139 5.775h-2.94a.56.56 0 0 0-.49.284L.077 8.887a.56.56 0 0 0 0 .567L3.18 14.83l-1.47 2.545a.56.56 0 0 0 0 .566l1.634 2.83a.57.57 0 0 0 .49.283h6.205l1.47 2.545a.57.57 0 0 0 .49.284h3.266a.57.57 0 0 0 .49-.284l3.104-5.375h2.94a.57.57 0 0 0 .49-.283l1.634-2.828a.55.55 0 0 0-.004-.568M8.733.686l1.634 2.828-1.634 2.828H21.8L20.164 9.17H7.425L5.63 6.06Zm1.306 19.801-6.205-.002 1.634-2.83h3.265L2.201 6.344h3.267q3.182 5.517 6.367 11.032zm10.124-5.66L18.53 12l-6.532 11.315-1.634-2.83c2.129-3.673 4.25-7.351 6.373-11.028h3.592l3.102 5.374z",
  },
  {
    name: "Next.js 16",
    color: "#ddffdc",
    path: "M18.665 21.978C16.758 23.255 14.465 24 12 24 5.377 24 0 18.623 0 12S5.377 0 12 0s12 5.377 12 12c0 3.583-1.574 6.801-4.067 9.001L9.219 7.2H7.2v9.596h1.615V9.251l9.85 12.727Zm-3.332-8.533 1.6 2.061V7.2h-1.6v6.245Z",
  },
  {
    name: "React 19",
    color: "#61DAFB",
    path: "M12 9.861A2.139 2.139 0 1 0 12 14.139 2.139 2.139 0 1 0 12 9.861zM6.008 16.122l-1.21-.061A12.014 12.014 0 0 1 .387 9.44C.227 8.71.832 8.061 1.578 8.061h.526c.466 0 .852.328.945.78a10.46 10.46 0 0 0 3.318 5.823c.36.328.422.882.137 1.273a.965.965 0 0 1-.496.422zm5.962 4.273c-.422 0-.784-.328-.836-.75a10.59 10.59 0 0 0-1.014-3.318.873.873 0 0 1 .422-1.156.873.873 0 0 1 1.156.422 12.21 12.21 0 0 1 1.156 3.793.873.873 0 0 1-.873.992zm6.022-4.273a.965.965 0 0 1-.496-.422c-.285-.391-.223-.945.137-1.273a10.46 10.46 0 0 0 3.318-5.823c.093-.452.479-.78.945-.78h.526c.746 0 1.351.649 1.191 1.379a12.014 12.014 0 0 1-4.411 6.621l-1.21.061z",
  },
  {
    name: "TypeScript",
    color: "#3178C6",
    path: "M1.125 0C.502 0 0 .502 0 1.125v21.75C0 23.498.502 24 1.125 24h21.75c.623 0 1.125-.502 1.125-1.125V1.125C24 .502 23.498 0 22.875 0zm17.363 9.75c.612 0 1.154.037 1.627.111a6.38 6.38 0 0 1 1.306.34v2.458a3.95 3.95 0 0 0-.672-.227 5.07 5.07 0 0 0-.7-.143 4.62 4.62 0 0 0-.682-.054c-.293 0-.543.027-.749.082a.94.94 0 0 0-.479.227.613.613 0 0 0-.176.358.48.48 0 0 0 .082.328c.064.094.176.187.335.279.158.094.369.193.629.297.479.197.893.393 1.24.589.346.196.629.402.846.613.215.21.379.443.486.697.107.254.16.543.16.867 0 .681-.234 1.203-.701 1.563-.469.36-1.143.539-2.021.539-.469 0-.893-.041-1.27-.123a5.78 5.78 0 0 1-1.043-.328 4.84 4.84 0 0 1-.846-.451v-2.613c.262.196.549.373.857.527.309.156.621.287.938.393.316.107.629.187.939.24.309.053.588.08.836.08.305 0 .555-.033.748-.098a.83.83 0 0 0 .451-.27.68.68 0 0 0 .143-.43.61.61 0 0 0-.082-.328 1.04 1.04 0 0 0-.279-.297 3.18 3.18 0 0 0-.486-.297 8.93 8.93 0 0 0-.697-.297c-.41-.176-.783-.36-1.117-.551a4.42 4.42 0 0 1-.836-.586 2.42 2.42 0 0 1-.531-.69 2.07 2.07 0 0 1-.187-.897c0-.65.227-1.156.682-1.516.453-.36 1.094-.539 1.92-.539zm-8.578.918h5.484v1.963h-3.322v1.963h3.117v1.963h-3.117v4.393H9.91z",
  },
  {
    name: "Tailwind CSS",
    color: "#06B6D4",
    path: "M12.001,4.8c-3.2,0-5.2,1.6-6,4.8c1.2-1.6,2.6-2.2,4.2-1.8c0.913,0.228,1.565,0.89,2.288,1.624C13.666,10.618,15.027,12,18.001,12c3.2,0,5.2-1.6,6-4.8c-1.2,1.6-2.6,2.2-4.2,1.8c-0.913-0.228-1.565-0.89-2.288-1.624C16.337,6.182,14.976,4.8,12.001,4.8z M6.001,12c-3.2,0-5.2,1.6-6,4.8c1.2-1.6,2.6-2.2,4.2-1.8c0.913,0.228,1.565,0.89,2.288,1.624c1.178,1.194,2.539,2.576,5.512,2.576c3.2,0,5.2-1.6,6-4.8c-1.2,1.6-2.6,2.2-4.2,1.8c-0.913-0.228-1.565-0.89-2.288-1.624C11.337,14.182,9.976,12.8,6.001,12z",
  },
];

// ─── Hero section ─────────────────────────────────────────────────

function Hero({ onTryDemo }: { onTryDemo: () => void }) {
  return (
    <div className="flex flex-col items-center gap-8 py-12 sm:py-20 text-center">
      {/* Eyebrow label: Moss 70, uppercase, tracked */}
      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-info">
        <span className="shimmer-text">AI Trading Desk · Bitget Hackathon S2</span>
      </div>

      {/* Headline: display font, Phosphor White, tight tracking */}
      <div className="max-w-3xl">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-medium tracking-tight text-foreground leading-[1.05]">
          Your overnight research desk for tokenized markets
        </h1>
        <p className="mt-6 text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
          Five specialist analysts examine what happened in tokenized US-stock
          markets while you slept. One ranked briefing. Clear action items.
        </p>
      </div>

      {/* CTA: Accent Pill (lime, rationed) + Ghost Outline */}
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

      {/* How it works: 3-column grid, Ground Iron cards */}
      <div className="mt-8 w-full max-w-4xl">
        <div className="grid gap-6 sm:grid-cols-3 text-left">
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Brain className="h-5 w-5 text-foreground icon-animate-brain" aria-hidden="true" />
            </div>
            <h3 className="font-medium text-foreground">Five analysts, one question</h3>
            <p className="text-sm text-muted-foreground">
              Macro, market intel, news, sentiment, and technical: each examines
              your watchlist from its own perspective.
            </p>
          </div>
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Zap className="h-5 w-5 text-foreground icon-animate-zap" aria-hidden="true" />
            </div>
            <h3 className="font-medium text-foreground">Watch them work</h3>
            <p className="text-sm text-muted-foreground">
              Each analyst streams its findings in real time. You see the
              reasoning, not just the answer.
            </p>
          </div>
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <TrendingUp className="h-5 w-5 text-foreground icon-animate-trend" aria-hidden="true" />
            </div>
            <h3 className="font-medium text-foreground">Ranked action items</h3>
            <p className="text-sm text-muted-foreground">
              A synthesizer merges all five analyses into a briefing with
              three ranked actions tied to your positions.
            </p>
          </div>
        </div>
      </div>

      {/* Tech stack: marquee with actual project logos, fading ends */}
      <div className="mt-4 w-full max-w-4xl overflow-hidden marquee-mask">
        <div className="flex w-max marquee-track">
          {[...TECH_MARQUEE_ITEMS, ...TECH_MARQUEE_ITEMS].map((item, i) => (
            <div key={i} className="flex items-center gap-2 px-6 text-sm text-muted-foreground whitespace-nowrap">
              <svg viewBox="0 0 24 24" width={20} height={20} fill={item.color} aria-hidden="true">
                <path d={item.path} />
              </svg>
              <span className="font-medium">{item.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Landing shell: manages hero ↔ app transition ────────────────
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
    <div className={cn(
      "relative flex flex-col min-h-[100dvh] bg-background",
      !showApp && "overflow-hidden",
    )}>
      {/* Header: Carbon Veil, Phosphor Blue-Black border, nav shadow (only place shadows are allowed) */}
      <header
        className="sticky top-0 z-10 backdrop-blur-[10px]"
        style={{
          backgroundColor: "var(--muted)",
          borderBottom: "1px solid var(--nav-border)",
          boxShadow: "var(--nav-shadow)",
        }}
      >
        <div className="mx-auto w-full max-w-6xl px-6 h-16 flex items-center justify-between">
          <button
            onClick={goToHero}
            className="flex items-center gap-2 transition-opacity hover:opacity-80"
            aria-label="Overnight Brief: back to home"
          >
            <Moon className="h-5 w-5 text-primary" aria-hidden="true" />
            <span className="text-sm font-medium tracking-tight text-foreground">Overnight Brief</span>
          </button>
          <div className="flex items-center gap-2 text-sm font-medium tracking-tight text-foreground/80">
            <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            <span className="hidden sm:inline">AI Trading Desk · Bitget Hackathon S2</span>
            <span className="sm:hidden">Bitget S2</span>
          </div>
        </div>
      </header>

      {/* Hero: hidden when app is active */}
      <div
        className={cn(
          "transition-all duration-300 ease-out flex-1",
          showApp
            ? "opacity-0 -translate-y-4 pointer-events-none absolute inset-0 overflow-hidden"
            : "opacity-100 translate-y-0",
        )}
        aria-hidden={showApp}
      >
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <Hero onTryDemo={goToApp} />
        </div>
      </div>

      {/* Workbench: hidden when hero is active, but in the DOM */}
      <div
        className={cn(
          "transition-all duration-300 ease-out",
          showApp
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-4 pointer-events-none absolute inset-0 overflow-hidden",
        )}
        aria-hidden={!showApp}
      >
        <main className="flex-1 border py-8 sm:py-12">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-8">
              <div>
                <h1 className="text-5xl sm:text-9xl font-medium tracking-tight text-foreground leading-[1.05]">
                  Your overnight <br /> research desk
                </h1>
                <p className="mt-4 text-lg sm:text-xl text-muted-foreground max-w-2xl leading-relaxed">
                  Five specialist analysts (macro, market intel, news,
                  sentiment, and technical) examine what happened in tokenized
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
