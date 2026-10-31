"use client";

import { Select } from "@/components/ui/field";
import { currencyName, currencyOptions, PINNED_CURRENCIES, type RateMap } from "@/lib/fx";

/** Currency picker: pinned currencies first, then every currency we have a rate for. */
export function CurrencySelect({
  value,
  onChange,
  rates,
  className = "",
  ariaLabel = "Currency",
}: {
  value: string;
  onChange: (code: string) => void;
  rates: RateMap | null;
  className?: string;
  ariaLabel?: string;
}) {
  const all = currencyOptions([...Object.keys(rates ?? {}), value]);
  const rest = all.filter((c) => !PINNED_CURRENCIES.includes(c));
  return (
    <Select aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} className={className}>
      <optgroup label="Common">
        {PINNED_CURRENCIES.map((c) => (
          <option key={c} value={c}>
            {c} · {currencyName(c)}
          </option>
        ))}
      </optgroup>
      {rest.length > 0 ? (
        <optgroup label="All currencies">
          {rest.map((c) => (
            <option key={c} value={c}>
              {c} · {currencyName(c)}
            </option>
          ))}
        </optgroup>
      ) : null}
    </Select>
  );
}
