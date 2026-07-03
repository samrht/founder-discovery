import { AppConfig } from "@/lib/config";
import { RawLead } from "../types";

export interface FormDFiling {
  accession: string;
  entityName: string;
  industryGroup: string;
  state: string;
  amountSold: number;
  dateOfFirstSale: string | null;
  officers: string[];
  filingUrl: string;
}

const UA = () => process.env.EDGAR_USER_AGENT ?? "founder-discovery research smarthshokeen08@gmail.com";
const FEED =
  "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=D&company=&dateb=&owner=include&count=40&output=atom";

const US_STATES = new Set(
  "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" "),
);
const MAX_RAISE = 10_000_000; // Series A+ raises are disqualified anyway; skip early

const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1] ?? "";

export function parseFormD(xml: string, accession: string, filingUrl: string): FormDFiling {
  const officers: string[] = [];
  for (const block of xml.match(/<relatedPersonInfo>[\s\S]*?<\/relatedPersonInfo>/g) ?? []) {
    const first = tag(block, "firstName");
    const last = tag(block, "lastName");
    const name = `${first} ${last}`.replace(/\bN\/A\b/g, "").trim();
    if (name) officers.push(name);
  }
  return {
    accession,
    entityName: tag(xml, "entityName"),
    industryGroup: tag(xml, "industryGroupType"),
    state: xml.match(/<issuerAddress>[\s\S]*?<stateOrCountry>([^<]*)<\/stateOrCountry>/)?.[1] ?? "",
    amountSold: Number(tag(xml, "totalAmountSold")) || 0,
    dateOfFirstSale: xml.match(/<dateOfFirstSale>[\s\S]*?<value>([^<]*)<\/value>/)?.[1] ?? null,
    officers,
    filingUrl,
  };
}

export function filterFormD(f: FormDFiling): boolean {
  return (
    f.entityName.length > 0 &&
    !/pooled investment fund/i.test(f.industryGroup) &&
    !/\b(fund|capital|partners|holdings|spv|feeder)\b/i.test(f.entityName) &&
    US_STATES.has(f.state) &&
    f.amountSold > 0 &&
    f.amountSold <= MAX_RAISE
  );
}

async function fetchXml(folder: string): Promise<string | null> {
  const direct = await fetch(folder + "primary_doc.xml", { headers: { "User-Agent": UA() } });
  if (direct.ok) return direct.text();
  const idx = await fetch(folder + "index.json", { headers: { "User-Agent": UA() } });
  if (!idx.ok) return null;
  const json = (await idx.json()) as { directory?: { item?: Array<{ name: string }> } };
  const xmlFile = json.directory?.item?.find((i) => i.name.endsWith(".xml") && !i.name.startsWith("R"));
  if (!xmlFile) return null;
  const res = await fetch(folder + xmlFile.name, { headers: { "User-Agent": UA() } });
  return res.ok ? res.text() : null;
}

export async function collectEdgar(cfg: AppConfig): Promise<RawLead[]> {
  const res = await fetch(FEED, { headers: { "User-Agent": UA() } });
  if (!res.ok) throw new Error(`EDGAR feed failed: ${res.status}`);
  const atom = await res.text();
  const links = [...atom.matchAll(/<link[^>]+href="([^"]+-index\.htm)"/g)].map((m) => m[1]);
  const out: RawLead[] = [];
  for (const link of links) {
    if (out.length >= cfg.edgarMaxPerRun) break;
    const folder = link.replace(/[^/]+-index\.htm$/, "");
    const accession = link.match(/(\d{10}-?\d{2}-?\d{6})-index\.htm$/)?.[1] ?? folder;
    try {
      const xml = await fetchXml(folder);
      if (!xml) continue;
      const filing = parseFormD(xml, accession, link);
      if (filterFormD(filing)) {
        out.push({ source: "edgar", sourceId: filing.accession, url: filing.filingUrl, payload: filing });
      }
    } catch {
      continue; // one bad filing must not kill the run
    }
    await new Promise((r) => setTimeout(r, 150)); // SEC fair-access: stay well under 10 req/s
  }
  return out;
}
