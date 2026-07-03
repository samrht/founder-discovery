# Founder Discovery & Lead Scoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Local Next.js app that collects founders from Reddit + YC, scores them per the Clarity Research spec, and produces human-reviewed outreach drafts.

**Architecture:** Single Next.js (App Router) app. Collectors/normalizers per source feed a common `FounderProfile`; everything downstream (disqualify → Gemini evaluate → deterministic decide → outreach draft) is source-agnostic. Prisma + SQLite for state; server actions + two API routes; no background workers.

**Tech Stack:** Next.js (TS, App Router, src dir), Prisma + SQLite, Tailwind + shadcn/ui, `@google/genai` (Gemini free tier), zod, Vitest.

## Global Constraints

- $0 budget: free tiers only (Reddit script app, YC public JSON dump, Gemini free tier). No paid services.
- Nothing auto-sends. Drafts are copied and sent manually by the user. No email/DM APIs.
- Outreach drafts must never mention AI or automation; written as if Smarth personally researched the founder.
- Pricing is never hardcoded — it comes from the `Config` table at runtime.
- Source-agnostic boundary: nothing outside `src/lib/sources/` may reference a specific source's data shape.
- Precision over recall; `Unknown` is a first-class value; never present inference as fact (encoded in prompts/schemas).
- SQLite via Prisma: **no Prisma enums** (unsupported on SQLite) — statuses/decisions are strings constrained by TS union types.
- Product spec (behavior source of truth): `C:\Users\shoke\Documents\Claude\Projects\analysis\founder_discovery_system_prompt.md` (copied to `docs/product-spec.md` in Task 1).
- Commits: plain messages, no Co-Authored-By trailer.
- Shell: Windows PowerShell 5.1 (no `&&` — use `;`).

---

### Task 1: Scaffold app, test runner, deps

**Files:**
- Create: entire Next.js scaffold at repo root (via `create-next-app` in `web/` then moved up)
- Create: `vitest.config.ts`, `.env.example`, `docs/product-spec.md`
- Modify: `.gitignore`, `package.json` (test script)

**Interfaces:**
- Produces: working `npm run dev`, `npm test` (vitest, passes with no tests), `@/*` path alias usable in app and tests.

- [ ] **Step 1: Scaffold Next.js into repo root**

```powershell
npx create-next-app@latest web --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
Get-ChildItem web -Force | Move-Item -Destination .
Remove-Item web
```

(create-next-app skips `git init` because the parent repo exists. `docs/` is untouched.)

- [ ] **Step 2: Install deps + shadcn**

```powershell
npm i zod @google/genai
npm i -D vitest prisma
npm i @prisma/client
npx shadcn@latest init -d
npx shadcn@latest add button card badge input textarea label
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { passWithNoTests: true },
});
```

Add to `package.json` scripts: `"test": "vitest run"`.

- [ ] **Step 4: Create `.env.example`**

```
DATABASE_URL="file:./dev.db"
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
REDDIT_USERNAME=
REDDIT_PASSWORD=
REDDIT_USER_AGENT=windows:founder-discovery:v1 (by /u/YOUR_USERNAME)
```

- [ ] **Step 5: Copy product spec into repo**

```powershell
Copy-Item "C:\Users\shoke\Documents\Claude\Projects\analysis\founder_discovery_system_prompt.md" docs\product-spec.md
```

- [ ] **Step 6: Verify**

Run: `npm test` → "No test files found, exiting with code 0". Run: `npm run dev` briefly → compiles, http://localhost:3000 renders.

- [ ] **Step 7: Commit**

```powershell
git add -A; git commit -m "chore: scaffold Next.js app with vitest, shadcn, deps"
```

---

### Task 2: Prisma schema, DB client, runtime config

**Files:**
- Create: `prisma/schema.prisma`, `src/lib/db.ts`, `src/lib/config.ts`
- Test: `src/lib/config.test.ts`

**Interfaces:**
- Produces: `prisma` singleton (`@/lib/db`); `AppConfig` type, `DEFAULT_CONFIG`, `getConfig(): Promise<AppConfig>`, `saveConfig(patch: Partial<AppConfig>): Promise<void>`, and pure `mergeConfig(rows: {key:string; value:string}[]): AppConfig` (`@/lib/config`).
- Prisma models: `Lead`, `Evaluation`, `Draft`, `Config` as below.

- [ ] **Step 1: Write `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Lead {
  id          String   @id @default(cuid())
  source      String
  sourceId    String
  sourceUrl   String
  dedupKey    String
  channel     String   // "REDDIT_DM" | "EMAIL"
  status      String   @default("NEW") // NEW | DISQUALIFIED | PURSUE_NOW | PURSUE | MAYBE_LATER | REJECTED | APPROVED | SENT
  profile     String   // JSON FounderProfile
  rawPayload  String   // JSON raw source object
  disqualifyReason String?
  error       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  evaluations Evaluation[]
  drafts      Draft[]

  @@unique([source, sourceId])
  @@index([dedupKey])
  @@index([status])
}

model Evaluation {
  id                String   @id @default(cuid())
  leadId            String
  lead              Lead     @relation(fields: [leadId], references: [id], onDelete: Cascade)
  summary           String
  observedFacts     String   // JSON string[]
  inferences        String   // JSON {text, confidence}[]
  scores            String   // JSON EvaluationResult["scores"]
  whyNow            String?
  risks             String   // JSON string[]
  missingInfo       String   // JSON string[]
  overallConfidence String
  weighted          Float
  decision          String   // PURSUE_NOW | PURSUE | MAYBE_LATER | REJECTED
  reason            String
  createdAt         DateTime @default(now())
}

model Draft {
  id             String   @id @default(cuid())
  leadId         String
  lead           Lead     @relation(fields: [leadId], references: [id], onDelete: Cascade)
  primaryHook    String
  desiredOutcome String
  callToAction   String
  message        String
  editedMessage  String?
  approved       Boolean  @default(false)
  createdAt      DateTime @default(now())
}

model Config {
  key   String @id
  value String // JSON-encoded
}
```

- [ ] **Step 2: Create DB**

```powershell
npx prisma db push
```

Expected: "Your database is now in sync". Confirm `.gitignore` covers `*.db` (add `prisma/dev.db` if not).

- [ ] **Step 3: Create `src/lib/db.ts`**

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

- [ ] **Step 4: Write failing test `src/lib/config.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { DEFAULT_CONFIG, mergeConfig } from "./config";

describe("mergeConfig", () => {
  it("returns defaults when no rows", () => {
    expect(mergeConfig([])).toEqual(DEFAULT_CONFIG);
  });
  it("overrides defaults with stored rows", () => {
    const cfg = mergeConfig([{ key: "pricing", value: JSON.stringify("Reports start at $299") }]);
    expect(cfg.pricing).toBe("Reports start at $299");
    expect(cfg.weights).toEqual(DEFAULT_CONFIG.weights);
  });
  it("ignores unknown keys", () => {
    expect(mergeConfig([{ key: "bogus", value: "1" }])).toEqual(DEFAULT_CONFIG);
  });
});
```

Run: `npx vitest run src/lib/config.test.ts` → FAIL (module not found).

- [ ] **Step 5: Implement `src/lib/config.ts`**

```ts
import { prisma } from "./db";

export interface AppConfig {
  pricing: string; // runtime pricing text; empty = don't mention price
  weights: { pain: number; timing: number; stageFit: number; budget: number; reachability: number; geography: number };
  thresholds: { pursue: number; maybeLater: number }; // weighted-score cutoffs
  subreddits: string[];
  redditLimitPerSub: number;
  ycBatches: string[];
  ycMaxPerRun: number;
  scoreBatchSize: number;
}

export const DEFAULT_CONFIG: AppConfig = {
  pricing: "",
  weights: { pain: 0.3, timing: 0.25, stageFit: 0.15, budget: 0.15, reachability: 0.1, geography: 0.05 },
  thresholds: { pursue: 3.5, maybeLater: 2.5 },
  subreddits: ["startups", "Entrepreneur", "SaaS", "EntrepreneurRideAlong"],
  redditLimitPerSub: 50,
  ycBatches: ["Spring 2026", "Winter 2026"],
  ycMaxPerRun: 25,
  scoreBatchSize: 10,
};

export function mergeConfig(rows: { key: string; value: string }[]): AppConfig {
  const cfg: AppConfig = structuredClone(DEFAULT_CONFIG);
  for (const row of rows) {
    if (row.key in cfg) {
      try {
        (cfg as unknown as Record<string, unknown>)[row.key] = JSON.parse(row.value);
      } catch { /* keep default on bad JSON */ }
    }
  }
  return cfg;
}

export async function getConfig(): Promise<AppConfig> {
  return mergeConfig(await prisma.config.findMany());
}

export async function saveConfig(patch: Partial<AppConfig>): Promise<void> {
  for (const [key, value] of Object.entries(patch)) {
    const v = JSON.stringify(value);
    await prisma.config.upsert({ where: { key }, create: { key, value: v }, update: { value: v } });
  }
}
```

- [ ] **Step 6: Run test** → PASS. **Commit:**

```powershell
git add -A; git commit -m "feat: prisma schema, db client, runtime config"
```

---

### Task 3: Founder schema types + dedup key

**Files:**
- Create: `src/lib/sources/types.ts`, `src/lib/dedup.ts`
- Test: `src/lib/dedup.test.ts`

**Interfaces:**
- Produces (used by every later task):

