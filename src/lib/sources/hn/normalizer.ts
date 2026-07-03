import { FounderProfile, RawLead, UNKNOWN } from "../types";
import { HnHit } from "./collector";

const MIN_BODY = 80;

function stripHtml(html: string): string {
  return html
    .replace(/<p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&")
    .trim();
}

export function normalizeHnStory(raw: RawLead): FounderProfile | null {
  const h = raw.payload as HnHit;
  if (!h.author) return null;
  const body = h.story_text ? stripHtml(h.story_text) : "";
  if (body.length < MIN_BODY) return null;
  return {
    founderName: h.author,
    company: UNKNOWN,
    website: UNKNOWN,
    source: "hn",
    sourceId: h.objectID,
    sourceUrl: raw.url,
    location: UNKNOWN,
    stage: UNKNOWN,
    teamSize: UNKNOWN,
    funding: UNKNOWN,
    revenue: UNKNOWN,
    recentActivity: `Posted on Hacker News (${h.points} points, ${h.num_comments} comments)`,
    painSignals: [],
    timingSignals: [],
    reachability: "Active poster on Hacker News",
    confidence: "Low",
    channel: "EMAIL",
    rawText: `Title: ${h.title}\nBody: ${body}`,
  };
}
