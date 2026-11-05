"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/database.types";

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

/** Moves several tasks at once. */
export async function updateTaskDates(changes: { id: string; start_date: string; end_date: string }[]) {
  const supabase = createClient();
  const results = await Promise.all(changes.map((c) => supabase.from("tasks").update({ start_date: c.start_date, end_date: c.end_date }).eq("id", c.id)));
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}

export async function deleteRow(table: TableName, id: string) {
  const { error } = await untyped().from(table).delete().eq("id", id);
  if (error) throw error;
}

