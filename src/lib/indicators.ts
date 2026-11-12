import type { MarketCandle } from "./market-chart";

export type MovingAverageType = "SMA" | "WMA" | "EMA" | "SSMA";

export type MovingAverageConfig = {
  period: number;
  type: MovingAverageType;
  color: string;
  thickness: number;
};

function normalizedPeriod(period: number) {
  return Math.max(1, Math.floor(period));
}

export function calculateMovingAverage(
  candles: MarketCandle[],
  config: MovingAverageConfig,
): Array<number | undefined> {
  const period = normalizedPeriod(config.period);
  const closes = candles.map((candle) => candle.c);
  if (config.type === "EMA") {
    const multiplier = 2 / (period + 1);
    let previous: number | undefined;
    return closes.map((close, index) => {
      if (index < period - 1) return undefined;
      if (previous === undefined) {
        previous =
          closes.slice(index - period + 1, index + 1).reduce((sum, value) => sum + value, 0) /
          period;
      } else {
        previous = (close - previous) * multiplier + previous;
      }
      return previous;
    });
  }

  const values: Array<number | undefined> = [];
  let previousSmoothed: number | undefined;
  closes.forEach((close, index) => {
    if (index < period - 1) {
      values.push(undefined);
      return;
    }
    const window = closes.slice(index - period + 1, index + 1);
    if (config.type === "WMA") {
      const denominator = (period * (period + 1)) / 2;
      values.push(
        window.reduce((sum, value, offset) => sum + value * (offset + 1), 0) / denominator,
      );
      return;
    }
    if (config.type === "SSMA") {
      previousSmoothed =
        previousSmoothed === undefined
          ? window.reduce((sum, value) => sum + value, 0) / period
          : (previousSmoothed * (period - 1) + close) / period;
      values.push(previousSmoothed);
      return;
    }
    values.push(window.reduce((sum, value) => sum + value, 0) / period);
  });
  return values;
}
