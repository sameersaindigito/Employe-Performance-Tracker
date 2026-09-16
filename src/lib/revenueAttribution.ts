import type { Task, RevenueItem } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Per-project breakdown for a single designer — every UI number traces to this. */
export interface DesignerProjectShare {
  projectId: string;
  clientName: string;
  /** Hours this designer logged on this project — punchedHours (approved/billed) ONLY */
  designerHours: number;
  /** Total hours across ALL designers on this project */
  projectTotalHours: number;
  /** Project's total revenue from the Revenue Master */
  projectTotalRevenue: number;
  /** designerHours / projectTotalHours * projectTotalRevenue */
  designerShare: number;
}

export interface DesignerRevenue {
  designerName: string;
  teamLeader: string;
  /** Sum of designerShare across all projects — use this for KPI cards / ranking */
  revenueContribution: number;
  /** Full breakdown — one entry per project the designer touched */
  projects: DesignerProjectShare[];
}

// ── Hour parsing ──────────────────────────────────────────────────────────────

/**
 * Parses free-text hour strings into a decimal number.
 *
 * Handled formats:
 *   "2"                    → 2.0
 *   "2.5"                  → 2.5
 *   "2h"                   → 2.0
 *   "2h 30m"               → 2.5
 *   "2hr 30min"            → 2.5
 *   "6 Hours 30 Minutes"   → 6.5
 *   "2 hours 50 mins (X)"  → 2.833...
 *   "150m" / "150 Minutes" → 2.5
 *   "45 Minutes (note)"    → 0.75  (trailing free-text notes don't break parsing)
 *   ""                     → 0
 *   "N/A"                  → 0
 *
 * Alternation order matters here: `h(?:ours|our|rs|r)?` must try the
 * LONGEST suffix first. Regex alternation takes the first branch that
 * matches, not the longest — an earlier `(?:r|rs|our|ours)?` ordering
 * matched "our" inside "hours" and stopped, leaving a stray "s" that
 * blocked the following minutes group from matching at all, silently
 * dropping the minutes on every plural "X Hours Y Minutes" entry (the
 * standard timesheet phrasing). Same reasoning applies to the minutes
 * suffix and to the standalone minutes-only pattern below.
 *
 * The minutes-only pattern below is intentionally NOT end-anchored. Real
 * timesheet entries often append a free-text note after the number, e.g.
 * "45 Minutes (I think we don't have to bill this)" — an earlier `^...$`
 * full-string anchor rejected that as a match (the trailing note isn't part
 * of the pattern), silently falling through to the plain-number fallback,
 * which read the leading "45" as 45 WHOLE HOURS instead of 45 minutes — a
 * ~60x overstatement that single-handedly explained a live "Listed: 50.3
 * hrs" figure for a designer whose real logged time that month was ~6 hours.
 */
export function parseHours(s: string): number {
  if (!s) return 0;
  const str = String(s).trim();
  if (!str) return 0;

  // Try "XhYm" / "X hr Y min" patterns first
  const hhmm = str.match(/(\d+(?:\.\d+)?)\s*h(?:ours|our|rs|r)?\s*(?:(\d+(?:\.\d+)?)\s*m(?:inutes|inute|ins|in)?\.?)?/i);
  if (hhmm) {
    const h = parseFloat(hhmm[1] ?? '0');
    const m = parseFloat(hhmm[2] ?? '0');
    return h + m / 60;
  }

  // Pure minutes: "150m", "150min", "150 Minutes", or "150 Minutes (note)"
  const minsOnly = str.match(/^(\d+(?:\.\d+)?)\s*m(?:inutes|inute|ins|in)?\.?/i);
  if (minsOnly) {
    return parseFloat(minsOnly[1]) / 60;
  }

  // Plain number (could be decimal): "2.5"
  const plain = parseFloat(str);
  if (!isNaN(plain)) return plain;

  return 0;
}

// ── Revenue resolution (Part 5 display rules) ─────────────────────────────────

