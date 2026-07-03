import { describe, it, expect } from "vitest";
import { parseFormD, filterFormD, FormDFiling } from "./collector";
import { normalizeFormD } from "./normalizer";

const xml = `<?xml version="1.0"?>
<edgarSubmission>
  <primaryIssuer>
    <entityName>Acme Robotics Inc.</entityName>
    <issuerAddress>
      <city>Austin</city>
      <stateOrCountry>TX</stateOrCountry>
    </issuerAddress>
  </primaryIssuer>
  <relatedPersonsList>
    <relatedPersonInfo>
      <relatedPersonName><firstName>Jane</firstName><lastName>Doe</lastName></relatedPersonName>
      <relatedPersonRelationshipList><relationship>Executive Officer</relationship></relatedPersonRelationshipList>
    </relatedPersonInfo>
    <relatedPersonInfo>
      <relatedPersonName><firstName>N/A</firstName><lastName>Acme GP LLC</lastName></relatedPersonName>
      <relatedPersonRelationshipList><relationship>Director</relationship></relatedPersonRelationshipList>
    </relatedPersonInfo>
  </relatedPersonsList>
  <offeringData>
    <industryGroup><industryGroupType>Other Technology</industryGroupType></industryGroup>
    <typeOfFiling><dateOfFirstSale><value>2026-06-28</value></dateOfFirstSale></typeOfFiling>
    <offeringSalesAmounts><totalAmountSold>750000</totalAmountSold></offeringSalesAmounts>
  </offeringData>
</edgarSubmission>`;

const filing = parseFormD(xml, "0001-26-000001", "https://www.sec.gov/x-index.htm");

describe("parseFormD", () => {
  it("extracts issuer, industry, state, amount, date, officers", () => {
    expect(filing.entityName).toBe("Acme Robotics Inc.");
    expect(filing.industryGroup).toBe("Other Technology");
    expect(filing.state).toBe("TX");
    expect(filing.amountSold).toBe(750000);
    expect(filing.dateOfFirstSale).toBe("2026-06-28");
    expect(filing.officers).toEqual(["Jane Doe", "Acme GP LLC"]);
  });
});

describe("filterFormD", () => {
  it("accepts a small US operating-company raise", () => {
    expect(filterFormD(filing)).toBe(true);
  });
  it("rejects pooled funds, fund-named entities, non-US, zero or huge raises", () => {
    expect(filterFormD({ ...filing, industryGroup: "Pooled Investment Fund" })).toBe(false);
    expect(filterFormD({ ...filing, entityName: "Stonepeak Credit Fund II LP" })).toBe(false);
    expect(filterFormD({ ...filing, entityName: "NEA CH 2026 II SPV, L.P." })).toBe(false);
    expect(filterFormD({ ...filing, state: "ON" })).toBe(false);
    expect(filterFormD({ ...filing, amountSold: 0 })).toBe(false);
    expect(filterFormD({ ...filing, amountSold: 50_000_000 })).toBe(false);
  });
});

describe("normalizeFormD", () => {
  it("maps filing to FounderProfile with funding and timing signals", () => {
    const p = normalizeFormD({ source: "edgar", sourceId: filing.accession, url: filing.filingUrl, payload: filing })!;
    expect(p.founderName).toBe("Jane Doe");
    expect(p.company).toBe("Acme Robotics Inc.");
    expect(p.location).toBe("TX, USA");
    expect(p.funding).toContain("$750,000");
    expect(p.timingSignals[0]).toContain("Form D");
    expect(p.channel).toBe("EMAIL");
    expect(p.rawText).toContain("Other Technology");
  });
});
