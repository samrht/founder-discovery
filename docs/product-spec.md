# Clarity Research — Founder Discovery & Lead Scoring System

## Purpose

This is a client pipeline, not a networking tool. Find and score founders who are the best-fit buyers for Clarity Research's competitive intelligence and market research reports, faster than manual scrolling. Every outreach message is human-reviewed and written as if Smarth personally researched the founder. Never mention AI, never frame it as automated.

## North Star

The objective is not to find the largest number of founders. The objective is to consistently identify founders who are both likely to benefit from Clarity Research and realistically likely to become paying clients.

Precision is more important than recall. A false positive, a poor-quality lead that looks good on paper, is worse than a false negative, a good lead that got missed. When in doubt, reject.

## Architecture Principle: Source-Agnostic Scoring

The scoring engine must not care where a founder came from. Whether data comes from Reddit, YC, GitHub, Product Hunt, or a future source, evaluation happens the same way. Every source's only job is to normalize raw data into the common Founder Schema below before it reaches the scoring step. Add a new source by writing a new normalizer, not by touching the scorer.

## Founder Schema

The normalized profile every source must map into. Any field can be `Unknown`, see Uncertainty Handling.

- Founder Name
- Company
- Website
- Source
- Location
- Stage
- Team Size
- Funding
- Revenue (if known)
- Recent Activity
- Pain Signals
- Timing Signals
- Reachability
- Confidence

## Sources (v1 scope)

Reddit and YC Launches, evaluated for lead-gen fit:

1. **Reddit** — r/startups, r/Entrepreneur, r/SaaS, r/EntrepreneurRideAlong. Strongest source because founders post their actual pain here: confusion about competitors, market sizing questions, pivot uncertainty. Direct buying signal, not a proxy for one.
2. **YC Launches / company directory** — structured list of qualified pre-seed/seed companies with public profiles. Weaker cold-outreach fit than Reddit, YC founders are well-networked and may treat a low-priced report from an unknown provider as low-signal. Use it to build target lists, expect lower reply rates than Reddit leads.

Deferred: X/Twitter (API paywalled), LinkedIn (TOS-hostile scraping), Crunchbase (paywalled), Product Hunt (too noisy, consumer-skewed, thin founder data).

## Ideal Client Profile

- Solo founder or team of 2 to 5
- Pre-Series A (pre-seed or seed, not Series A+)
- US or UK based
- Actively building, fundraising, or making a market or positioning decision right now
- No in-house research or analyst capacity
- Some ability to pay: raised a small round, has revenue, or explicit spend language

## Immediate Disqualifiers

Reject leads that clearly meet any of the following, before spending scoring effort on them:

- Enterprise company
- Series A+
- Obvious consultant selling services
- Student project
- Dead company
- Inactive founder

## Scoring Model

Six weighted dimensions, 0 to 5 each, output as a full breakdown, never a single composite number. Every dimension score must cite the evidence behind it, see Evidence Discipline below.

1. **Pain signal** — explicit confusion or questions about competitors, market size, positioning, recent pivot talk. Strongest predictor of near-term willingness to pay.
2. **Timing** — an active decision point: fundraising prep, pitch deck in progress, market entry, launch week. See Why Now below.
3. **Stage fit** — pre-seed/seed, team of 1 to 5.
4. **Budget signal** — raised funding, has revenue, or explicit spend or outsourcing language.
5. **Reachability** — active public poster, replies to comments, real account, not a throwaway or dead profile.
6. **Geography fit** — confirmed US or UK based.

## Why Now?

Every qualifying lead needs an answer to one question: why contact this founder this week, not someday. If there's no answer, the lead is a Maybe Later, not a Pursue.

Any of these, on its own, is enough:

- Launched this week
- Fundraising next month
- A direct competitor just announced funding
- Founder was actively asking questions yesterday

Older or vaguer signals ("seems like a growing company") don't count as Why Now, they belong in Stage fit or Budget signal instead.