```ts
// src/lib/sources/types.ts
export type SourceName = "reddit" | "yc";
export type Channel = "REDDIT_DM" | "EMAIL";
export type Confidence = "High" | "Medium" | "Low";
export const UNKNOWN = "Unknown" as const;
export type Unk = typeof UNKNOWN;

export interface RawLead {
  source: SourceName;
  sourceId: string;
  url: string;
  payload: unknown;
}

export interface FounderProfile {
  founderName: string | Unk;
  company: string | Unk;
  website: string | Unk;
  source: SourceName;
  sourceId: string;
  sourceUrl: string;
  location: string | Unk;
  stage: string | Unk;
  teamSize: number | Unk;
  funding: string | Unk;
  revenue: string | Unk;
  recentActivity: string | Unk;
  painSignals: string[];
  timingSignals: string[];
  reachability: string | Unk;
  confidence: Confidence;
  channel: Channel;
  rawText: string; // all source text evidence, fed to the LLM
}
```

- `dedupKey(p: FounderProfile): string` (`@/lib/dedup`).

- [ ] **Step 1: Create `src/lib/sources/types.ts`** with the code above (verbatim).

- [ ] **Step 2: Write failing test `src/lib/dedup.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { dedupKey } from "./dedup";
import { FounderProfile, UNKNOWN } from "./sources/types";

const base: FounderProfile = {
  founderName: "Jane Doe", company: "Acme AI", website: UNKNOWN, source: "reddit",
  sourceId: "abc", sourceUrl: "https://reddit.com/x", location: UNKNOWN, stage: UNKNOWN,
  teamSize: UNKNOWN, funding: UNKNOWN, revenue: UNKNOWN, recentActivity: UNKNOWN,
  painSignals: [], timingSignals: [], reachability: UNKNOWN, confidence: "Low",
  channel: "REDDIT_DM", rawText: "",
};

describe("dedupKey", () => {
  it("normalizes case and punctuation", () => {
    expect(dedupKey(base)).toBe(dedupKey({ ...base, founderName: "jane doe!", company: "ACME-ai" }));
  });
  it("falls back to source id when name and company unknown", () => {
    const k = dedupKey({ ...base, founderName: UNKNOWN, company: UNKNOWN });
    expect(k).toBe("reddit::abc");
  });
});
```

Run: `npx vitest run src/lib/dedup.test.ts` → FAIL.

- [ ] **Step 3: Implement `src/lib/dedup.ts`**

```ts
import { FounderProfile, UNKNOWN } from "./sources/types";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function dedupKey(p: FounderProfile): string {
  const name = p.founderName === UNKNOWN ? "" : norm(p.founderName);
  const company = p.company === UNKNOWN ? "" : norm(p.company);
  if (!name && !company) return `${p.source}::${p.sourceId}`;
  return `${name}::${company}`;
}
```

- [ ] **Step 4: Run test** → PASS. **Commit:** `git add -A; git commit -m "feat: founder schema types and dedup key"`

---

### Task 4: Rule-based disqualifiers

**Files:**
- Create: `src/lib/pipeline/disqualify.ts`
- Test: `src/lib/pipeline/disqualify.test.ts`

**Interfaces:**
- Consumes: `FounderProfile`, `UNKNOWN` from Task 3.
- Produces: `disqualify(p: FounderProfile): string | null` — reason string if disqualified, else null.

- [ ] **Step 1: Write failing test `src/lib/pipeline/disqualify.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { disqualify } from "./disqualify";
import { FounderProfile, UNKNOWN } from "../sources/types";

const base: FounderProfile = {
  founderName: "A", company: "B", website: UNKNOWN, source: "reddit", sourceId: "1",
  sourceUrl: "", location: UNKNOWN, stage: UNKNOWN, teamSize: UNKNOWN, funding: UNKNOWN,
  revenue: UNKNOWN, recentActivity: UNKNOWN, painSignals: [], timingSignals: [],
  reachability: UNKNOWN, confidence: "Low", channel: "REDDIT_DM",
  rawText: "We are a small startup figuring out our market.",
};

describe("disqualify", () => {
  it("passes a normal early-stage profile", () => {
    expect(disqualify(base)).toBeNull();
  });
  it("rejects raised Series A+", () => {
    expect(disqualify({ ...base, rawText: "We just closed our Series B led by Index." })).toMatch(/Series/i);
  });
  it("does NOT reject aspirational Series A talk (that's a timing signal)", () => {
    expect(disqualify({ ...base, rawText: "Preparing to raise our Series A next year, confused about market sizing." })).toBeNull();
  });
  it("rejects known team size > 5", () => {
    expect(disqualify({ ...base, teamSize: 12 })).toMatch(/team/i);
  });
  it("rejects consultants selling services", () => {
    expect(disqualify({ ...base, rawText: "In my consulting business I help founders with GTM. DM me for my agency's packages." })).toMatch(/consultant/i);
  });
  it("rejects student projects", () => {
    expect(disqualify({ ...base, rawText: "Building this for my university class project." })).toMatch(/student/i);
  });
  it("rejects explicit Series A+ stage field", () => {
    expect(disqualify({ ...base, stage: "Series B" })).toMatch(/Series/i);
  });
});
```

Run → FAIL.

- [ ] **Step 2: Implement `src/lib/pipeline/disqualify.ts`**

```ts
import { FounderProfile, UNKNOWN } from "../sources/types";

interface Rule { reason: string; test: (p: FounderProfile) => boolean }

const RULES: Rule[] = [
  {
    reason: "Series A+ (stage field)",
    test: (p) => p.stage !== UNKNOWN && /series [a-e]|growth/i.test(p.stage),
  },
  {
    reason: "Raised Series A or later",
    // only past-tense raises disqualify; "preparing/planning to raise" is a timing signal
    test: (p) => /\b(closed|raised|announced|completed)\b[^.]{0,40}\bseries [a-e]\b/i.test(p.rawText),
  },
  {
    reason: "Team size above 5",
    test: (p) => p.teamSize !== UNKNOWN && p.teamSize > 5,
  },
  {
    reason: "Consultant selling services",
    test: (p) => /(my|our) (consulting|agency)\b/i.test(p.rawText) && /\bI (help|offer|coach)\b|DM me/i.test(p.rawText),
  },
  {
    reason: "Student project",
    test: (p) => /\b(university|college|school|class) project\b|\bstudent project\b|for my (class|course)\b/i.test(p.rawText),
  },
];

export function disqualify(p: FounderProfile): string | null {
  for (const rule of RULES) if (rule.test(p)) return rule.reason;
  return null;
}
```

- [ ] **Step 3: Run test** → PASS (adjust regexes only if a listed test fails). **Commit:** `git add -A; git commit -m "feat: rule-based immediate disqualifiers"`

---

### Task 5: Reddit collector + normalizer

**Files:**
- Create: `src/lib/sources/reddit/collector.ts`, `src/lib/sources/reddit/normalizer.ts`
- Test: `src/lib/sources/reddit/normalizer.test.ts`

**Interfaces:**
- Consumes: `RawLead`, `FounderProfile`, `UNKNOWN` (Task 3).
- Produces: `collectReddit(subreddits: string[], limitPerSub: number): Promise<RawLead[]>`; `normalizeRedditPost(raw: RawLead): FounderProfile | null` (null = skip: no/short body or deleted author).

- [ ] **Step 1: Write failing test `src/lib/sources/reddit/normalizer.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { normalizeRedditPost } from "./normalizer";
import { RawLead } from "../types";

function raw(overrides: Partial<{ id: string; title: string; selftext: string; author: string; subreddit: string; permalink: string }> = {}): RawLead {
  const data = {
    id: "1abc", title: "Struggling to size my market",
    selftext: "Solo founder of a B2B SaaS. I have 20 paying customers but no idea who my real competitors are. Preparing a pre-seed raise and my deck's market slide is guesswork. How do you all figure out TAM without paying $20k?",
    author: "founder_jane", subreddit: "startups", permalink: "/r/startups/comments/1abc/x/",
    ...overrides,
  };
  return { source: "reddit", sourceId: data.id, url: `https://www.reddit.com${data.permalink}`, payload: data };
}

describe("normalizeRedditPost", () => {
  it("maps a text post to a FounderProfile", () => {
    const p = normalizeRedditPost(raw());
    expect(p).not.toBeNull();
    expect(p!.founderName).toBe("founder_jane");
    expect(p!.channel).toBe("REDDIT_DM");
    expect(p!.source).toBe("reddit");
    expect(p!.rawText).toContain("Struggling to size my market");
    expect(p!.rawText).toContain("TAM");
    expect(p!.company).toBe("Unknown");
  });
  it("skips posts with short or missing body", () => {
    expect(normalizeRedditPost(raw({ selftext: "" }))).toBeNull();
    expect(normalizeRedditPost(raw({ selftext: "link post lol" }))).toBeNull();
  });
  it("skips deleted authors", () => {
    expect(normalizeRedditPost(raw({ author: "[deleted]" }))).toBeNull();
  });
});
```

Run → FAIL.

- [ ] **Step 2: Implement `src/lib/sources/reddit/normalizer.ts`**

```ts
import { FounderProfile, RawLead, UNKNOWN } from "../types";

interface RedditPost {
  id: string; title: string; selftext: string; author: string;
  subreddit: string; permalink: string;
}

const MIN_BODY = 80;

