"use client";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setOutcomeAction } from "@/app/actions";
import { OUTCOMES, OUTCOME_LABELS, Outcome } from "@/lib/outcomes";

export function OutcomePicker({ leadId, outcome }: { leadId: string; outcome: string | null }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-2 flex-wrap">
      {OUTCOMES.map((o: Outcome) => (
        <Button
          key={o}
          size="sm"
          variant={outcome === o ? "default" : "outline"}
          disabled={pending}
          onClick={() => start(() => setOutcomeAction(leadId, outcome === o ? null : o))}
        >
          {OUTCOME_LABELS[o]}
        </Button>
      ))}
    </div>
  );
}
