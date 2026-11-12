import type { MarketCandle } from "./market-chart";

export const SUPPORT_RESISTANCE_NAME = "Suporte e resistência";
export const SUPPORT_RESISTANCE_PERIODS = [20, 50, 80, 120, 150, 200, 250, 300, 350, 400] as const;

export type SupportResistanceSeries = {
  period: number;
  resistance: Array<number | undefined>;
  support: Array<number | undefined>;
};

function windowValues(
  candles: MarketCandle[],
  index: number,
  period: number,
  barLook: number,
): MarketCandle[] {
  const end = index - barLook;
  const start = end - period + 1;
  if (start < 0 || end >= candles.length) return [];
  return candles.slice(start, end + 1);
}

export function calculateSupportResistance(
  candles: MarketCandle[],
  barLook = 3,
): SupportResistanceSeries[] {
  return SUPPORT_RESISTANCE_PERIODS.map((period) => {
    const resistance: Array<number | undefined> = [];
    const support: Array<number | undefined> = [];
    candles.forEach((_, index) => {
      const values = windowValues(candles, index, period, barLook);
      resistance.push(
        values.length === period ? Math.max(...values.map((candle) => candle.h)) : undefined,
      );
      support.push(
        values.length === period ? Math.min(...values.map((candle) => candle.l)) : undefined,
      );
    });
    return { period, resistance, support };
  });
}

export function currentSupportResistance(series: SupportResistanceSeries[]) {
  return series.map(({ period, resistance, support }) => ({
    period,
    resistance: resistance[resistance.length - 1],
    support: support[support.length - 1],
  }));
}

export function visibleSupportResistance(
  series: SupportResistanceSeries[],
  start: number,
  end: number,
): SupportResistanceSeries[] {
  return series.map(({ period, resistance, support }) => ({
    period,
    resistance: resistance.slice(start, end),
    support: support.slice(start, end),
  }));
}
