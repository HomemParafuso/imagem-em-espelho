import { describe, expect, test } from "vitest";
import { calculateMovingAverage } from "@/lib/indicators";

describe("moving averages", () => {
  test("calculates EMA from the selected period without shifting the line", () => {
    const candles = [1, 2, 3, 4].map((close) => ({ o: close, h: close, l: close, c: close }));
    const values = calculateMovingAverage(candles, {
      period: 3,
      type: "EMA",
      color: "#ffffff",
      thickness: 1,
    });

    expect(values).toEqual([undefined, undefined, 2, 3]);
  });

  test("keeps the historical EMA seed when the chart window changes", () => {
    const candles = [1, 2, 3, 4, 5, 6].map((close) => ({
      o: close,
      h: close,
      l: close,
      c: close,
    }));
    const config = { period: 3, type: "EMA" as const, color: "#ffffff", thickness: 1 };
    const full = calculateMovingAverage(candles, config);

    expect(full.slice(2, 5)).toEqual([2, 3, 4]);
  });
});
