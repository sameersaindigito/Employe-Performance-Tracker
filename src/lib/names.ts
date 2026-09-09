/**
 * Normalizes a person's name for use as a grouping/comparison key.
 *
 * Trims leading/trailing whitespace and collapses internal runs of
 * whitespace to a single space — handles inconsistent data entry like
 * "Aryan " (trailing space) or "Aryan  Kumar" (double space) so the same
 * real person doesn't get silently split into multiple designers/leaders
 * wherever their name is used as a Map/Set key.
 *
 * Deliberately whitespace-only: never fuzzy-matches different spellings or
 * words. "Deepak Singh" and "Deepak Dhiman" must stay distinct — that's a
 * data-entry discipline issue, not something this function should paper over.
 */
export function normalizeName(name: string | null | undefined): string {
  return String(name ?? '').trim().replace(/\s+/g, ' ');
}
