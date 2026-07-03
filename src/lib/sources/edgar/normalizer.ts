import { FounderProfile, RawLead, UNKNOWN } from "../types";
import { FormDFiling } from "./collector";

const fmtUsd = (n: number) => "$" + n.toLocaleString("en-US");

export function normalizeFormD(raw: RawLead): FounderProfile | null {
  const f = raw.payload as FormDFiling;
  if (!f.entityName) return null;
  return {
    founderName: f.officers[0] ?? UNKNOWN,
    company: f.entityName,
    website: UNKNOWN,
    source: "edgar",
    sourceId: f.accession,
    sourceUrl: f.filingUrl,
    location: `${f.state}, USA`,
    stage: UNKNOWN,
    teamSize: UNKNOWN,
    funding: `${fmtUsd(f.amountSold)} raised (SEC Form D)`,
    revenue: UNKNOWN,
    recentActivity: `Filed SEC Form D${f.dateOfFirstSale ? ` (first sale ${f.dateOfFirstSale})` : ""}`,
    painSignals: [],
    timingSignals: [`Just filed Form D for a ${fmtUsd(f.amountSold)} raise`],
    reachability: UNKNOWN,
    confidence: "Medium",
    channel: "EMAIL",
    activityAt: f.dateOfFirstSale ? new Date(f.dateOfFirstSale).toISOString() : null,
    rawText: [
      `Company: ${f.entityName}`,
      `Industry: ${f.industryGroup}`,
      `State: ${f.state}`,
      `Amount sold: ${fmtUsd(f.amountSold)}`,
      f.dateOfFirstSale ? `Date of first sale: ${f.dateOfFirstSale}` : null,
      f.officers.length ? `Officers/directors: ${f.officers.join(", ")}` : null,
      `Signal: recently raised a small round (filed SEC Form D), likely making market/positioning decisions.`,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}
