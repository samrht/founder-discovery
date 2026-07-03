import { describe, it, expect } from "vitest";
import { filterYcCompany, YcCompany } from "./collector";
import { normalizeYcCompany } from "./normalizer";
import { DEFAULT_CONFIG } from "@/lib/config";

const company: YcCompany = {
  id: 9001, name: "Acme AI", slug: "acme-ai", website: "https://acme.ai",
  one_liner: "Competitive intel for plumbers", long_description: "Acme helps plumbing SMBs see local competitors.",
  team_size: 2, all_locations: "New York, NY, USA", batch: "Winter 2026",
  status: "Active", stage: "Early Stage", url: "https://www.ycombinator.com/companies/acme-ai",
};
const cfg = { ...DEFAULT_CONFIG, ycBatches: ["Winter 2026"] };

describe("filterYcCompany", () => {
  it("accepts active, small, US/UK, configured batch", () => {
    expect(filterYcCompany(company, cfg)).toBe(true);
  });
  it("rejects inactive / big team / wrong geo / other batch", () => {
    expect(filterYcCompany({ ...company, status: "Inactive" }, cfg)).toBe(false);
    expect(filterYcCompany({ ...company, team_size: 9 }, cfg)).toBe(false);
    expect(filterYcCompany({ ...company, all_locations: "Berlin, Germany" }, cfg)).toBe(false);
    expect(filterYcCompany({ ...company, batch: "Summer 2020" }, cfg)).toBe(false);
  });
});

describe("normalizeYcCompany", () => {
  it("maps to FounderProfile with EMAIL channel", () => {
    const p = normalizeYcCompany({ source: "yc", sourceId: "acme-ai", url: company.url, payload: company });
    expect(p.company).toBe("Acme AI");
    expect(p.channel).toBe("EMAIL");
    expect(p.teamSize).toBe(2);
    expect(p.founderName).toBe("Unknown");
    expect(p.stage).toContain("Winter 2026");
    expect(p.rawText).toContain("Competitive intel");
  });
});
