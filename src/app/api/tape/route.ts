import { NextResponse } from "next/server";
import { fetchWatchlist, fetchCryptoTickers } from "@/lib/bitget-market";
import { DEFAULT_WATCHLIST_SYMBOLS } from "@/lib/rtoken-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 60s CDN-level cache: the tape is ambient context, not a trading feed.
export const revalidate = 60;

export interface TapeItem {
  symbol: string;
  price: number;
  changePct: number;
  kind: "rtoken" | "crypto";
}

export async function GET() {
  const [{ items, isLive }, crypto] = await Promise.all([
    fetchWatchlist([...DEFAULT_WATCHLIST_SYMBOLS]),
    fetchCryptoTickers(),
  ]);

  const tape: TapeItem[] = items.map((w) => ({
    symbol: w.symbol,
    price: w.lastPrice,
    changePct: w.overnightChangePct,
    kind: "rtoken",
  }));

  if (crypto.btc) {
    tape.push({ symbol: "BTC", price: crypto.btc.price, changePct: crypto.btc.changePct, kind: "crypto" });
  }
  if (crypto.eth) {
    tape.push({ symbol: "ETH", price: crypto.eth.price, changePct: crypto.eth.changePct, kind: "crypto" });
  }

  return NextResponse.json(
    { items: tape, isLive: isLive || crypto.isLive, timestamp: new Date().toISOString() },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } },
  );
}
