/**
 * Guards against implausibly-far-future "YYYY-MM" values polluting any
 * "real months with data" list (dropdown options, "most recent month"
 * defaults) — the same defensive principle as the backend's own Sept-2026+
 * ingestion cutoff, just guarding the other direction on the frontend.
 *
 * Root cause this exists for: a handful of raw task rows for one client
 * ("Lashon Wilson") carry dates like "2027-09-14", "2028-09-14",
 * "2029-09-15" — genuinely present in the source data (not a parsing bug;
 * confirmed live, no day/month swap involved), almost certainly a copy-
 * pasted test/placeholder row with the year manually bumped. Left
 * unguarded, every piece of UI that lists "months with data" (Dashboard
 * Month filter, Revenue page Month filter, Recent Tasks' own month filter,
 * and the "most recent month" auto-select defaults) surfaced these as
 * selectable options, even though selecting one shows nothing everywhere
 * else in the app.
 *
 * Deliberately ONLY guards the future direction — old/past months are the
 * backend's own concern (its Sept-2026+ cutoff already handles that end) —
 * and deliberately generous (6 months) so genuine near-term planning data
 * is never mistaken for garbage.
 */
const MAX_MONTHS_AHEAD = 6;

export function isPlausibleMonth(month: string, reference: Date = new Date()): boolean {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return false;
  const year = Number(match[1]);
  const monthNum = Number(match[2]);
  if (monthNum < 1 || monthNum > 12) return false;

  const monthIndex = year * 12 + (monthNum - 1);
  const refIndex = reference.getFullYear() * 12 + reference.getMonth();
  return monthIndex <= refIndex + MAX_MONTHS_AHEAD;
}
