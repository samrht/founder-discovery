import { freshness } from "@/lib/fit";

const COLORS: Record<string, string> = {
  green: "bg-green-500",
  yellow: "bg-yellow-500",
  red: "bg-red-500",
  unknown: "bg-gray-300",
};

export function FreshnessDot({ activityAt, showLabel = false }: { activityAt: Date | string | null; showLabel?: boolean }) {
  const f = freshness(activityAt);
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" title={f.label}>
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${COLORS[f.bucket]}`} />
      {showLabel && f.label}
    </span>
  );
}