/**
 * Resolves the billable amount for a single revenue row.
 *
 * The backend already computes `totalRevenue` correctly:
 *   Hourly → totalHours * hourlyRate
 *   Fixed  → the flat fee (stored in `hourlyRate` for legacy reasons)
 *
 * So we trust it whenever it is non-zero. The fallback only kicks in when the
 * backend left totalRevenue blank/zero despite usable hours + rate, so a row
 * never renders as $0 while its inputs are present.
 *
 * Every consumer (KPI cards, charts, tables, and the attribution math below)
 * goes through this one function, which is what keeps the leader/designer
 * totals reconciling exactly with the Total Revenue KPI.
 */
export function resolveRevenueAmount(item: RevenueItem): number {
  if (item.totalRevenue > 0) return item.totalRevenue;
  if (item.paymentMode === 'Hourly') {
    return (item.totalHours || 0) * (item.hourlyRate || 0);
  }
  // Fixed mode: `hourlyRate` holds the flat fee — never multiply by hours.
  return item.hourlyRate || 0;
}

/**
 * Extracts a clean "YYYY-MM" prefix from a raw month value, tolerating a full
 * ISO datetime string (e.g. "2026-07-31T18:30:00.000Z") in place of the
 * expected "YYYY-MM" — seen in real data, most likely a date-formatted sheet
 * cell serialized as a timestamp instead of plain text. Left unnormalized,
 * two different raw representations of the same real month (e.g. "2026-07"
 * and "2026-07-31T18:30:00.000Z") would be treated as distinct values and
 * both happen to format to the same "Jul 2026" label — producing a duplicate
 * dropdown entry without ever comparing equal to the clean value elsewhere.
 * Falls back to the trimmed raw value for anything that doesn't look like a
 * date at all, so unrecognized values don't just silently vanish.
 */
function normalizeMonthValue(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/^(\d{4}-\d{2})/);
  return match ? match[1] : trimmed;
}

/**
 * Parses a RevenueItem.month value into its start/end "YYYY-MM" bounds.
 *
 * A project that spans multiple months is reported as a range —
 * "2026-07 - 2026-09" — instead of being arbitrarily pinned to one month.
 * A plain single value ("2026-07") has the same start and end.
 */
export function parseMonthRange(month: string): { start: string; end: string } {
  if (!month) return { start: '', end: '' };
  const parts = month.split(' - ').map((s) => s.trim());
  if (parts.length === 2 && parts[0] && parts[1]) {
    return { start: normalizeMonthValue(parts[0]), end: normalizeMonthValue(parts[1]) };
  }
  const single = normalizeMonthValue(month);
  return { start: single, end: single };
}

/** True if a RevenueItem's month value (single or range) covers the given "YYYY-MM". */
export function monthIncludes(itemMonth: string, targetMonth: string): boolean {
  const { start, end } = parseMonthRange(itemMonth);
  if (!start) return false;
  return targetMonth >= start && targetMonth <= end;
}

/**
 * Narrows a revenue list to an active month/category filter.
 * An empty string means "no filter" (i.e. All Months / All Categories).
 *
 * Month matching is range-aware (see monthIncludes) — a row whose month is
 * "2026-06 - 2026-08" must still match a "2026-07" filter, not just an exact
 * string match, or every ranged row would be silently excluded the moment a
 * specific month is selected.
 *
 * Note this scopes REVENUE rows only, never the task list. Task hours must stay
 * whole so each project's hours denominator is complete — filtering tasks by
 * month would shrink denominators and silently inflate designers' shares.
 */
export function scopeRevenueItems(
  items: RevenueItem[],
  opts: { month?: string; category?: string } = {},
): RevenueItem[] {
  const { month, category } = opts;
  if (!month && !category) return items;
  return items.filter((r) => {
    if (month && !monthIncludes(r.month, month)) return false;
    if (category && r.category.toLowerCase() !== category.toLowerCase()) return false;
    return true;
  });
}

// ── Month attribution ───────────────────────────────────────────────────────────

/** A task's own "YYYY-MM", derived from its date field. Empty string if unparseable. */
export function taskMonth(date: string): string {
  return (date ?? '').slice(0, 7);
}

