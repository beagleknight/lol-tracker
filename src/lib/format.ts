// ─── Locale Constants ────────────────────────────────────────────────────────

export const SUPPORTED_LOCALES = [
  { value: "en-GB", label: "English (UK)", description: "DD/MM/YYYY" },
  { value: "en-US", label: "English (US)", description: "MM/DD/YYYY" },
  { value: "es-ES", label: "Español", description: "DD/MM/AAAA" },
] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]["value"];

export const DEFAULT_LOCALE: SupportedLocale = "en-GB";

// ─── Date Formatting ─────────────────────────────────────────────────────────

/**
 * Date format variants used across the app.
 *
 * - "short"          → "25 Mar 2026"
 * - "short-compact"  → "25 Mar"
 * - "medium"         → "Wed, 25 Mar 2026"
 * - "long"           → "Wednesday, 25 March 2026"
 * - "datetime"       → "Wed, 25 Mar 2026, 14:30"
 * - "datetime-short" → "Wed, 25 Mar, 14:30"
 */
export type DateVariant =
  | "short"
  | "short-compact"
  | "medium"
  | "long"
  | "datetime"
  | "datetime-short";

const DATE_OPTIONS: Record<DateVariant, Intl.DateTimeFormatOptions> = {
  short: { day: "2-digit", month: "short", year: "numeric" },
  "short-compact": { day: "2-digit", month: "short" },
  medium: { weekday: "short", day: "2-digit", month: "short", year: "numeric" },
  long: { weekday: "long", day: "2-digit", month: "long", year: "numeric" },
  datetime: {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  },
  "datetime-short": {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  },
};

/**
 * Format a date using the user's locale preference.
 * Accepts Date objects or values coercible to Date (timestamps, strings).
 */
export function formatDate(
  date: Date | number | string,
  locale: string = DEFAULT_LOCALE,
  variant: DateVariant = "short",
): string {
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat(locale, DATE_OPTIONS[variant]).format(d);
}

// ─── Duration Formatting ─────────────────────────────────────────────────────

/**
 * Format game duration in seconds to "m:ss".
 * Locale-independent — game time format is universal.
 */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ─── Number Formatting ───────────────────────────────────────────────────────

/**
 * Format a number with locale-aware thousand separators.
 * For gold, damage, and other large game values.
 */
export function formatNumber(
  value: number,
  locale: string = DEFAULT_LOCALE,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(locale, options).format(value);
}
