import type { Task } from '../types';
import { parseHours } from './revenueAttribution';

// ── Capacity model ───────────────────────────────────────────────────────────
//
// FIXED capacity constants per period — not derived from weekday-counting.
// An earlier version computed capacity by counting the actual weekdays inside
// each period (e.g. September's 22 weekdays × 8 = 176), which varies month to
// month. Capacity is now a flat, predictable number per granularity instead:
//   Daily = 8, Weekly = 40, Monthly = 160 (8 × 5 × 4), Yearly = 1920 (160 × 12)

export const HOURS_PER_DAY = 8;

export type Period = 'daily' | 'weekly' | 'monthly' | 'yearly';

/** Fixed capacity hours per period granularity — see the note above. */
export const FIXED_CAPACITY_HOURS: Record<Period, number> = {
  daily: 8,
  weekly: 40,
  monthly: 160,
  yearly: 1920,
};

function toDateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Inclusive [start, end] calendar-day bounds for the period containing `reference`. Week starts Monday. */
export function periodBounds(period: Period, reference: Date): { start: Date; end: Date } {
  const ref = toDateOnly(reference);
  switch (period) {
    case 'daily':
      return { start: ref, end: ref };
    case 'weekly': {
      const day = ref.getDay(); // 0=Sun..6=Sat
      const diffToMonday = (day + 6) % 7;
      const start = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - diffToMonday);
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
      return { start, end };
    }
    case 'monthly': {
      const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
      const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
      return { start, end };
    }
    case 'yearly': {
      const start = new Date(ref.getFullYear(), 0, 1);
      const end = new Date(ref.getFullYear(), 11, 31);
      return { start, end };
    }
  }
}

/**
 * Capacity hours for a period — a FIXED constant per granularity (see
 * FIXED_CAPACITY_HOURS above), not derived from the reference date. The
 * `reference` param is kept for call-site compatibility (period bounds still
 * need it to select which tasks fall inside the window) but capacity itself
 * no longer varies by which specific day/week/month/year is passed in.
 */
export function capacityHoursForPeriod(period: Period, _reference: Date = new Date()): number {
  return FIXED_CAPACITY_HOURS[period];
}

/** True if a task's own date falls within [start, end] (inclusive, by calendar day). */
function taskInRange(task: Task, start: Date, end: Date): boolean {
  const raw = (task.date ?? '').slice(0, 10);
  if (!raw) return false;
  return raw >= toDateKey(start) && raw <= toDateKey(end);
}

/**
 * Tasks whose own date falls inside an explicit [start, end] calendar-day
 * range — the shared primitive behind filterTasksByPeriod (reference-date
 * driven) AND the Productivity card's own month/week/year-string-driven
 * ranges below, so every "which tasks are in this window" check goes through
 * the same inclusive date-key comparison.
 */
export function filterTasksInDateRange(tasks: Task[], start: Date, end: Date): Task[] {
  return tasks.filter((t) => taskInRange(t, start, end));
}

/** Tasks whose own date falls inside the given period. */
export function filterTasksByPeriod(tasks: Task[], period: Period, reference: Date = new Date()): Task[] {
  const { start, end } = periodBounds(period, reference);
  return filterTasksInDateRange(tasks, start, end);
}

// ── Month/week/year-string-driven ranges (Productivity card) ────────────────
//
// The Productivity card's "View by" control navigates by an explicit
// "YYYY-MM" month string (the top-level Month filter, or a designer's most
// recent month with data) rather than a "reference Date" — these helpers
// derive [start, end] bounds directly from that string instead of forcing a
// round-trip through periodBounds' reference-date model.

/** [start, end] bounds for a "YYYY-MM" month string. */
export function monthRangeFromString(month: string): { start: Date; end: Date } {
  const [y, m] = month.split('-').map(Number);
  const year = y || new Date().getFullYear();
  const mo = (m || 1) - 1;
  return { start: new Date(year, mo, 1), end: new Date(year, mo + 1, 0) };
}

/**
 * [start, end] bounds for one of 4 fixed week buckets within a month: days
 * 1-7 / 8-14 / 15-21 / 22-end. These are simple calendar-day buckets (NOT
 * Monday-start weeks like periodBounds' 'weekly' — a month doesn't divide
 * evenly into real weeks) chosen so every month always has exactly 4
 * selectable "Week N" options, each carrying the same 40hr capacity.
 */
export function weekOfMonthRange(month: string, week: 1 | 2 | 3 | 4): { start: Date; end: Date } {
  const { start: monthStart, end: monthEnd } = monthRangeFromString(month);
  const dayStart = (week - 1) * 7 + 1;
  const start = new Date(monthStart.getFullYear(), monthStart.getMonth(), dayStart);
  const rawEnd = new Date(monthStart.getFullYear(), monthStart.getMonth(), dayStart + 6);
  const end = rawEnd.getTime() > monthEnd.getTime() ? monthEnd : rawEnd;
  return { start, end };
}

/** [start, end] bounds for the calendar year containing a "YYYY-MM" month string. */
export function yearRangeFromMonthString(month: string): { start: Date; end: Date } {
  const y = Number(month.slice(0, 4)) || new Date().getFullYear();
  return { start: new Date(y, 0, 1), end: new Date(y, 11, 31) };
}

export interface DesignerProductivity {
  designerName: string;
  /** Sum of punchedHours (approved/billed) within the period — parsed via parseHours. */
  billedHours: number;
  capacityHours: number;
  /** (billedHours / capacityHours) * 100 */
  productivityPct: number;
}

/**
 * Each designer's Productivity % for a period: their PUNCHED (approved,
 * billed) hours within that period, as a percentage of capacity (8hrs/day ×
 * weekdays in the period).
 *
 * Deliberately uses punchedHours, not actualEfforts — the self-reported
 * "Listed" field is informational context only (surfaced separately on the
 * designer detail card) and never drives this score. Only designers with at
 * least one task in the period appear; a designer entirely absent from a
 * period has nothing logged, i.e. 0% — callers scoring a fixed population
 * (DOTM's eligible list, the Leaderboard) should default a missing lookup to
 * 0 rather than treat absence as "not applicable."
 */
export function computeDesignerProductivity(
  tasks: Task[],
  period: Period,
  reference: Date = new Date(),
): DesignerProductivity[] {
  const capacityHours = capacityHoursForPeriod(period, reference);
  const periodTasks = filterTasksByPeriod(tasks, period, reference);

  const hoursByDesigner = new Map<string, number>();
  periodTasks.forEach((t) => {
    if (!t.designerName) return;
    const billed = parseHours(t.punchedHours);
    hoursByDesigner.set(t.designerName, (hoursByDesigner.get(t.designerName) ?? 0) + billed);
  });

  const result: DesignerProductivity[] = [];
  hoursByDesigner.forEach((billedHours, designerName) => {
    result.push({
      designerName,
      billedHours: Math.round(billedHours * 100) / 100,
      capacityHours,
      productivityPct: capacityHours > 0 ? Math.round((billedHours / capacityHours) * 10000) / 100 : 0,
    });
  });

  return result.sort((a, b) => b.productivityPct - a.productivityPct);
}

/** Convenience: designerName -> productivityPct, for O(1) lookups when scoring a population. */
export function computeProductivityMap(
  tasks: Task[],
  period: Period,
  reference: Date = new Date(),
): Map<string, number> {
  const map = new Map<string, number>();
  computeDesignerProductivity(tasks, period, reference).forEach((d) => map.set(d.designerName, d.productivityPct));
  return map;
}
