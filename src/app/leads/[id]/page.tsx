import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { DraftPanel } from "@/components/DraftPanel";
import { RejectButton } from "@/components/RejectButton";
import { StatusBadge } from "@/components/StatusBadge";
import { DIMENSIONS, EvaluationResult } from "@/lib/pipeline/evaluate";
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
  const p = JSON.parse(lead.profile) as FounderProfile;
  const ev = lead.evaluations[0];
  const scores = ev ? (JSON.parse(ev.scores) as EvaluationResult["scores"]) : null;

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
        <RejectButton leadId={lead.id} />
      </div>

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
    </main>
  );
}
