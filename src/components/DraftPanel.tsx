"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { approveDraftAction, generateDraftAction, markSentAction } from "@/app/actions";

interface DraftData {
  id: string;
  primaryHook: string;
  desiredOutcome: string;
  callToAction: string;
  message: string;
  editedMessage: string | null;
  approved: boolean;
}

export function DraftPanel({
  leadId,
  leadStatus,
  draft,
}: {
  leadId: string;
  leadStatus: string;
  draft: DraftData | null;
}) {
  const [pending, start] = useTransition();
  const [text, setText] = useState(draft ? draft.editedMessage ?? draft.message : "");
  const [copied, setCopied] = useState(false);
  const canDraft = ["PURSUE_NOW", "PURSUE"].includes(leadStatus);

  if (!draft) {
    return canDraft ? (
      <Button onClick={() => start(() => generateDraftAction(leadId))} disabled={pending}>
        {pending ? "Generating…" : "Generate draft"}
      </Button>
    ) : (
      <p className="text-sm text-muted-foreground">Drafts are only generated for Pursue leads.</p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-sm grid gap-1">
        <p>
          <b>Primary Hook:</b> {draft.primaryHook}
        </p>
        <p>
          <b>Desired Outcome:</b> {draft.desiredOutcome}
        </p>
        <p>
          <b>Call to Action:</b> {draft.callToAction}
        </p>
      </div>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} />
      <div className="flex gap-2 flex-wrap">
        <Button
          variant="secondary"
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "Copied!" : "Copy message"}
        </Button>
        {!draft.approved && (
          <Button onClick={() => start(() => approveDraftAction(draft.id, text))} disabled={pending}>
            Approve
          </Button>
        )}
        {leadStatus === "APPROVED" && (
          <Button onClick={() => start(() => markSentAction(leadId))} disabled={pending}>
            Mark sent
          </Button>
        )}
        {canDraft && (
          <Button variant="outline" onClick={() => start(() => generateDraftAction(leadId))} disabled={pending}>
            Regenerate
          </Button>
        )}
      </div>
    </div>
  );
}
