import { useMemo, useState } from 'react';
import type { Task, RevenueItem } from '../../types';
import { Card } from '../ui/Card';
import { KPICard } from '../dashboard/KPICard';
import { parseHours, computeDesignerRevenue, scopeRevenueItemsForDateRange } from '../../lib/revenueAttribution';
import {
  capacityHoursForPeriod,
  filterTasksInDateRange,
  monthRangeFromString,
  weekOfMonthRange,
  yearRangeFromMonthString,
  toDateKey,
  type Period,
} from '../../lib/productivity';
import { Gauge, DollarSign, Star, User } from 'lucide-react';

type ViewBy = 'day' | 'week' | 'month' | 'year';
type WeekChoice = 'all' | '1' | '2' | '3' | '4';

const VIEW_BY_OPTIONS: { value: ViewBy; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
];

function selectCls(extra = '') {
  return `bg-[#111118] border border-[#1E1E2E] text-[#F0F0F5] text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#6366F1] ${extra}`;
}

function dateFromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function formatMonthLabel(month: string): string {
  if (!month) return '';
  const { start } = monthRangeFromString(month);
  return start.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
}

function formatCurrency(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

function formatHours(h: number): string {
  return `${h.toFixed(1)} hrs`;
}

interface DesignerDetailSectionProps {
  /** The designer this section profiles. */
  designerName: string;
  /** Complete, unfiltered task list — this section does its own designer/date filtering. */
  allTasks: Task[];
  /** Complete, unfiltered revenue list. */
  revenueItems: RevenueItem[];
  /** The page's own top-level Month filter ('' = All Months) — used only to pick
   *  which month is "in scope" by default; this section never writes back to it. */
  topLevelMonth: string;
  loading?: boolean;
  /** Dashboard shows Average Rating alongside Revenue/Productivity; Revenue page doesn't. */
  showRating?: boolean;
  /** Revenue page shows the per-project audit table; Dashboard doesn't. */
  showAuditTable?: boolean;
}

/**
 * A single "View by" (Day/Week/Month/Year) control shared across an ENTIRE
 * designer-detail section — Revenue Contribution, the Project-level Revenue
 * Audit table, and Productivity all read from the exact same window.
 *
 * An earlier version nested the View-by control inside the Productivity
 * card only, so switching to e.g. "Week 1" updated Productivity's
 * Listed/Billed numbers while Revenue Contribution and the Audit table sat
 * right next to it still showing the whole month's totals — individually
 * correct, but inconsistent-looking as a section. Lifting the control up
 * here so it governs every number in the section fixes that.
 */
export function DesignerDetailSection({
  designerName,
  allTasks,
  revenueItems,
  topLevelMonth,
  loading,
  showRating = false,
  showAuditTable = false,
}: DesignerDetailSectionProps) {
  const designerTasks = useMemo(
    () => allTasks.filter((t) => t.designerName === designerName),
    [allTasks, designerName],
  );

  // "Month in scope": the top-level Month filter if one is set, otherwise
  // this designer's own most recent month with data, otherwise the current
  // calendar month as a last resort (a brand-new designer with zero tasks).
  const scopeMonth = useMemo(() => {
    if (topLevelMonth) return topLevelMonth;
    let best = '';
    designerTasks.forEach((t) => {
      const m = t.date?.slice(0, 7);
      if (m && m > best) best = m;
    });
    return best || toDateKey(new Date()).slice(0, 7);
  }, [topLevelMonth, designerTasks]);

  // Default day = this designer's own most recent date with data — NOT
  // "today", since demo/test data is often backdated and defaulting to
  // today would show an empty, misleading 0% for a designer with real
  // (just not today's) hours logged.
  const defaultDay = useMemo(() => {
    let best = '';
    designerTasks.forEach((t) => {
      const d = t.date?.slice(0, 10);
      if (d && d > best) best = d;
    });
    return best || toDateKey(new Date());
  }, [designerTasks]);

  const [viewBy, setViewBy] = useState<ViewBy>('month');
  const [day, setDay] = useState(defaultDay);
  const [week, setWeek] = useState<WeekChoice>('all');

  const effectiveDay = day || defaultDay;

  const { start, end, capacityPeriod, windowLabel } = useMemo(() => {
    switch (viewBy) {
      case 'day': {
        const d = dateFromKey(effectiveDay);
        return { start: d, end: d, capacityPeriod: 'daily' as Period, windowLabel: effectiveDay };
      }
      case 'week': {
        if (week === 'all') {
          // Simplification (explicit, per design): "All Weeks" is treated as
          // the whole month, at Monthly's 160hr capacity — not 40hrs × the
          // number of weeks in the month. Picked for consistency: it's the
          // exact same window/capacity as the Month view, so switching
          // Week → "All Weeks" and Month always agree.
          const { start, end } = monthRangeFromString(scopeMonth);
          return { start, end, capacityPeriod: 'monthly' as Period, windowLabel: `${formatMonthLabel(scopeMonth)} (all weeks)` };
        }
        const weekNum = Number(week) as 1 | 2 | 3 | 4;
        const { start, end } = weekOfMonthRange(scopeMonth, weekNum);
        return { start, end, capacityPeriod: 'weekly' as Period, windowLabel: `Week ${week} · ${formatMonthLabel(scopeMonth)}` };
      }
      case 'year': {
        const { start, end } = yearRangeFromMonthString(scopeMonth);
        return { start, end, capacityPeriod: 'yearly' as Period, windowLabel: String(start.getFullYear()) };
      }
      case 'month':
      default: {
        const { start, end } = monthRangeFromString(scopeMonth);
        return { start, end, capacityPeriod: 'monthly' as Period, windowLabel: formatMonthLabel(scopeMonth) };
      }
    }
  }, [viewBy, effectiveDay, week, scopeMonth]);

  const detail = useMemo(() => {
    // ── Productivity: Listed + Billed, from the SAME windowDesignerTasks — by
    // construction they can never drift to mismatched time windows.
    const windowDesignerTasks = filterTasksInDateRange(designerTasks, start, end);
    const listedHours = windowDesignerTasks.reduce((s, t) => s + parseHours(t.actualEfforts), 0);
    const billedHours = windowDesignerTasks.reduce((s, t) => s + parseHours(t.punchedHours), 0);
    const capacityHours = capacityHoursForPeriod(capacityPeriod);
    // No capping — overtime (>100%) is a real, useful signal, shown as-is.
    const productivityPct = capacityHours > 0 ? Math.round((billedHours / capacityHours) * 10000) / 100 : 0;

    // ── Revenue Contribution + Audit table: same window, same proportional-
    // hours-share math scopeRevenueItemsForMonth already used, generalized to
    // an arbitrary [start, end] instead of a fixed calendar month. Revenue
    // rows are split by ALL designers' punchedHours-only share of each
    // project within the window (scopeRevenueItemsForDateRange), then
    // computeDesignerRevenue further splits that window's revenue across
    // designers by their own punchedHours-only share — so Revenue
    // Contribution's underlying hours match Productivity's Billed hours
    // exactly (both are punchedHours-only, both scoped to the same window).
    const startKey = toDateKey(start);
    const endKey = toDateKey(end);
    const windowScopedRevenue = scopeRevenueItemsForDateRange(revenueItems, allTasks, startKey, endKey);
    const windowScopedTasks = filterTasksInDateRange(allTasks, start, end);
    const revenues = computeDesignerRevenue(windowScopedTasks, windowScopedRevenue);
    const designerRevenue = revenues.find((d) => d.designerName === designerName);

    const ratedTasks = windowDesignerTasks.filter(
      (t) => t.averageRating !== null && t.averageRating !== undefined,
    );
    const averageRating = ratedTasks.length > 0
      ? Math.round((ratedTasks.reduce((s, t) => s + Number(t.averageRating), 0) / ratedTasks.length) * 100) / 100
      : null;

    return {
      capacityHours,
      listedHours: Math.round(listedHours * 100) / 100,
      billedHours: Math.round(billedHours * 100) / 100,
      productivityPct,
      revenueContribution: designerRevenue?.revenueContribution ?? 0,
      projects: designerRevenue?.projects ?? [],
      averageRating,
    };
  }, [designerTasks, allTasks, revenueItems, designerName, start, end, capacityPeriod]);

  return (
    <div className="space-y-4">
      {/* Shared "View by" control — governs Revenue Contribution, the Audit
          table, and Productivity below, all at once. Fully local: it never
          reads or writes any page-level filter. */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-[#F0F0F5] flex items-center gap-2">
          <User size={15} className="text-purple-400" />
          {designerName} — {windowLabel}
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={viewBy}
            onChange={(e) => setViewBy(e.target.value as ViewBy)}
            className={selectCls('cursor-pointer')}
            title="Time window for this designer's section only — does not affect any other filter"
          >
            {VIEW_BY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>View by {opt.label}</option>
            ))}
          </select>

          {viewBy === 'day' && (
            <input
              type="date"
              value={effectiveDay}
              onChange={(e) => setDay(e.target.value)}
              className={selectCls()}
            />
          )}

          {viewBy === 'week' && (
            <select
              value={week}
              onChange={(e) => setWeek(e.target.value as WeekChoice)}
              className={selectCls('cursor-pointer')}
            >
              <option value="all">All Weeks</option>
              <option value="1">Week 1</option>
              <option value="2">Week 2</option>
              <option value="3">Week 3</option>
              <option value="4">Week 4</option>
            </select>
          )}
        </div>
      </div>

      <div className={`grid grid-cols-1 sm:grid-cols-2 ${showRating ? 'lg:grid-cols-3' : ''} gap-4`}>
        <KPICard
          title="Revenue Contribution"
          value={loading ? '—' : formatCurrency(detail.revenueContribution)}
          subtitle={`proportional share · ${detail.projects.length} project(s)`}
          icon={<DollarSign size={18} />}
          iconColor="text-amber-400"
          loading={loading}
        />
        <KPICard
          title="Productivity"
          value={loading ? '—' : `${detail.productivityPct.toFixed(0)}%`}
          subtitle={`Capacity: ${formatHours(detail.capacityHours)} · Listed: ${formatHours(detail.listedHours)} · Billed: ${formatHours(detail.billedHours)}`}
          icon={<Gauge size={18} />}
          iconColor="text-emerald-400"
          loading={loading}
        />
        {showRating && (
          <KPICard
            title="Average Rating"
            value={loading ? '—' : detail.averageRating !== null ? `${detail.averageRating.toFixed(2)} / 5` : 'N/A'}
            subtitle={windowLabel}
            icon={<Star size={18} />}
            iconColor="text-yellow-400"
            loading={loading}
          />
        )}
      </div>

      {showAuditTable && detail.projects.length > 0 && (
        <Card className="fade-in">
          <h2 className="text-sm font-semibold text-[#F0F0F5] mb-1 flex items-center gap-2">
            <User size={15} className="text-purple-400" />
            Project-level Revenue Audit — {designerName}
          </h2>
          <p className="text-xs text-[#8B8B9E] mb-4">
            Share = (designer hrs ÷ project total hrs) × project revenue, for {windowLabel} · Verify by hand: rows sum to the KPI above
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1E1E2E]">
                  {['Project ID', 'Client', 'Designer Hrs', 'Project Hrs', 'Project Revenue', 'Designer Share'].map((h) => (
                    <th key={h} className="text-left text-xs font-medium text-[#8B8B9E] uppercase tracking-wider py-3 px-3 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {detail.projects.map((p) => (
                  <tr key={p.projectId} className="border-b border-[#1E1E2E]/50 hover:bg-[#1E1E2E]/40 transition-colors">
                    <td className="py-3 px-3 text-[#8B8B9E] font-mono text-xs">{p.projectId || '—'}</td>
                    <td className="py-3 px-3 text-[#F0F0F5]">{p.clientName || '—'}</td>
                    <td className="py-3 px-3 text-[#8B8B9E]">{p.designerHours.toFixed(1)} h</td>
                    <td className="py-3 px-3 text-[#8B8B9E]">{p.projectTotalHours.toFixed(1)} h</td>
                    <td className="py-3 px-3 text-[#F0F0F5]">
                      {p.projectTotalRevenue > 0 ? formatCurrency(p.projectTotalRevenue) : <span className="text-[#8B8B9E]">Not billed</span>}
                    </td>
                    <td className="py-3 px-3 text-emerald-400 font-semibold">
                      {p.designerShare > 0 ? formatCurrency(p.designerShare) : <span className="text-[#8B8B9E]">—</span>}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-[#2E2E3E] bg-[#1E1E2E]/30">
                  <td colSpan={5} className="py-2 px-3 text-xs font-semibold text-[#8B8B9E]">Total</td>
                  <td className="py-2 px-3 text-xs font-semibold text-emerald-400">
                    {formatCurrency(detail.revenueContribution)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
