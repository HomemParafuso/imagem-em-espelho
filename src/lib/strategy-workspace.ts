import { z } from "zod";
import { defaultRules, entryAmount, settleOrder, tradeBlock, type Order, type Rules } from "./trading";
import { calculateMovingAverage } from "./indicators";
import type { MarketCandle } from "./market-chart";

export const definitionSchema = z.object({
  name: z.string().min(1).max(120),
  signal: z.enum(["momentum", "ma-cross"]),
  period: z.number().int().min(2).max(100),
  duration: z.number().int().min(5).max(3600),
  entry: z.number().positive().max(1000),
  stopWin: z.number().positive().max(100000),
  stopLoss: z.number().positive().max(100000),
  mode: z.enum(["demo", "real"]),
});
export type Definition = z.infer<typeof definitionSchema>;
const proposalPatchSchema = definitionSchema.partial().strict();
export type Version = { version: number; definition: Definition; approvedAt: number; reason: string };
export type Proposal = { id: string; baseVersion: number; summary: string; rationale: string; patch: z.infer<typeof proposalPatchSchema>; status: "pending" | "accepted" | "rejected"; createdAt: number };
export type Decision = { time: number; signal: "CALL" | "PUT" | "WAIT"; reason: string; version: number };
export type Workspace = {
  draft: Definition; versions: Version[]; proposals: Proposal[];
  session: { status: "stopped" | "running" | "paused"; balance: number; initial: number; orders: (Order & { strategyVersion: number })[]; decisions: Decision[]; lastTick: number; source: "simulated"; };
};
export const workspaceKey = (threadId: string) => `tradex-workspace-v1:${threadId}`;
export function createWorkspace(rules: Rules = defaultRules, duration = 60): Workspace {
  return { draft: { name: "Minha estratégia", signal: "momentum", period: 5, duration, entry: rules.entry, stopWin: rules.stopWin, stopLoss: rules.stopLoss, mode: "demo" }, versions: [], proposals: [], session: { status: "stopped", balance: 10000, initial: 10000, orders: [], decisions: [], lastTick: 0, source: "simulated" } };
}
export function loadWorkspace(id: string, rules?: Rules, duration?: number): Workspace {
  try {
    const raw = localStorage.getItem(workspaceKey(id));
    if (raw) {
      const parsed = JSON.parse(raw) as Workspace;
      if (definitionSchema.safeParse(parsed.draft).success && Array.isArray(parsed.versions) && Array.isArray(parsed.proposals) && Array.isArray(parsed.session.orders)) {
        // Reopening never resumes trading without a fresh explicit start.
        return { ...parsed, session: { ...parsed.session, status: parsed.session.status === "running" ? "paused" : parsed.session.status } };
      }
    }
  } catch { /* Fall back to a fresh isolated workspace. */ }
  return createWorkspace(rules, duration);
}
export function saveWorkspace(id: string, value: Workspace) { localStorage.setItem(workspaceKey(id), JSON.stringify(value)); }
export function approveDefinition(w: Workspace, reason = "Aprovação manual"): Workspace {
  const definition = definitionSchema.parse(w.draft);
  if (w.session.status === "running") throw new Error("Pause a execução antes de aprovar mudanças.");
  const version = (w.versions.at(-1)?.version ?? 0) + 1;
  return { ...w, versions: [...w.versions, { version, definition: { ...definition }, approvedAt: Date.now(), reason }] };
}
export function startDemo(w: Workspace): Workspace {
  const approved = w.versions.at(-1);
  if (!approved) throw new Error("Aprove uma versão antes de iniciar.");
  if (approved.definition.mode !== "demo") throw new Error("Execução real bloqueada: integração e autorização da corretora pendentes.");
  if (JSON.stringify(w.draft) !== JSON.stringify(approved.definition)) throw new Error("O rascunho mudou. Aprove a nova versão antes de iniciar.");
  return { ...w, session: { ...w.session, status: "running" } };
}
export function extractWorkspaceProposal(text: string, w: Workspace): Proposal | null {
  const block = text.match(/<strategy-proposal>\s*([\s\S]*?)\s*<\/strategy-proposal>/i)?.[1];
  if (!block) return null;
  try {
    const body = z.object({ summary: z.string().min(1).max(300), rationale: z.string().min(1).max(1000), patch: proposalPatchSchema }).parse(JSON.parse(block));
    if (!Object.keys(body.patch).length) return null;
    definitionSchema.parse({ ...w.draft, ...body.patch });
    return { ...body, id: crypto.randomUUID(), baseVersion: w.versions.at(-1)?.version ?? 0, createdAt: Date.now(), status: "pending" };
  } catch { return null; }
}
export function acceptProposal(w: Workspace, id: string): Workspace {
  const proposal = w.proposals.find(p => p.id === id);
  if (!proposal || proposal.status !== "pending") throw new Error("Proposta indisponível.");
  if (proposal.baseVersion !== (w.versions.at(-1)?.version ?? 0)) throw new Error("Proposta desatualizada. Peça uma nova análise.");
  const next = approveDefinition({ ...w, draft: definitionSchema.parse({ ...w.draft, ...proposal.patch }) }, proposal.summary);
  return { ...next, proposals: next.proposals.map(p => p.id === id ? { ...p, status: "accepted" } : p) };
}
// Deterministic synthetic quotes: never a broker feed or a prediction.
export function demoCandles(time: number): MarketCandle[] {
  const end = Math.floor(time / 1000);
  return Array.from({ length: 121 }, (_, index) => {
    const t = end - 120 + index;
    const quote = (s: number) => 1.12 + Math.sin(s / 13) * 0.001 + Math.sin(s / 3) * 0.00015;
    const o = quote(t - 1), c = quote(t);
    return { o, c, h: Math.max(o, c) + 0.00002, l: Math.min(o, c) - 0.00002, time: t };
  });
}
export function evaluateSignal(d: Definition, candles: MarketCandle[]): { signal: Decision["signal"]; reason: string } {
  const last = candles.at(-1), before = candles.at(-2);
  if (!last || !before || candles.length < d.period + 1) return { signal: "WAIT", reason: "Velas insuficientes" };
  if (d.signal === "momentum") {
    const first = candles.at(-d.period);
    const change = last.c - (first?.c ?? last.c);
    return { signal: change > 0 ? "CALL" : change < 0 ? "PUT" : "WAIT", reason: `Momentum de ${d.period} velas: ${change.toFixed(6)}` };
  }
  const ma = calculateMovingAverage(candles, { period: d.period, type: "EMA", color: "", thickness: 1 });
  const currentMA = ma.at(-1), previousMA = ma.at(-2);
  if (currentMA === undefined || previousMA === undefined) return { signal: "WAIT", reason: "Aguardando EMA" };
  const signal = before.c <= previousMA && last.c > currentMA ? "CALL" : before.c >= previousMA && last.c < currentMA ? "PUT" : "WAIT";
  return { signal, reason: signal === "WAIT" ? "Sem cruzamento da EMA" : `Cruzamento da EMA ${d.period}` };
}
export function tickDemo(w: Workspace, time: number): Workspace {
  const candles = demoCandles(time), price = candles.at(-1)?.c;
  if (price === undefined) return w;
  let balance = w.session.balance;
  const orders = w.session.orders.map(order => {
    const settled = settleOrder(order, demoCandles(order.expiresAt).at(-1)?.c ?? price, time);
    if (order.status !== "closed" && settled.status === "closed") balance += order.amt + (settled.result ?? 0);
    return { ...settled, strategyVersion: order.strategyVersion };
  });
  let next: Workspace = { ...w, session: { ...w.session, orders, balance: Number(balance.toFixed(2)) } };
  const approved = w.versions.at(-1);
  if (w.session.status !== "running" || !approved) return next;
  if (approved.definition.mode !== "demo") return { ...next, session: { ...next.session, status: "paused" } };
  if (time - w.session.lastTick < approved.definition.duration * 1000 || orders.some(o => o.status === "open")) return next;
  const d = approved.definition;
  const rules = { ...defaultRules, account: "Demo", entry: d.entry, stopWin: d.stopWin, stopLoss: d.stopLoss, simultaneous: false };
  const amount = entryAmount(rules, next.session.balance, orders);
  const block = tradeBlock(rules, orders, amount, next.session.balance, w.session.initial);
  const result = block ? { signal: "WAIT" as const, reason: block } : evaluateSignal(d, candles);
  next = { ...next, session: { ...next.session, lastTick: time, status: block ? "paused" : "running", decisions: [...next.session.decisions, { ...result, time, version: approved.version }].slice(-200) } };
  if (result.signal === "WAIT") return next;
  return { ...next, session: { ...next.session, balance: Number((next.session.balance - amount).toFixed(2)), orders: [...orders, { id: crypto.randomUUID(), asset: "EUR/USD · simulado", dir: result.signal === "CALL" ? "up" : "down", price, amt: amount, openedAt: time, expiresAt: time + d.duration * 1000, status: "open", strategyVersion: approved.version }] } };
}
export function backtest(d: Definition, endTime: number, count = 100) {
  let pnl = 0, wins = 0, trades = 0;
  for (let i = count; i > 0; i--) {
    const time = endTime - i * d.duration * 1000;
    const result = evaluateSignal(d, demoCandles(time));
    if (result.signal === "WAIT") continue;
    const price = demoCandles(time).at(-1)?.c, close = demoCandles(time + d.duration * 1000).at(-1)?.c;
    if (price === undefined || close === undefined) continue;
    const win = result.signal === "CALL" ? close > price : close < price;
    pnl += price === close ? 0 : win ? d.entry * 0.86 : -d.entry;
    wins += win ? 1 : 0; trades++;
  }
  return { pnl: Number(pnl.toFixed(2)), wins, trades };
}