export function normalizeRedditPost(raw: RawLead): FounderProfile | null {
  const d = raw.payload as RedditPost;
  if (!d.selftext || d.selftext.length < MIN_BODY) return null;
  if (!d.author || d.author === "[deleted]") return null;
  return {
    founderName: d.author,
    company: UNKNOWN,
    website: UNKNOWN,
    source: "reddit",
    sourceId: d.id,
    sourceUrl: raw.url,
    location: UNKNOWN,
    stage: UNKNOWN,
    teamSize: UNKNOWN,
    funding: UNKNOWN,
    revenue: UNKNOWN,
    recentActivity: `Posted in r/${d.subreddit}`,
    painSignals: [],
    timingSignals: [],
    reachability: "Active public poster on Reddit",
    confidence: "Low",
    channel: "REDDIT_DM",
    rawText: `Title: ${d.title}\nSubreddit: r/${d.subreddit}\nBody: ${d.selftext}`,
  };
}
```

- [ ] **Step 3: Run test** → PASS.

- [ ] **Step 4: Implement `src/lib/sources/reddit/collector.ts`** (thin I/O wrapper — no unit test; verified live in Task 11)

```ts
import { RawLead } from "../types";

const UA = () => process.env.REDDIT_USER_AGENT ?? "founder-discovery/1.0";

async function getToken(): Promise<string> {
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": UA(),
    },
    body: new URLSearchParams({
      grant_type: "password",
      username: process.env.REDDIT_USERNAME!,
      password: process.env.REDDIT_PASSWORD!,
    }),
  });
  if (!res.ok) throw new Error(`Reddit auth failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("Reddit auth: no access_token in response");
  return json.access_token;
}

export async function collectReddit(subreddits: string[], limitPerSub: number): Promise<RawLead[]> {
  const token = await getToken();
  const out: RawLead[] = [];
  for (const sub of subreddits) {
    const res = await fetch(`https://oauth.reddit.com/r/${sub}/new?limit=${limitPerSub}`, {
      headers: { Authorization: `Bearer ${token}`, "User-Agent": UA() },
    });
    if (!res.ok) { console.error(`r/${sub} fetch failed: ${res.status}`); continue; }
    const json = (await res.json()) as { data?: { children?: Array<{ data: { id: string; permalink: string } }> } };
    for (const child of json.data?.children ?? []) {
      out.push({
        source: "reddit",
        sourceId: child.data.id,
        url: `https://www.reddit.com${child.data.permalink}`,
        payload: child.data,
      });
    }
    await new Promise((r) => setTimeout(r, 1100)); // stay under 60 req/min
  }
  return out;
}
```

- [ ] **Step 5: Commit:** `git add -A; git commit -m "feat: reddit collector and normalizer"`

---

### Task 6: YC collector + normalizer

**Files:**
- Create: `src/lib/sources/yc/collector.ts`, `src/lib/sources/yc/normalizer.ts`
- Test: `src/lib/sources/yc/yc.test.ts`

**Interfaces:**
- Consumes: `RawLead`, `FounderProfile`, `UNKNOWN` (Task 3); `AppConfig` (Task 2).
- Produces: `collectYc(cfg: AppConfig): Promise<RawLead[]>`; exported pure `filterYcCompany(c: YcCompany, cfg: AppConfig): boolean`; `normalizeYcCompany(raw: RawLead): FounderProfile`; exported `YcCompany` interface.
- Data source: `https://yc-oss.github.io/api/companies/all.json` — free static daily dump of the YC directory (no key, no scraping).

- [ ] **Step 1: Write failing test `src/lib/sources/yc/yc.test.ts`**

```ts
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
```

Run → FAIL.

- [ ] **Step 2: Implement `src/lib/sources/yc/collector.ts`**

```ts
import { AppConfig } from "@/lib/config";
import { RawLead } from "../types";

export interface YcCompany {
  id: number; name: string; slug: string; website: string;
  one_liner: string; long_description: string; team_size: number | null;
  all_locations: string; batch: string; status: string; stage: string; url: string;
}

const US_UK = /USA|United States|United Kingdom|London|New York|San Francisco|Remote/i;

export function filterYcCompany(c: YcCompany, cfg: AppConfig): boolean {
  return (
    c.status === "Active" &&
    typeof c.team_size === "number" && c.team_size >= 1 && c.team_size <= 5 &&
    US_UK.test(c.all_locations) &&
    cfg.ycBatches.includes(c.batch)
  );
}

export async function collectYc(cfg: AppConfig): Promise<RawLead[]> {
  const res = await fetch("https://yc-oss.github.io/api/companies/all.json");
  if (!res.ok) throw new Error(`YC fetch failed: ${res.status}`);
  const companies = (await res.json()) as YcCompany[];
  return companies
    .filter((c) => filterYcCompany(c, cfg))
    .slice(0, cfg.ycMaxPerRun)
    .map((c) => ({ source: "yc" as const, sourceId: c.slug, url: c.url, payload: c }));
}
```

- [ ] **Step 3: Implement `src/lib/sources/yc/normalizer.ts`**

```ts
import { FounderProfile, RawLead, UNKNOWN } from "../types";
import { YcCompany } from "./collector";

export function normalizeYcCompany(raw: RawLead): FounderProfile {
  const c = raw.payload as YcCompany;
  return {
    founderName: UNKNOWN, // YC public dump has no founder names; user finds them at outreach time
    company: c.name,
    website: c.website || UNKNOWN,
    source: "yc",
    sourceId: c.slug,
    sourceUrl: raw.url,
    location: c.all_locations || UNKNOWN,
    stage: `Pre-seed/Seed (YC ${c.batch})`,
    teamSize: typeof c.team_size === "number" ? c.team_size : UNKNOWN,
    funding: "YC-backed (standard deal)",
    revenue: UNKNOWN,
    recentActivity: `YC ${c.batch} company`,
    painSignals: [],
    timingSignals: [],
    reachability: UNKNOWN,
    confidence: "Medium",
    channel: "EMAIL",
    rawText: `Company: ${c.name}\nOne-liner: ${c.one_liner}\nDescription: ${c.long_description}\nLocation: ${c.all_locations}\nTeam size: ${c.team_size}\nBatch: ${c.batch}`,
  };
}
```

- [ ] **Step 4: Run test** → PASS. **Commit:** `git add -A; git commit -m "feat: yc collector and normalizer"`

---

### Task 7: Gemini JSON wrapper

**Files:**
- Create: `src/lib/gemini.ts`
- Test: `src/lib/gemini.test.ts`

**Interfaces:**
- Produces: `generateJson<T>(prompt: string, schema: ZodType<T>, call?: (prompt: string) => Promise<string>): Promise<T>` — validates against zod schema, strips markdown fences, retries once (2s pause), throws after 2nd failure. `call` is injectable for tests; default uses `@google/genai` with `GEMINI_MODEL` (fallback `gemini-2.5-flash`) and `responseMimeType: "application/json"`.

- [ ] **Step 1: Write failing test `src/lib/gemini.test.ts`**

```ts
import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { generateJson } from "./gemini";

const schema = z.object({ ok: z.boolean() });

describe("generateJson", () => {
  it("parses valid JSON", async () => {
    expect(await generateJson("p", schema, async () => '{"ok":true}')).toEqual({ ok: true });
  });
  it("strips markdown fences", async () => {
    expect(await generateJson("p", schema, async () => '```json\n{"ok":true}\n```')).toEqual({ ok: true });
  });
  it("retries once on invalid output then succeeds", async () => {
    const call = vi.fn().mockResolvedValueOnce("garbage").mockResolvedValueOnce('{"ok":false}');
    expect(await generateJson("p", schema, call)).toEqual({ ok: false });
    expect(call).toHaveBeenCalledTimes(2);
  });
  it("throws after two failures", async () => {
    await expect(generateJson("p", schema, async () => "nope")).rejects.toThrow();
  });
});
```

Run → FAIL.

- [ ] **Step 2: Implement `src/lib/gemini.ts`**

```ts
import { GoogleGenAI } from "@google/genai";
import { ZodType } from "zod";

const sleepMs = process.env.NODE_ENV === "test" ? 0 : 2000;

async function defaultCall(prompt: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const res = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
    contents: prompt,
    config: { responseMimeType: "application/json" },
  });
  return res.text ?? "";
}

export async function generateJson<T>(
  prompt: string,
  schema: ZodType<T>,
  call: (prompt: string) => Promise<string> = defaultCall,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await call(prompt);
      const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
      return schema.parse(JSON.parse(cleaned));
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, sleepMs));
    }
  }
  throw lastErr;
}
```

Note: vitest sets `NODE_ENV=test` automatically, so retries don't slow tests.

- [ ] **Step 3: Run test** → PASS. **Commit:** `git add -A; git commit -m "feat: gemini json wrapper with validation and retry"`

---

### Task 8: Evaluation step (research + score)

**Files:**
- Create: `src/lib/pipeline/evaluate.ts`
- Test: `src/lib/pipeline/evaluate.test.ts`

**Interfaces:**
- Consumes: `generateJson` (Task 7), `FounderProfile` (Task 3), `AppConfig` (Task 2).
- Produces:

```ts
export const DIMENSIONS = ["pain", "timing", "stageFit", "budget", "reachability", "geography"] as const;
export type Dimension = (typeof DIMENSIONS)[number];
export type DimScore = { score: number; evidence: string[] };
export type EvaluationResult = {
  summary: string;
  observedFacts: string[];
  inferences: { text: string; confidence: "High" | "Medium" | "Low" }[];
  scores: Record<Dimension, DimScore>;
  whyNow: string | null;
  risks: string[];
  missingInformation: string[];
  overallConfidence: "High" | "Medium" | "Low";
};
export function buildEvaluationPrompt(profile: FounderProfile): string;
export async function evaluateLead(profile: FounderProfile, call?: (p: string) => Promise<string>): Promise<EvaluationResult>;
```