/**
 * projectId → key → hours, from each task's own hour fields, keyed by
 * whatever `keyOf` extracts (a month, a category, ...). Shared by
 * computeMonthBreakdown, computeCategoryRevenue, and scopeRevenueItemsForKey
 * so every "split a project's hours by X" computation uses the identical
 * grouping/hour-parsing logic instead of three near-identical copies of it.
 *
 * Uses ONLY punchedHours (approved/billed) — no actualEfforts fallback. A
 * task with no punched hours yet contributes 0 to any dollar-figure
 * attribution; actualEfforts is self-reported and informational only (shown
 * separately as "Listed"), and must never influence a revenue split. An
 * earlier `punchedHours > 0 ? punchedHours : actualEfforts` fallback here
 * caused Revenue Contribution to track a designer's unapproved self-reported
 * hours instead of their approved ones whenever punchedHours was blank.
 */
function groupHoursByProjectAndKey(
  tasks: Task[],
  keyOf: (t: Task) => string,
): Map<string, Map<string, number>> {
  const result = new Map<string, Map<string, number>>();
  tasks.forEach((t) => {
    if (!t.projectId) return;
    const key = keyOf(t);
    if (!key) return;
    const pid = t.projectId.trim();
    if (!result.has(pid)) result.set(pid, new Map());
    const kMap = result.get(pid)!;
    const hours = parseHours(t.punchedHours);
    kMap.set(key, (kMap.get(key) ?? 0) + hours);
  });
  return result;
}

export interface MonthRevenue {
  hours: number;
  revenue: number;
}

/**
 * "YYYY-MM" → { hours, revenue } attributed to that month, summed across
 * every project. Same proportional hours-share model as
 * computeDesignerRevenue / computeCategoryRevenue, but splitting a project's
 * revenue across the MONTHS it was worked in (derived from each task's own
 * date field, not the project-level RevenueItem.month range) instead of
 * designers or categories — so a project spanning "2026-08 - 2026-09" gives
 * an August figure and a September figure that sum to its true total,
 * instead of showing that same full total under both months.
 */
export function computeMonthBreakdown(
  tasks: Task[],
  revenueItems: RevenueItem[],
): Map<string, MonthRevenue> {
  const revenueByProject = new Map<string, number>();
  revenueItems.forEach((r) => {
    if (!r.projectId) return;
    const pid = r.projectId.trim();
    revenueByProject.set(pid, (revenueByProject.get(pid) ?? 0) + resolveRevenueAmount(r));
  });

  const projectMonthHours = groupHoursByProjectAndKey(tasks, (t) => taskMonth(t.date));

  const totals = new Map<string, MonthRevenue>();
  projectMonthHours.forEach((mMap, pid) => {
    const projectRevenue = revenueByProject.get(pid) ?? 0;
    let totalProjectHours = 0;
    mMap.forEach((h) => { totalProjectHours += h; });

    mMap.forEach((hours, month) => {
      const share = totalProjectHours > 0 ? (hours / totalProjectHours) * projectRevenue : 0;
      const existing = totals.get(month) ?? { hours: 0, revenue: 0 };
      existing.hours += hours;
      existing.revenue += share;
      totals.set(month, existing);
    });
  });

  return totals;
}

/**
 * "YYYY-MM" → revenue attributed to that month. Convenience wrapper around
 * computeMonthBreakdown for callers that only need the revenue side.
 *
 * Note: this is a COMPANY-WIDE total across every project — it does not
 * compose with an active leader/category/designer filter. The Revenue page
 * doesn't call this directly for its KPI card for that reason; it instead
 * threads scopeRevenueItemsForMonth + filterTasksByMonth through the same
 * pipeline every other filter already uses, so a month figure stays correct
 * when combined with other active filters. This function is the plain
 * unfiltered figure — useful on its own (e.g. a future "Revenue by Month"
 * view) — and is exercised by the same underlying math either way.
 */
export function computeMonthRevenue(
  tasks: Task[],
  revenueItems: RevenueItem[],
): Map<string, number> {
  const map = new Map<string, number>();
  computeMonthBreakdown(tasks, revenueItems).forEach((v, month) => map.set(month, v.revenue));
  return map;
}

