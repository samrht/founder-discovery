import { z } from "zod";
import { generateJson } from "../gemini";
import { FounderProfile } from "../sources/types";

export const DIMENSIONS = ["pain", "timing", "stageFit", "budget", "reachability", "geography"] as const;
export type Dimension = (typeof DIMENSIONS)[number];

const DimScoreSchema = z.object({ score: z.number().int().min(0).max(5), evidence: z.array(z.string()) });
export type DimScore = z.infer<typeof DimScoreSchema>;

const ConfidenceSchema = z.enum(["High", "Medium", "Low"]);

export const REPORT_SECTIONS = [
  "Competitor Analysis",
  "Positioning",
  "GTM",
  "Market Validation",
  "Market Sizing",
  "Pricing",
] as const;

export const SnapshotSchema = z.object({
  problem: z.string(),
  biggestCompetitor: z.string(),
  biggestOpportunity: z.string(),
  suggestedHook: z.string(),
});
export type Snapshot = z.infer<typeof SnapshotSchema>;

export const ReportValueSchema = z.object({
  stars: z.number().int().min(1).max(5),
  sections: z.array(z.enum(REPORT_SECTIONS)),
  reason: z.string(),
});
export type ReportValue = z.infer<typeof ReportValueSchema>;

export const EvaluationSchema = z.object({
  summary: z.string(),
  observedFacts: z.array(z.string()),
  inferences: z.array(z.object({ text: z.string(), confidence: ConfidenceSchema })),
  scores: z.object({
    pain: DimScoreSchema, timing: DimScoreSchema, stageFit: DimScoreSchema,
    budget: DimScoreSchema, reachability: DimScoreSchema, geography: DimScoreSchema,
  }),
  whyNow: z.string().nullable(),
  risks: z.array(z.string()),
  missingInformation: z.array(z.string()),
  overallConfidence: ConfidenceSchema,
  snapshot: SnapshotSchema.nullish(),
  reportValue: ReportValueSchema.nullish(),
});
export type EvaluationResult = z.infer<typeof EvaluationSchema>;

const RULES = `
You evaluate startup founders as potential buyers of Clarity Research's competitive intelligence and market research reports.

North star: precision over recall. A false positive is worse than a false negative. When in doubt, score low.

Evidence discipline:
- observedFacts: only things literally present in the evidence below. Never inferred.
- inferences: conclusions drawn from facts, each tagged High/Medium/Low confidence. Never present an inference as a fact.
- If evidence is insufficient for a field or dimension, do not guess: use low scores, empty evidence arrays, and list the gap in missingInformation. "Unknown" is always better than a wrong guess.

Score each dimension 0-5. Every score MUST cite its evidence (quotes or specific facts from the input). No evidence = score 0-1.
- pain: explicit confusion/questions about competitors, market size, positioning; recent pivot talk.
- timing: an active decision point right now - fundraising prep, deck in progress, market entry, launch week.
- stageFit: pre-seed/seed, team of 1-5.
- budget: raised funding, has revenue, or explicit spend/outsourcing language.
- reachability: active real account, replies, not a throwaway.
- geography: confirmed US or UK. Unconfirmed = 0-1.

whyNow: one sentence answering "why contact this founder THIS WEEK", only if a concrete trigger exists (launched this week, fundraising next month, competitor just funded, actively asking questions in the last days). Vague signals ("seems to be growing") are NOT a whyNow - return null instead.

snapshot: a 30-second brief a salesperson reads before opening the full profile. Keep each field to one short sentence; use "Unknown" where the evidence doesn't say.
- problem: what the founder is struggling with right now
- biggestCompetitor: the named or most likely competitor they face
- biggestOpportunity: the clearest opening for them in their market
- suggestedHook: the one angle an outreach message should lead with, drawn from the strongest evidence

reportValue: whether a Clarity Research report can genuinely help this founder.
- stars: 1-5 (5 = report directly answers a question they are asking right now; 1 = no plausible use)
- sections: which report sections would help, chosen ONLY from ["Competitor Analysis","Positioning","GTM","Market Validation","Market Sizing","Pricing"]
- reason: one sentence grounded in the evidence explaining the rating

Ideal client: solo founder or team 2-5, pre-Series A, US/UK, actively building/fundraising/deciding, no in-house research capacity, some ability to pay.

Return ONLY JSON matching exactly this shape:
{"summary": string, "observedFacts": string[], "inferences": [{"text": string, "confidence": "High"|"Medium"|"Low"}], "scores": {"pain"|"timing"|"stageFit"|"budget"|"reachability"|"geography": {"score": 0-5 integer, "evidence": string[]}}, "whyNow": string|null, "risks": string[], "missingInformation": string[], "overallConfidence": "High"|"Medium"|"Low", "snapshot": {"problem": string, "biggestCompetitor": string, "biggestOpportunity": string, "suggestedHook": string}, "reportValue": {"stars": 1-5 integer, "sections": string[], "reason": string}}
`;

export function buildEvaluationPrompt(profile: FounderProfile): string {
  const { rawText, ...fields } = profile;
  return `${RULES}\n\nKnown profile fields (from the source, treat as observed facts):\n${JSON.stringify(fields, null, 2)}\n\nEvidence text:\n"""\n${rawText}\n"""`;
}

export async function evaluateLead(
  profile: FounderProfile,
  call?: (p: string) => Promise<string>,
): Promise<EvaluationResult> {
  return generateJson(buildEvaluationPrompt(profile), EvaluationSchema, call);
}
