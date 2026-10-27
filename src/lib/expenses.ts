// Amounts are stored as numeric(12,2) in one currency.
export const CURRENCY = "INR";

const wholeMoney = new Intl.NumberFormat("en-IN", { style: "currency", currency: CURRENCY, maximumFractionDigits: 0 });
const exactMoney = new Intl.NumberFormat("en-IN", { style: "currency", currency: CURRENCY, minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** ₹1,500 for whole amounts, ₹1,250.50 otherwise. */
export function formatMoney(amount: number) {
  return Number.isInteger(Math.round(amount * 100) / 100) ? wholeMoney.format(amount) : exactMoney.format(amount);
}

/** Parses a typed amount ("1,250.50", "₹ 900") into a positive number with at most 2 decimals, or null. */
export function parseAmount(input: string): number | null {
  const cleaned = input.replace(/[^\d.]/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return value > 0 && value < 10_000_000_000 ? value : null;
}

/** Adds amounts in paise so floating-point never drifts. */
export function totalOf(expenses: { amount: number }[]) {
  return expenses.reduce((sum, e) => sum + Math.round(Number(e.amount) * 100), 0) / 100;
}

export type CategoryTotal = { key: string; name: string; total: number; count: number };

/** Totals per category, largest first. Expenses without a category are grouped as "Uncategorised". */
export function totalsByCategory(
  expenses: { amount: number; category_id: string | null }[],
  categories: { id: string; name: string }[],
): CategoryTotal[] {
  const groups = new Map<string, { amount: number }[]>();
  for (const e of expenses) {
    const key = e.category_id && categories.some((c) => c.id === e.category_id) ? e.category_id : "none";
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  return [...groups.entries()]
    .map(([key, items]) => ({
      key,
      name: categories.find((c) => c.id === key)?.name ?? "Uncategorised",
      total: totalOf(items),
      count: items.length,
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

/** Finds a category by name, ignoring case and surrounding spaces. */
export function findCategoryByName<T extends { name: string }>(categories: T[], name: string): T | undefined {
  const wanted = name.trim().toLowerCase();
  return categories.find((c) => c.name.trim().toLowerCase() === wanted);
}
