import Link from "next/link";
import { getConfig } from "@/lib/config";
import { SettingsForm } from "@/components/SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const cfg = await getConfig();
  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6">
      <Link href="/" className="text-sm underline">
        ← Queue
      </Link>
      <h1 className="text-2xl font-bold">Settings</h1>
      <SettingsForm cfg={cfg} />
    </main>
  );
}
