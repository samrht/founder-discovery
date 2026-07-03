import { FounderProfile, RawLead, UNKNOWN } from "../types";
import { YcCompany } from "./collector";

export function normalizeYcCompany(raw: RawLead): FounderProfile {
  const c = raw.payload as YcCompany;
  return {
    founderName: UNKNOWN, // YC public dump has no founder names; user finds them at outreach time
    company: c.name,
    website: c.website || UNKNOWN,
    source: "yc",
    sourceId: c.slug,
    sourceUrl: raw.url,
    location: c.all_locations || UNKNOWN,
    stage: `Pre-seed/Seed (YC ${c.batch})`,
    teamSize: typeof c.team_size === "number" ? c.team_size : UNKNOWN,
    funding: "YC-backed (standard deal)",
    revenue: UNKNOWN,
    recentActivity: `YC ${c.batch} company`,
    painSignals: [],
    timingSignals: [],
    reachability: UNKNOWN,
    confidence: "Medium",
    channel: "EMAIL",
    rawText: `Company: ${c.name}\nOne-liner: ${c.one_liner}\nDescription: ${c.long_description}\nLocation: ${c.all_locations}\nTeam size: ${c.team_size}\nBatch: ${c.batch}`,
  };
}
