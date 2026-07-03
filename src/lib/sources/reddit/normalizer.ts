import { FounderProfile, RawLead, UNKNOWN } from "../types";

interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  author: string;
  subreddit: string;
  permalink: string;
  created_utc?: number;
}

const MIN_BODY = 80;

export function normalizeRedditPost(raw: RawLead): FounderProfile | null {
  const d = raw.payload as RedditPost;
  if (!d.selftext || d.selftext.length < MIN_BODY) return null;
  if (!d.author || d.author === "[deleted]") return null;
  return {
    founderName: d.author,
    company: UNKNOWN,
    website: UNKNOWN,
    source: "reddit",
    sourceId: d.id,
    sourceUrl: raw.url,
    location: UNKNOWN,
    stage: UNKNOWN,
    teamSize: UNKNOWN,
    funding: UNKNOWN,
    revenue: UNKNOWN,
    recentActivity: `Posted in r/${d.subreddit}`,
    painSignals: [],
    timingSignals: [],
    reachability: "Active public poster on Reddit",
    confidence: "Low",
    channel: "REDDIT_DM",
    activityAt: d.created_utc ? new Date(d.created_utc * 1000).toISOString() : null,
    rawText: `Title: ${d.title}\nSubreddit: r/${d.subreddit}\nBody: ${d.selftext}`,
  };
}
