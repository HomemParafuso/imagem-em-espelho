import { describe, expect, it } from "vitest";
import { applyBrokerEvent } from "@/lib/broker-events";
import type { Order } from "@/lib/trading";

const orders: Order[] = [
  {
    id: "a",
    asset: "EUR/USD",
    dir: "up",
    price: 1.1,
    amt: 12,
    openedAt: 1,
    expiresAt: 2,
    status: "open",
    brokerId: "101",
  },
  {
    id: "b",
    asset: "EUR/USD",
    dir: "down",
    price: 1.1,
    amt: 12,
    openedAt: 1,
    expiresAt: 2,
    status: "open",
    brokerId: "102",
  },
];

describe("broker order events", () => {
  it("closes only the order matching the broker id", () => {
    const result = applyBrokerEvent(orders, {
      name: "portfolio.position-changed",
      msg: { position_id: 102, status: "closed", pnl_net: -12 },
    });
    expect(result.find((order) => order.id === "b")?.closedAt).toBeTypeOf("number");
    expect(result.find((order) => order.id === "a")?.closedAt).toBeUndefined();
  });

  it("does not guess when multiple open orders have no identifying data", () => {
    const result = applyBrokerEvent(orders, { name: "sold-options", msg: { status: "closed" } });
    expect(result.every((order) => order.closedAt === undefined)).toBe(true);
  });

  it("matches a single close event by direction and amount", () => {
    const result = applyBrokerEvent([orders[0]!], {
      name: "sold-options",
      msg: { direction: "call", amount: 12, status: "closed" },
    });
    expect(result[0]?.closedAt).toBeTypeOf("number");
  });
});
