import { describe, it, expect } from "vitest";
import { buildEvaluationPrompt, evaluateLead, EvaluationResult } from "./evaluate";
import { FounderProfile, UNKNOWN } from "../sources/types";

const profile: FounderProfile = {
  founderName: "founder_jane", company: UNKNOWN, website: UNKNOWN, source: "reddit",
  sourceId: "1abc", sourceUrl: "https://reddit.com/x", location: UNKNOWN, stage: UNKNOWN,
  teamSize: UNKNOWN, funding: UNKNOWN, revenue: UNKNOWN, recentActivity: "Posted in r/startups",
  painSignals: [], timingSignals: [], reachability: "Active public poster on Reddit",
  confidence: "Low", channel: "REDDIT_DM", activityAt: null,
  rawText: "Title: Struggling to size my market\nBody: no idea who my competitors are",
};

const fake: EvaluationResult = {
  summary: "Solo founder confused about competitors.",
  observedFacts: ["Posted asking about competitors"],
  inferences: [{ text: "Likely pre-seed", confidence: "Medium" }],
  scores: {
    pain: { score: 5, evidence: ["'no idea who my competitors are'"] },
    timing: { score: 3, evidence: ["Active question this week"] },
    stageFit: { score: 3, evidence: [] },
    budget: { score: 1, evidence: [] },
    reachability: { score: 4, evidence: ["Active poster"] },
    geography: { score: 0, evidence: [] },
  },
  whyNow: "Asked yesterday",
  risks: ["Geography unknown"],
  missingInformation: ["Funding unknown", "Geography unknown"],
  overallConfidence: "Medium",
};

describe("buildEvaluationPrompt", () => {
  it("includes profile evidence and core rules", () => {
    const p = buildEvaluationPrompt(profile);
    expect(p).toContain("no idea who my competitors are");
    expect(p).toContain("Unknown");            // uncertainty handling rule present
    expect(p).toMatch(/precision.*recall/is);  // north star present
  });
});

describe("evaluateLead", () => {
  it("returns schema-validated result", async () => {
    const r = await evaluateLead(profile, async () => JSON.stringify(fake));
    expect(r.scores.pain.score).toBe(5);
    expect(r.whyNow).toBe("Asked yesterday");
  });
  it("rejects out-of-range scores", async () => {
    const bad = { ...fake, scores: { ...fake.scores, pain: { score: 9, evidence: [] } } };
    await expect(evaluateLead(profile, async () => JSON.stringify(bad))).rejects.toThrow();
  });
});
