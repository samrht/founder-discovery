import { describe, it, expect } from "vitest";
import { fitScore, fitReasons, freshness } from "./fit";
import { DEFAULT_CONFIG } from "./config";
import { EvaluationResult } from "./pipeline/evaluate";

describe("fitScore", () => {
  it("maps weighted 0-5 onto 0-100", () => {
    expect(fitScore(0)).toBe(0);
    expect(fitScore(4.55)).toBe(91);
    expect(fitScore(5)).toBe(100);
  });
  it("clamps out-of-range values", () => {
    expect(fitScore(-1)).toBe(0);
    expect(fitScore(9)).toBe(100);
  });
});

const scores: EvaluationResult["scores"] = {
  pain: { score: 5, evidence: ["asked about competitors"] },
  timing: { score: 2, evidence: [] },
  stageFit: { score: 4, evidence: ["team of 3"] },
  budget: { score: 3, evidence: [] },
  reachability: { score: 1, evidence: [] },
  geography: { score: 5, evidence: ["SF, USA"] },
};

describe("fitReasons", () => {
  it("puts whyNow first, then strong dimensions by weight, skipping weak ones", () => {
    const r = fitReasons({ scores, whyNow: "Fundraising next month" }, DEFAULT_CONFIG);
    expect(r[0]).toBe("Fundraising next month");
    expect(r[1]).toContain("Pain signal (5/5)");
    expect(r[1]).toContain("asked about competitors");
    expect(r.some((x) => x.includes("Reachable"))).toBe(false); // score 1 excluded
    expect(r.some((x) => x.includes("Active decision point"))).toBe(false); // score 2 excluded
  });
  it("omits whyNow when null and evidence suffix when empty", () => {
    const r = fitReasons({ scores, whyNow: null }, DEFAULT_CONFIG);
    expect(r[0]).toContain("Pain signal");
    const budget = r.find((x) => x.includes("budget") || x.includes("Likely has budget"))!;
    expect(budget).toBe("Likely has budget (3/5)");
  });
});

describe("freshness", () => {
  const now = new Date("2026-07-04T12:00:00Z");
  it("green within 2 days", () => {
    expect(freshness("2026-07-04T08:00:00Z", now)).toEqual({ bucket: "green", label: "Posted today" });
    expect(freshness("2026-07-03T08:00:00Z", now)).toEqual({ bucket: "green", label: "Posted yesterday" });
  });
  it("yellow within a week", () => {
    expect(freshness("2026-06-30T08:00:00Z", now)).toEqual({ bucket: "yellow", label: "4 days ago" });
  });
  it("red beyond a week, in weeks past 14 days", () => {
    expect(freshness("2026-06-24T08:00:00Z", now).bucket).toBe("red");
    expect(freshness("2026-06-13T08:00:00Z", now)).toEqual({ bucket: "red", label: "3 weeks ago" });
  });
  it("unknown for null or garbage", () => {
    expect(freshness(null, now).bucket).toBe("unknown");
    expect(freshness("not-a-date", now).bucket).toBe("unknown");
  });
});
