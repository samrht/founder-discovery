import { runCollect } from "@/lib/ingest";

export async function POST() {
  return Response.json(await runCollect());
}
