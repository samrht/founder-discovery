import { AppConfig } from "@/lib/config";
import { RawLead } from "../types";

export interface HnHit {
  objectID: string;
  title: string;
  story_text: string | null;
  author: string;
  created_at_i: number;
  points: number;
  num_comments: number;
}

// Free, no-auth Algolia HN search API (hn.algolia.com/api)
const HN_API = "https://hn.algolia.com/api/v1/search_by_date";
const DAYS_BACK = 7;

export async function collectHn(cfg: AppConfig): Promise<RawLead[]> {
  const since = Math.floor(Date.now() / 1000) - DAYS_BACK * 86400;
  const out: RawLead[] = [];
  for (const tag of ["ask_hn", "show_hn"]) {
    const url = `${HN_API}?tags=${tag}&hitsPerPage=${cfg.hnMaxPerRun}&numericFilters=created_at_i>${since}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`HN ${tag} fetch failed: ${res.status}`);
      continue;
    }
    const json = (await res.json()) as { hits?: HnHit[] };
    for (const hit of json.hits ?? []) {
      out.push({
        source: "hn",
        sourceId: hit.objectID,
        url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
        payload: hit,
      });
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return out;
}
