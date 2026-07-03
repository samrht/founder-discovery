import { Badge } from "@/components/ui/badge";

const STYLES: Record<string, string> = {
  PURSUE_NOW: "bg-red-600 text-white",
  PURSUE: "bg-orange-500 text-white",
  MAYBE_LATER: "bg-yellow-500 text-black",
  NEW: "bg-blue-500 text-white",
  APPROVED: "bg-green-600 text-white",
  SENT: "bg-green-900 text-white",
  REJECTED: "bg-gray-400 text-white",
  DISQUALIFIED: "bg-gray-300 text-gray-700",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge className={STYLES[status] ?? ""}>{status.replace("_", " ")}</Badge>;
}
