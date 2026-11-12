import { beforeEach, describe, expect, it } from "vitest";
import {
  createDefaultStrategy,
  extractStrategyProposal,
  loadStrategyStore,
  saveStrategyStore,
  syncStrategyRules,
} from "@/lib/strategy-contract";
import { defaultRules } from "@/lib/trading";

describe("strategy contracts", () => {
  beforeEach(() => localStorage.clear());

  it("creates a demo strategy from the current rules", () => {
    const strategy = createDefaultStrategy();
    expect(strategy.version).toBe(1);
    expect(strategy.mode).toBe("demo");
    expect(strategy.rules.entry).toBe(defaultRules.entry);
  });

  it("persists and reloads the active strategy without losing proposals", () => {
    const strategy = createDefaultStrategy();
    const store = { active: strategy, proposals: [], decisions: [] };
    saveStrategyStore(store);
    expect(loadStrategyStore().active.id).toBe(strategy.id);
  });

  it("synchronizes rule changes and never changes the strategy version implicitly", () => {
    const strategy = createDefaultStrategy();
    const updated = syncStrategyRules(strategy, { ...defaultRules, entry: 25, account: "Real" });
    expect(updated.version).toBe(1);
    expect(updated.mode).toBe("real");
    expect(updated.rules.entry).toBe(25);
  });

  it("registers only a valid structured proposal as pending", () => {
    const strategy = createDefaultStrategy();
    const proposal = extractStrategyProposal(
      'texto <strategy-proposal>{"summary":"Ajustar EMA","rationale":"Mais confirmação","changes":["Período 21"]}</strategy-proposal>',
      strategy,
      "thread-1",
    );
    expect(proposal?.status).toBe("pending");
    expect(proposal?.sourceThreadId).toBe("thread-1");
    expect(extractStrategyProposal("sem proposta", strategy, "thread-1")).toBeNull();
  });
});
