import { FounderProfile, UNKNOWN } from "../sources/types";

interface Rule {
  reason: string;
  test: (p: FounderProfile) => boolean;
}

const RULES: Rule[] = [
  {
    reason: "Series A+ (stage field)",
    test: (p) => p.stage !== UNKNOWN && /series [a-e]|growth/i.test(p.stage),
  },
  {
    reason: "Raised Series A or later",
    // only past-tense raises disqualify; "preparing/planning to raise" is a timing signal
    test: (p) => /\b(closed|raised|announced|completed)\b[^.]{0,40}\bseries [a-e]\b/i.test(p.rawText),
  },
  {
    reason: "Team size above 5",
    test: (p) => p.teamSize !== UNKNOWN && p.teamSize > 5,
  },
  {
    reason: "Consultant selling services",
    test: (p) => /(my|our) (consulting|agency)\b/i.test(p.rawText) && /\bI (help|offer|coach)\b|DM me/i.test(p.rawText),
  },
  {
    reason: "Student project",
    test: (p) => /\b(university|college|school|class) project\b|\bstudent project\b|for my (class|course)\b/i.test(p.rawText),
  },
];

export function disqualify(p: FounderProfile): string | null {
  for (const rule of RULES) if (rule.test(p)) return rule.reason;
  return null;
}
