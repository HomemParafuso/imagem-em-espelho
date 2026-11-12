import type { BrokerEvent } from "@/hooks/useIqWebSocket";
import type { Order } from "@/lib/trading";

const BROKER_ID_KEYS = ["id", "option_id", "position_id", "order_id", "external_id"];

function findValue(value: unknown, keys: string[]): unknown {
  if (!value || typeof value !== "object") return undefined;
  if (Array.isArray(value)) {
    for (const child of value) {
      const found = findValue(child, keys);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  const object = value as Record<string, unknown>;
  for (const key of keys) {
    if (object[key] !== undefined && object[key] !== null) return object[key];
  }
  for (const child of Object.values(object)) {
    const found = findValue(child, keys);
    if (found !== undefined) return found;
  }
  return undefined;
}

function stringValue(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.toLowerCase();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function numberValue(value: unknown): number | undefined {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function eventValue(event: BrokerEvent, keys: string[]): unknown {
  return findValue(event.msg, keys) ?? findValue(event, keys);
}

function normalizedDirection(value: unknown): Order["dir"] | undefined {
  const direction = stringValue(value);
  if (direction === "up" || direction === "call" || direction === "higher") return "up";
  if (direction === "down" || direction === "put" || direction === "lower") return "down";
  return undefined;
}

function findCandidate(
  orders: Order[],
  event: BrokerEvent,
  brokerId: string | undefined,
): Order | undefined {
  const openOrders = orders.filter(
    (order) => order.status === "pending" || order.status === "open",
  );
  if (brokerId) return openOrders.find((order) => order.brokerId === brokerId);
  if (openOrders.length === 1) return openOrders[0];

  const direction = normalizedDirection(
    eventValue(event, ["direction", "dir", "option_direction"]),
  );
  const amount = numberValue(eventValue(event, ["amount", "price", "value", "investment"]));
  const candidates = openOrders.filter(
    (order) =>
      (direction === undefined || order.dir === direction) &&
      (amount === undefined || Math.abs(order.amt - amount) < 0.01),
  );
  return candidates.length === 1 ? candidates[0] : undefined;
}

export function applyBrokerEvent(orders: Order[], event: BrokerEvent): Order[] {
  const name = event.name?.toLowerCase() ?? "";
  const status = stringValue(eventValue(event, ["status", "state", "position_status"]));
  const isOpen =
    name.includes("option-open") ||
    name.includes("position-open") ||
    name.includes("order-accepted") ||
    (name.includes("position-changed") && status === "open");
  const isClosed =
    name.includes("option-closed") ||
    name.includes("position-closed") ||
    name.includes("order-closed") ||
    name.includes("sold-options") ||
    (name.includes("position-changed") &&
      ["closed", "expired", "sold", "settled"].includes(status ?? ""));
  if (!isOpen && !isClosed) return orders;

  const rawBrokerId = eventValue(event, BROKER_ID_KEYS);
  const brokerId = stringValue(rawBrokerId);
  const candidate = findCandidate(orders, event, brokerId);
  if (!candidate) return orders;

  const closePrice = numberValue(
    eventValue(event, ["close_price", "closePrice", "close_quote", "sell_price"]),
  );
  const result = numberValue(
    eventValue(event, ["pnl_net", "pnl_realized", "pnl", "profit_amount", "profit"]),
  );
  return orders.map((order) =>
    order.id !== candidate.id
      ? order
      : {
          ...order,
          status: isClosed ? "closed" : "open",
          ...(brokerId ? { brokerId } : {}),
          ...(isClosed
            ? {
                closedAt: Date.now(),
                ...(closePrice === undefined ? {} : { closePrice }),
                ...(result === undefined ? {} : { result }),
              }
            : {}),
        },
  );
}
