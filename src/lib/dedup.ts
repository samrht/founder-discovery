import { FounderProfile, UNKNOWN } from "./sources/types";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function dedupKey(p: FounderProfile): string {
  const name = p.founderName === UNKNOWN ? "" : norm(p.founderName);
  const company = p.company === UNKNOWN ? "" : norm(p.company);
  if (!name && !company) return `${p.source}::${p.sourceId}`;
  return `${name}::${company}`;
}
