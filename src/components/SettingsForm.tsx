"use client";
import { useState, useTransition } from "react";
import { AppConfig } from "@/lib/config";
import { saveSettingsAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SettingsForm({ cfg }: { cfg: AppConfig }) {
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [pricing, setPricing] = useState(cfg.pricing);
  const [subreddits, setSubreddits] = useState(cfg.subreddits.join(", "));
  const [ycBatches, setYcBatches] = useState(cfg.ycBatches.join(", "));
  const [weights, setWeights] = useState(cfg.weights);
  const [thresholds, setThresholds] = useState(cfg.thresholds);

  function save() {
    start(async () => {
      await saveSettingsAction({
        pricing,
        subreddits: subreddits.split(",").map((s) => s.trim()).filter(Boolean),
        ycBatches: ycBatches.split(",").map((s) => s.trim()).filter(Boolean),
        weights,
        thresholds,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label>Pricing (runtime — empty means drafts never mention price)</Label>
        <Input value={pricing} onChange={(e) => setPricing(e.target.value)} placeholder="e.g. Reports start at $299" />
      </div>
      <div className="space-y-1">
        <Label>Subreddits (comma-separated, no r/)</Label>
        <Input value={subreddits} onChange={(e) => setSubreddits(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label>YC batches (comma-separated)</Label>
        <Input value={ycBatches} onChange={(e) => setYcBatches(e.target.value)} />
      </div>
      <fieldset className="space-y-1">
        <Label>Scoring weights (calibration)</Label>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(weights) as (keyof AppConfig["weights"])[]).map((k) => (
            <div key={k}>
              <Label className="text-xs">{k}</Label>
              <Input
                type="number"
                step="0.05"
                value={weights[k]}
                onChange={(e) => setWeights({ ...weights, [k]: Number(e.target.value) })}
              />
            </div>
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-1">
        <Label>Decision thresholds (weighted /5)</Label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">pursue ≥</Label>
            <Input
              type="number"
              step="0.1"
              value={thresholds.pursue}
              onChange={(e) => setThresholds({ ...thresholds, pursue: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label className="text-xs">maybeLater ≥</Label>
            <Input
              type="number"
              step="0.1"
              value={thresholds.maybeLater}
              onChange={(e) => setThresholds({ ...thresholds, maybeLater: Number(e.target.value) })}
            />
          </div>
        </div>
      </fieldset>
      <Button onClick={save} disabled={pending}>
        {saved ? "Saved!" : pending ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
