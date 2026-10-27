import type { Designer, ExpenseCategory, Vendor } from "@/lib/types";

export function categoryLabel(key: string, categories: ExpenseCategory[]) {
  return categories.find((c) => c.id === key)?.name ?? "Uncategorised";
}

export function payeeLabel(key: string, vendors: Vendor[], designers: Designer[]) {
  if (key.startsWith("v:")) return vendors.find((v) => v.id === key.slice(2))?.name ?? "Deleted vendor";
  if (key.startsWith("d:")) return designers.find((d) => d.id === key.slice(2))?.name ?? "Deleted designer";
  return "No vendor or designer";
}

export function payeeKind(key: string) {
  return key.startsWith("v:") ? "Vendor" : key.startsWith("d:") ? "Designer" : undefined;
}