/**
 * Returns a new RevenueItem[] where each row's totalRevenue/totalHours are
 * scaled down to just one KEY's (a month, a category, ...) proportional
 * hours-share — every other field (leader, category, clientName,
 * paymentChannel, paymentMode, hourlyRate, projectId) is preserved from the
 * original row, so any chart/table that just reads those fields keeps
 * working unchanged, now against key-scoped totals instead of whole-project
 * ones. `keyOf` extracts the key from a task (e.g. its month or category);
 * `applyKey` writes the resolved key back onto the output row (e.g. setting
 * `.month` or `.category` to match what was actually split).
 *
 * Shared engine behind scopeRevenueItemsForMonth and
 * scopeRevenueItemsForCategory — same math, different dimension. Composing
 * both sequentially (scale by month, then scale THAT result by category
 * using tasks already limited to that month) yields the correct JOINT
 * (month × category) share, not an independent double-count — see
 * scopeRevenueItemsForCategory's own doc for the worked reasoning.
 *
 * Pair this with a matching task filter (filterTasksByMonth, or filtering by
 * category) when feeding computeDesignerRevenue / computeCategoryRevenue for
 * a specific key — the task list must be limited to that key too, or the
 * hours-share denominator inside those functions would use hours OUTSIDE the
 * selected key against this key's already-reduced revenue figure, inflating
 * shares for whoever worked outside it and shortchanging whoever worked more
 * heavily within it.
 *
 * A row for a project with zero hours under the given key is dropped
 * entirely — nothing to attribute, same as computeMonthBreakdown silently
 * contributing 0 rather than surfacing a $0 row.
 *
 * If a project has more than one revenue row, each row's revenue is scaled
 * by the same ratio (this key's project share ÷ the project's original
 * total revenue), preserving their relative proportions to each other.
 *
 * An empty `key` returns `revenueItems` unchanged — "no filter" keeps
 * showing full, unsplit totals; there's no double-counting risk there since
 * every project appears exactly once regardless of how many keys it spans.
 */
function scopeRevenueItemsForKey(
  revenueItems: RevenueItem[],
  tasks: Task[],
  key: string,
  keyOf: (t: Task) => string,
  applyKey: (item: RevenueItem, key: string) => RevenueItem,
): RevenueItem[] {
  if (!key) return revenueItems;

  const projectKeyHours = groupHoursByProjectAndKey(tasks, keyOf);
  const projectOriginalRevenue = new Map<string, number>();
  revenueItems.forEach((r) => {
    if (!r.projectId) return;
    const pid = r.projectId.trim();
    projectOriginalRevenue.set(pid, (projectOriginalRevenue.get(pid) ?? 0) + resolveRevenueAmount(r));
  });

  const result: RevenueItem[] = [];
  revenueItems.forEach((r) => {
    if (!r.projectId) return;
    const pid = r.projectId.trim();
    const kMap = projectKeyHours.get(pid);
    const keyHours = kMap?.get(key) ?? 0;
    if (keyHours <= 0) return;

    let totalProjectHours = 0;
    kMap?.forEach((h) => { totalProjectHours += h; });
    const originalProjectRevenue = projectOriginalRevenue.get(pid) ?? 0;
    const keyProjectShare = totalProjectHours > 0
      ? (keyHours / totalProjectHours) * originalProjectRevenue
      : 0;

    const rowRevenue = resolveRevenueAmount(r);
    const revenueRatio = originalProjectRevenue > 0 ? keyProjectShare / originalProjectRevenue : 0;
    const hoursRatio = totalProjectHours > 0 ? keyHours / totalProjectHours : 0;

    result.push(applyKey({
      ...r,
      totalRevenue: Math.round(rowRevenue * revenueRatio * 100) / 100,
      totalHours: Math.round((r.totalHours || 0) * hoursRatio * 100) / 100,
    }, key));
  });

  return result;
}

/** Month-dimension instance of scopeRevenueItemsForKey — see that function for the full rationale. */
export function scopeRevenueItemsForMonth(
  revenueItems: RevenueItem[],
  tasks: Task[],
  month: string,
): RevenueItem[] {
  return scopeRevenueItemsForKey(
    revenueItems, tasks, month,
    (t) => taskMonth(t.date),
    (item, month) => ({ ...item, month }),
  );
}

