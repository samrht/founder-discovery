import { describe, it, expect } from "vitest";
import { decide } from "./decide";
import { EvaluationResult } from "./evaluate";
import { DEFAULT_CONFIG } from "@/lib/config";

function evalWith(scores: Record<string, number>, whyNow: string | null): EvaluationResult {
  const s = (n: number) => ({ score: n, evidence: n > 0 ? [`evidence ${n}`] : [] });
  return {
    summary: "s", observedFacts: [], inferences: [],
    scores: {
      pain: s(scores.pain ?? 0), timing: s(scores.timing ?? 0), stageFit: s(scores.stageFit ?? 3),
      budget: s(scores.budget ?? 0), reachability: s(scores.reachability ?? 3), geography: s(scores.geography ?? 3),
    },
    whyNow, risks: [], missingInformation: [], overallConfidence: "Medium",
  };
}
const cfg = DEFAULT_CONFIG; // pursue: 3.5, maybeLater: 2.5

describe("decide", () => {
  it("PURSUE_NOW: strong scores + whyNow", () => {
    const r = decide(evalWith({ pain: 5, timing: 5, stageFit: 4, budget: 3, reachability: 4, geography: 4 }, "Fundraising next month"), cfg);
    expect(r.decision).toBe("PURSUE_NOW");
    expect(r.reason).toContain("Fundraising next month");
  });
  it("PURSUE: strong scores, no whyNow", () => {
    const r = decide(evalWith({ pain: 5, timing: 4, stageFit: 4, budget: 3, reachability: 4, geography: 4 }, null), cfg);
    expect(r.decision).toBe("PURSUE");
  });
  it("MAYBE_LATER: middling weighted score", () => {
    const r = decide(evalWith({ pain: 3, timing: 3, stageFit: 3, budget: 2, reachability: 3, geography: 3 }, null), cfg);
    expect(r.decision).toBe("MAYBE_LATER");
  });
  it("REJECTED: weak weighted score", () => {
    const r = decide(evalWith({ pain: 1, timing: 1 }, null), cfg);
    expect(r.decision).toBe("REJECTED");
  });
  it("hard gate: stageFit 0 rejects regardless of other scores", () => {
    const r = decide(evalWith({ pain: 5, timing: 5, stageFit: 0, budget: 5, reachability: 5, geography: 5 }, "now"), cfg);
    expect(r.decision).toBe("REJECTED");
  });
  it("reason cites top dimensions and weighted score", () => {
    const r = decide(evalWith({ pain: 5, timing: 4, stageFit: 4, budget: 3, reachability: 4, geography: 4 }, null), cfg);
    expect(r.reason).toMatch(/pain 5/);
    expect(r.reason).toMatch(/\d\.\d/);
  });
});
