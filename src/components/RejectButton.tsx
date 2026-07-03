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
