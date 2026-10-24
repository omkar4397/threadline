import type { Metadata } from "next";
import { loadPartners } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { PartnersView } from "@/components/partners/partners-view";

export const metadata: Metadata = { title: "Vendors & Designers" };

export default async function PartnersPage({ searchParams }: PageProps<"/partners">) {
  const { tab } = await searchParams;
  const supabase = await createClient();
  const [{ vendors, designers }, { data: openTasks }] = await Promise.all([
    loadPartners(),
    supabase.from("tasks").select("vendor_id, designer_id").neq("status", "done"),
  ]);
  return <PartnersView vendors={vendors} designers={designers} openTasks={openTasks ?? []} tab={tab === "designers" ? "designers" : "vendors"} />;
}
