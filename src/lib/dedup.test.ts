import { describe, it, expect } from "vitest";
import { dedupKey } from "./dedup";
import { FounderProfile, UNKNOWN } from "./sources/types";

const base: FounderProfile = {
  founderName: "Jane Doe", company: "Acme AI", website: UNKNOWN, source: "reddit",
  sourceId: "abc", sourceUrl: "https://reddit.com/x", location: UNKNOWN, stage: UNKNOWN,
  teamSize: UNKNOWN, funding: UNKNOWN, revenue: UNKNOWN, recentActivity: UNKNOWN,
  painSignals: [], timingSignals: [], reachability: UNKNOWN, confidence: "Low",
  channel: "REDDIT_DM", activityAt: null, rawText: "",
};

describe("dedupKey", () => {
  it("normalizes case and punctuation", () => {
    expect(dedupKey(base)).toBe(dedupKey({ ...base, founderName: "jane doe!", company: "ACME-ai" }));
  });
  it("falls back to source id when name and company unknown", () => {
    const k = dedupKey({ ...base, founderName: UNKNOWN, company: UNKNOWN });
    expect(k).toBe("reddit::abc");
  });
});
