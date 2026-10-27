"use client";

import { formatMoney } from "@/lib/expenses";

export type BarItem = { key: string; label: string; sublabel?: string; total: number; count: number };

/**
 * Horizontal bars for comparing amounts. One series, so one colour; every bar is
 * labelled with its value, and the whole row is the hit target. When `onSelect`
 * is given, a row toggles a filter and the active row stays emphasised.
 */
export function BarList({
  items,
  selected,
  onSelect,
  limit = 8,
  emptyText = "Nothing to show",
}: {
  items: BarItem[];
  selected?: string;
  onSelect?: (key: string) => void;
  limit?: number;
  emptyText?: string;
}) {
  if (items.length === 0) return <p className="py-2 text-sm text-muted">{emptyText}</p>;
  const max = Math.max(...items.map((i) => i.total));
  const sum = items.reduce((n, i) => n + i.total, 0);
  const shown = items.slice(0, limit);
  const rest = items.slice(limit);
  const rows = rest.length
    ? [...shown, { key: "__other", label: `${rest.length} more`, total: rest.reduce((n, i) => n + i.total, 0), count: rest.reduce((n, i) => n + i.count, 0) }]
    : shown;

  return (
    <ul className="-mx-2">
      {rows.map((item) => {
        const active = selected === item.key;
        const dimmed = selected !== undefined && selected !== "" && !active;
        const share = sum > 0 ? Math.round((item.total / sum) * 100) : 0;
        const width = `${Math.max(1.5, (item.total / max) * 100)}%`;
        const content = (
          <>
            <span className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">
                <span className={active ? "font-semibold" : ""}>{item.label}</span>
                {"sublabel" in item && item.sublabel ? <span className="text-muted"> · {item.sublabel}</span> : null}
              </span>
              <span className="shrink-0 tabular-nums">
                <span className="font-medium">{formatMoney(item.total)}</span>
                <span className="ml-1.5 text-xs text-muted">{share}%</span>
              </span>
            </span>
            <span className="mt-1.5 block h-2 rounded-full bg-stone-100">
              <span className={`block h-full rounded-full transition-opacity ${dimmed ? "bg-accent/30" : "bg-accent"}`} style={{ width }} />
            </span>
          </>
        );
        const title = `${item.label}: ${formatMoney(item.total)} · ${item.count} expense${item.count === 1 ? "" : "s"} · ${share}%`;
        return (
          <li key={item.key}>
            {onSelect && item.key !== "__other" ? (
              <button
                type="button"
                onClick={() => onSelect(active ? "" : item.key)}
                aria-pressed={active}
                title={`${title}${active ? " · tap to clear filter" : " · tap to filter"}`}
                className={`block min-h-12 w-full rounded-lg px-2 py-2 text-left hover:bg-stone-50 ${active ? "bg-accent-soft hover:bg-accent-soft" : ""}`}
              >
                {content}
              </button>
            ) : (
              <div title={title} className="block min-h-12 px-2 py-2">
                {content}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
