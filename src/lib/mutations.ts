"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/database.types";
import type { DateShift } from "@/lib/scheduling";

type Tables = Database["public"]["Tables"];
type TableName = keyof Tables;

// Client-side writes. RLS on every table guarantees they only touch the
// signed-in owner's rows.

/** The generic helpers are typed by their signatures; the query builder itself is untyped. */
function untyped() {
  return createClient() as unknown as SupabaseClient;
}

export async function insertRow<T extends TableName>(table: T, values: Tables[T]["Insert"]) {
  const { data, error } = await untyped().from(table).insert(values).select("id").single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function updateRow<T extends TableName>(table: T, id: string, values: Tables[T]["Update"]) {
  const { error } = await untyped().from(table).update(values).eq("id", id);
  if (error) throw error;
}

export async function deleteRow(table: TableName, id: string) {
  const { error } = await untyped().from(table).delete().eq("id", id);
  if (error) throw error;
}

export async function applyDateShifts(shifts: DateShift[]) {
  const supabase = createClient();
  const results = await Promise.all(
    shifts.map((s) => supabase.from("tasks").update({ start_date: s.start_date, end_date: s.end_date }).eq("id", s.id)),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}

export async function createProjectWithTasks(args: {
  clientId: string;
  name: string;
  deliveryDate: string;
  notes: string | null;
  tasks: { stage_name: string; sort_order: number; start_date: string; end_date: string }[];
}) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("create_project_with_tasks", {
    p_client_id: args.clientId,
    p_name: args.name,
    p_delivery_date: args.deliveryDate,
    p_notes: args.notes ?? "",
    p_tasks: args.tasks.map((t) => ({ ...t, vendor_id: null, designer_id: null })),
  });
  if (error) throw error;
  return data;
}
