// Outreach outcomes for the learning loop: recorded per lead, aggregated on the
// queue page so scoring weights can be calibrated against what actually converts.
export const OUTCOMES = ["NO_REPLY", "INTERESTED", "BOOKED_CALL", "CLIENT", "WRONG_ICP"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export const OUTCOME_LABELS: Record<Outcome, string> = {
  NO_REPLY: "No reply",
  INTERESTED: "Interested",
  BOOKED_CALL: "Booked call",
  CLIENT: "Client",
  WRONG_ICP: "Wrong ICP",
};
