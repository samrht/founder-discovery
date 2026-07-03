# Founder Discovery & Lead Scoring

Local Next.js app that collects founders from Reddit, YC Launches, and Hacker News (Ask HN / Show HN), scores them against the Clarity Research ideal-client profile (six weighted dimensions, evidence per score, precision over recall), and produces human-reviewed outreach drafts. Nothing auto-sends: every draft is edited, approved, copied, and sent manually. The behavior source of truth is [`docs/product-spec.md`](docs/product-spec.md).

## Setup

1. `npm i`
2. Copy `.env.example` → `.env` and fill in:
   - **Reddit** (optional — HN and YC work without it): create a *script* app at [reddit.com/prefs/apps](https://www.reddit.com/prefs/apps) → `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, plus your `REDDIT_USERNAME`, `REDDIT_PASSWORD`, and a descriptive `REDDIT_USER_AGENT`. Note: Reddit may refuse app creation on new accounts; the collector logs the auth error and the other sources still run.
   - **Gemini**: free-tier key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey) → `GEMINI_API_KEY` (model defaults to `GEMINI_MODEL=gemini-2.5-flash`).
3. `npx prisma db push` — creates the local SQLite database.
4. `npm run dev` — app at [http://localhost:3000](http://localhost:3000).

## Daily usage

1. **Collect** — pulls new posts/companies from the configured subreddits and YC batches, normalizes them into founder profiles, dedupes, and applies the immediate disqualifiers.
2. **Score** — runs the LLM evaluation (facts vs. inferences, six dimension scores with evidence, Why Now check) and renders a decision: Pursue Immediately, Pursue, Maybe Later, or Reject.
3. Review dossiers from the queue — every lead shows its full scoring breakdown, evidence, risks, and missing information.
4. On a Pursue lead: **Generate draft** → edit the message → **Approve** → **Copy message** → send it yourself (Reddit DM or email) → **Mark sent**.
5. Anything that doesn't hold up on reading: **Reject**.

Maybe Later leads stay in the queue for a future pass. Drafts are only generated for Pursue leads, and only after the outreach strategy (hook → outcome → CTA) is decided — never the other way around.

## Calibration

Don't trust the ranking until it's been checked against reality (see the spec's Calibration section):

1. Collect and score 15–20 **real** leads.
2. Read the ranked output and ask of each top lead: *would this founder plausibly pay this month?* — not "do they seem smart or interesting."
3. Where the ranking disagrees with your judgment, adjust the scoring weights and decision thresholds in **Settings** (weights should sum to ~1; decisions use the weighted score out of 5).
4. Re-score and re-check. Repeat until the top of the queue matches who you'd actually contact this week.

Pricing text also lives in Settings — it's injected into drafts at runtime and never hardcoded; leave it empty and drafts won't mention price.

## Commands

- `npm run dev` — dev server
- `npm test` — unit tests (Vitest)
- `npm run build` — production build
- `npx prisma studio` — inspect the local database
