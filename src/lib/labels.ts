import type { Enum } from "@/lib/database.types";

export type TaskStatus = Enum<"task_status">;
export type ProjectStatus = Enum<"project_status">;
export type VendorType = Enum<"vendor_type">;

export const TASK_STATUSES: TaskStatus[] = ["not_started", "in_progress", "done"];
export const PROJECT_STATUSES: ProjectStatus[] = ["active", "on_hold", "completed"];
export const VENDOR_TYPES: VendorType[] = ["fabric_supplier", "printer", "manufacturer", "shipper", "other"];

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  done: "Done",
};

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
};

export const VENDOR_TYPE_LABEL: Record<VendorType, string> = {
  fabric_supplier: "Fabric supplier",
  printer: "Printer",
  manufacturer: "Manufacturer",
  shipper: "Shipper",
  other: "Other",
};

/** Bar colours by status (single-client view). */
export const STATUS_COLOR: Record<TaskStatus, { bg: string; text: string }> = {
  not_started: { bg: "#d6d3d1", text: "#292524" },
  in_progress: { bg: "#2563eb", text: "#ffffff" },
  done: { bg: "#15803d", text: "#ffffff" },
};

/** Bar colours by client (All clients view). All pass contrast with white text. */
const CLIENT_PALETTE = [
  "#7a2048", "#0e7490", "#6d28d9", "#047857", "#b45309", "#1d4ed8",
  "#be123c", "#4d7c0f", "#0f766e", "#c2410c", "#7e22ce", "#475569",
];

export function clientColor(index: number) {
  return CLIENT_PALETTE[((index % CLIENT_PALETTE.length) + CLIENT_PALETTE.length) % CLIENT_PALETTE.length];
}

export function nextTaskStatus(status: TaskStatus): TaskStatus {
  return status === "not_started" ? "in_progress" : status === "in_progress" ? "done" : "not_started";
}
