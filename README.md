# Founder Discovery & Lead Scoring

A local web app that finds early-stage startup founders who are likely to pay for market research, scores them with evidence, and drafts personalized outreach — so prospecting takes minutes instead of hours of manual scrolling.

## What it does

1. **Collects founders automatically** from four free sources:
   - **Hacker News** — Ask HN / Show HN / Launch HN posts, where founders publicly describe their problems and launches
   - **Y Combinator directory** — active companies from configurable batches, filtered to small teams in the US/UK
   - **SEC Form D filings** — US startups that just legally registered a fundraise (a direct "has budget, deciding things right now" signal), with investment funds filtered out
   - **Reddit** — r/startups, r/Entrepreneur, r/SaaS and more (needs API credentials; the app runs fine without them)
2. **Disqualifies obvious non-fits** with fast rules before spending any AI budget (Series A+, enterprises, consultants, dead companies).
3. **Scores each survivor with AI** across six weighted dimensions — pain, timing, stage fit, budget, reachability, geography — every score backed by quoted evidence, with observed facts kept strictly separate from inferences.
4. **Renders a decision**: Pursue Immediately, Pursue, Maybe Later, or Reject — with a one-line reason. Precision over recall: when in doubt, it rejects.
5. **Drafts outreach** for Pursue leads only — hook → desired outcome → call to action → message — for you to edit, approve, copy, and send yourself. Nothing is ever sent automatically.

Each scored lead also gets:

- **Clarity Fit score** (0–100) with checkmarked reasons — not just a number, but *why*
- **Freshness indicator** — 🟢 posted in the last 2 days, 🟡 within a week, 🔴 older; founders making decisions *now* rank first
- **30-Second Brief** — problem, biggest competitor, biggest opportunity, and suggested hook, readable before opening the full dossier
- **"Can Clarity Help?"** — a 1–5 star estimate of report value with the best-fit report sections, so zero-fit leads cost zero minutes
- **Outcome tracking** — mark each outreach No reply / Interested / Booked call / Client / Wrong ICP; the queue aggregates them so scoring weights can be calibrated against what actually converts

Everything runs on your machine. Leads live in a single local SQLite file (`prisma/dev.db`); the only external calls are source collection and Gemini scoring.

## Setup

1. `npm i`
2. Copy `.env.example` → `.env` and fill in:
   - **Gemini**: free key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey) → `GEMINI_API_KEY`. Scoring uses a **model fallback chain** (`GEMINI_MODELS`) — if one model hits its free-tier quota, the next takes over automatically.
   - **Reddit** (optional — the other sources work without it): create a *script* app at [reddit.com/prefs/apps](https://www.reddit.com/prefs/apps) → `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, plus your `REDDIT_USERNAME`, `REDDIT_PASSWORD`, and a descriptive `REDDIT_USER_AGENT`. Note: Reddit may refuse app creation on new accounts; the collector logs the auth error and the other sources still run.
3. `npx prisma db push` — creates the local database.
4. `npm run dev` — app at [http://localhost:3000](http://localhost:3000).

## Daily usage

1. **Collect** — pulls and normalizes new founders from all sources, dedupes, applies disqualifiers.
2. **Score** — AI-evaluates 10 leads per click (roughly 1–2 minutes per batch; the button stays busy while it works).
3. Read the dossiers, starting with **Pursue Immediately** — their "why now" (a launch, a raise) goes stale in days.
4. On a Pursue lead: **Generate draft** → edit → **Approve** → **Copy message** → send it via the founder's channel (HN profile email, YC founder's LinkedIn, Reddit DM) → **Mark sent**.
5. Weak on closer reading? **Reject.**

## Calibration

Don't trust the ranking until it's been checked against reality:

1. Collect and score 15–20 real leads.
2. For each top-ranked lead ask: *would this founder plausibly pay this month?* — not "do they seem interesting."
3. Where the ranking disagrees with your judgment, adjust the scoring weights and decision thresholds in **Settings** (weights should sum to ~1; decisions use the weighted score out of 5).
4. Re-score and repeat until the top of the queue matches who you'd actually contact this week.

Pricing text also lives in Settings — it's injected into drafts at runtime, never hardcoded; leave it empty and drafts won't mention price.

## Architecture notes

- **Source-agnostic scoring**: every source only normalizes raw data into a common founder profile; adding a source means writing one new normalizer, never touching the scorer.
- **Unknown is a first-class value**: missing evidence is reported in each dossier's Missing Information section, never guessed.
- Tests run against an isolated throwaway database (`prisma/test.db`) and never touch your real leads.

## Commands

- `npm run dev` — start the app
- `npm test` — unit tests (Vitest)
- `npm run build` — production build
- `npx prisma studio` — browse the local database

Full behavior spec: [`docs/product-spec.md`](docs/product-spec.md)
