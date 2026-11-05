"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { insertRow, updateRow } from "@/lib/mutations";
import { diffDays } from "@/lib/dates";
import { errorMessage } from "@/lib/form";
import { useToast } from "@/components/ui/toast";
import type { Database } from "@/lib/database.types";
import type { Task } from "@/lib/types";
import type { TablesUpdate } from "./types";

type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"];

/** Saving, creating and status changes for tasks. Each task moves on its own. */
export function useTaskActions() {
  const router = useRouter();
  const toast = useToast();

  const saveTask = useCallback(
    async (task: Task, patch: TablesUpdate): Promise<boolean> => {
      const start = patch.start_date ?? task.start_date;
      const end = patch.end_date ?? task.end_date;
      if (diffDays(end, start) < 0) {
        toast("The end date can’t be before the start date.", "error");
        return false;
      }
      try {
        await updateRow("tasks", task.id, patch);
        router.refresh();
        toast("Saved");
        return true;
      } catch (err) {
        toast(errorMessage(err), "error");
        return false;
      }
    },
    [router, toast],
  );

  const createTask = useCallback(
    async (values: TaskInsert): Promise<boolean> => {
      try {
        await insertRow("tasks", values);
        router.refresh();
        toast(values.kind === "milestone" ? "Milestone added" : "Task added");
        return true;
      } catch (err) {
        toast(errorMessage(err), "error");
        return false;
      }
    },
    [router, toast],
  );

  const setStatus = useCallback(
    async (task: Task, status: Task["status"]) => {
      try {
        await updateRow("tasks", task.id, { status });
        router.refresh();
      } catch (err) {
        toast(errorMessage(err), "error");
      }
    },
    [router, toast],
  );

  return { saveTask, createTask, setStatus };
}
