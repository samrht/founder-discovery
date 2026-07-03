import { AppConfig } from "@/lib/config";
import { RawLead } from "../types";

export interface YcCompany {
  id: number;
  name: string;
  slug: string;
  website: string;
  one_liner: string;
  long_description: string;
  team_size: number | null;
  all_locations: string;
  batch: string;
  status: string;
  stage: string;
  url: string;
}

const US_UK = /USA|United States|United Kingdom|London|New York|San Francisco|Remote/i;

export function filterYcCompany(c: YcCompany, cfg: AppConfig): boolean {
  return (
    c.status === "Active" &&
    typeof c.team_size === "number" && c.team_size >= 1 && c.team_size <= 5 &&
    US_UK.test(c.all_locations) &&
    cfg.ycBatches.includes(c.batch)
  );
}

// Free daily-updated static dump of the YC directory (github.com/yc-oss/api)
const YC_ALL = "https://yc-oss.github.io/api/companies/all.json";

export async function collectYc(cfg: AppConfig): Promise<RawLead[]> {
  const res = await fetch(YC_ALL);
  if (!res.ok) throw new Error(`YC fetch failed: ${res.status}`);
  const companies = (await res.json()) as YcCompany[];
  return companies
    .filter((c) => filterYcCompany(c, cfg))
    .slice(0, cfg.ycMaxPerRun)
    .map((c) => ({ source: "yc" as const, sourceId: c.slug, url: c.url, payload: c }));
}
