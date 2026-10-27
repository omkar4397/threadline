import type { Metadata } from "next";
import { loadExpenseCategories, loadStages } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/misc";
import { StagesEditor } from "@/components/settings/stages-editor";
import { AccountSettings } from "@/components/settings/account-settings";
import { ExpenseCategoriesEditor } from "@/components/settings/expense-categories-editor";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const [stages, categories, { data: expenseRows }, { data }] = await Promise.all([
    loadStages(),
    loadExpenseCategories(),
    supabase.from("expenses").select("category_id"),
    supabase.auth.getClaims(),
  ]);
  const usage: Record<string, number> = {};
  for (const e of expenseRows ?? []) if (e.category_id) usage[e.category_id] = (usage[e.category_id] ?? 0) + 1;
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
      <section className="mb-10">
        <h2 className="text-lg font-semibold">Expense categories</h2>
        <p className="mb-4 text-sm text-muted">Pick from these when adding an expense. New categories typed in an expense are added here too.</p>
        <ExpenseCategoriesEditor key={categories.map((c) => `${c.id}:${c.updated_at}`).join("|")} categories={categories} usage={usage} />
      </section>
      <section>
        <h2 className="mb-4 text-lg font-semibold">Account</h2>
        <AccountSettings username={username} />
      </section>
    </div>
  );
}
