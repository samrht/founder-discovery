import { describe, it, expect } from "vitest";
import { buildOutreachPrompt, generateOutreach, DraftResult } from "./outreach";
import { FounderProfile, UNKNOWN } from "../sources/types";
import { EvaluationResult } from "./evaluate";
import { DEFAULT_CONFIG } from "@/lib/config";

const profile: FounderProfile = {
  founderName: "founder_jane", company: UNKNOWN, website: UNKNOWN, source: "reddit",
  sourceId: "1abc", sourceUrl: "u", location: UNKNOWN, stage: UNKNOWN, teamSize: UNKNOWN,
  funding: UNKNOWN, revenue: UNKNOWN, recentActivity: UNKNOWN, painSignals: [], timingSignals: [],
  reachability: UNKNOWN, confidence: "Low", channel: "REDDIT_DM", activityAt: null,
  rawText: "Body: no idea who my competitors are",
};
const ev: EvaluationResult = {
  summary: "s", observedFacts: ["Asked about competitors"], inferences: [],
  scores: {
    pain: { score: 5, evidence: ["quote"] }, timing: { score: 4, evidence: [] },
    stageFit: { score: 4, evidence: [] }, budget: { score: 2, evidence: [] },
    reachability: { score: 4, evidence: [] }, geography: { score: 3, evidence: [] },
  },
  whyNow: "Asked yesterday", risks: [], missingInformation: [], overallConfidence: "Medium",
};
const fake: DraftResult = { primaryHook: "Competition", desiredOutcome: "Reply with interest", callToAction: "Reply and I'll send a sample", message: "Hey â€” saw your post about competitors..." };

describe("buildOutreachPrompt", () => {
  it("includes channel format, evidence, and no-AI rule", () => {
    const p = buildOutreachPrompt(profile, ev, DEFAULT_CONFIG);
    expect(p).toMatch(/Reddit DM/i);
    expect(p).toContain("Asked about competitors");
    expect(p).toMatch(/never mention AI/i);
  });
  it("includes pricing only when configured", () => {
    expect(buildOutreachPrompt(profile, ev, DEFAULT_CONFIG)).toMatch(/do not mention price/i);
    expect(buildOutreachPrompt(profile, ev, { ...DEFAULT_CONFIG, pricing: "$299 per report" })).toContain("$299 per report");
  });
});

describe("generateOutreach", () => {
  it("returns schema-validated draft", async () => {
    const d = await generateOutreach(profile, ev, DEFAULT_CONFIG, async () => JSON.stringify(fake));
    expect(d.primaryHook).toBe("Competition");
  });
  it("rejects invalid hook", async () => {
    await expect(generateOutreach(profile, ev, DEFAULT_CONFIG, async () => JSON.stringify({ ...fake, primaryHook: "Vibes" }))).rejects.toThrow();
  });
});
