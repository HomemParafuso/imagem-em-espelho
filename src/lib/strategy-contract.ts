import { defaultRules, type Rules } from "@/lib/trading";

export type StrategyMode = "demo" | "real";
export type StrategyStatus = "draft" | "approved" | "paused";

export type StrategyContract = {
  id: string;
  name: string;
  version: number;
  status: StrategyStatus;
  mode: StrategyMode;
  asset: string;
  rules: Rules;
  indicators: string[];
  createdAt: number;
  updatedAt: number;
  approvedAt?: number;
};

export type StrategyProposal = {
  id: string;
  strategyId: string;
  baseVersion: number;
  summary: string;
  rationale: string;
  changes: string[];
  sourceThreadId?: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: number;
};

export type ModelDecision = {
  model: string;
  decision: "CALL" | "PUT" | "WAIT";
  confidence: number;
  evidence: string[];
  risks: string[];
  createdAt: number;
};

export type StrategyStore = {
  active: StrategyContract;
  proposals: StrategyProposal[];
  decisions: ModelDecision[];
};

export const STRATEGY_STORE_KEY = "tradex-strategy-v1";

export function createDefaultStrategy(rules: Rules = defaultRules): StrategyContract {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name: "Estratégia principal",
    version: 1,
    status: "draft",
    mode: rules.account.toLowerCase() === "real" ? "real" : "demo",
    asset: "EUR/USD (OTC)",
    rules: { ...rules },
    indicators: ["Suporte e resistência"],
    createdAt: now,
    updatedAt: now,
  };
}

export function loadStrategyStore(rules: Rules = defaultRules): StrategyStore {
  try {
    const raw = localStorage.getItem(STRATEGY_STORE_KEY);
    if (!raw) return { active: createDefaultStrategy(rules), proposals: [], decisions: [] };
    const parsed: unknown = JSON.parse(raw);
    if (!isStrategyStore(parsed))
      return { active: createDefaultStrategy(rules), proposals: [], decisions: [] };
    return parsed;
  } catch {
    return { active: createDefaultStrategy(rules), proposals: [], decisions: [] };
  }
}

export function saveStrategyStore(store: StrategyStore): void {
  try {
    localStorage.setItem(STRATEGY_STORE_KEY, JSON.stringify(store));
  } catch {
    // The in-memory store remains usable when browser storage is unavailable.
  }
}

export function syncStrategyRules(strategy: StrategyContract, rules: Rules): StrategyContract {
  return {
    ...strategy,
    mode: rules.account.toLowerCase() === "real" ? "real" : "demo",
    rules: { ...rules },
    updatedAt: Date.now(),
  };
}

export function extractStrategyProposal(
  text: string,
  strategy: StrategyContract,
  sourceThreadId: string,
): StrategyProposal | null {
  const match = text.match(/<strategy-proposal>\s*([\s\S]*?)\s*<\/strategy-proposal>/i);
  if (!match?.[1]) return null;
  try {
    const parsed: unknown = JSON.parse(match[1]);
    if (!isProposalBody(parsed)) return null;
    return {
      id: crypto.randomUUID(),
      strategyId: strategy.id,
      baseVersion: strategy.version,
      summary: parsed["summary"],
      rationale: parsed["rationale"],
      changes: parsed["changes"],
      sourceThreadId,
      status: "pending",
      createdAt: Date.now(),
    };
  } catch {
    return null;
  }
}

function isStrategyStore(value: unknown): value is StrategyStore {
  if (typeof value !== "object" || value === null) return false;
  const store = value as Record<string, unknown>;
  const active = store["active"];
  if (typeof active !== "object" || active === null) return false;
  const contract = active as Record<string, unknown>;
  return (
    typeof contract["id"] === "string" &&
    typeof contract["name"] === "string" &&
    typeof contract["version"] === "number" &&
    Array.isArray(store["proposals"]) &&
    Array.isArray(store["decisions"])
  );
}

function isProposalBody(
  value: unknown,
): value is { summary: string; rationale: string; changes: string[] } {
  if (typeof value !== "object" || value === null) return false;
  const body = value as Record<string, unknown>;
  return (
    typeof body["summary"] === "string" &&
    typeof body["rationale"] === "string" &&
    Array.isArray(body["changes"]) &&
    body["changes"].every((change): change is string => typeof change === "string")
  );
}
