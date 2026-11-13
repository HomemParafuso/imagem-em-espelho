import { beforeEach, describe, expect, it } from "vitest";
import { acceptProposal, approveDefinition, backtest, createWorkspace, extractWorkspaceProposal, loadWorkspace, saveWorkspace, startDemo, tickDemo } from "@/lib/strategy-workspace";

describe("conversation strategy safeguards", () => {
  beforeEach(() => localStorage.clear());
  it("isolates contracts and results per conversation", () => {
    const first = createWorkspace(); first.draft.entry = 25;
    saveWorkspace("first", first); saveWorkspace("second", createWorkspace());
    expect(loadWorkspace("first").draft.entry).toBe(25);
    expect(loadWorkspace("second").draft.entry).toBe(12);
  });
  it("requires an approved version before execution", () => {
    expect(() => startDemo(createWorkspace())).toThrow();
  });
  it("blocks real execution even after approval", () => {
    const w = createWorkspace(); w.draft.mode = "real";
    expect(() => startDemo(approveDefinition(w))).toThrow(/real bloqueada/);
  });
  it("rejects changed drafts until explicitly approved", () => {
    const w = approveDefinition(createWorkspace()); w.draft.entry = 30;
    expect(() => startDemo(w)).toThrow(/rascunho mudou/);
    expect(w.versions[0]?.definition.entry).toBe(12);
  });
  it("does not resume automatically after reopening", () => {
    saveWorkspace("first", startDemo(approveDefinition(createWorkspace())));
    expect(loadWorkspace("first").session.status).toBe("paused");
  });
  it("creates and settles isolated demo orders with 86 percent payout", () => {
    const w = createWorkspace(); w.draft.duration = 5;
    const opened = tickDemo(startDemo(approveDefinition(w)), 1000000);
    expect(opened.session.orders).toHaveLength(1);
    expect(opened.session.balance).toBe(9988);
    const settled = tickDemo({ ...opened, session: { ...opened.session, status: "paused" } }, 1005000);
    const order = settled.session.orders[0];
    expect(order?.status).toBe("closed");
    const win = order?.dir === "up" ? (order.closePrice ?? 0) > order.price : (order?.closePrice ?? 0) < (order?.price ?? 0);
    expect(order?.result).toBe(win ? 10.32 : -12);
    expect(settled.session.balance).toBe(win ? 10010.32 : 9988);
    expect(settled.session.orders).toHaveLength(1);
  });
  it("pauses at stop loss and opens no further orders", () => {
    const w = createWorkspace(); w.draft.stopLoss = 5;
    const running = startDemo(approveDefinition(w));
    running.session.orders = [{ id: "loss", asset: "demo", dir: "up", price: 1, amt: 12, openedAt: 1, expiresAt: 2, closedAt: 2, result: -12, status: "closed", strategyVersion: 1 }];
    const next = tickDemo(running, 1000000);
    expect(next.session.status).toBe("paused");
    expect(next.session.orders).toHaveLength(1);
  });
  it("records proposals without changing the contract and applies only explicit approval", () => {
    const w = approveDefinition(createWorkspace());
    const p = extractWorkspaceProposal('<strategy-proposal>{"summary":"Entrada menor","rationale":"Reduzir risco","patch":{"entry":5}}</strategy-proposal>', w);
    expect(p?.status).toBe("pending"); expect(w.draft.entry).toBe(12);
    if (!p) throw new Error("Expected proposal");
    const next = acceptProposal({ ...w, proposals: [p] }, p.id);
    expect(next.draft.entry).toBe(5); expect(next.versions.at(-1)?.version).toBe(2);
    expect(next.versions[0]?.definition.entry).toBe(12);
  });
  it("rejects stale proposals and changing contracts during execution", () => {
    const w = approveDefinition(createWorkspace());
    const p = extractWorkspaceProposal('<strategy-proposal>{"summary":"Ajuste","rationale":"Teste","patch":{"period":7}}</strategy-proposal>', w);
    if (!p) throw new Error("Expected proposal");
    expect(() => acceptProposal({ ...startDemo(w), proposals: [p] }, p.id)).toThrow(/Pause/);
    expect(() => acceptProposal({ ...approveDefinition(w), proposals: [p] }, p.id)).toThrow(/desatualizada/);
  });
  it("rejects unsupported formulas and invalid duration limits", () => {
    const w = createWorkspace();
    expect(extractWorkspaceProposal('<strategy-proposal>{"summary":"Ajuste","rationale":"Teste","patch":{"duration":4}}</strategy-proposal>', w)).toBeNull();
    expect(extractWorkspaceProposal('<strategy-proposal>{"summary":"Ajuste","rationale":"Teste","patch":{"signal":"unknown"}}</strategy-proposal>', w)).toBeNull();
    w.draft.duration = 3601;
    expect(() => approveDefinition(w)).toThrow();
  });
  it("compares synthetic results deterministically without changing the workspace", () => {
    const w = createWorkspace();
    expect(backtest(w.draft, 1000000)).toEqual(backtest(w.draft, 1000000));
    expect(w.session.orders).toHaveLength(0);
  });
});