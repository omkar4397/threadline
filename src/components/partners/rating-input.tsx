"use client";

import { useState } from "react";

export function RatingInput({ name, defaultValue }: { name: string; defaultValue: number | null }) {
  const [value, setValue] = useState<number | null>(defaultValue);
  return (
    <div className="flex items-center gap-1">
      <input type="hidden" name={name} value={value ?? ""} />
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => setValue(value === n ? null : n)}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          aria-pressed={value !== null && n <= value}
          className={`flex size-11 items-center justify-center rounded-full text-2xl ${value !== null && n <= value ? "text-amber-500" : "text-stone-300"} hover:bg-stone-100`}
        >
          ★
        </button>
      ))}
      {value ? (
        <button type="button" onClick={() => setValue(null)} className="ml-1 min-h-11 px-2 text-xs text-muted underline">
          Clear
        </button>
      ) : null}
    </div>
  );
}
