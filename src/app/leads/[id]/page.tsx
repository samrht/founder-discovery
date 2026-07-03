import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { DraftPanel } from "@/components/DraftPanel";
import { FreshnessDot } from "@/components/FreshnessDot";
import { OutcomePicker } from "@/components/OutcomePicker";
import { RejectButton } from "@/components/RejectButton";
import { StatusBadge } from "@/components/StatusBadge";
import { getConfig } from "@/lib/config";
import { fitScore, fitReasons } from "@/lib/fit";
import { DIMENSIONS, EvaluationResult, ReportValue, Snapshot } from "@/lib/pipeline/evaluate";
import { FounderProfile, UNKNOWN } from "@/lib/sources/types";

export const dynamic = "force-dynamic";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1">
      <h2 className="text-sm font-semibold uppercase text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      evaluations: { orderBy: { createdAt: "desc" }, take: 1 },
      drafts: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!lead) notFound();
  const cfg = await getConfig();
  const p = JSON.parse(lead.profile) as FounderProfile;
  const ev = lead.evaluations[0];
  const scores = ev ? (JSON.parse(ev.scores) as EvaluationResult["scores"]) : null;
  const snapshot = ev?.snapshot ? (JSON.parse(ev.snapshot) as Snapshot) : null;
  const reportValue = ev?.reportValue ? (JSON.parse(ev.reportValue) as ReportValue) : null;
  const reasons = ev && scores ? fitReasons({ scores, whyNow: ev.whyNow }, cfg) : [];

  return (
    <main className="mx-auto max-w-3xl w-full p-6 space-y-6">
      <Link href="/" className="text-sm underline">
        ← Queue
      </Link>
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">{p.founderName !== UNKNOWN ? p.founderName : p.company}</h1>
        <StatusBadge status={lead.status} />
        <a href={lead.sourceUrl} target="_blank" className="text-sm underline">
          {({ reddit: "Reddit post", yc: "YC profile", hn: "HN post", edgar: "SEC Form D filing" } as Record<string, string>)[lead.source] ?? lead.source} ↗
        </a>
        {p.website !== UNKNOWN && (
          <a href={p.website} target="_blank" className="text-sm underline">
            Website ↗
          </a>
        )}
        <FreshnessDot activityAt={lead.activityAt} showLabel />
        <RejectButton leadId={lead.id} />
      </div>

      {ev && (
        <div className="rounded-lg border p-4 space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold uppercase text-muted-foreground">Clarity Fit</span>
            <span className="text-3xl font-bold">{fitScore(ev.weighted)}</span>
            <span className="text-muted-foreground">/100</span>
          </div>
          {reasons.length > 0 && (
            <ul className="text-sm space-y-0.5">
              {reasons.map((r, i) => (
                <li key={i}>
                  <span className="text-green-600 mr-1.5">✓</span>
                  {r}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {snapshot && (
        <div className="rounded-lg border p-4 space-y-1.5">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground">30-Second Brief</h2>
          <dl className="text-sm space-y-1">
            {(
              [
                ["Company", p.company !== UNKNOWN ? p.company : ev?.summary ?? UNKNOWN],
                ["Problem", snapshot.problem],
                ["Biggest Competitor", snapshot.biggestCompetitor],
                ["Biggest Opportunity", snapshot.biggestOpportunity],
                ["Suggested Hook", snapshot.suggestedHook],
              ] as const
            ).map(([k, v]) => (
              <div key={k}>
                <dt className="inline font-medium">{k}: </dt>
                <dd className="inline text-muted-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {reportValue && (
        <div className="rounded-lg border p-4 space-y-1.5">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground">Can Clarity Help?</h2>
          <p className="text-xl" aria-label={`${reportValue.stars} out of 5 stars`}>
            {"★".repeat(reportValue.stars)}
            <span className="text-muted-foreground">{"☆".repeat(5 - reportValue.stars)}</span>
          </p>
          {reportValue.sections.length > 0 && (
            <div className="text-sm">
              <p className="font-medium">Best report sections:</p>
              <ul className="space-y-0.5">
                {reportValue.sections.map((s) => (
                  <li key={s}>
                    <span className="text-green-600 mr-1.5">✓</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-sm text-muted-foreground">{reportValue.reason}</p>
        </div>
      )}

      <Section title="Profile">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {(
            [
              ["Company", p.company],
              ["Location", p.location],
              ["Stage", p.stage],
              ["Team size", String(p.teamSize)],
              ["Funding", p.funding],
              ["Revenue", p.revenue],
              ["Reachability", p.reachability],
              ["Channel", p.channel],
            ] as const
          ).map(([k, v]) => (
            <div key={k}>
              <dt className="inline font-medium">{k}: </dt>
              <dd className="inline text-muted-foreground">{v}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {lead.disqualifyReason && (
        <Section title="Disqualified">
          <p className="text-sm">{lead.disqualifyReason}</p>
        </Section>
      )}
      {lead.error && (
        <Section title="Last error">
          <p className="text-sm text-red-600">{lead.error}</p>
        </Section>
      )}

      {ev && scores && (
        <>
          <Section title="Summary">
            <p className="text-sm">{ev.summary}</p>
          </Section>
          <Section title="Observed Facts">
            <ul className="list-disc pl-5 text-sm">
              {(JSON.parse(ev.observedFacts) as string[]).map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </Section>
          <Section title="Inferences">
            <ul className="list-disc pl-5 text-sm">
              {(JSON.parse(ev.inferences) as { text: string; confidence: string }[]).map((inf, i) => (
                <li key={i}>
                  {inf.text} <em className="text-muted-foreground">({inf.confidence})</em>
                </li>
              ))}
            </ul>
          </Section>
          <Section title="Scoring Breakdown">
            <div className="space-y-2 text-sm">
              {DIMENSIONS.map((d) => (
                <div key={d}>
                  <p className="font-medium">
                    {d}: {scores[d].score}/5
                  </p>
                  {scores[d].evidence.length > 0 && (
                    <ul className="list-disc pl-5 text-muted-foreground">
                      {scores[d].evidence.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </Section>
          <Section title="Why Now">
            <p className="text-sm">{ev.whyNow ?? "No why-now trigger — not urgent."}</p>
          </Section>
          <Section title="Decision">
            <p className="text-sm">
              <b>{ev.decision.replace("_", " ")}</b> (weighted {ev.weighted}/5, confidence {ev.overallConfidence}) —{" "}
              {ev.reason}
            </p>
          </Section>
          <Section title="Risks">
            <ul className="list-disc pl-5 text-sm">
              {(JSON.parse(ev.risks) as string[]).map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </Section>
          <Section title="Missing Information">
            <ul className="list-disc pl-5 text-sm">
              {(JSON.parse(ev.missingInfo) as string[]).map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </Section>
        </>
      )}

      <Section title="Source text">
        <pre className="text-xs whitespace-pre-wrap rounded bg-muted p-3">{p.rawText}</pre>
      </Section>

      <Section title="Outreach">
        <DraftPanel leadId={lead.id} leadStatus={lead.status} draft={lead.drafts[0] ?? null} />
      </Section>

      {ev && (
        <Section title="Outcome (feeds calibration)">
          <OutcomePicker leadId={lead.id} outcome={lead.outcome} />
        </Section>
      )}
    </main>
  );
}