/**
 * Category-dimension instance of scopeRevenueItemsForKey. Fixes the same bug
 * pattern as the month split: the backend's syncRevenue() stamps each
 * project with only the FIRST task category it saw, so selecting e.g.
 * "Graphic Design" on a project that also has Web Design/IT Operations hours
 * used to show that project's FULL revenue (project-inclusion), not just
 * Graphic Design's ~4% share. This scales it down to the real share instead.
 *
 * To compose correctly with an already-active month filter, pass tasks
 * already limited to that month (e.g. via filterTasksByMonth) rather than
 * the full task list — that makes the category split's "total project hours"
 * denominator mean "hours within the selected month," so scaling this
 * function's OUTPUT sequentially after scopeRevenueItemsForMonth's yields the
 * correct joint (month × category) share: revenue × (hoursInMonth/hoursEver)
 * × (hoursInCategoryWithinMonth/hoursInMonth) = revenue ×
 * hoursInCategoryWithinMonth/hoursEver, not a double-discount.
 */
export function scopeRevenueItemsForCategory(
  revenueItems: RevenueItem[],
  tasks: Task[],
  category: string,
): RevenueItem[] {
  return scopeRevenueItemsForKey(
    revenueItems, tasks, category,
    (t) => t.category,
    (item, category) => ({ ...item, category }),
  );
}

/**
 * Tasks whose own date falls in the given month — pairs with
 * scopeRevenueItemsForMonth so an attribution function fed both uses the
 * right hours denominator for that month. An empty month returns tasks
 * unchanged (matching scopeRevenueItemsForMonth's "All Months" behavior).
 */
export function filterTasksByMonth(tasks: Task[], month: string): Task[] {
  if (!month) return tasks;
  return tasks.filter((t) => taskMonth(t.date) === month);
}

/**
 * Date-range counterpart to scopeRevenueItemsForMonth/Category — proportionally
 * splits each project's revenue by whatever share of its (punchedHours-only)
 * hours fall inside an inclusive [startDateKey, endDateKey] window
 * ("YYYY-MM-DD" strings, comparable lexicographically), instead of a fixed
 * calendar month or category. This is what lets the designer-detail
 * section's "View by" control (Day/Week/Month/Year) drive Revenue
 * Contribution and the Audit table the same way scopeRevenueItemsForMonth
 * already drives the Month view — same proportional-hours-share math,
 * generalized to any window instead of hardcoded to month boundaries.
 *
 * NOT implemented via scopeRevenueItemsForKey/groupHoursByProjectAndKey:
 * those key a task by a value that's ALWAYS present (every task has some
 * month, some category), so summing across every key naturally reconstructs
 * a project's true total hours. A window is a binary in/out split — an
 * out-of-window task has no key at all — so it would vanish from that total
 * entirely instead of correctly counting toward "hours outside this window."
 * This computes the true all-time total directly instead.
 *
 * Takes plain date-key strings (not Date objects) so this file never needs
 * to import the date-range helpers from lib/productivity.ts — that module
 * already imports parseHours from here, and a two-way import would create a
 * circular dependency between the two.
 */
export function scopeRevenueItemsForDateRange(
  revenueItems: RevenueItem[],
  tasks: Task[],
  startDateKey: string,
  endDateKey: string,
): RevenueItem[] {
  const inWindow = (t: Task) => {
    const raw = (t.date ?? '').slice(0, 10);
    return !!raw && raw >= startDateKey && raw <= endDateKey;
  };

  const projectTotalHours = new Map<string, number>();
  const projectWindowHours = new Map<string, number>();
  tasks.forEach((t) => {
    if (!t.projectId) return;
    const pid = t.projectId.trim();
    const hours = parseHours(t.punchedHours);
    projectTotalHours.set(pid, (projectTotalHours.get(pid) ?? 0) + hours);
    if (inWindow(t)) {
      projectWindowHours.set(pid, (projectWindowHours.get(pid) ?? 0) + hours);
    }
  });

  const projectOriginalRevenue = new Map<string, number>();
  revenueItems.forEach((r) => {
    if (!r.projectId) return;
    const pid = r.projectId.trim();
    projectOriginalRevenue.set(pid, (projectOriginalRevenue.get(pid) ?? 0) + resolveRevenueAmount(r));
  });

  const result: RevenueItem[] = [];
  revenueItems.forEach((r) => {
    if (!r.projectId) return;
    const pid = r.projectId.trim();
    const windowHours = projectWindowHours.get(pid) ?? 0;
    if (windowHours <= 0) return; // nothing to attribute in this window

    const totalHours = projectTotalHours.get(pid) ?? 0;
    const originalProjectRevenue = projectOriginalRevenue.get(pid) ?? 0;
    const windowShare = totalHours > 0 ? (windowHours / totalHours) * originalProjectRevenue : 0;

    const rowRevenue = resolveRevenueAmount(r);
    const revenueRatio = originalProjectRevenue > 0 ? windowShare / originalProjectRevenue : 0;
    const hoursRatio = totalHours > 0 ? windowHours / totalHours : 0;

    result.push({
      ...r,
      totalRevenue: Math.round(rowRevenue * revenueRatio * 100) / 100,
      totalHours: Math.round((r.totalHours || 0) * hoursRatio * 100) / 100,
    });
  });

  return result;
}