- [ ] **Step 1: Write failing test `src/lib/pipeline/evaluate.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { buildEvaluationPrompt, evaluateLead, EvaluationResult } from "./evaluate";
import { FounderProfile, UNKNOWN } from "../sources/types";

const profile: FounderProfile = {
  founderName: "founder_jane", company: UNKNOWN, website: UNKNOWN, source: "reddit",
  sourceId: "1abc", sourceUrl: "https://reddit.com/x", location: UNKNOWN, stage: UNKNOWN,
  teamSize: UNKNOWN, funding: UNKNOWN, revenue: UNKNOWN, recentActivity: "Posted in r/startups",
  painSignals: [], timingSignals: [], reachability: "Active public poster on Reddit",
  confidence: "Low", channel: "REDDIT_DM",
  rawText: "Title: Struggling to size my market\nBody: no idea who my competitors are",
};

const fake: EvaluationResult = {
  summary: "Solo founder confused about competitors.",
  observedFacts: ["Posted asking about competitors"],
  inferences: [{ text: "Likely pre-seed", confidence: "Medium" }],
  scores: {
    pain: { score: 5, evidence: ["'no idea who my competitors are'"] },
    timing: { score: 3, evidence: ["Active question this week"] },
    stageFit: { score: 3, evidence: [] },
    budget: { score: 1, evidence: [] },
    reachability: { score: 4, evidence: ["Active poster"] },
    geography: { score: 0, evidence: [] },
  },
  whyNow: "Asked yesterday",
  risks: ["Geography unknown"],
  missingInformation: ["Funding unknown", "Geography unknown"],
  overallConfidence: "Medium",
};

describe("buildEvaluationPrompt", () => {
  it("includes profile evidence and core rules", () => {
    const p = buildEvaluationPrompt(profile);
    expect(p).toContain("no idea who my competitors are");
    expect(p).toContain("Unknown");            // uncertainty handling rule present
    expect(p).toMatch(/precision.*recall/is);  // north star present
  });
});

describe("evaluateLead", () => {
  it("returns schema-validated result", async () => {
    const r = await evaluateLead(profile, async () => JSON.stringify(fake));
    expect(r.scores.pain.score).toBe(5);
    expect(r.whyNow).toBe("Asked yesterday");
  });
  it("rejects out-of-range scores", async () => {
    const bad = { ...fake, scores: { ...fake.scores, pain: { score: 9, evidence: [] } } };
    await expect(evaluateLead(profile, async () => JSON.stringify(bad))).rejects.toThrow();
  });
});
```

Run → FAIL.

- [ ] **Step 2: Implement `src/lib/pipeline/evaluate.ts`**

```ts
import { z } from "zod";
import { generateJson } from "../gemini";
import { FounderProfile } from "../sources/types";

export const DIMENSIONS = ["pain", "timing", "stageFit", "budget", "reachability", "geography"] as const;
export type Dimension = (typeof DIMENSIONS)[number];

const DimScoreSchema = z.object({ score: z.number().int().min(0).max(5), evidence: z.array(z.string()) });
export type DimScore = z.infer<typeof DimScoreSchema>;

const ConfidenceSchema = z.enum(["High", "Medium", "Low"]);

export const EvaluationSchema = z.object({
  summary: z.string(),
  observedFacts: z.array(z.string()),
  inferences: z.array(z.object({ text: z.string(), confidence: ConfidenceSchema })),
  scores: z.object({
    pain: DimScoreSchema, timing: DimScoreSchema, stageFit: DimScoreSchema,
    budget: DimScoreSchema, reachability: DimScoreSchema, geography: DimScoreSchema,
  }),
  whyNow: z.string().nullable(),
  risks: z.array(z.string()),
  missingInformation: z.array(z.string()),
  overallConfidence: ConfidenceSchema,
});
export type EvaluationResult = z.infer<typeof EvaluationSchema>;

const RULES = `
You evaluate startup founders as potential buyers of Clarity Research's competitive intelligence and market research reports.

North star: precision over recall. A false positive is worse than a false negative. When in doubt, score low.

Evidence discipline:
- observedFacts: only things literally present in the evidence below. Never inferred.
- inferences: conclusions drawn from facts, each tagged High/Medium/Low confidence. Never present an inference as a fact.
- If evidence is insufficient for a field or dimension, do not guess: use low scores, empty evidence arrays, and list the gap in missingInformation. "Unknown" is always better than a wrong guess.

Score each dimension 0-5. Every score MUST cite its evidence (quotes or specific facts from the input). No evidence = score 0-1.
- pain: explicit confusion/questions about competitors, market size, positioning; recent pivot talk.
- timing: an active decision point right now — fundraising prep, deck in progress, market entry, launch week.
- stageFit: pre-seed/seed, team of 1-5.
- budget: raised funding, has revenue, or explicit spend/outsourcing language.
- reachability: active real account, replies, not a throwaway.
- geography: confirmed US or UK. Unconfirmed = 0-1.

whyNow: one sentence answering "why contact this founder THIS WEEK", only if a concrete trigger exists (launched this week, fundraising next month, competitor just funded, actively asking questions in the last days). Vague signals ("seems to be growing") are NOT a whyNow — return null instead.

Ideal client: solo founder or team 2-5, pre-Series A, US/UK, actively building/fundraising/deciding, no in-house research capacity, some ability to pay.

Return ONLY JSON matching exactly this shape:
{"summary": string, "observedFacts": string[], "inferences": [{"text": string, "confidence": "High"|"Medium"|"Low"}], "scores": {"pain"|"timing"|"stageFit"|"budget"|"reachability"|"geography": {"score": 0-5 integer, "evidence": string[]}}, "whyNow": string|null, "risks": string[], "missingInformation": string[], "overallConfidence": "High"|"Medium"|"Low"}
`;

export function buildEvaluationPrompt(profile: FounderProfile): string {
  const { rawText, ...fields } = profile;
  return `${RULES}\n\nKnown profile fields (from the source, treat as observed facts):\n${JSON.stringify(fields, null, 2)}\n\nEvidence text:\n"""\n${rawText}\n"""`;
}

export async function evaluateLead(
  profile: FounderProfile,
  call?: (p: string) => Promise<string>,
): Promise<EvaluationResult> {
  return generateJson(buildEvaluationPrompt(profile), EvaluationSchema, call);
}
```

- [ ] **Step 3: Run test** → PASS. **Commit:** `git add -A; git commit -m "feat: LLM evaluation step with evidence-per-dimension schema"`

---

### Task 9: Deterministic decision

**Files:**
- Create: `src/lib/pipeline/decide.ts`
- Test: `src/lib/pipeline/decide.test.ts`

**Interfaces:**
- Consumes: `EvaluationResult`, `DIMENSIONS` (Task 8), `AppConfig` (Task 2).
- Produces:

```ts
export type Decision = "PURSUE_NOW" | "PURSUE" | "MAYBE_LATER" | "REJECTED";
export function decide(evaluation: EvaluationResult, cfg: AppConfig): { decision: Decision; weighted: number; reason: string };
```

- [ ] **Step 1: Write failing test `src/lib/pipeline/decide.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { decide } from "./decide";
import { EvaluationResult } from "./evaluate";
import { DEFAULT_CONFIG } from "@/lib/config";

function evalWith(scores: Record<string, number>, whyNow: string | null): EvaluationResult {
  const s = (n: number) => ({ score: n, evidence: n > 0 ? [`evidence ${n}`] : [] });
  return {
    summary: "s", observedFacts: [], inferences: [],
    scores: {
      pain: s(scores.pain ?? 0), timing: s(scores.timing ?? 0), stageFit: s(scores.stageFit ?? 3),
      budget: s(scores.budget ?? 0), reachability: s(scores.reachability ?? 3), geography: s(scores.geography ?? 3),
    },
    whyNow, risks: [], missingInformation: [], overallConfidence: "Medium",
  };
}
const cfg = DEFAULT_CONFIG; // pursue: 3.5, maybeLater: 2.5

describe("decide", () => {
  it("PURSUE_NOW: strong scores + whyNow", () => {
    const r = decide(evalWith({ pain: 5, timing: 5, stageFit: 4, budget: 3, reachability: 4, geography: 4 }, "Fundraising next month"), cfg);
    expect(r.decision).toBe("PURSUE_NOW");
    expect(r.reason).toContain("Fundraising next month");
  });
  it("PURSUE: strong scores, no whyNow", () => {
    const r = decide(evalWith({ pain: 5, timing: 4, stageFit: 4, budget: 3, reachability: 4, geography: 4 }, null), cfg);
    expect(r.decision).toBe("PURSUE");
  });
  it("MAYBE_LATER: middling weighted score", () => {
    const r = decide(evalWith({ pain: 3, timing: 3, stageFit: 3, budget: 2, reachability: 3, geography: 3 }, null), cfg);
    expect(r.decision).toBe("MAYBE_LATER");
  });
  it("REJECTED: weak weighted score", () => {
    const r = decide(evalWith({ pain: 1, timing: 1 }, null), cfg);
    expect(r.decision).toBe("REJECTED");
  });
  it("hard gate: stageFit 0 rejects regardless of other scores", () => {
    const r = decide(evalWith({ pain: 5, timing: 5, stageFit: 0, budget: 5, reachability: 5, geography: 5 }, "now"), cfg);
    expect(r.decision).toBe("REJECTED");
  });
  it("reason cites top dimensions and weighted score", () => {
    const r = decide(evalWith({ pain: 5, timing: 4, stageFit: 4, budget: 3, reachability: 4, geography: 4 }, null), cfg);
    expect(r.reason).toMatch(/pain 5/);
    expect(r.reason).toMatch(/\d\.\d/);
  });
});
```

Run → FAIL.

- [ ] **Step 2: Implement `src/lib/pipeline/decide.ts`**

