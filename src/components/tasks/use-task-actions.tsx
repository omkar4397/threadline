"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { applyDateShifts, updateRow } from "@/lib/mutations";
import { shiftLaterTasks } from "@/lib/scheduling";
import { diffDays } from "@/lib/dates";
import { errorMessage } from "@/lib/form";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import type { Task } from "@/lib/types";
import type { TablesUpdate } from "./types";

/**
 * Saving a task: when its end date moves, offer to move the later tasks of the
 * same project by the same number of days.
 */
export function useTaskActions(allTasks: Task[]) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();

  const saveTask = useCallback(
    async (task: Task, patch: TablesUpdate): Promise<boolean> => {
      const start = patch.start_date ?? task.start_date;
      const end = patch.end_date ?? task.end_date;
      if (diffDays(end, start) < 0) {
        toast("The end date can’t be before the start date.", "error");
        return false;
      }

      const projectTasks = allTasks.filter((t) => t.project_id === task.project_id);
      const shifts = shiftLaterTasks(projectTasks, task.id, task.end_date, end);
      let applyShift = false;

      if (shifts.length > 0) {
        const delta = diffDays(end, task.end_date);
        const days = `${Math.abs(delta)} day${Math.abs(delta) === 1 ? "" : "s"}`;
        const choice = await confirm({
          title: "Move later tasks too?",
          message: (
            <>
              This task now ends {days} {delta > 0 ? "later" : "earlier"}. Move the {shifts.length} later unfinished task
              {shifts.length === 1 ? "" : "s"} in this project {delta > 0 ? "later" : "earlier"} by {days} as well?
            </>
          ),
          choices: [
            { value: "only", label: "Only this task" },
            { value: "shift", label: `Move ${shifts.length} task${shifts.length === 1 ? "" : "s"}`, variant: "primary" },
          ],
        });
        if (choice === null) return false;
        applyShift = choice === "shift";
      }

      try {
        await updateRow("tasks", task.id, patch);
        if (applyShift) await applyDateShifts(shifts);
        router.refresh();
        toast(applyShift ? `Saved and moved ${shifts.length} later task${shifts.length === 1 ? "" : "s"}` : "Saved");
        return true;
      } catch (err) {
        toast(errorMessage(err), "error");
        return false;
      }
    },
    [allTasks, confirm, router, toast],
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

  return { saveTask, setStatus };
}
