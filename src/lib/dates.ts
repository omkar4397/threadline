// Dates are stored as ISO "YYYY-MM-DD" strings (Postgres `date`). All arithmetic
// goes through whole UTC day numbers so time zones and DST never shift a date.

const MS_PER_DAY = 86_400_000;

export function toDayNumber(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / MS_PER_DAY);
}

export function fromDayNumber(day: number): string {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return fromDayNumber(toDayNumber(iso) + days);
}

/** Whole days from `b` to `a` (positive when `a` is later). */
export function diffDays(a: string, b: string): number {
  return toDayNumber(a) - toDayNumber(b);
}

/** Inclusive length of a date range in days. */
export function durationDays(start: string, end: string): number {
  return diffDays(end, start) + 1;
}

/** Today's date in the viewer's local time zone. */
export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const shortFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const longFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const monthFormat = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });

function asUTCDate(iso: string) {
  return new Date(toDayNumber(iso) * MS_PER_DAY);
}

export function formatShort(iso: string) {
  return shortFormat.format(asUTCDate(iso));
}

export function formatLong(iso: string) {
  return longFormat.format(asUTCDate(iso));
}

export function formatMonth(iso: string) {
  return monthFormat.format(asUTCDate(iso));
}

export function formatRange(start: string, end: string) {
  return start === end ? formatShort(start) : `${formatShort(start)} – ${formatShort(end)}`;
}

/** 0 = Monday … 6 = Sunday */
export function weekdayIndex(iso: string) {
  return (asUTCDate(iso).getUTCDay() + 6) % 7;
}
