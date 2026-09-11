import { NextRequest } from "next/server";
import { ANALYST_PERSONAS } from "@/lib/seed-data";
import { runAnalyst, synthesizeBriefing } from "@/lib/analysts";
import { fetchWatchlist } from "@/lib/bitget-market";
import { getRTokenMeta, DEFAULT_WATCHLIST_SYMBOLS } from "@/lib/rtoken-catalog";
import type { BriefingStreamEvent, WatchlistItem } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const prompt: string = String(body.prompt || "What happened while I slept?");
  // Client can send a custom watchlist of rToken symbols for personalization.
  // Falls back to the default 5 if not provided or invalid.
  const clientSymbols: string[] = Array.isArray(body.symbols)
    ? body.symbols.filter((s: unknown) => typeof s === "string" && getRTokenMeta(String(s)))
    : [];
  const symbols = clientSymbols.length > 0 ? clientSymbols : DEFAULT_WATCHLIST_SYMBOLS;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: BriefingStreamEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };

      try {
        // Fetch real market data from Bitget for the user's selected symbols.
        // Falls back to seed data if the API is unreachable.
        const { items: watchlist, isLive } = await fetchWatchlist(symbols);

        // Signal data source to the client
        send({ type: "market-data", isLive, timestamp: new Date().toISOString(), watchlist });

        // Run analysts sequentially: each panel lights up one by one.
        // This is the money shot: watching 5 panels activate in sequence.
        const findings = [];

        for (const persona of ANALYST_PERSONAS) {
          // Signal: analyst starting
          send({
            type: "analyst-start",
            analystId: persona.id,
            analystName: persona.name,
            emoji: persona.emoji,
          });

          try {
            const finding = await runAnalyst(persona.id, prompt, watchlist);
            findings.push(finding);

            send({
              type: "analyst-done",
              analystId: persona.id,
              finding,
            });
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Analyst failed";
            send({
              type: "analyst-error",
              analystId: persona.id,
              error: msg,
            });
          }
        }

        // Synthesize
        send({ type: "synthesis-start" });

        const briefing = await synthesizeBriefing(prompt, watchlist, findings);

        send({ type: "briefing-done", briefing });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        send({ type: "error", error: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