```ts
import { AppConfig } from "../config";
import { DIMENSIONS, EvaluationResult } from "./evaluate";

export type Decision = "PURSUE_NOW" | "PURSUE" | "MAYBE_LATER" | "REJECTED";

export function decide(ev: EvaluationResult, cfg: AppConfig): { decision: Decision; weighted: number; reason: string } {
  const w = cfg.weights;
  const totalWeight = DIMENSIONS.reduce((a, d) => a + w[d], 0);
  const weighted = DIMENSIONS.reduce((a, d) => a + w[d] * ev.scores[d].score, 0) / totalWeight;
  const rounded = Math.round(weighted * 10) / 10;

  const top = [...DIMENSIONS].sort((a, b) => ev.scores[b].score - ev.scores[a].score).slice(0, 2)
    .map((d) => `${d} ${ev.scores[d].score} (${ev.scores[d].evidence[0] ?? "no evidence"})`).join("; ");

  let decision: Decision;
  if (ev.scores.stageFit.score === 0) decision = "REJECTED";
  else if (weighted < cfg.thresholds.maybeLater) decision = "REJECTED";
  else if (weighted < cfg.thresholds.pursue) decision = "MAYBE_LATER";
  else decision = ev.whyNow ? "PURSUE_NOW" : "PURSUE";

  const why = ev.whyNow ? ` Why now: ${ev.whyNow}` : " No why-now trigger.";
  const reason =
    decision === "REJECTED" && ev.scores.stageFit.score === 0
      ? `Rejected: stage fit is 0 (hard gate). Weighted ${rounded}/5.`
      : `Weighted ${rounded}/5 — ${top}.${why}`;

  return { decision, weighted: rounded, reason };
}
```

- [ ] **Step 3: Run test** → PASS. **Commit:** `git add -A; git commit -m "feat: deterministic decision from weighted scores"`

---

### Task 10: Outreach strategy + draft step

**Files:**
- Create: `src/lib/pipeline/outreach.ts`
- Test: `src/lib/pipeline/outreach.test.ts`

**Interfaces:**
- Consumes: `generateJson` (Task 7), `FounderProfile` (Task 3), `EvaluationResult` (Task 8), `AppConfig` (Task 2).
- Produces:

```ts
export type DraftResult = {
  primaryHook: "Competition" | "Fundraising" | "Positioning" | "Market Entry" | "Pricing" | "Expansion" | "Pivot";
  desiredOutcome: string;
  callToAction: string;
  message: string;
};
export function buildOutreachPrompt(profile: FounderProfile, ev: EvaluationResult, cfg: AppConfig): string;
export async function generateOutreach(profile: FounderProfile, ev: EvaluationResult, cfg: AppConfig, call?: (p: string) => Promise<string>): Promise<DraftResult>;
```

- [ ] **Step 1: Write failing test `src/lib/pipeline/outreach.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { buildOutreachPrompt, generateOutreach, DraftResult } from "./outreach";
import { FounderProfile, UNKNOWN } from "../sources/types";
import { EvaluationResult } from "./evaluate";
import { DEFAULT_CONFIG } from "@/lib/config";

const profile: FounderProfile = {
  founderName: "founder_jane", company: UNKNOWN, website: UNKNOWN, source: "reddit",
  sourceId: "1abc", sourceUrl: "u", location: UNKNOWN, stage: UNKNOWN, teamSize: UNKNOWN,
  funding: UNKNOWN, revenue: UNKNOWN, recentActivity: UNKNOWN, painSignals: [], timingSignals: [],
  reachability: UNKNOWN, confidence: "Low", channel: "REDDIT_DM",
  rawText: "Body: no idea who my competitors are",
};
const ev: EvaluationResult = {
  summary: "s", observedFacts: ["Asked about competitors"], inferences: [],
  scores: {
    pain: { score: 5, evidence: ["quote"] }, timing: { score: 4, evidence: [] },
    stageFit: { score: 4, evidence: [] }, budget: { score: 2, evidence: [] },
    reachability: { score: 4, evidence: [] }, geography: { score: 3, evidence: [] },
  },
  whyNow: "Asked yesterday", risks: [], missingInformation: [], overallConfidence: "Medium",
};
const fake: DraftResult = { primaryHook: "Competition", desiredOutcome: "Reply with interest", callToAction: "Reply and I'll send a sample", message: "Hey — saw your post about competitors..." };

describe("buildOutreachPrompt", () => {
  it("includes channel format, evidence, and no-AI rule", () => {
    const p = buildOutreachPrompt(profile, ev, DEFAULT_CONFIG);
    expect(p).toMatch(/Reddit DM/i);
    expect(p).toContain("Asked about competitors");
    expect(p).toMatch(/never mention AI/i);
  });
  it("includes pricing only when configured", () => {
    expect(buildOutreachPrompt(profile, ev, DEFAULT_CONFIG)).toMatch(/do not mention price/i);
    expect(buildOutreachPrompt(profile, ev, { ...DEFAULT_CONFIG, pricing: "$299 per report" })).toContain("$299 per report");
  });
});

describe("generateOutreach", () => {
  it("returns schema-validated draft", async () => {
    const d = await generateOutreach(profile, ev, DEFAULT_CONFIG, async () => JSON.stringify(fake));
    expect(d.primaryHook).toBe("Competition");
  });
  it("rejects invalid hook", async () => {
    await expect(generateOutreach(profile, ev, DEFAULT_CONFIG, async () => JSON.stringify({ ...fake, primaryHook: "Vibes" }))).rejects.toThrow();
  });
});
```

Run → FAIL.

- [ ] **Step 2: Implement `src/lib/pipeline/outreach.ts`**

```ts
import { z } from "zod";
import { AppConfig } from "../config";
import { generateJson } from "../gemini";
import { FounderProfile } from "../sources/types";
import { EvaluationResult } from "./evaluate";

export const DraftSchema = z.object({
  primaryHook: z.enum(["Competition", "Fundraising", "Positioning", "Market Entry", "Pricing", "Expansion", "Pivot"]),
  desiredOutcome: z.string(),
  callToAction: z.string(),
  message: z.string(),
});
export type DraftResult = z.infer<typeof DraftSchema>;

export function buildOutreachPrompt(profile: FounderProfile, ev: EvaluationResult, cfg: AppConfig): string {
  const channel = profile.channel === "REDDIT_DM"
    ? "a Reddit DM: casual, under 80 words, references their post naturally, no subject line"
    : "a cold email: under 120 words, include a subject line as the first line ('Subject: ...')";
  const pricing = cfg.pricing
    ? `If price comes up naturally, pricing is: ${cfg.pricing}`
    : "Pricing is not set: do not mention price at all.";
  return `
You write outreach for Smarth, founder of Clarity Research (competitive intelligence and market research reports for early-stage founders).

Work strictly in this order:
1. primaryHook — pick exactly ONE angle (Competition, Fundraising, Positioning, Market Entry, Pricing, Expansion, Pivot) from the STRONGEST evidence below.
2. desiredOutcome — what this message should make the founder do or feel (e.g. reply with interest, ask for the sample report, book a call).
3. callToAction — the single concrete next step in the message, matched to the desiredOutcome.
4. message — written LAST, built only around the locked hook/outcome/CTA.

Message rules:
- Written as if Smarth personally read their post/profile and did the research himself.
- Never mention AI, automation, tools, or systems. Never sound templated.
- Reference their specific situation using the evidence (quote or paraphrase their own words).
- ${channel}
- ${pricing}
- One CTA only. No links unless essential. No flattery filler.

Founder profile:
${JSON.stringify({ founderName: profile.founderName, company: profile.company, source: profile.source, channel: profile.channel }, null, 2)}

Evaluation evidence:
Summary: ${ev.summary}
Observed facts: ${JSON.stringify(ev.observedFacts)}
Why now: ${ev.whyNow ?? "none"}
Top signals: ${JSON.stringify(ev.scores)}

Return ONLY JSON: {"primaryHook": ..., "desiredOutcome": ..., "callToAction": ..., "message": ...}
`;
}

export async function generateOutreach(
  profile: FounderProfile,
  ev: EvaluationResult,
  cfg: AppConfig,
  call?: (p: string) => Promise<string>,
): Promise<DraftResult> {
  return generateJson(buildOutreachPrompt(profile, ev, cfg), DraftSchema, call);
}
```

- [ ] **Step 3: Run test** → PASS. **Commit:** `git add -A; git commit -m "feat: outreach strategy and draft generation"`

---

### Task 11: Ingestion + scoring orchestration and API routes

**Files:**
- Create: `src/lib/ingest.ts`, `src/lib/scoreRun.ts`, `src/app/api/collect/route.ts`, `src/app/api/score/route.ts`
- Test: `src/lib/ingest.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 2–9.
- Produces:

```ts
// ingest.ts
export interface SourceRunner { collect: () => Promise<RawLead[]>; normalize: (raw: RawLead) => FounderProfile | null }
export interface CollectSummary { fetched: number; skipped: number; duplicates: number; disqualified: number; added: number; errors: string[] }
export async function runCollect(runners?: SourceRunner[]): Promise<CollectSummary>;
// scoreRun.ts
export interface ScoreSummary { scored: number; byDecision: Record<string, number>; errors: string[] }
export async function runScoring(): Promise<ScoreSummary>;
```

- Routes: `POST /api/collect` → `CollectSummary` JSON; `POST /api/score` → `ScoreSummary` JSON.

- [ ] **Step 1: Write failing test `src/lib/ingest.test.ts`** (uses real SQLite via prisma — wipe Lead table in beforeEach)

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "./db";
import { runCollect, SourceRunner } from "./ingest";
import { FounderProfile, RawLead, UNKNOWN } from "./sources/types";

function profileFor(raw: RawLead, rawText: string): FounderProfile {
  return {
    founderName: "user_" + raw.sourceId, company: UNKNOWN, website: UNKNOWN, source: raw.source,
    sourceId: raw.sourceId, sourceUrl: raw.url, location: UNKNOWN, stage: UNKNOWN, teamSize: UNKNOWN,
    funding: UNKNOWN, revenue: UNKNOWN, recentActivity: UNKNOWN, painSignals: [], timingSignals: [],
    reachability: UNKNOWN, confidence: "Low", channel: "REDDIT_DM", rawText,
  };
}
const rawLead = (id: string): RawLead => ({ source: "reddit", sourceId: id, url: `https://r/${id}`, payload: {} });

