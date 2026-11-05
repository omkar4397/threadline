"use client";

import { useId, useRef, useState, type InputHTMLAttributes } from "react";

/**
 * A text field with a styled suggestion list: type anything, or pick one of
 * `options`. Replaces the browser's native <datalist>, which can't be styled.
 */
export function Combobox({
  value,
  onChange,
  options,
  className = "",
  ...inputProps
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "list">) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const query = value.trim().toLowerCase();
  const matches = options.filter((o) => !query || o.toLowerCase().includes(query)).filter((o) => o.toLowerCase() !== query);
  const showList = open && matches.length > 0;

  function choose(option: string) {
    onChange(option);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && showList && active >= 0) {
      e.preventDefault();
      choose(matches[active]);
    } else if (e.key === "Escape" && showList) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onClick={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className={`w-full min-h-11 rounded-full border border-line bg-surface py-2 pr-11 pl-4 text-base text-ink shadow-soft placeholder:text-stone-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 sm:text-sm ${className}`}
        {...inputProps}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Show suggestions"
        onMouseDown={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
          setOpen((o) => !o);
        }}
        className="absolute inset-y-0 right-1 flex w-10 items-center justify-center rounded-full text-stone-400 hover:text-ink"
      >
        <svg viewBox="0 0 20 20" className={`size-4 transition-transform ${showList ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {showList ? (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-30 mt-1.5 max-h-64 overflow-y-auto rounded-2xl bg-surface p-1.5 shadow-lift">
          {matches.map((option, i) => (
            <li
              key={option}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                // Keep focus in the input so blur doesn't close the list first.
                e.preventDefault();
                choose(option);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex min-h-11 cursor-pointer items-center rounded-xl px-3 text-sm ${i === active ? "bg-accent-soft text-accent" : "text-ink"}`}
            >
              {option}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
