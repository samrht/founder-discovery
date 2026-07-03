import { describe, it, expect } from "vitest";
import { normalizeRedditPost } from "./normalizer";
import { RawLead } from "../types";

function raw(overrides: Partial<{ id: string; title: string; selftext: string; author: string; subreddit: string; permalink: string }> = {}): RawLead {
  const data = {
    id: "1abc", title: "Struggling to size my market",
    selftext: "Solo founder of a B2B SaaS. I have 20 paying customers but no idea who my real competitors are. Preparing a pre-seed raise and my deck's market slide is guesswork. How do you all figure out TAM without paying $20k?",
    author: "founder_jane", subreddit: "startups", permalink: "/r/startups/comments/1abc/x/",
    ...overrides,
  };
  return { source: "reddit", sourceId: data.id, url: `https://www.reddit.com${data.permalink}`, payload: data };
}

describe("normalizeRedditPost", () => {
  it("maps a text post to a FounderProfile", () => {
    const p = normalizeRedditPost(raw());
    expect(p).not.toBeNull();
    expect(p!.founderName).toBe("founder_jane");
    expect(p!.channel).toBe("REDDIT_DM");
    expect(p!.source).toBe("reddit");
    expect(p!.rawText).toContain("Struggling to size my market");
    expect(p!.rawText).toContain("TAM");
    expect(p!.company).toBe("Unknown");
  });
  it("skips posts with short or missing body", () => {
    expect(normalizeRedditPost(raw({ selftext: "" }))).toBeNull();
    expect(normalizeRedditPost(raw({ selftext: "link post lol" }))).toBeNull();
  });
  it("skips deleted authors", () => {
    expect(normalizeRedditPost(raw({ author: "[deleted]" }))).toBeNull();
  });
});
