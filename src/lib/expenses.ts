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

type ExpenseLike = {
  amount: number;
  spent_on: string;
  category_id: string | null;
  vendor_id: string | null;
  designer_id: string | null;
  project_id: string;
};

/** "v:<id>", "d:<id>" or "none": one key for who was paid. */
export function payeeKey(e: { vendor_id: string | null; designer_id: string | null }) {
  return e.vendor_id ? `v:${e.vendor_id}` : e.designer_id ? `d:${e.designer_id}` : "none";
}

/** Category key as used by totalsByCategory: the id, or "none" when missing or deleted. */
export function categoryKey(e: { category_id: string | null }, categories: { id: string }[]) {
  return e.category_id && categories.some((c) => c.id === e.category_id) ? e.category_id : "none";
}

export type ExpenseFilter = {
  /** Inclusive ISO dates; empty means unbounded. */
  from?: string;
  to?: string;
  category?: string;
  payee?: string;
  projectIds?: string[];
};

export function filterExpenses<T extends ExpenseLike>(expenses: T[], filter: ExpenseFilter, categories: { id: string }[]): T[] {
  return expenses.filter(
    (e) =>
      (!filter.from || e.spent_on >= filter.from) &&
      (!filter.to || e.spent_on <= filter.to) &&
      (!filter.category || categoryKey(e, categories) === filter.category) &&
      (!filter.payee || payeeKey(e) === filter.payee) &&
      (!filter.projectIds || filter.projectIds.includes(e.project_id)),
  );
}

export type GroupTotal = { key: string; total: number; count: number };

/** Totals per key, largest first. */
export function totalsBy<T extends { amount: number }>(expenses: T[], key: (e: T) => string): GroupTotal[] {
  const groups = new Map<string, T[]>();
  for (const e of expenses) {
    const k = key(e);
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }
  return [...groups.entries()]
    .map(([k, items]) => ({ key: k, total: totalOf(items), count: items.length }))
    .sort((a, b) => b.total - a.total || a.key.localeCompare(b.key));
}

/** Month totals from the first to the last month (both "YYYY-MM"), including empty months. */
export function monthlyTotals(expenses: { amount: number; spent_on: string }[], firstMonth: string, lastMonth: string) {
  const byMonth = new Map(totalsBy(expenses, (e) => e.spent_on.slice(0, 7)).map((g) => [g.key, g]));
  const months: { month: string; total: number; count: number }[] = [];
  let [y, m] = firstMonth.split("-").map(Number);
  const [ly, lm] = lastMonth.split("-").map(Number);
  while (y < ly || (y === ly && m <= lm)) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    months.push({ month: key, total: byMonth.get(key)?.total ?? 0, count: byMonth.get(key)?.count ?? 0 });
    m += 1;
    if (m === 13) {
      m = 1;
      y += 1;
    }
  }
  return months;
}

/** Spreadsheet-safe CSV: quotes every cell and neutralises formula prefixes. */
export function toCsv(rows: (string | number)[][]) {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          let text = String(cell);
          if (typeof cell === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
          return `"${text.replace(/"/g, '""')}"`;
        })
        .join(","),
    )
    .join("\r\n");
}