function runner(items: { id: string; text: string }[]): SourceRunner {
  return {
    collect: async () => items.map((i) => rawLead(i.id)),
    normalize: (raw) => {
      const item = items.find((i) => i.id === raw.sourceId)!;
      return item.text === "" ? null : profileFor(raw, item.text);
    },
  };
}

beforeEach(async () => { await prisma.lead.deleteMany(); });

describe("runCollect", () => {
  it("adds new leads, skips nulls, disqualifies by rules", async () => {
    const s = await runCollect([runner([
      { id: "a", text: "figuring out my market" },
      { id: "b", text: "" }, // normalizer skip
      { id: "c", text: "we closed our Series B last week" }, // disqualified
    ])]);
    expect(s).toMatchObject({ fetched: 3, skipped: 1, duplicates: 0, disqualified: 1, added: 1 });
    expect(await prisma.lead.count({ where: { status: "NEW" } })).toBe(1);
    expect(await prisma.lead.count({ where: { status: "DISQUALIFIED" } })).toBe(1);
  });
  it("never re-adds the same sourceId", async () => {
    const r = runner([{ id: "a", text: "hello market" }]);
    await runCollect([r]);
    const s2 = await runCollect([r]);
    expect(s2.duplicates).toBe(1);
    expect(s2.added).toBe(0);
    expect(await prisma.lead.count()).toBe(1);
  });
});
```

Run → FAIL.

- [ ] **Step 2: Implement `src/lib/ingest.ts`**

```ts
import { getConfig } from "./config";
import { prisma } from "./db";
import { dedupKey } from "./dedup";
import { disqualify } from "./pipeline/disqualify";
import { collectReddit } from "./sources/reddit/collector";
import { normalizeRedditPost } from "./sources/reddit/normalizer";
import { FounderProfile, RawLead } from "./sources/types";
import { collectYc } from "./sources/yc/collector";
import { normalizeYcCompany } from "./sources/yc/normalizer";

export interface SourceRunner {
  collect: () => Promise<RawLead[]>;
  normalize: (raw: RawLead) => FounderProfile | null;
}

export interface CollectSummary {
  fetched: number; skipped: number; duplicates: number; disqualified: number; added: number; errors: string[];
}

async function defaultRunners(): Promise<SourceRunner[]> {
  const cfg = await getConfig();
  return [
    { collect: () => collectReddit(cfg.subreddits, cfg.redditLimitPerSub), normalize: normalizeRedditPost },
    { collect: () => collectYc(cfg), normalize: (r) => normalizeYcCompany(r) },
  ];
}

export async function runCollect(runners?: SourceRunner[]): Promise<CollectSummary> {
  const list = runners ?? (await defaultRunners());
  const s: CollectSummary = { fetched: 0, skipped: 0, duplicates: 0, disqualified: 0, added: 0, errors: [] };
  for (const runner of list) {
    let raws: RawLead[] = [];
    try { raws = await runner.collect(); } catch (e) { s.errors.push(String(e)); continue; }
    for (const raw of raws) {
      s.fetched++;
      try {
        const existing = await prisma.lead.findUnique({ where: { source_sourceId: { source: raw.source, sourceId: raw.sourceId } } });
        if (existing) { s.duplicates++; continue; }
        const profile = runner.normalize(raw);
        if (!profile) { s.skipped++; continue; }
        const key = dedupKey(profile);
        if (!key.startsWith(`${raw.source}::`) && (await prisma.lead.findFirst({ where: { dedupKey: key } }))) {
          s.duplicates++; continue;
        }
        const reason = disqualify(profile);
        await prisma.lead.create({
          data: {
            source: profile.source, sourceId: profile.sourceId, sourceUrl: profile.sourceUrl,
            dedupKey: key, channel: profile.channel,
            status: reason ? "DISQUALIFIED" : "NEW", disqualifyReason: reason,
            profile: JSON.stringify(profile), rawPayload: JSON.stringify(raw.payload),
          },
        });
        reason ? s.disqualified++ : s.added++;
      } catch (e) { s.errors.push(`${raw.source}:${raw.sourceId}: ${String(e)}`); }
    }
  }
  return s;
}
```

- [ ] **Step 3: Run test** → PASS.

- [ ] **Step 4: Implement `src/lib/scoreRun.ts`** (thin orchestration over tested parts — no unit test; verified live in Step 6)

```ts
import { getConfig } from "./config";
import { prisma } from "./db";
import { decide } from "./pipeline/decide";
import { evaluateLead } from "./pipeline/evaluate";
import { FounderProfile } from "./sources/types";

export interface ScoreSummary { scored: number; byDecision: Record<string, number>; errors: string[] }

export async function runScoring(): Promise<ScoreSummary> {
  const cfg = await getConfig();
  const leads = await prisma.lead.findMany({ where: { status: "NEW" }, orderBy: { createdAt: "asc" }, take: cfg.scoreBatchSize });
  const s: ScoreSummary = { scored: 0, byDecision: {}, errors: [] };
  for (const lead of leads) {
    try {
      const profile = JSON.parse(lead.profile) as FounderProfile;
      const ev = await evaluateLead(profile);
      const { decision, weighted, reason } = decide(ev, cfg);
      await prisma.$transaction([
        prisma.evaluation.create({
          data: {
            leadId: lead.id, summary: ev.summary,
            observedFacts: JSON.stringify(ev.observedFacts), inferences: JSON.stringify(ev.inferences),
            scores: JSON.stringify(ev.scores), whyNow: ev.whyNow,
            risks: JSON.stringify(ev.risks), missingInfo: JSON.stringify(ev.missingInformation),
            overallConfidence: ev.overallConfidence, weighted, decision, reason,
          },
        }),
        prisma.lead.update({ where: { id: lead.id }, data: { status: decision, error: null } }),
      ]);
      s.scored++;
      s.byDecision[decision] = (s.byDecision[decision] ?? 0) + 1;
      await new Promise((r) => setTimeout(r, 6500)); // Gemini free tier ~10 RPM
    } catch (e) {
      s.errors.push(`${lead.id}: ${String(e)}`);
      await prisma.lead.update({ where: { id: lead.id }, data: { error: String(e) } }); // stays NEW for retry
    }
  }
  return s;
}
```

- [ ] **Step 5: Create routes**

`src/app/api/collect/route.ts`:

```ts
import { runCollect } from "@/lib/ingest";

export async function POST() {
  return Response.json(await runCollect());
}
```

`src/app/api/score/route.ts`:

```ts
import { runScoring } from "@/lib/scoreRun";

export async function POST() {
  return Response.json(await runScoring());
}
```

- [ ] **Step 6: Live smoke test** (needs `.env.local` with real keys — if the user hasn't provided Reddit/Gemini creds yet, pause and ask them to: create a Reddit "script" app at reddit.com/prefs/apps and a Gemini key at aistudio.google.com/apikey, fill `.env.local` per `.env.example`)

```powershell
npm run dev
```

Then in a second terminal: `Invoke-RestMethod -Method POST http://localhost:3000/api/collect` → JSON summary with `added > 0`. Then `Invoke-RestMethod -Method POST http://localhost:3000/api/score` → JSON with `scored > 0`. Inspect: `npx prisma studio` → Evaluation rows have per-dimension evidence.

- [ ] **Step 7: Commit:** `git add -A; git commit -m "feat: collect and score orchestration with API routes"`

---

### Task 12: Queue page (dashboard home)

**Files:**
- Create: `src/components/StatusBadge.tsx`, `src/components/RunButtons.tsx`
- Modify: `src/app/page.tsx` (replace scaffold content), `src/app/layout.tsx` (title "Founder Discovery", simple header)

**Interfaces:**
- Consumes: `prisma` (Task 2), routes (Task 11).
- Produces: `/` — leads grouped by status, each row linking to `/leads/[id]` (Task 13).

- [ ] **Step 1: Implement `src/components/StatusBadge.tsx`**

```tsx
import { Badge } from "@/components/ui/badge";

const STYLES: Record<string, string> = {
  PURSUE_NOW: "bg-red-600 text-white", PURSUE: "bg-orange-500 text-white",
  MAYBE_LATER: "bg-yellow-500 text-black", NEW: "bg-blue-500 text-white",
  APPROVED: "bg-green-600 text-white", SENT: "bg-green-900 text-white",
  REJECTED: "bg-gray-400 text-white", DISQUALIFIED: "bg-gray-300 text-gray-700",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge className={STYLES[status] ?? ""}>{status.replace("_", " ")}</Badge>;
}
```

