import { getConfig } from "./config";
import { prisma } from "./db";
import { dedupKey } from "./dedup";
import { disqualify } from "./pipeline/disqualify";
import { collectReddit } from "./sources/reddit/collector";
import { normalizeRedditPost } from "./sources/reddit/normalizer";
import { FounderProfile, RawLead } from "./sources/types";
import { collectYc } from "./sources/yc/collector";
import { normalizeYcCompany } from "./sources/yc/normalizer";
import { collectHn } from "./sources/hn/collector";
import { normalizeHnStory } from "./sources/hn/normalizer";

export interface SourceRunner {
  collect: () => Promise<RawLead[]>;
  normalize: (raw: RawLead) => FounderProfile | null;
}

export interface CollectSummary {
  fetched: number;
  skipped: number;
  duplicates: number;
  disqualified: number;
  added: number;
  errors: string[];
}

async function defaultRunners(): Promise<SourceRunner[]> {
  const cfg = await getConfig();
  return [
    { collect: () => collectReddit(cfg.subreddits, cfg.redditLimitPerSub), normalize: normalizeRedditPost },
    { collect: () => collectYc(cfg), normalize: (r) => normalizeYcCompany(r) },
    { collect: () => collectHn(cfg), normalize: normalizeHnStory },
  ];
}

export async function runCollect(runners?: SourceRunner[]): Promise<CollectSummary> {
  const list = runners ?? (await defaultRunners());
  const s: CollectSummary = { fetched: 0, skipped: 0, duplicates: 0, disqualified: 0, added: 0, errors: [] };
  for (const runner of list) {
    let raws: RawLead[] = [];
    try {
      raws = await runner.collect();
    } catch (e) {
      s.errors.push(String(e));
      continue;
    }
    for (const raw of raws) {
      s.fetched++;
      try {
        const existing = await prisma.lead.findUnique({
          where: { source_sourceId: { source: raw.source, sourceId: raw.sourceId } },
        });
        if (existing) {
          s.duplicates++;
          continue;
        }
        const profile = runner.normalize(raw);
        if (!profile) {
          s.skipped++;
          continue;
        }
        const key = dedupKey(profile);
        if (!key.startsWith(`${raw.source}::`) && (await prisma.lead.findFirst({ where: { dedupKey: key } }))) {
          s.duplicates++;
          continue;
        }
        const reason = disqualify(profile);
        await prisma.lead.create({
          data: {
            source: profile.source,
            sourceId: profile.sourceId,
            sourceUrl: profile.sourceUrl,
            dedupKey: key,
            channel: profile.channel,
            status: reason ? "DISQUALIFIED" : "NEW",
            disqualifyReason: reason,
            profile: JSON.stringify(profile),
            rawPayload: JSON.stringify(raw.payload),
          },
        });
        if (reason) s.disqualified++;
        else s.added++;
      } catch (e) {
        s.errors.push(`${raw.source}:${raw.sourceId}: ${String(e)}`);
      }
    }
  }
  return s;
}
