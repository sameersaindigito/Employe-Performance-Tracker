/**
 * Normalizes a person's name for use as a grouping/comparison key AND as the
 * display form shown everywhere.
 *
 * Trims leading/trailing whitespace, collapses internal runs of whitespace
 * to a single space, and case-folds to Title Case per word — handles
 * inconsistent data entry like "Aryan " (trailing space), "Aryan  Kumar"
 * (double space), or "aryan" / "ARYAN" / "aryan" (mixed casing) so the same
 * real person doesn't get silently split into multiple designers/leaders
 * wherever their name is used as a Map/Set key, and always renders
 * identically regardless of which sheet row happened to type it.
 *
 * Deliberately whitespace-and-casing-only: never fuzzy-matches different
 * spellings or words. "Deepak Singh" and "Deepak Dhiman" must stay distinct,
 * and "deepak singh" must become exactly "Deepak Singh" — never merged with
 * a genuinely different name. That's a data-entry discipline issue, not
 * something this function should paper over.
 *
 * Title Case is applied per whitespace-separated word (first letter upper,
 * rest lower) — a simple, consistent rule chosen over anything smarter; it
 * doesn't special-case apostrophes/hyphens (e.g. "o'brien" → "O'brien", not
 * "O'Brien"), which is an accepted trade-off for keeping this predictable.
 */
export function normalizeName(name: string | null | undefined): string {
  const trimmed = String(name ?? '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return trimmed;
  return trimmed
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
