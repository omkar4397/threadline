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

/**
 * Bar colours by status (single-client view). Pastel fills with dark text; the
 * three steps also differ in lightness so they stay apart without colour vision.
 */
export const STATUS_COLOR: Record<TaskStatus, { bg: string; text: string }> = {
  not_started: { bg: "#e4d9d6", text: "#4a3d41" },
  in_progress: { bg: "#a9c4ea", text: "#15304f" },
  done: { bg: "#9fcb9c", text: "#173a1f" },
};

/** Pastel bar colours by client (All clients view), each with a dark text colour that passes contrast. */
const CLIENT_PALETTE: { bg: string; text: string }[] = [
  { bg: "#f1b9c6", text: "#5a1f2e" }, // blush
  { bg: "#bfd8bc", text: "#1f3a25" }, // sage
  { bg: "#e9d3a6", text: "#4f3b0e" }, // sand
  { bg: "#cfc4ec", text: "#33264f" }, // lavender
  { bg: "#b9d9ea", text: "#14394a" }, // sky
  { bg: "#f5c7ad", text: "#5a2a12" }, // peach
  { bg: "#b9e2d4", text: "#123d30" }, // mint
  { bg: "#efe09a", text: "#4a3c05" }, // butter
  { bg: "#e6c3e1", text: "#4a1e45" }, // lilac
  { bg: "#c6d1ef", text: "#1e2a4f" }, // powder blue
  { bg: "#f0cfb3", text: "#4f2e12" }, // apricot
  { bg: "#dcd4cf", text: "#3a332e" }, // stone
];

function paletteEntry(index: number) {
  return CLIENT_PALETTE[((index % CLIENT_PALETTE.length) + CLIENT_PALETTE.length) % CLIENT_PALETTE.length];
}

export function clientColor(index: number) {
  return paletteEntry(index).bg;
}

export function clientTextColor(index: number) {
  return paletteEntry(index).text;
}

export function nextTaskStatus(status: TaskStatus): TaskStatus {
  return status === "not_started" ? "in_progress" : status === "in_progress" ? "done" : "not_started";
}
