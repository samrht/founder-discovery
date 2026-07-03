import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "./db";
import { runCollect, SourceRunner } from "./ingest";
import { FounderProfile, RawLead, UNKNOWN } from "./sources/types";

function profileFor(raw: RawLead, rawText: string): FounderProfile {
  return {
    founderName: "user_" + raw.sourceId, company: UNKNOWN, website: UNKNOWN, source: raw.source,
    sourceId: raw.sourceId, sourceUrl: raw.url, location: UNKNOWN, stage: UNKNOWN, teamSize: UNKNOWN,
    funding: UNKNOWN, revenue: UNKNOWN, recentActivity: UNKNOWN, painSignals: [], timingSignals: [],
    reachability: UNKNOWN, confidence: "Low", channel: "REDDIT_DM", activityAt: null, rawText,
  };
}
const rawLead = (id: string): RawLead => ({ source: "reddit", sourceId: id, url: `https://r/${id}`, payload: {} });

function runner(items: { id: string; text: string }[]): SourceRunner {
  return {
    collect: async () => items.map((i) => rawLead(i.id)),
    normalize: (raw) => {
      const item = items.find((i) => i.id === raw.sourceId)!;
      return item.text === "" ? null : profileFor(raw, item.text);
    },
  };
}

beforeEach(async () => {
  await prisma.lead.deleteMany();
});

describe("runCollect", () => {
  it("adds new leads, skips nulls, disqualifies by rules", async () => {
    const s = await runCollect([runner([
      { id: "a", text: "figuring out my market" },
      { id: "b", text: "" }, // normalizer skip
      { id: "c", text: "we closed our Series B last week" }, // disqualified
    ])]);
    expect(s).toMatchObject({ fetched: 3, skipped: 1, duplicates: 0, disqualified: 1, added: 1 });
    expect(await prisma.lead.count({ where: { status: "NEW" } })).toBe(1);
    expect(await prisma.lead.count({ where: { status: "DISQUALIFIED" } })).toBe(1);
  });
  it("never re-adds the same sourceId", async () => {
    const r = runner([{ id: "a", text: "hello market" }]);
    await runCollect([r]);
    const s2 = await runCollect([r]);
    expect(s2.duplicates).toBe(1);
    expect(s2.added).toBe(0);
    expect(await prisma.lead.count()).toBe(1);
  });
});
