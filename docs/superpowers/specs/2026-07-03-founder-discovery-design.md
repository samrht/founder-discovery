# Founder Discovery & Lead Scoring — Technical Design

Date: 2026-07-03
Product spec (source of truth for behavior): `C:\Users\shoke\Documents\Claude\Projects\analysis\founder_discovery_system_prompt.md`

This document covers the technical design only. Scoring rules, evidence discipline, decision taxonomy, and output format are defined by the product spec and are not restated here.

## Decisions (locked)

| Decision | Choice |
|---|---|
| Interface | Local web dashboard |
| Outreach | Drafts only — human copies and sends manually; nothing auto-sends |
| Hosting | Local-only on Smarth's PC (deploy later if ever needed) |
| Stack | Next.js (App Router, TypeScript), Prisma + SQLite, Tailwind + shadcn/ui |
| LLM | Gemini free tier (`@google/genai`), structured output |
| Sources v1 | Reddit (official free OAuth API: r/startups, r/Entrepreneur, r/SaaS, r/EntrepreneurRideAlong) and YC company directory (public Algolia index) |
| Cost | $0 — no paid services anywhere in v1 |

## Architecture

Single Next.js app. Pipeline code lives in `src/lib`, UI in `src/app`. No separate worker: collection and scoring run inside API route handlers, which is fine locally (no serverless timeouts).

```
src/lib/
  sources/
    types.ts        RawLead + FounderProfile (the spec's Founder Schema)
    reddit/
      collector.ts  fetch new posts from the 4 subreddits (Reddit OAuth API)
      normalizer.ts RawLead -> FounderProfile
    yc/
      collector.ts  query YC public Algolia index (pre-seed/seed filters)
      normalizer.ts RawLead -> FounderProfile
  pipeline/
    disqualify.ts   rule-based Immediate Disqualifiers (no LLM cost)
    research.ts     Gemini: extract Observed Facts / Inferences (+confidence) from evidence
    score.ts        Gemini structured output: 6 dimensions, 0–5, evidence per score, Why Now
    decide.ts       deterministic mapping from scores + Why Now -> Final Decision
    outreach.ts     Gemini: Primary Hook -> Desired Outcome -> CTA -> draft (in that order)
  gemini.ts         client wrapper: model config, retry, JSON schema enforcement
  config.ts         runtime config loader (pricing, weights, thresholds, subreddits)
```

Source-agnostic rule from the spec is enforced structurally: everything after `sources/` consumes only `FounderProfile`. Adding a source = adding a `collector.ts` + `normalizer.ts` pair.

## Data model (Prisma + SQLite)

- **Lead** — normalized FounderProfile fields, `source`, `sourceId` (unique per source), `dedupKey` (normalized founder+company), `status`, `channel` (REDDIT_DM | EMAIL), raw source payload (JSON), timestamps.
- **Evaluation** — one per scoring run: observed facts, inferences (each with confidence), 6 dimension scores with per-score evidence (JSON), Why Now answer, overall confidence, final decision, decision reason, risks, missing information.
- **Draft** — outreach strategy (hook / desired outcome / CTA), message text, edited text, approved flag.
- **Config** — key/value: pricing, scoring weights, decision thresholds, subreddit list. Pricing is never hardcoded (spec requirement).

Status machine: `NEW → DISQUALIFIED | SCORED`, then decision sets `PURSUE_NOW | PURSUE | MAYBE_LATER | REJECTED`, then `APPROVED → SENT` (manually marked). Dedup: unique `(source, sourceId)` plus `dedupKey` check — a founder already in the DB is never re-collected, re-scored, or re-drafted.

## Pipeline flow

1. **Collect** (button-triggered): collectors pull new items, skip anything matching existing `sourceId`/`dedupKey`, insert as `NEW`.
2. **Disqualify**: pure rules over normalized fields + raw text (Series A+ keywords, enterprise, consultant patterns, dead/inactive signals). Ambiguous → survives (LLM sees it next); the LLM scoring step can still reject.
3. **Research + Score**: one Gemini call per lead with a JSON response schema mirroring the spec's output format. `Unknown` is a first-class value; missing evidence feeds Missing Information. Insufficient evidence → low dimension scores per spec ("when in doubt, reject").
4. **Decide**: deterministic in code — configurable weighted threshold + hard gates (e.g., no Why Now ⇒ at best Maybe Later; geography Unknown caps confidence). Keeps decisions auditable and calibration = editing config, not prompts.
5. **Outreach** (Pursue/Pursue-Now only, on demand from the UI): strategy first, then draft, single Gemini call with ordered fields. Reddit leads get DM-format, YC leads email-format.
6. **Review**: human edits/approves in UI, copies text, sends manually, marks SENT.

## Dashboard (pages)

- **Queue** `/` — leads ranked by decision then score, filterable by status/source.
- **Lead detail** `/leads/[id]` — full dossier exactly following the spec's Output Format; buttons: Generate Draft, Approve, Mark Sent, Reject, Copy message, link to Reddit profile / company site.
- **Collect** — button + progress/result summary (X collected, Y duplicates, Z disqualified).
- **Settings** `/settings` — pricing, weights, thresholds, subreddits.

## Error handling

- Collectors: per-item try/catch — one bad post never kills a run; run summary reports failures.
- Gemini: JSON-schema-validated responses (zod), one retry on invalid/ratelimit, then lead stays `NEW` with error noted — never a half-scored lead.
- Rate limits respected: Reddit ≤60 req/min, Gemini free-tier RPM with simple queue + backoff.

## Testing

- Unit tests (Vitest): normalizers (fixture JSON → FounderProfile), disqualify rules, decide logic, dedup key generation.
- LLM steps tested via schema validation of live responses + the spec's own Calibration step (15–20 real leads) as the acceptance test.

## Secrets

`.env.local` (gitignored): `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_REFRESH_TOKEN` (or username/password script-app auth), `GEMINI_API_KEY`.

## Out of scope (v1)

Auto-sending anything, email-address discovery, scheduling/cron, deployment, additional sources (HN, GitHub, Wellfound), multi-user.
