// ─── Technical indicators (pure TypeScript, no Python needed) ─────
// Calculates RSI, MACD, EMA, Bollinger Bands, and support/resistance
// from OHLCV candle data fetched from Bitget's public API.
// Based on standard formulas used in technical analysis libraries.

import type { Candle } from "./bitget-market";

/** Simple Moving Average */
export function sma(values: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
      continue;
    }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += values[j];
    result.push(sum / period);
  }
  return result;
}

/** Exponential Moving Average */
export function ema(values: number[], period: number): number[] {
  const result: number[] = [];
  const k = 2 / (period + 1);
  let prev = values[0];
  for (let i = 0; i < values.length; i++) {
    if (i === 0) {
      result.push(values[0]);
    } else {
      prev = values[i] * k + prev * (1 - k);
      result.push(prev);
    }
  }
  return result;
}

/** Relative Strength Index (RSI) */
export function rsi(candles: Candle[], period = 14): number[] {
  const closes = candles.map((c) => c.close);
  const result: number[] = [];
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 0; i < closes.length; i++) {
    if (i === 0) {
      result.push(50);
      continue;
    }
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    if (i <= period) {
      avgGain += gain;
      avgLoss += loss;
      if (i === period) {
        avgGain /= period;
        avgLoss /= period;
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        result.push(100 - 100 / (1 + rs));
      } else {
        result.push(50);
      }
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      result.push(100 - 100 / (1 + rs));
    }
  }
  return result;
}

/** MACD (Moving Average Convergence Divergence) */
export function macd(
  candles: Candle[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9,
): { dif: number[]; dea: number[]; hist: number[] } {
  const closes = candles.map((c) => c.close);
  const emaFast = ema(closes, fastPeriod);
  const emaSlow = ema(closes, slowPeriod);
  const dif = closes.map((_, i) => emaFast[i] - emaSlow[i]);
  const dea = ema(dif, signalPeriod);
  const hist = dif.map((d, i) => 2 * (d - dea[i]));
  return { dif, dea, hist };
}

/** Bollinger Bands */
export function bollingerBands(
  candles: Candle[],
  period = 20,
  multiplier = 2,
): { upper: number[]; middle: number[]; lower: number[] } {
  const closes = candles.map((c) => c.close);
  const middle = sma(closes, period);
  const upper: number[] = [];
  const lower: number[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      upper.push(NaN);
      lower.push(NaN);
      continue;
    }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += (closes[j] - middle[i]) ** 2;
    }
    const std = Math.sqrt(sum / period);
    upper.push(middle[i] + multiplier * std);
    lower.push(middle[i] - multiplier * std);
  }

  return { upper, middle, lower };
}

/** Support and resistance levels from recent swing highs/lows */
export function supportResistance(
  candles: Candle[],
  lookback = 50,
): { support: number; resistance: number; pivot: number } {
  const recent = candles.slice(-lookback);
  if (recent.length === 0) return { support: 0, resistance: 0, pivot: 0 };

  const highs = recent.map((c) => c.high);
  const lows = recent.map((c) => c.low);
  const resistance = Math.max(...highs);
  const support = Math.min(...lows);
  const pivot = (resistance + support + recent[recent.length - 1].close) / 3;

  return { support, resistance, pivot };
}

/** Volume trend: is volume increasing or decreasing? */
export function volumeTrend(candles: Candle[], lookback = 20): {
  trend: "increasing" | "decreasing" | "flat";
  avgVolume: number;
  lastVolume: number;
} {
  const recent = candles.slice(-lookback);
  if (recent.length < 2) return { trend: "flat", avgVolume: 0, lastVolume: 0 };

  const avgVolume = recent.reduce((s, c) => s + c.volume, 0) / recent.length;
  const lastVolume = recent[recent.length - 1].volume;
  const firstHalf = recent.slice(0, Math.floor(recent.length / 2)).reduce((s, c) => s + c.volume, 0);
  const secondHalf = recent.slice(Math.floor(recent.length / 2)).reduce((s, c) => s + c.volume, 0);
  const firstAvg = firstHalf / Math.floor(recent.length / 2);
  const secondAvg = secondHalf / (recent.length - Math.floor(recent.length / 2));

  let trend: "increasing" | "decreasing" | "flat" = "flat";
  if (secondAvg > firstAvg * 1.1) trend = "increasing";
  else if (secondAvg < firstAvg * 0.9) trend = "decreasing";

  return { trend, avgVolume, lastVolume };
}