## Evidence Discipline

Separate observed facts from inferred conclusions at every step. Never present an inference as a fact.

Example:

Observed:
- Founder posted asking about competitors.
- Team of 3.
- Raised $500k.

Inference:
- Likely preparing for fundraising.
- Competitive positioning appears important.

Confidence: High / Medium / Low, attached to every inference and to the overall lead.

Every score in the Scoring Breakdown carries its own evidence:

Pain Score: 5
Evidence:
- Reddit post: "I'm struggling to understand our competitors."
- Asked about TAM.
- Mentioned pivot.

## Uncertainty Handling

If the evidence is insufficient, do not guess. Return `Unknown`. Unknown is preferable to an incorrect inference, and it feeds directly into the Missing Information field so the gap is visible, not hidden behind a confident-sounding guess.

## Final Decision

Every evaluated founder gets exactly one of:

- **Pursue Immediately** — strong fit, clear Why Now, act this week.
- **Pursue** — strong fit, no urgent trigger yet, queue for outreach.
- **Maybe Later** — decent fit but missing a Why Now or key evidence, revisit later.
- **Reject** — fails Immediate Disqualifiers or scores too low on fit.

Always state the reason in one or two sentences, referencing the specific scores and evidence that drove it, not a vibe.

## Calibration

Run the model against 15 to 20 real leads before trusting it. Check whether the ranked output actually matches founders who would plausibly pay this month, not just people who seem smart or interesting. Adjust weights against that check.

## Workflow

1. **Collect** raw founder data from Reddit + YC Launches.
2. **Normalize** into the Founder Schema, source-agnostic from this point on.
3. **Disqualify** — apply Immediate Disqualifiers, drop clear non-fits before deeper research.
4. **Research** the survivors: what they build, team size, funding, recent posts and pain signals, timing, reachability. Record as Observed Facts, mark anything unclear as Unknown.
5. **Build structured profile** — Observed Facts and Inferences kept separate, each inference tagged with a confidence level.
6. **Score** using the Scoring Model, full breakdown with evidence per dimension, including a Why Now check.
7. **Decide** — render the Final Decision with a one to two sentence reason.
8. **Determine Outreach Strategy** — Pursue Immediately and Pursue leads only. Maybe Later gets logged for a future pass, Reject stops here.
9. **Generate Email** — only after the outreach strategy is decided, never before.
10. **Human review** — every message read and approved before sending.
11. **Send.**

## Output Format (per founder)

- Founder
- Company
- Source
- Summary
- Observed Facts
- Inferences
- Scoring Breakdown
- Why Now
- Reasons
- Risks
- Confidence
- Final Decision
- Outreach Strategy (Primary Hook, Desired Outcome, Call to Action)
- Email Draft
- Missing Information

Example Missing Information block:

Missing:
- Funding unknown
- Team size unknown
- Geography unknown

## Outreach Strategy

Strategy comes before writing, always in this order, never skip straight to the email:

```
Determine Outreach Strategy
      ↓
  Generate Email
```

And "Determine Outreach Strategy" itself is a sequence, not a single step:

```
Primary Hook
      ↓
Desired Outcome
      ↓
Call to Action
      ↓
    Email
```

- **Primary Hook** — the one angle the message is built around: Competition, Fundraising, Positioning, Market Entry, Pricing, Expansion, or Pivot. Pick exactly one, drawn from the strongest evidence in the profile.
- **Desired Outcome** — what this specific email should make the founder do or feel: reply with interest, ask for the sample report, book a call.
- **Call to Action** — the concrete, single next step stated in the email, matched to the Desired Outcome.
- **Email** — written last, only after the above three are locked, as if Smarth did the research himself.

## Pricing

Pricing comes from runtime configuration. Never hardcode price points into the scoring or outreach logic.

## Later / not v1

GitHub, Wellfound, Hacker News as additional sources, plugged in as new normalizers per the source-agnostic architecture. X and LinkedIn once free or low-risk access exists.
