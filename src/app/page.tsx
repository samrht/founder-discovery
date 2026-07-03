import Link from "next/link";
import { prisma } from "@/lib/db";
import { FreshnessDot } from "@/components/FreshnessDot";
import { RunButtons } from "@/components/RunButtons";
import { StatusBadge } from "@/components/StatusBadge";
import { fitScore } from "@/lib/fit";
import { OUTCOME_LABELS, Outcome } from "@/lib/outcomes";
import { FounderProfile } from "@/lib/sources/types";

export const dynamic = "force-dynamic";

const ORDER = ["PURSUE_NOW", "PURSUE", "MAYBE_LATER", "APPROVED", "SENT", "NEW", "REJECTED", "DISQUALIFIED"];

export default async function Home() {
  const leads = await prisma.lead.findMany({
    include: { evaluations: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { updatedAt: "desc" },
  });
  const groups = ORDER.map((status) => ({ status, items: leads.filter((l) => l.status === status) })).filter(
    (g) => g.items.length > 0,
  );
  const outcomeCounts = leads.reduce<Record<string, number>>((acc, l) => {
    if (l.outcome) acc[l.outcome] = (acc[l.outcome] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <main className="mx-auto max-w-4xl w-full p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Lead Queue</h1>
        <Link className="text-sm underline" href="/settings">
          Settings
        </Link>
      </div>
      <RunButtons />
      {Object.keys(outcomeCounts).length > 0 && (
        <p className="text-sm text-muted-foreground">
          Outreach so far:{" "}
          {Object.entries(outcomeCounts)
            .map(([o, n]) => `${OUTCOME_LABELS[o as Outcome] ?? o} ${n}`)
            .join(" · ")}{" "}
          — use these to calibrate weights in Settings.
        </p>
      )}
      {groups.length === 0 && <p className="text-muted-foreground">No leads yet. Run Collect.</p>}
      {groups.map((g) => (
        <section key={g.status} className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {g.status.replace("_", " ")} ({g.items.length})
          </h2>
          <ul className="divide-y rounded border">
            {g.items.map((lead) => {
              const p = JSON.parse(lead.profile) as FounderProfile;
              const ev = lead.evaluations[0];
              return (
                <li key={lead.id}>
                  <Link href={`/leads/${lead.id}`} className="flex items-center gap-3 p-3 hover:bg-muted">
                    <FreshnessDot activityAt={lead.activityAt} />
                    <StatusBadge status={lead.status} />
                    <span className="font-medium">{p.founderName !== "Unknown" ? p.founderName : p.company}</span>
                    <span className="text-sm text-muted-foreground truncate flex-1">
                      {ev?.summary ?? p.rawText.slice(0, 80)}
                    </span>
                    {ev && (
                      <span className="text-sm font-mono" title={`weighted ${ev.weighted}/5`}>
                        {fitScore(ev.weighted)}/100
                      </span>
                    )}
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