/** Full technical analysis summary for a symbol */
export interface TechnicalSummary {
  symbol: string;
  lastPrice: number;
  rsi: number;
  rsiSignal: "oversold" | "overbought" | "neutral";
  macdHist: number;
  macdSignal: "bullish" | "bearish" | "neutral";
  ema20: number;
  ema50: number;
  emaTrend: "bullish" | "bearish" | "neutral";
  bollingerUpper: number;
  bollingerLower: number;
  bollingerWidth: number;
  support: number;
  resistance: number;
  volumeTrend: "increasing" | "decreasing" | "flat";
  avgVolume: number;
  lastVolume: number;
  overall: "bullish" | "bearish" | "neutral";
}

/** Calculate a full technical analysis summary from candles */
export function analyzeCandles(
  candles: Candle[],
  symbol: string,
): TechnicalSummary | null {
  if (candles.length < 30) return null;

  const closes = candles.map((c) => c.close);
  const lastPrice = closes[closes.length - 1];

  const rsiValues = rsi(candles, 14);
  const lastRsi = rsiValues[rsiValues.length - 1];
  const rsiSignal =
    lastRsi < 30 ? "oversold" : lastRsi > 70 ? "overbought" : "neutral";

  const { dif, dea, hist } = macd(candles);
  const lastHist = hist[hist.length - 1];
  const macdSignal =
    lastHist > 0 && dif[dif.length - 1] > dea[dea.length - 1]
      ? "bullish"
      : lastHist < 0 && dif[dif.length - 1] < dea[dea.length - 1]
        ? "bearish"
        : "neutral";

  const ema20Values = ema(closes, 20);
  const ema50Values = ema(closes, 50);
  const ema20 = ema20Values[ema20Values.length - 1];
  const ema50 = ema50Values[ema50Values.length - 1];
  const emaTrend =
    ema20 > ema50 ? "bullish" : ema20 < ema50 ? "bearish" : "neutral";

  const bb = bollingerBands(candles, 20, 2);
  const bbUpper = bb.upper[bb.upper.length - 1];
  const bbLower = bb.lower[bb.lower.length - 1];
  const bbWidth = bbUpper - bbLower;

  const sr = supportResistance(candles, 50);
  const volTrend = volumeTrend(candles, 20);

  // Overall signal from vote
  let bullCount = 0;
  let bearCount = 0;
  if (rsiSignal === "oversold") bullCount++;
  if (rsiSignal === "overbought") bearCount++;
  if (macdSignal === "bullish") bullCount++;
  if (macdSignal === "bearish") bearCount++;
  if (emaTrend === "bullish") bullCount++;
  if (emaTrend === "bearish") bearCount++;
  if (lastPrice > sr.pivot) bullCount++;
  if (lastPrice < sr.pivot) bearCount++;

  const overall =
    bullCount > bearCount + 1
      ? "bullish"
      : bearCount > bullCount + 1
        ? "bearish"
        : "neutral";

  return {
    symbol,
    lastPrice,
    rsi: Math.round(lastRsi * 10) / 10,
    rsiSignal,
    macdHist: Math.round(lastHist * 100) / 100,
    macdSignal,
    ema20: Math.round(ema20 * 100) / 100,
    ema50: Math.round(ema50 * 100) / 100,
    emaTrend,
    bollingerUpper: Math.round(bbUpper * 100) / 100,
    bollingerLower: Math.round(bbLower * 100) / 100,
    bollingerWidth: Math.round(bbWidth * 100) / 100,
    support: Math.round(sr.support * 100) / 100,
    resistance: Math.round(sr.resistance * 100) / 100,
    volumeTrend: volTrend.trend,
    avgVolume: Math.round(volTrend.avgVolume),
    lastVolume: Math.round(volTrend.lastVolume),
    overall,
  };
}
