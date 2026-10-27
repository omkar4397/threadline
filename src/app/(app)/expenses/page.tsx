import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { loadExpenseCategories, loadPartners } from "@/lib/data";
import { ExpensesOverview } from "@/components/expenses/expenses-overview";

export const metadata: Metadata = { title: "Expenses" };

export default async function ExpensesPage() {
  const supabase = await createClient();
  const [{ data: expenses }, { data: projects }, { data: clients }, categories, { vendors, designers }] = await Promise.all([
    supabase.from("expenses").select("*").order("spent_on", { ascending: false }),
    supabase.from("projects").select("*").order("delivery_date"),
    supabase.from("clients").select("*").order("name"),
    loadExpenseCategories(),
    loadPartners(),
  ]);
  return (
    <ExpensesOverview
      expenses={expenses ?? []}
      projects={projects ?? []}
      clients={clients ?? []}
      categories={categories}
      vendors={vendors}
      designers={designers}
    />
  );
}
