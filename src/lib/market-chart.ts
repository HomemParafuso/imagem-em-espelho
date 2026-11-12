export type MarketCandle = { o: number; h: number; l: number; c: number; time?: number };

export const TIMEFRAME_OPTIONS = [
  { label: "1m", seconds: 60 },
  { label: "5m", seconds: 300 },
  { label: "15m", seconds: 900 },
  { label: "30m", seconds: 1800 },
  { label: "1h", seconds: 3600 },
  { label: "3h", seconds: 10800 },
  { label: "6h", seconds: 21600 },
  { label: "12h", seconds: 43200 },
  { label: "24h", seconds: 86400 },
  { label: "1 semana", seconds: 604800 },
  { label: "15 dias", seconds: 1296000 },
  { label: "1 mês", seconds: 2592000 },
];

export function toUnixSeconds(value: number) {
  if (value > 100_000_000_000_000_000) return value / 1_000_000_000;
  if (value > 100_000_000_000_000) return value / 1_000_000;
  if (value > 100_000_000_000) return value / 1_000;
  return value;
}

export function formatTimeframe(seconds: number) {
  return (
    TIMEFRAME_OPTIONS.find((item) => item.seconds === seconds)?.label ??
    `${Math.round(seconds / 60)}m`
  );
}

export function aggregateCandles(candles: MarketCandle[], timeframeSeconds: number) {
  if (timeframeSeconds === 60) return candles;
  const buckets = new Map<number, MarketCandle>();
  for (const candle of candles) {
    if (candle.time === undefined || !Number.isFinite(candle.time)) continue;
    const seconds = toUnixSeconds(candle.time);
    const bucket = Math.floor(seconds / timeframeSeconds) * timeframeSeconds;
    const current = buckets.get(bucket);
    buckets.set(
      bucket,
      current
        ? {
            ...current,
            h: Math.max(current.h, candle.h),
            l: Math.min(current.l, candle.l),
            c: candle.c,
          }
        : { ...candle, time: bucket },
    );
  }
  return [...buckets.values()].sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
}

export function mergeIntoMinuteCandle(candles: MarketCandle[], incoming: MarketCandle[]) {
  const buckets = new Map<number, MarketCandle>();
  const add = (candle: MarketCandle) => {
    if (candle.time === undefined || !Number.isFinite(candle.time)) return;
    const seconds = toUnixSeconds(candle.time);
    const bucket = Math.floor(seconds / 60) * 60;
    const current = buckets.get(bucket);
    buckets.set(
      bucket,
      current
        ? {
            o: current.o,
            h: Math.max(current.h, candle.h),
            l: Math.min(current.l, candle.l),
            c: candle.c,
            time: bucket,
          }
        : { ...candle, time: bucket },
    );
  };
  candles.forEach(add);
  incoming.forEach(add);
  return [...buckets.values()].sort((a, b) => (a.time ?? 0) - (b.time ?? 0)).slice(-22000);
}
