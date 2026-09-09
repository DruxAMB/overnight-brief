# Overnight Brief

> An AI research desk that explains what happened in tokenized US-stock markets while you slept.

[**▶ Live demo**](https://overnight-brief.vercel.app) · [Submission](https://forms.gle/GyWZCMCPocgJdJon6)

![Overnight Brief workbench](docs/hero.png)

## The problem

Tokenized US stocks trade around the clock, but humans sleep. Overnight moves, macro events, and rToken premium shifts pile up unexplained. You wake up to a gap and no idea why it happened or what to do about it.

## What it does

- **Multi-agent overnight briefing** — type "What happened while I slept?" and five specialist analysts (macro, market intel, news, sentiment, technical) each examine your watchlist from their perspective, streaming their findings one by one.
- **Synthesized briefing** — a synthesizer agent merges all five analyses into an executive summary with a market regime call and three ranked action items tied to your positions.
- **Drill-down** — click any analyst panel or action item to see the full reasoning, data sources, confidence score, and which analysts flagged it.
- **Follow-up Q&A** — type a targeted question ("Should I adjust my rNVDA position?") and the five-analyst pipeline re-runs focused on that symbol.

## Demo walkthrough

| Step | Action | What happens |
|---|---|---|
| 1 | Open the URL | Workbench loads with a watchlist (rNVDA, rTSLA, rAAPL, rCOIN, rMSTR), a pre-filled prompt, and five idle analyst panels |
| 2 | Click "Generate Briefing" | Five analyst panels light up sequentially — Macro Oracle, Market Intel, News Briefing, Sentiment Analyst, Technical Analysis — each streaming its findings |
| 3 | Wait ~5 seconds | A synthesized briefing assembles at the top: executive summary, market regime badge, three ranked action items |
| 4 | Click an action item | Expands to show which analysts flagged it, their confidence scores, and the rationale |
| 5 | Click an analyst panel | Expands to full findings: detailed analysis, signals, data sources, confidence meter |
| 6 | Type a follow-up question | The five-analyst pipeline re-runs focused on the asked symbol, producing a new targeted briefing |

## How it works

```mermaid
graph TD
    A[User prompt] --> B[Analyst 1: Macro Oracle]
    A --> C[Analyst 2: Market Intel]
    A --> D[Analyst 3: News Briefing]
    A --> E[Analyst 4: Sentiment]
    A --> F[Analyst 5: Technical]

    B --> G[Synthesizer]
    C --> G
    D --> G
    E --> G
    F --> G

    G --> H[Executive Summary]
    G --> I[Ranked Action Items]
    G --> J[Market Regime Call]

    subgraph "Bitget Agent SDK"
        K[Live rToken tickers]
    end

    K -.-> A
```

Each analyst is a Qwen 3.6 Plus call with a distinct persona system prompt (macro, market intel, news, sentiment, technical). The analysts run sequentially — not in parallel — so the judge can watch each panel activate, which is the money shot. A synthesizer agent then merges all five findings into a ranked briefing.

The hard part: this isn't one LLM call. It's five independent analyst calls, each with a distinct persona system prompt, each reasoning over the same market data from a different angle, followed by a sixth synthesis call that merges their outputs. The architecture is visible on screen — you watch each analyst work before the synthesis appears.

## Built with

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16.3.4 (App Router) | Server-side streaming, edge-ready route handlers |
| Language | TypeScript | Type safety across the RSC boundary |
| Styling | Tailwind CSS 4 | Semantic token system, no hardcoded values |
| Icons | lucide-react | One icon library, consistent sizing |
| LLM | Qwen 3.6 Plus (via Bitget hackathon proxy) | Sponsor LLM, structured JSON output, OpenAI-compatible API |
| Market data | Bitget Agent SDK (`@bitget-ai/bitget-agent-sdk`) | Live rToken tickers from public market endpoint, no API key required |
| Analyst personas | 5 custom Qwen prompts | Macro, market-intel, news, sentiment, technical — each with a distinct system prompt |
| Deploy | Vercel | Same-day, zero-config for Next.js |

## What's real vs. mocked

| Component | Status | Notes |
|---|---|---|
| Multi-agent architecture | **Real** | Five distinct Qwen calls with persona prompts, sequential streaming, synthesizer merge |
| Qwen LLM integration | **Real** | Qwen 3.6 Plus via Bitget hackathon proxy (`hackathon.bitgetops.com/v1`), structured JSON output, prompt sanitization, retry on transient errors |
| Bitget Agent SDK | **Real** | Fetches live rToken tickers (rNVDA, rTSLA, rAAPL, rCOIN, rMSTR) from Bitget's public market endpoint on every briefing request |
| Watchlist data | **Real (live)** | Real rToken prices, 24h changes, and volumes from Bitget. Falls back to curated seed snapshot if the API is unreachable. |
| Analyst findings | **Real (LLM)** | Qwen 3.6 Plus reasons over live Bitget market data with persona-specific prompts. Falls back to curated seed findings if the LLM is unavailable. |
| Synthesized briefing | **Real (LLM)** | A sixth Qwen call merges all five analyst findings into an executive summary and ranked action items. Falls back to seed briefing on error. |
| Trading / order execution | **Not implemented** | This is a research desk, not a trading bot. The human makes all decisions. |

## Run it locally

```bash
git clone https://github.com/DruxAMB/overnight-brief.git
cd overnight-brief
npm ci
cp .env.example .env.local
# Optional: add BITGET_QWEN_API_KEY to .env.local for live LLM analysis
# Without it, the app uses curated seed data
npm run dev
```

Open http://localhost:3000

### Environment variables

| Variable | Required? | Where to get it | What degrades without it |
|---|---|---|---|
| `BITGET_QWEN_API_KEY` | Optional | [Bitget hackathon Qwen proxy](https://bitget-ai.gitbook.io/bitgetai_hackathons2) | App falls back to curated seed findings — the UI and flow are identical, but the analysis is pre-written |

## Known limitations

- Watchlist is pre-seeded (5 rToken positions). No UI for adding/removing symbols.
- No historical briefing archive — each run is ephemeral.
- No price charts or sparklines in analyst panels (cut for scope).
- No multi-language support.

## Licences

- **Project code**: MIT License — see [LICENSE](LICENSE)
- **Qwen API**: Alibaba Cloud / Bitget hackathon proxy terms
- **Bitget Agent SDK**: MIT (per [Bitget Agent Hub](https://github.com/Bitget-AI/agent_hub))
- **lucide-react**: ISC
- **Next.js, React, Tailwind CSS**: MIT

---

Built for the [Bitget AI Base Camp Hackathon S2](https://www.bitget.com/en/activity-hub/hackathon) — AI Trading Desk track.
