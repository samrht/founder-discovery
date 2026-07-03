"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function RunButtons() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function run(path: string, label: string) {
    setBusy(label);
    setResult(null);
    try {
      const res = await fetch(path, { method: "POST" });
      setResult(`${label}: ${JSON.stringify(await res.json())}`);
      router.refresh();
    } catch (e) {
      setResult(`${label} failed: ${String(e)}`);
    }
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
