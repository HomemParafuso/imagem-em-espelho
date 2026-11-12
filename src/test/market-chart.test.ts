import { describe, expect, it } from "vitest";
import { aggregateCandles, mergeIntoMinuteCandle, toUnixSeconds } from "@/lib/market-chart";
import { calculateSupportResistance, currentSupportResistance } from "@/lib/support-resistance";

describe("market chart candles", () => {
  it("consolidates second updates into the same one-minute candle", () => {
    const first = [{ o: 1.1, h: 1.1, l: 1.1, c: 1.1, time: 120 }];
    const result = mergeIntoMinuteCandle(first, [
      { o: 1.11, h: 1.13, l: 1.09, c: 1.12, time: 149 },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ o: 1.1, h: 1.13, l: 1.09, c: 1.12, time: 120 });
  });

  it("aggregates completed minute candles into the selected period", () => {
    const result = aggregateCandles(
      [
        { o: 1.1, h: 1.2, l: 1.0, c: 1.15, time: 0 },
        { o: 1.15, h: 1.25, l: 1.1, c: 1.2, time: 60 },
      ],
      300,
    );
    expect(result).toEqual([{ o: 1.1, h: 1.25, l: 1.0, c: 1.2, time: 0 }]);
  });

  it("normalizes the nanosecond timestamp sent by IQ", () => {
    const first = { o: 1.1, h: 1.1, l: 1.1, c: 1.1, time: 1_794_424_815_758_513_200 };
    const second = { o: 1.1, h: 1.2, l: 1.0, c: 1.15, time: 1_794_424_816_885_000_000 };
    expect(toUnixSeconds(first.time)).toBeCloseTo(1_794_424_815.758, 2);
    expect(mergeIntoMinuteCandle([], [first, second])).toHaveLength(1);
  });

  it("calculates the permanent support and resistance levels from real candles", () => {
    const candles = Array.from({ length: 23 }, (_, index) => ({
      o: 1,
      h: 1.2 + index / 1000,
      l: 1 + index / 1000,
      c: 1.1,
      time: index * 60,
    }));
    const levels = currentSupportResistance(calculateSupportResistance(candles));
    expect(levels[0]?.period).toBe(20);
    expect(levels[0]?.resistance).toBeCloseTo(1.219, 10);
    expect(levels[0]?.support).toBe(1);
    expect(levels[1]?.resistance).toBeUndefined();
  });
});
