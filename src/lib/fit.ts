import { AppConfig } from "./config";
import { DIMENSIONS, EvaluationResult } from "./pipeline/evaluate";

// Clarity Fit: the weighted 0-5 score presented as 0-100 with human-readable reasons.
export function fitScore(weighted: number): number {
  return Math.round(Math.min(5, Math.max(0, weighted)) * 20);
}

const DIMENSION_LABELS: Record<(typeof DIMENSIONS)[number], string> = {
  pain: "Pain signal",
  timing: "Active decision point",
  stageFit: "Stage fit",
  budget: "Likely has budget",
  reachability: "Reachable",
  geography: "US/UK based",
};

export function fitReasons(ev: Pick<EvaluationResult, "scores" | "whyNow">, cfg: AppConfig): string[] {
  const reasons: string[] = [];
  if (ev.whyNow) reasons.push(ev.whyNow);
  const ranked = [...DIMENSIONS].sort((a, b) => cfg.weights[b] - cfg.weights[a]);
  for (const d of ranked) {
    const s = ev.scores[d];
    if (s.score >= 3) {
      const detail = s.evidence[0] ? `: ${s.evidence[0]}` : "";
      reasons.push(`${DIMENSION_LABELS[d]} (${s.score}/5)${detail}`);
    }
  }
  return reasons;
}

// Freshness: founders making decisions NOW are worth more than three-week-old posts.
export type Freshness = { bucket: "green" | "yellow" | "red" | "unknown"; label: string };

export function freshness(activityAt: string | Date | null | undefined, now: Date = new Date()): Freshness {
  if (!activityAt) return { bucket: "unknown", label: "Activity date unknown" };
  const at = typeof activityAt === "string" ? new Date(activityAt) : activityAt;
  if (isNaN(at.getTime())) return { bucket: "unknown", label: "Activity date unknown" };
  const days = Math.floor((now.getTime() - at.getTime()) / 86_400_000);
  const label =
    days <= 0 ? "Posted today" : days === 1 ? "Posted yesterday" : days < 14 ? `${days} days ago` : `${Math.floor(days / 7)} weeks ago`;
  if (days <= 2) return { bucket: "green", label };
  if (days <= 7) return { bucket: "yellow", label };
  return { bucket: "red", label };
}
