export type SourceName = "reddit" | "yc" | "hn";
export type Channel = "REDDIT_DM" | "EMAIL";
export type Confidence = "High" | "Medium" | "Low";
export const UNKNOWN = "Unknown" as const;
export type Unk = typeof UNKNOWN;

export interface RawLead {
  source: SourceName;
  sourceId: string;
  url: string;
  payload: unknown;
}

export interface FounderProfile {
  founderName: string | Unk;
  company: string | Unk;
  website: string | Unk;
  source: SourceName;
  sourceId: string;
  sourceUrl: string;
  location: string | Unk;
  stage: string | Unk;
  teamSize: number | Unk;
  funding: string | Unk;
  revenue: string | Unk;
  recentActivity: string | Unk;
  painSignals: string[];
  timingSignals: string[];
  reachability: string | Unk;
  confidence: Confidence;
  channel: Channel;
  rawText: string; // all source text evidence, fed to the LLM
}
