export type OrderStatus = "pending" | "open" | "closed" | "rejected";
export type Order = {
  id: string;
  asset: string;
  dir: "up" | "down";
  price: number;
  amt: number;
  openedAt: number;
  expiresAt: number;
  status: OrderStatus;
  closedAt?: number;
  closePrice?: number;
  result?: number;
  brokerId?: string;
};
export type Rules = {
  broker: string;
  account: string;
  entryMode: string;
  entry: number;
  payoutType: string;
  minPayout: number;
  delay: string;
  martingale: boolean;
  multiplier: number;
  mgLevels: number;
  soros: boolean;
  sorosPercent: number;
  sorosLevels: number;
  sorosgale: boolean;
  sgLevels: number;
  recovery: boolean;
  recoveryPercent: number;
  invert: boolean;
  cycles: boolean;
  cycleCount: number;
  cycleTarget: number;
  masaniello: boolean;
  masanielloTrades: number;
  masanielloWins: number;
  virtualLoss: boolean;
  virtualLossCount: number;
  noDelay: boolean;
  simultaneous: boolean;
  stopMode: string;
  stopWin: number;
  stopLoss: number;
  trailing: boolean;
  preStop: boolean;
  trend: boolean;
  period: number;
  average: string;
  investing: boolean;
  investingMode: string;
  news: boolean;
  newsBefore: number;
  newsAfter: number;
  impact: number;
  aiFilter: boolean;
  confidence: string;
  timerZone: boolean;
  candleHit: boolean;
};
export const defaultRules: Rules = {
  broker: "TradeX",
  account: "Demo",
  entryMode: "Valor",
  entry: 12,
  payoutType: "Digital",
  minPayout: 80,
  delay: "Automático",
  martingale: false,
  multiplier: 1.6,
  mgLevels: 1,
  soros: false,
  sorosPercent: 20,
  sorosLevels: 1,
  sorosgale: false,
  sgLevels: 5,
  recovery: false,
  recoveryPercent: 30,
  invert: false,
  cycles: false,
  cycleCount: 3,
  cycleTarget: 100,
  masaniello: false,
  masanielloTrades: 10,
  masanielloWins: 6,
  virtualLoss: false,
  virtualLossCount: 2,
  noDelay: true,
  simultaneous: true,
  stopMode: "Valor",
  stopWin: 40000,
  stopLoss: 30000,
  trailing: false,
  preStop: false,
  trend: false,
  period: 21,
  average: "EMA",
  investing: false,
  investingMode: "Normal",
  news: false,
  newsBefore: 30,
  newsAfter: 30,
  impact: 2,
  aiFilter: false,
  confidence: "Baixa",
  timerZone: false,
  candleHit: false,
};
export function settleOrder(order: Order, price: number, time: number): Order {
  if (order.closedAt !== undefined || time < order.expiresAt) return order;
  const win = order.dir === "up" ? price > order.price : price < order.price;
  return {
    ...order,
    status: "closed",
    closedAt: time,
    closePrice: price,
    result: price === order.price ? 0 : win ? Number((order.amt * 0.86).toFixed(2)) : -order.amt,
  };
}
export function entryAmount(r: Rules, balance: number, history: Order[]): number {
  let amount = r.entryMode === "Porcentagem" ? (balance * r.entry) / 100 : r.entry;
  const sorted = history
    .filter((o) => o.closedAt !== undefined)
    .sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0));
  const last = sorted[0];
  let losses = 0,
    wins = 0;
  for (const o of sorted) {
    if ((o.result ?? 0) >= 0) break;
    losses++;
  }
  for (const o of sorted) {
    if ((o.result ?? 0) <= 0) break;
    wins++;
  }
  if (r.martingale && losses > 0 && losses <= r.mgLevels) amount *= r.multiplier ** losses;
  if (r.soros && wins > 0 && wins <= r.sorosLevels)
    amount += ((last?.result ?? 0) * r.sorosPercent) / 100;
  if (r.recovery && (last?.result ?? 0) < 0)
    amount += (Math.abs(last?.result ?? 0) * r.recoveryPercent) / 100;
  return Number(amount.toFixed(2));
}
export function tradeBlock(
  r: Rules,
  orders: Order[],
  amount: number,
  balance: number,
  initial: number,
): string | null {
  const closed = orders.filter((o) => o.closedAt !== undefined);
  const pnl = closed.reduce((sum, o) => sum + (o.result ?? 0), 0);
  const unit = r.stopMode === "Porcentagem" ? initial / 100 : 1;
  if (r.minPayout > 86) return "Payout de 86% abaixo do mínimo configurado.";
  if (pnl >= r.stopWin * unit) return "Stop WIN atingido.";
  if (pnl <= -r.stopLoss * unit) return "Stop LOSS atingido.";
  if (r.preStop && pnl - amount < -r.stopLoss * unit)
    return "Pré Stop LOSS: esta entrada ultrapassa o limite.";
  if (r.trailing) {
    let total = 0,
      peak = 0;
    for (const o of [...closed].sort((a, b) => (a.closedAt ?? 0) - (b.closedAt ?? 0))) {
      total += o.result ?? 0;
      peak = Math.max(peak, total);
    }
    if (peak - pnl >= r.stopLoss * unit) return "Stop Móvel atingido.";
  }
  if (!r.simultaneous && orders.some((o) => o.closedAt === undefined))
    return "Aguarde a ordem aberta encerrar.";
  if (!Number.isFinite(amount) || amount <= 0) return "Defina uma entrada maior que zero.";
  if (amount > balance) return "Saldo insuficiente.";
  return null;
}
