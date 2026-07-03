import { describe, it, expect } from "vitest";
import { HnHit } from "./collector";
import { normalizeHnStory } from "./normalizer";

const hit: HnHit = {
  objectID: "48775562",
  title: "Ask HN: How do I size the market for my dev-tools startup?",
  story_text:
    "We&#x27;re a team of 3 building a CI analytics tool.<p>Raised a small angel round. I&#x27;m preparing our seed deck and I have no idea how big our market actually is or who the real competitors are.",
  author: "founder123",
  created_at_i: 1751500000,
  points: 12,
  num_comments: 4,
};

const raw = { source: "hn" as const, sourceId: hit.objectID, url: `https://news.ycombinator.com/item?id=${hit.objectID}`, payload: hit };

describe("normalizeHnStory", () => {
  it("maps to FounderProfile with EMAIL channel and HN reachability", () => {
    const p = normalizeHnStory(raw);
    expect(p).not.toBeNull();
    expect(p!.founderName).toBe("founder123");
    expect(p!.source).toBe("hn");
    expect(p!.sourceId).toBe("48775562");
    expect(p!.sourceUrl).toBe("https://news.ycombinator.com/item?id=48775562");
    expect(p!.channel).toBe("EMAIL");
    expect(p!.reachability).toContain("Hacker News");
  });

  it("strips HTML and decodes entities into rawText", () => {
    const p = normalizeHnStory(raw)!;
    expect(p.rawText).toContain("We're a team of 3");
    expect(p.rawText).not.toContain("<p>");
    expect(p.rawText).not.toContain("&#x27;");
    expect(p.rawText).toContain(hit.title);
  });

  it("rejects stories without enough body text", () => {
    expect(normalizeHnStory({ ...raw, payload: { ...hit, story_text: null } })).toBeNull();
    expect(normalizeHnStory({ ...raw, payload: { ...hit, story_text: "too short" } })).toBeNull();
  });

  it("rejects stories without an author", () => {
    expect(normalizeHnStory({ ...raw, payload: { ...hit, author: "" } })).toBeNull();
  });
});
