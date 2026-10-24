import type { Metadata } from "next";
import { loadStages } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/misc";
import { StagesEditor } from "@/components/settings/stages-editor";
import { AccountSettings } from "@/components/settings/account-settings";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const [stages, { data }] = await Promise.all([loadStages(), supabase.auth.getClaims()]);
  const username = (data?.claims?.user_metadata as { username?: string } | undefined)?.username ?? "";

  return (
    <div className="max-w-2xl">
      <PageHeader title="Settings" />
      <section className="mb-10">
        <h2 className="text-lg font-semibold">Stages</h2>
        <p className="mb-4 text-sm text-muted">
          These are the stages you can pick from when creating a project, in this order. You enter the days per stage for each project; the default days here are only shown as a reference when editing a task. Changes don’t affect existing projects.
        </p>
        <StagesEditor key={stages.map((s) => `${s.id}:${s.updated_at}`).join("|")} stages={stages} />
      </section>
      <section>
        <h2 className="mb-4 text-lg font-semibold">Account</h2>
        <AccountSettings username={username} />
      </section>
    </div>
  );
}