// ── Core attribution ──────────────────────────────────────────────────────────

/**
 * Computes each designer's proportional revenue contribution across all projects.
 *
 * Algorithm:
 *  1. Group tasks by projectId.
 *  2. For each project, find the matching RevenueItem and read its totalRevenue.
 *     (If no match, that project contributes $0 — designer is not skipped.)
 *  3. For each designer on the project:
 *       designerShare = (designer's hours on project / total hours on all designers) * project.totalRevenue
 *  4. Sum each designer's share across all projects → revenueContribution.
 *
 * Returns one entry per designer (deduplicated, most-frequent teamLeader assigned),
 * each carrying a full projects[] breakdown for audit traceability.
 *
 * ⚠️  Data hygiene note: designer names are matched by exact string.
 *     "Deepak Singh" and "Deepak Dhiman" are two different people.
 *     Inconsistent data entry (e.g. "Deepak" for the same person) will split
 *     their revenue across multiple buckets — fix this in the source sheet, not here.
 */
export function computeDesignerRevenue(
  tasks: Task[],
  revenueItems: RevenueItem[],
): DesignerRevenue[] {
  // Build a fast lookup: projectId → { totalRevenue, clientName }
  const revenueByProject = new Map<string, { revenue: number; clientName: string }>();
  revenueItems.forEach((r) => {
    if (r.projectId) {
      const pid = r.projectId.trim();
      const existing = revenueByProject.get(pid);
      revenueByProject.set(pid, {
        revenue: (existing?.revenue ?? 0) + resolveRevenueAmount(r),
        clientName: r.clientName || existing?.clientName || '',
      });
    }
  });

  // Group tasks by projectId → designerName → { hours, leaderCounts }
  type DesignerAccum = {
    hours: number;
    leaderCounts: Map<string, number>;
  };
  const projectMap = new Map<string, Map<string, DesignerAccum>>();

  tasks.forEach((t) => {
    if (!t.designerName || !t.projectId) return;

    const pid = t.projectId.trim();
    if (!projectMap.has(pid)) projectMap.set(pid, new Map());
    const dMap = projectMap.get(pid)!;

    const existing: DesignerAccum = dMap.get(t.designerName) ?? {
      hours: 0,
      leaderCounts: new Map(),
    };

    // ONLY punchedHours (approved/billed) — see groupHoursByProjectAndKey's
    // doc above for why actualEfforts must never feed a dollar figure.
    existing.hours += parseHours(t.punchedHours);

    if (t.teamLeader) {
      existing.leaderCounts.set(
        t.teamLeader,
        (existing.leaderCounts.get(t.teamLeader) ?? 0) + 1,
      );
    }

    dMap.set(t.designerName, existing);
  });

  // Accumulate per-designer contribution across all projects
  const designerTotals = new Map<string, {
    contribution: number;
    leaderCounts: Map<string, number>;
    projects: DesignerProjectShare[];
  }>();

  projectMap.forEach((dMap, pid) => {
    const revEntry = revenueByProject.get(pid);
    const projectRevenue = revEntry?.revenue ?? 0;
    const clientName = revEntry?.clientName ?? '';

    // Sum total hours across all designers on this project
    let totalProjectHours = 0;
    dMap.forEach((accum) => { totalProjectHours += accum.hours; });

    dMap.forEach((accum, designerName) => {
      const share =
        totalProjectHours > 0
          ? (accum.hours / totalProjectHours) * projectRevenue
          : 0;

      const existing = designerTotals.get(designerName) ?? {
        contribution: 0,
        leaderCounts: new Map(),
        projects: [] as DesignerProjectShare[],
      };

      existing.contribution += share;

      // Append this project to the designer's auditable breakdown
      existing.projects.push({
        projectId: pid,
        clientName,
        designerHours: accum.hours,
        projectTotalHours: totalProjectHours,
        projectTotalRevenue: projectRevenue,
        designerShare: Math.round(share * 100) / 100,
      });

      // Merge leader counts
      accum.leaderCounts.forEach((count, leader) => {
        existing.leaderCounts.set(
          leader,
          (existing.leaderCounts.get(leader) ?? 0) + count,
        );
      });

      designerTotals.set(designerName, existing);
    });
  });

  // Convert to DesignerRevenue[]
  const result: DesignerRevenue[] = [];
  designerTotals.forEach(({ contribution, leaderCounts, projects }, designerName) => {
    let primaryLeader = '';
    let maxCount = 0;
    leaderCounts.forEach((count, leader) => {
      if (count > maxCount) { maxCount = count; primaryLeader = leader; }
    });

    result.push({
      designerName,
      teamLeader: primaryLeader,
      revenueContribution: Math.round(contribution * 100) / 100,
      projects: projects.sort((a, b) => b.designerShare - a.designerShare),
    });
  });

  return result.sort((a, b) => b.revenueContribution - a.revenueContribution);
}