- [ ] **Step 2: Implement `src/components/RunButtons.tsx`**

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function RunButtons() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function run(path: string, label: string) {
    setBusy(label); setResult(null);
    try {
      const res = await fetch(path, { method: "POST" });
      setResult(`${label}: ${JSON.stringify(await res.json())}`);
      router.refresh();
    } catch (e) { setResult(`${label} failed: ${String(e)}`); }
    setBusy(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Button onClick={() => run("/api/collect", "Collect")} disabled={busy !== null}>
          {busy === "Collect" ? "Collecting…" : "Collect leads"}
        </Button>
        <Button variant="secondary" onClick={() => run("/api/score", "Score")} disabled={busy !== null}>
          {busy === "Score" ? "Scoring…" : "Score NEW leads"}
        </Button>
      </div>
      {result && <p className="text-xs text-muted-foreground font-mono break-all">{result}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Implement `src/app/page.tsx`**

```tsx
import Link from "next/link";
import { prisma } from "@/lib/db";
import { RunButtons } from "@/components/RunButtons";
import { StatusBadge } from "@/components/StatusBadge";
import { FounderProfile } from "@/lib/sources/types";

export const dynamic = "force-dynamic";

const ORDER = ["PURSUE_NOW", "PURSUE", "MAYBE_LATER", "APPROVED", "SENT", "NEW", "REJECTED", "DISQUALIFIED"];

export default async function Home() {
  const leads = await prisma.lead.findMany({
    include: { evaluations: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { updatedAt: "desc" },
  });
  const groups = ORDER.map((status) => ({ status, items: leads.filter((l) => l.status === status) }))
    .filter((g) => g.items.length > 0);

  return (
    <main className="mx-auto max-w-4xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Lead Queue</h1>
        <Link className="text-sm underline" href="/settings">Settings</Link>
      </div>
      <RunButtons />
      {groups.length === 0 && <p className="text-muted-foreground">No leads yet. Run Collect.</p>}
      {groups.map((g) => (
        <section key={g.status} className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">{g.status.replace("_", " ")} ({g.items.length})</h2>
          <ul className="divide-y rounded border">
            {g.items.map((lead) => {
              const p = JSON.parse(lead.profile) as FounderProfile;
              const ev = lead.evaluations[0];
              return (
                <li key={lead.id}>
                  <Link href={`/leads/${lead.id}`} className="flex items-center gap-3 p-3 hover:bg-muted">
                    <StatusBadge status={lead.status} />
                    <span className="font-medium">{p.founderName !== "Unknown" ? p.founderName : p.company}</span>
                    <span className="text-sm text-muted-foreground truncate flex-1">
                      {ev?.summary ?? p.rawText.slice(0, 80)}
                    </span>
                    {ev && <span className="text-sm font-mono">{ev.weighted}/5</span>}
                    <span className="text-xs uppercase text-muted-foreground">{lead.source}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </main>
  );
}
```

- [ ] **Step 4: Update `src/app/layout.tsx` metadata** — set `title: "Founder Discovery"`, `description: "Clarity Research lead pipeline"`. Remove scaffold boilerplate from the page if any remains.

- [ ] **Step 5: Manual verify:** `npm run dev` → `/` shows grouped leads from Task 11's smoke test, buttons work, rows link (404 for now is fine).

- [ ] **Step 6: Commit:** `git add -A; git commit -m "feat: lead queue dashboard"`

---

### Task 13: Lead dossier page + actions (draft, approve, send, reject)

**Files:**
- Create: `src/app/actions.ts`, `src/app/leads/[id]/page.tsx`, `src/components/DraftPanel.tsx`

**Interfaces:**
- Consumes: `prisma`, `getConfig` (Task 2), `generateOutreach` (Task 10), types from Tasks 3/8.
- Produces server actions:

```ts
export async function generateDraftAction(leadId: string): Promise<void>; // guards: status PURSUE_NOW | PURSUE only
export async function approveDraftAction(draftId: string, editedMessage: string): Promise<void>; // sets draft approved + lead APPROVED
export async function markSentAction(leadId: string): Promise<void>;      // APPROVED -> SENT
export async function rejectLeadAction(leadId: string): Promise<void>;    // any -> REJECTED
```

- [ ] **Step 1: Implement `src/app/actions.ts`**

```ts
"use server";
import { revalidatePath } from "next/cache";
import { getConfig, saveConfig, AppConfig } from "@/lib/config";
import { prisma } from "@/lib/db";
import { EvaluationResult } from "@/lib/pipeline/evaluate";
import { generateOutreach } from "@/lib/pipeline/outreach";
import { FounderProfile } from "@/lib/sources/types";

export async function generateDraftAction(leadId: string): Promise<void> {
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId }, include: { evaluations: { orderBy: { createdAt: "desc" }, take: 1 } } });
  if (!["PURSUE_NOW", "PURSUE"].includes(lead.status)) throw new Error("Drafts only for Pursue leads (spec workflow order)");
  const ev = lead.evaluations[0];
  if (!ev) throw new Error("Lead has no evaluation");
  const profile = JSON.parse(lead.profile) as FounderProfile;
  const evaluation: EvaluationResult = {
    summary: ev.summary, observedFacts: JSON.parse(ev.observedFacts), inferences: JSON.parse(ev.inferences),
    scores: JSON.parse(ev.scores), whyNow: ev.whyNow, risks: JSON.parse(ev.risks),
    missingInformation: JSON.parse(ev.missingInfo), overallConfidence: ev.overallConfidence as EvaluationResult["overallConfidence"],
  };
  const draft = await generateOutreach(profile, evaluation, await getConfig());
  await prisma.draft.create({ data: { leadId, ...draft } });
  revalidatePath(`/leads/${leadId}`);
}

export async function approveDraftAction(draftId: string, editedMessage: string): Promise<void> {
  const draft = await prisma.draft.update({ where: { id: draftId }, data: { approved: true, editedMessage } });
  await prisma.lead.update({ where: { id: draft.leadId }, data: { status: "APPROVED" } });
  revalidatePath(`/leads/${draft.leadId}`); revalidatePath("/");
}

export async function markSentAction(leadId: string): Promise<void> {
  await prisma.lead.update({ where: { id: leadId }, data: { status: "SENT" } });
  revalidatePath(`/leads/${leadId}`); revalidatePath("/");
}

export async function rejectLeadAction(leadId: string): Promise<void> {
  await prisma.lead.update({ where: { id: leadId }, data: { status: "REJECTED" } });
  revalidatePath(`/leads/${leadId}`); revalidatePath("/");
}

export async function saveSettingsAction(patch: Partial<AppConfig>): Promise<void> {
  await saveConfig(patch);
  revalidatePath("/settings");
}
```

- [ ] **Step 2: Implement `src/components/DraftPanel.tsx`**

```tsx
"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { approveDraftAction, generateDraftAction, markSentAction } from "@/app/actions";

interface DraftData { id: string; primaryHook: string; desiredOutcome: string; callToAction: string; message: string; editedMessage: string | null; approved: boolean }

export function DraftPanel({ leadId, leadStatus, draft }: { leadId: string; leadStatus: string; draft: DraftData | null }) {
  const [pending, start] = useTransition();
  const [text, setText] = useState(draft ? draft.editedMessage ?? draft.message : "");
  const [copied, setCopied] = useState(false);
  const canDraft = ["PURSUE_NOW", "PURSUE"].includes(leadStatus);

  if (!draft) {
    return canDraft
      ? <Button onClick={() => start(() => generateDraftAction(leadId))} disabled={pending}>{pending ? "Generating…" : "Generate draft"}</Button>
      : <p className="text-sm text-muted-foreground">Drafts are only generated for Pursue leads.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="text-sm grid gap-1">
        <p><b>Primary Hook:</b> {draft.primaryHook}</p>
        <p><b>Desired Outcome:</b> {draft.desiredOutcome}</p>
        <p><b>Call to Action:</b> {draft.callToAction}</p>
      </div>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} />
      <div className="flex gap-2 flex-wrap">
        <Button variant="secondary" onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
          {copied ? "Copied!" : "Copy message"}
        </Button>
        {!draft.approved && (
          <Button onClick={() => start(() => approveDraftAction(draft.id, text))} disabled={pending}>Approve</Button>
        )}
        {leadStatus === "APPROVED" && (
          <Button onClick={() => start(() => markSentAction(leadId))} disabled={pending}>Mark sent</Button>
        )}
        {canDraft && (
          <Button variant="outline" onClick={() => start(() => generateDraftAction(leadId))} disabled={pending}>Regenerate</Button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Implement `src/app/leads/[id]/page.tsx`** (the dossier — mirrors the spec's Output Format)

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { DraftPanel } from "@/components/DraftPanel";
import { StatusBadge } from "@/components/StatusBadge";
import { RejectButton } from "@/components/RejectButton";
import { DIMENSIONS, EvaluationResult } from "@/lib/pipeline/evaluate";
import { FounderProfile, UNKNOWN } from "@/lib/sources/types";

export const dynamic = "force-dynamic";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-1"><h2 className="text-sm font-semibold uppercase text-muted-foreground">{title}</h2>{children}</section>;
}

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: { evaluations: { orderBy: { createdAt: "desc" }, take: 1 }, drafts: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!lead) notFound();
  const p = JSON.parse(lead.profile) as FounderProfile;
  const ev = lead.evaluations[0];
  const scores = ev ? (JSON.parse(ev.scores) as EvaluationResult["scores"]) : null;

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <Link href="/" className="text-sm underline">← Queue</Link>
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">{p.founderName !== UNKNOWN ? p.founderName : p.company}</h1>
        <StatusBadge status={lead.status} />
        <a href={lead.sourceUrl} target="_blank" className="text-sm underline">{lead.source === "reddit" ? "Reddit post" : "YC profile"} ↗</a>
        {p.website !== UNKNOWN && <a href={p.website} target="_blank" className="text-sm underline">Website ↗</a>}
        <RejectButton leadId={lead.id} />
      </div>

      <Section title="Profile">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {([["Company", p.company], ["Location", p.location], ["Stage", p.stage], ["Team size", String(p.teamSize)], ["Funding", p.funding], ["Revenue", p.revenue], ["Reachability", p.reachability], ["Channel", p.channel]] as const)
            .map(([k, v]) => <div key={k}><dt className="inline font-medium">{k}: </dt><dd className="inline text-muted-foreground">{v}</dd></div>)}
        </dl>
      </Section>

      {lead.disqualifyReason && <Section title="Disqualified"><p className="text-sm">{lead.disqualifyReason}</p></Section>}
      {lead.error && <Section title="Last error"><p className="text-sm text-red-600">{lead.error}</p></Section>}

      {ev && scores && (
        <>
          <Section title="Summary"><p className="text-sm">{ev.summary}</p></Section>
          <Section title="Observed Facts">
            <ul className="list-disc pl-5 text-sm">{(JSON.parse(ev.observedFacts) as string[]).map((f, i) => <li key={i}>{f}</li>)}</ul>
          </Section>
          <Section title="Inferences">
            <ul className="list-disc pl-5 text-sm">
              {(JSON.parse(ev.inferences) as { text: string; confidence: string }[]).map((inf, i) => <li key={i}>{inf.text} <em className="text-muted-foreground">({inf.confidence})</em></li>)}
            </ul>
          </Section>
          <Section title="Scoring Breakdown">
            <div className="space-y-2 text-sm">
              {DIMENSIONS.map((d) => (
                <div key={d}>
                  <p className="font-medium">{d}: {scores[d].score}/5</p>
                  {scores[d].evidence.length > 0 && <ul className="list-disc pl-5 text-muted-foreground">{scores[d].evidence.map((e, i) => <li key={i}>{e}</li>)}</ul>}
                </div>
              ))}
            </div>
          </Section>
          <Section title="Why Now"><p className="text-sm">{ev.whyNow ?? "No why-now trigger — not urgent."}</p></Section>
          <Section title="Decision">
            <p className="text-sm"><b>{ev.decision.replace("_", " ")}</b> (weighted {ev.weighted}/5, confidence {ev.overallConfidence}) — {ev.reason}</p>
          </Section>
          <Section title="Risks">
            <ul className="list-disc pl-5 text-sm">{(JSON.parse(ev.risks) as string[]).map((r, i) => <li key={i}>{r}</li>)}</ul>
          </Section>
          <Section title="Missing Information">
            <ul className="list-disc pl-5 text-sm">{(JSON.parse(ev.missingInfo) as string[]).map((m, i) => <li key={i}>{m}</li>)}</ul>
          </Section>
        </>
      )}

      <Section title="Source text"><pre className="text-xs whitespace-pre-wrap rounded bg-muted p-3">{p.rawText}</pre></Section>

      <Section title="Outreach">
        <DraftPanel leadId={lead.id} leadStatus={lead.status} draft={lead.drafts[0] ?? null} />
      </Section>
    </main>
  );
}
```

- [ ] **Step 4: Implement `src/components/RejectButton.tsx`**

```tsx
"use client";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { rejectLeadAction } from "@/app/actions";

export function RejectButton({ leadId }: { leadId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button variant="destructive" size="sm" onClick={() => start(() => rejectLeadAction(leadId))} disabled={pending}>
      Reject
    </Button>
  );
}
```

- [ ] **Step 5: Manual verify:** open a scored lead → full dossier renders every spec Output Format section; Generate draft on a Pursue lead → hook/outcome/CTA + message appear; edit → Approve → status APPROVED; Copy works; Mark sent → SENT; Reject works; draft generation refuses on MAYBE_LATER lead.

- [ ] **Step 6: Commit:** `git add -A; git commit -m "feat: lead dossier page with draft review workflow"`

---

### Task 14: Settings page

**Files:**
- Create: `src/app/settings/page.tsx`, `src/components/SettingsForm.tsx`

**Interfaces:**
- Consumes: `getConfig`, `AppConfig` (Task 2), `saveSettingsAction` (Task 13).

- [ ] **Step 1: Implement `src/app/settings/page.tsx`**

```tsx
import Link from "next/link";
import { getConfig } from "@/lib/config";
import { SettingsForm } from "@/components/SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const cfg = await getConfig();
  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6">
      <Link href="/" className="text-sm underline">← Queue</Link>
      <h1 className="text-2xl font-bold">Settings</h1>
      <SettingsForm cfg={cfg} />
    </main>
  );
}
```

- [ ] **Step 2: Implement `src/components/SettingsForm.tsx`**

```tsx
"use client";
import { useState, useTransition } from "react";
import { AppConfig } from "@/lib/config";
import { saveSettingsAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SettingsForm({ cfg }: { cfg: AppConfig }) {
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [pricing, setPricing] = useState(cfg.pricing);
  const [subreddits, setSubreddits] = useState(cfg.subreddits.join(", "));
  const [ycBatches, setYcBatches] = useState(cfg.ycBatches.join(", "));
  const [weights, setWeights] = useState(cfg.weights);
  const [thresholds, setThresholds] = useState(cfg.thresholds);

  function save() {
    start(async () => {
      await saveSettingsAction({
        pricing,
        subreddits: subreddits.split(",").map((s) => s.trim()).filter(Boolean),
        ycBatches: ycBatches.split(",").map((s) => s.trim()).filter(Boolean),
        weights, thresholds,
      });
      setSaved(true); setTimeout(() => setSaved(false), 1500);
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label>Pricing (runtime — empty means drafts never mention price)</Label>
        <Input value={pricing} onChange={(e) => setPricing(e.target.value)} placeholder="e.g. Reports start at $299" />
      </div>
      <div className="space-y-1">
        <Label>Subreddits (comma-separated, no r/)</Label>
        <Input value={subreddits} onChange={(e) => setSubreddits(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label>YC batches (comma-separated)</Label>
        <Input value={ycBatches} onChange={(e) => setYcBatches(e.target.value)} />
      </div>
      <fieldset className="space-y-1">
        <Label>Scoring weights (calibration)</Label>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(weights) as (keyof AppConfig["weights"])[]).map((k) => (
            <div key={k}>
              <Label className="text-xs">{k}</Label>
              <Input type="number" step="0.05" value={weights[k]} onChange={(e) => setWeights({ ...weights, [k]: Number(e.target.value) })} />
            </div>
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-1">
        <Label>Decision thresholds (weighted /5)</Label>
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-xs">pursue ≥</Label><Input type="number" step="0.1" value={thresholds.pursue} onChange={(e) => setThresholds({ ...thresholds, pursue: Number(e.target.value) })} /></div>
          <div><Label className="text-xs">maybeLater ≥</Label><Input type="number" step="0.1" value={thresholds.maybeLater} onChange={(e) => setThresholds({ ...thresholds, maybeLater: Number(e.target.value) })} /></div>
        </div>
      </fieldset>
      <Button onClick={save} disabled={pending}>{saved ? "Saved!" : pending ? "Saving…" : "Save"}</Button>
    </div>
  );
}
```

- [ ] **Step 3: Manual verify:** change pricing + a weight → Save → reload → values persist; generate a draft → pricing text respected.

- [ ] **Step 4: Commit:** `git add -A; git commit -m "feat: settings page for runtime config and calibration"`

---

### Task 15: README + calibration procedure + final check

**Files:**
- Create: `README.md`
- Modify: none

- [ ] **Step 1: Write `README.md`** covering: what this is (one paragraph); setup (clone, `npm i`, copy `.env.example` → `.env.local`, create Reddit script app at reddit.com/prefs/apps, Gemini key at aistudio.google.com/apikey, `npx prisma db push`); daily usage (Collect → Score → review dossiers → Generate draft → edit/Approve → Copy → send manually → Mark sent); calibration procedure from the spec (score 15–20 real leads, check ranked output against "would plausibly pay this month", adjust weights/thresholds in Settings, re-check); pointer to `docs/product-spec.md` as behavior source of truth.

- [ ] **Step 2: Full verification**

```powershell
npm test          # all suites pass
npm run build     # production build succeeds
```

- [ ] **Step 3: Commit:** `git add -A; git commit -m "docs: README with setup, usage, calibration"`

---

## Spec Coverage Check

| Spec requirement | Where |
|---|---|
| Source-agnostic scoring / add source = new normalizer | Task 3 types boundary, Tasks 5–6, Task 11 `SourceRunner` |
| Founder Schema + Unknown | Task 3 `FounderProfile` + `UNKNOWN` |
| Reddit + YC v1 sources | Tasks 5, 6 |
| Immediate Disqualifiers before scoring effort | Task 4, wired before LLM in Task 11 |
| 6 weighted dimensions, evidence per score, no composite-only | Task 8 schema, Task 13 dossier shows full breakdown |
| Why Now gate | Task 8 (null unless concrete trigger), Task 9 (PURSUE_NOW vs PURSUE) |
| Evidence discipline (facts vs inferences, confidence) | Task 8 prompt + schema, Task 13 dossier |
| Uncertainty → Unknown → Missing Information | Task 8 prompt + `missingInformation`, Task 13 |
| Final Decision 4-way + 1–2 sentence reason | Task 9 |
| Calibration with adjustable weights | Task 14 settings, Task 15 README procedure |
| Workflow order: strategy before email, review before send | Task 10 prompt order, Task 13 guard + approve flow |
| Output Format per founder | Task 13 dossier sections |
| Pricing from runtime config, never hardcoded | Task 2 config, Task 10 prompt, Task 14 UI |
| Never mention AI, human-reviewed | Task 10 prompt rules, Task 13 approve-before-copy flow |
| Precision over recall / reject when in doubt | Task 8 prompt, Task 9 thresholds |
