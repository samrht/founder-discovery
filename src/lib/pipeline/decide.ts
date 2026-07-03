import { AppConfig } from "../config";
import { DIMENSIONS, EvaluationResult } from "./evaluate";

export type Decision = "PURSUE_NOW" | "PURSUE" | "MAYBE_LATER" | "REJECTED";

export function decide(ev: EvaluationResult, cfg: AppConfig): { decision: Decision; weighted: number; reason: string } {
  const w = cfg.weights;
  const totalWeight = DIMENSIONS.reduce((a, d) => a + w[d], 0);
  const weighted = DIMENSIONS.reduce((a, d) => a + w[d] * ev.scores[d].score, 0) / totalWeight;
  const rounded = Math.round(weighted * 10) / 10;

  const top = [...DIMENSIONS]
    .sort((a, b) => ev.scores[b].score - ev.scores[a].score)
    .slice(0, 2)
    .map((d) => `${d} ${ev.scores[d].score} (${ev.scores[d].evidence[0] ?? "no evidence"})`)
    .join("; ");

  let decision: Decision;
  if (ev.scores.stageFit.score === 0) decision = "REJECTED";
  else if (weighted < cfg.thresholds.maybeLater) decision = "REJECTED";
  else if (weighted < cfg.thresholds.pursue) decision = "MAYBE_LATER";
  else decision = ev.whyNow ? "PURSUE_NOW" : "PURSUE";

  const why = ev.whyNow ? ` Why now: ${ev.whyNow}` : " No why-now trigger.";
  const reason =
    decision === "REJECTED" && ev.scores.stageFit.score === 0
      ? `Rejected: stage fit is 0 (hard gate). Weighted ${rounded}/5.`
      : `Weighted ${rounded}/5 — ${top}.${why}`;

  return { decision, weighted: rounded, reason };
}