// ── Category attribution (Fix 2) ────────────────────────────────────────────────

export interface CategoryRevenue {
  category: string;
  revenueContribution: number;
  hours: number;
}

/**
 * Same proportional hours-share join as computeDesignerRevenue, grouped by
 * task category instead of designer name.
 *
 * Needed because the backend's syncRevenue() (revenue.gs) stamps each Project ID
 * with only the FIRST task category it encounters while summing that project's
 * hours. A project mixing e.g. "Design cum Development" and "IT Operations" tasks
 * has its entire revenue credited to whichever category came first — the other
 * category never appears anywhere, even though real hours were logged against it.
 *
 * This recomputes each category's true share directly from the Task list (which
 * has the real per-task category), joined to RevenueItem.totalRevenue by
 * projectId — so every category with logged hours gets its correct cut.
 */
export function computeCategoryRevenue(
  tasks: Task[],
  revenueItems: RevenueItem[],
): CategoryRevenue[] {
  const revenueByProject = new Map<string, number>();
  revenueItems.forEach((r) => {
    if (!r.projectId) return;
    const pid = r.projectId.trim();
    revenueByProject.set(pid, (revenueByProject.get(pid) ?? 0) + resolveRevenueAmount(r));
  });

  // projectId → category → hours
  const projectMap = groupHoursByProjectAndKey(tasks, (t) => t.category);

  const totals = new Map<string, { revenue: number; hours: number }>();
  projectMap.forEach((cMap, pid) => {
    const projectRevenue = revenueByProject.get(pid) ?? 0;
    let totalProjectHours = 0;
    cMap.forEach((h) => { totalProjectHours += h; });

    cMap.forEach((hours, category) => {
      const share = totalProjectHours > 0 ? (hours / totalProjectHours) * projectRevenue : 0;
      const existing = totals.get(category) ?? { revenue: 0, hours: 0 };
      existing.revenue += share;
      existing.hours += hours;
      totals.set(category, existing);
    });
  });

  const result: CategoryRevenue[] = [];
  totals.forEach(({ revenue, hours }, category) => {
    result.push({
      category,
      revenueContribution: Math.round(revenue * 100) / 100,
      hours: Math.round(hours * 100) / 100,
    });
  });

  return result.sort((a, b) => b.revenueContribution - a.revenueContribution);
}

/**
 * Returns a per-project breakdown for a single designer.
 * Thin convenience wrapper — callers can also access DesignerRevenue.projects directly.
 */
export function getDesignerProjectBreakdown(
  designerName: string,
  tasks: Task[],
  revenueItems: RevenueItem[],
): DesignerProjectShare[] {
  const all = computeDesignerRevenue(tasks, revenueItems);
  return all.find((d) => d.designerName === designerName)?.projects ?? [];
}