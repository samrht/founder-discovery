import { describe, it, expect } from "vitest";
import { disqualify } from "./disqualify";
import { FounderProfile, UNKNOWN } from "../sources/types";

const base: FounderProfile = {
  founderName: "A", company: "B", website: UNKNOWN, source: "reddit", sourceId: "1",
  sourceUrl: "", location: UNKNOWN, stage: UNKNOWN, teamSize: UNKNOWN, funding: UNKNOWN,
  revenue: UNKNOWN, recentActivity: UNKNOWN, painSignals: [], timingSignals: [],
  reachability: UNKNOWN, confidence: "Low", channel: "REDDIT_DM", activityAt: null,
  rawText: "We are a small startup figuring out our market.",
};

describe("disqualify", () => {
  it("passes a normal early-stage profile", () => {
    expect(disqualify(base)).toBeNull();
  });
  it("rejects raised Series A+", () => {
    expect(disqualify({ ...base, rawText: "We just closed our Series B led by Index." })).toMatch(/Series/i);
  });
  it("does NOT reject aspirational Series A talk (that's a timing signal)", () => {
    expect(disqualify({ ...base, rawText: "Preparing to raise our Series A next year, confused about market sizing." })).toBeNull();
  });
  it("rejects known team size > 5", () => {
    expect(disqualify({ ...base, teamSize: 12 })).toMatch(/team/i);
  });
  it("rejects consultants selling services", () => {
    expect(disqualify({ ...base, rawText: "In my consulting business I help founders with GTM. DM me for my agency's packages." })).toMatch(/consultant/i);
  });
  it("rejects student projects", () => {
    expect(disqualify({ ...base, rawText: "Building this for my university class project." })).toMatch(/student/i);
  });
  it("rejects explicit Series A+ stage field", () => {
    expect(disqualify({ ...base, stage: "Series B" })).toMatch(/Series/i);
  });
});
