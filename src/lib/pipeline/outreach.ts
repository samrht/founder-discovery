import { z } from "zod";
import { AppConfig } from "../config";
import { generateJson } from "../gemini";
import { FounderProfile } from "../sources/types";
import { EvaluationResult } from "./evaluate";

export const DraftSchema = z.object({
  primaryHook: z.enum(["Competition", "Fundraising", "Positioning", "Market Entry", "Pricing", "Expansion", "Pivot"]),
  desiredOutcome: z.string(),
  callToAction: z.string(),
  message: z.string(),
});
export type DraftResult = z.infer<typeof DraftSchema>;

export function buildOutreachPrompt(profile: FounderProfile, ev: EvaluationResult, cfg: AppConfig): string {
  const channel =
    profile.channel === "REDDIT_DM"
      ? "a Reddit DM: casual, under 80 words, references their post naturally, no subject line"
      : "a cold email: under 120 words, include a subject line as the first line ('Subject: ...')";
  const pricing = cfg.pricing
    ? `If price comes up naturally, pricing is: ${cfg.pricing}`
    : "Pricing is not set: do not mention price at all.";
  return `
You write outreach for Smarth, founder of Clarity Research (competitive intelligence and market research reports for early-stage founders).

Work strictly in this order:
1. primaryHook — pick exactly ONE angle (Competition, Fundraising, Positioning, Market Entry, Pricing, Expansion, Pivot) from the STRONGEST evidence below.
2. desiredOutcome — what this message should make the founder do or feel (e.g. reply with interest, ask for the sample report, book a call).
3. callToAction — the single concrete next step in the message, matched to the desiredOutcome.
4. message — written LAST, built only around the locked hook/outcome/CTA.

Message rules:
- Written as if Smarth personally read their post/profile and did the research himself.
- Never mention AI, automation, tools, or systems. Never sound templated.
- Reference their specific situation using the evidence (quote or paraphrase their own words).
- ${channel}
- ${pricing}
- One CTA only. No links unless essential. No flattery filler.

Founder profile:
${JSON.stringify({ founderName: profile.founderName, company: profile.company, source: profile.source, channel: profile.channel }, null, 2)}

Evaluation evidence:
Summary: ${ev.summary}
Observed facts: ${JSON.stringify(ev.observedFacts)}
Why now: ${ev.whyNow ?? "none"}
Top signals: ${JSON.stringify(ev.scores)}

Return ONLY JSON: {"primaryHook": ..., "desiredOutcome": ..., "callToAction": ..., "message": ...}
`;
}

export async function generateOutreach(
  profile: FounderProfile,
  ev: EvaluationResult,
  cfg: AppConfig,
  call?: (p: string) => Promise<string>,
): Promise<DraftResult> {
  return generateJson(buildOutreachPrompt(profile, ev, cfg), DraftSchema, call);
}
