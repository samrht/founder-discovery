import { runScoring } from "@/lib/scoreRun";

export async function POST() {
  return Response.json(await runScoring());
}
