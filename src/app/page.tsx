import { PageShell, Container, Stack } from "@/components/layout";
import { Workbench } from "@/components/workbench";
import { Moon, Sparkles } from "lucide-react";

export default function Home() {
  return (
    <PageShell>
      {/* Minimal header — landing section comes in P5 */}
      <header className="border-b border-border">
        <Container className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Moon className="h-5 w-5 text-primary" aria-hidden="true" />
              <span className="font-semibold text-foreground">Overnight Brief</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              <span>AI Trading Desk · Bitget Hackathon S2</span>
            </div>
          </div>
        </Container>
      </header>

      {/* Workbench */}
      <main className="flex-1 py-6 sm:py-8">
        <Container>
          <Stack gap="lg">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Your overnight research desk
              </h1>
              <p className="mt-2 text-base text-muted-foreground max-w-2xl">
                Five specialist analysts — macro, market intel, news, sentiment, and technical —
                examine what happened in tokenized US-stock markets while you slept, then synthesize
                a ranked briefing with clear action items.
              </p>
            </div>
            <Workbench />
          </Stack>
        </Container>
      </main>
    </PageShell>
  );
}
