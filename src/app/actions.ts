"use server";
import { revalidatePath } from "next/cache";
import { getConfig, saveConfig, AppConfig } from "@/lib/config";
import { prisma } from "@/lib/db";
import { EvaluationResult } from "@/lib/pipeline/evaluate";
import { generateOutreach } from "@/lib/pipeline/outreach";
import { FounderProfile } from "@/lib/sources/types";

export async function generateDraftAction(leadId: string): Promise<void> {
  const lead = await prisma.lead.findUniqueOrThrow({
    where: { id: leadId },
    include: { evaluations: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!["PURSUE_NOW", "PURSUE"].includes(lead.status)) {
    throw new Error("Drafts only for Pursue leads (spec workflow order)");
  }
  const ev = lead.evaluations[0];
  if (!ev) throw new Error("Lead has no evaluation");
  const profile = JSON.parse(lead.profile) as FounderProfile;
  const evaluation: EvaluationResult = {
    summary: ev.summary,
    observedFacts: JSON.parse(ev.observedFacts),
    inferences: JSON.parse(ev.inferences),
    scores: JSON.parse(ev.scores),
    whyNow: ev.whyNow,
    risks: JSON.parse(ev.risks),
    missingInformation: JSON.parse(ev.missingInfo),
    overallConfidence: ev.overallConfidence as EvaluationResult["overallConfidence"],
  };
  const draft = await generateOutreach(profile, evaluation, await getConfig());
  await prisma.draft.create({ data: { leadId, ...draft } });
  revalidatePath(`/leads/${leadId}`);
}

export async function approveDraftAction(draftId: string, editedMessage: string): Promise<void> {
  const draft = await prisma.draft.update({ where: { id: draftId }, data: { approved: true, editedMessage } });
  await prisma.lead.update({ where: { id: draft.leadId }, data: { status: "APPROVED" } });
  revalidatePath(`/leads/${draft.leadId}`);
  revalidatePath("/");
}

export async function markSentAction(leadId: string): Promise<void> {
  await prisma.lead.update({ where: { id: leadId }, data: { status: "SENT" } });
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/");
}

export async function rejectLeadAction(leadId: string): Promise<void> {
  await prisma.lead.update({ where: { id: leadId }, data: { status: "REJECTED" } });
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/");
}

export async function saveSettingsAction(patch: Partial<AppConfig>): Promise<void> {
  await saveConfig(patch);
  revalidatePath("/settings");
}
