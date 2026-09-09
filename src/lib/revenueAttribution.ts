import type { Task, RevenueItem } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Per-project breakdown for a single designer — every UI number traces to this. */
export interface DesignerProjectShare {
  projectId: string;
  clientName: string;
  /** Hours this designer logged on this project (punchedHours → actualEfforts fallback) */
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

  // Pure minutes: "150m", "150min", or "150 Minutes"
  const minsOnly = str.match(/^(\d+(?:\.\d+)?)\s*m(?:inutes|inute|ins|in)?\.?$/i);
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

    // Prefer punchedHours; fall back to actualEfforts if empty/zero
    const ph = parseHours(t.punchedHours);
    const ae = parseHours(t.actualEfforts);
    existing.hours += ph > 0 ? ph : ae;

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
  const projectMap = new Map<string, Map<string, number>>();
  tasks.forEach((t) => {
    if (!t.category || !t.projectId) return;
    const pid = t.projectId.trim();
    if (!projectMap.has(pid)) projectMap.set(pid, new Map());
    const cMap = projectMap.get(pid)!;
    const ph = parseHours(t.punchedHours);
    const ae = parseHours(t.actualEfforts);
    cMap.set(t.category, (cMap.get(t.category) ?? 0) + (ph > 0 ? ph : ae));
  });

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