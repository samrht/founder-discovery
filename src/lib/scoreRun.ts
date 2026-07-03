import { getConfig } from "./config";
import { prisma } from "./db";
import { decide } from "./pipeline/decide";
import { evaluateLead } from "./pipeline/evaluate";
import { FounderProfile } from "./sources/types";

export interface ScoreSummary {
  scored: number;
  byDecision: Record<string, number>;
  errors: string[];
}

export async function runScoring(): Promise<ScoreSummary> {
  const cfg = await getConfig();
  const leads = await prisma.lead.findMany({
    where: { status: "NEW" },
    orderBy: { createdAt: "asc" },
    take: cfg.scoreBatchSize,
  });
  const s: ScoreSummary = { scored: 0, byDecision: {}, errors: [] };
  for (const lead of leads) {
    try {
      const profile = JSON.parse(lead.profile) as FounderProfile;
      const ev = await evaluateLead(profile);
      const { decision, weighted, reason } = decide(ev, cfg);
      await prisma.$transaction([
        prisma.evaluation.create({
          data: {
            leadId: lead.id,
            summary: ev.summary,
            observedFacts: JSON.stringify(ev.observedFacts),
            inferences: JSON.stringify(ev.inferences),
            scores: JSON.stringify(ev.scores),
            whyNow: ev.whyNow,
            risks: JSON.stringify(ev.risks),
            missingInfo: JSON.stringify(ev.missingInformation),
            overallConfidence: ev.overallConfidence,
            weighted,
            decision,
            reason,
          },
        }),
        prisma.lead.update({ where: { id: lead.id }, data: { status: decision, error: null } }),
      ]);
      s.scored++;
      s.byDecision[decision] = (s.byDecision[decision] ?? 0) + 1;
      await new Promise((r) => setTimeout(r, 6500)); // Gemini free tier ~10 RPM
    } catch (e) {
      s.errors.push(`${lead.id}: ${String(e)}`);
      await prisma.lead.update({ where: { id: lead.id }, data: { error: String(e) } }); // stays NEW for retry
    }
  }
  return s;
}
