import { useState, useEffect, useMemo } from 'react';
import type { RevenueItem } from '../types';
import { useAppContext } from '../context/AppContext';
import {
  computeDesignerRevenue,
  computeCategoryRevenue,
  resolveRevenueAmount,
  scopeRevenueItems,
  parseMonthRange,
  monthIncludes,
} from '../lib/revenueAttribution';
import { PageShell } from '../components/layout/PageShell';
import { Card } from '../components/ui/Card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts';
import { DollarSign, Clock, TrendingUp, Award, RefreshCw, Users, User, Wallet } from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Plain USD, e.g. $1,234 — used for every KPI, table cell and tooltip. */
function formatCurrency(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

/** Abbreviated USD ($1.2K) — chart axis ticks only, where space is tight. */
function formatCurrencyAxis(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

/** Hours rendered as the small secondary line beside a revenue figure (Part 5). */
function formatHours(h: number): string {
  return `${(h ?? 0).toFixed(1)} hrs`;
}

function formatMonth(m: string): string {
  if (!m) return 'All Months';
  const [y, mo] = m.split('-');
  const date = new Date(+y, +mo - 1);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
}

/**
 * Returns the most recent YYYY-MM found in a list of RevenueItems, or '' if
 * empty. A row's month may be a range ("2026-07 - 2026-09") rather than a
 * single value — the END of the range is what determines recency, so this
 * uses parseMonthRange rather than comparing raw strings (a raw-string
 * comparison would judge a "2026-06 - 2026-09" row as older than a plain
 * "2026-08" row, even though the range actually extends past it).
 */
function getMostRecentRevenueMonth(items: RevenueItem[]): string {
  let best = '';
  for (const r of items) {
    const { end } = parseMonthRange(r.month);
    if (end && end > best) best = end;
  }
  return best;
}

// ── Color palettes ────────────────────────────────────────────────────────────

const BAR_COLORS = [
  '#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#84CC16', '#06B6D4',
];

const PIE_COLORS = [
  '#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899',
  '#14B8A6', '#F97316', '#84CC16', '#06B6D4',
];

// ── Tooltip components ────────────────────────────────────────────────────────

const BarTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div className="bg-[#1E1E2E] border border-[#2E2E3E] rounded-lg p-3 text-xs shadow-xl">
        <p className="font-semibold text-[#F0F0F5] mb-1">{d.leader}</p>
        <p className="text-[#8B8B9E]">
          Revenue: <span className="text-emerald-400 font-medium">{formatCurrency(d.revenue)}</span>
        </p>
        <p className="text-[#8B8B9E]">
          Hours: <span className="text-[#F0F0F5]">{d.hours.toFixed(1)}</span>
        </p>
      </div>
    );
  }
  return null;
};

const PieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0];
    return (
      <div className="bg-[#1E1E2E] border border-[#2E2E3E] rounded-lg p-3 text-xs shadow-xl">
        <p className="font-semibold text-[#F0F0F5] mb-1">{d.name}</p>
        <p className="text-[#8B8B9E]">
          Revenue: <span className="font-medium" style={{ color: d.payload.fill }}>{formatCurrency(d.value)}</span>
        </p>
      </div>
    );
  }
  return null;
};

/**
 * Fix 1: renders INSIDE the ring as a percentage only, instead of outside the
 * pie next to the full category name — outside placement clipped long names
 * like "Design cum Development" at the card edge. Matches the inside-label
 * pattern TaskPieChart already uses; full category names stay available via
 * the Legend below and the hover tooltip.
 */
const renderCategoryLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  if (percent < 0.06) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${Math.round(percent * 100)}%`}
    </text>
  );
};

const ChannelTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div className="bg-[#1E1E2E] border border-[#2E2E3E] rounded-lg p-3 text-xs shadow-xl">
        <p className="font-semibold text-[#F0F0F5] mb-1">{d.channel}</p>
        <p className="text-[#8B8B9E]">
          Revenue: <span className="text-cyan-400 font-medium">{formatCurrency(d.revenue)}</span>
        </p>
        <p className="text-[#8B8B9E]">
          Hours: <span className="text-[#F0F0F5]">{formatHours(d.hours)}</span>
        </p>
        <p className="text-[#8B8B9E]">
          Projects: <span className="text-[#F0F0F5]">{d.count}</span>
        </p>
      </div>
    );
  }
  return null;
};

// ── KPI Card ──────────────────────────────────────────────────────────────────

interface KPIProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  iconColor: string;
  loading?: boolean;
}

function RevenueKPICard({ title, value, subtitle, icon, iconColor, loading }: KPIProps) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-[#8B8B9E] uppercase tracking-wider mb-2">
            {title}
          </p>
          {loading ? (
            <div className="skeleton h-7 w-24 rounded" />
          ) : (
            <p className="text-2xl font-bold text-[#F0F0F5] truncate">{value}</p>
          )}
          {subtitle && !loading && (
            <p className="text-xs text-[#8B8B9E] mt-1">{subtitle}</p>
          )}
        </div>
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${iconColor}`}
          style={{ backgroundColor: 'rgba(99,102,241,0.12)' }}
        >
          <span className={iconColor}>{icon}</span>
        </div>
      </div>
    </Card>
  );
}

// ── Filter bar ────────────────────────────────────────────────────────────────

interface RevenueFilters {
  month: string;   // '' = All Months
  leader: string;
  category: string;
  designer: string;
}

interface FilterBarProps {
  filters: RevenueFilters;
  onChange: (f: Partial<RevenueFilters>) => void;
  availableMonths: string[];
  leaders: string[];
  categories: string[];
  designers: string[];
}

function RevenueFilterBar({
  filters, onChange, availableMonths, leaders, categories, designers,
}: FilterBarProps) {
  const hasActiveFilter = filters.month || filters.leader || filters.category || filters.designer;
  const selectCls = 'bg-[#111118] border border-[#1E1E2E] text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#6366F1] text-[#F0F0F5]';

  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      {/* Bug 3c: plain <select> instead of <input type="month"> */}
      <select
        value={filters.month}
        onChange={(e) => onChange({ month: e.target.value })}
        className={`${selectCls} min-w-[150px]`}
      >
        <option value="">All Months</option>
        {availableMonths.map((m) => (
          <option key={m} value={m}>{formatMonth(m)}</option>
        ))}
      </select>

      <select
        value={filters.leader}
        onChange={(e) => onChange({ leader: e.target.value, designer: '' })}
        className={`${selectCls} min-w-[150px]`}
      >
        <option value="">All Leaders</option>
        {leaders.map((l) => <option key={l} value={l}>{l}</option>)}
      </select>

      <select
        value={filters.designer}
        onChange={(e) => onChange({ designer: e.target.value, leader: '' })}
        className={`${selectCls} min-w-[160px]`}
      >
        <option value="">All Designers</option>
        {designers.map((d) => <option key={d} value={d}>{d}</option>)}
      </select>

      <select
        value={filters.category}
        onChange={(e) => onChange({ category: e.target.value })}
        className={`${selectCls} min-w-[170px]`}
      >
        <option value="">All Categories</option>
        {categories.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>

      {hasActiveFilter && (
        <button
          onClick={() => onChange({ month: '', leader: '', category: '', designer: '' })}
          className="text-xs text-[#8B8B9E] hover:text-[#F0F0F5] transition-colors flex items-center gap-1 px-2 py-1.5 rounded-md hover:bg-[#1E1E2E]"
        >
          ✕ Clear
        </button>
      )}
    </div>
  );
}

// ── Main Revenue page ─────────────────────────────────────────────────────────

export function Revenue() {
  // Tasks AND revenue both come from the single shared AppContext fetch —
  // the same (allTasks, revenueItems) pair every other consumer (Dashboard's
  // Leaderboard/DOTM/IT Ops Champion) uses. This page used to run its own
  // independent fetchRevenue({}) call here, which meant allTasks (AppContext's
  // snapshot) and allRevenueData (this page's own, separately-fetched
  // snapshot) could correspond to two different moments against a backend
  // that's been observed returning inconsistent data across separate
  // requests — breaking the projectId join that computeCategoryRevenue /
  // computeDesignerRevenue rely on (a project's tasks and its revenue row
  // must come from the SAME fetch, or they silently fail to match up).
  const { allTasks, revenueItems: allRevenueData, loading, error, refetch } = useAppContext();

  const [filters, setFilters] = useState<RevenueFilters>({
    month: '',    // Bug 3b: start blank; corrected after allRevenueData loads
    leader: '',
    category: '',
    designer: '',
  });
  // Tracks whether we've set the initial default month yet
  const [defaultMonthSet, setDefaultMonthSet] = useState(false);

  const updateFilters = (partial: Partial<RevenueFilters>) =>
    setFilters((prev) => ({ ...prev, ...partial }));

  // Fix 1: default month = max `month` field across RevenueItem[], NOT Task dates.
  // Revenue Master only has rows for projects with a filled-in Billing entry, so
  // it can lag behind the Task list's date range — using Task dates here (as the
  // Dashboard correctly does for its own dataset) could default to a month with
  // real tasks but zero revenue rows.
  useEffect(() => {
    if (allRevenueData.length > 0 && !defaultMonthSet) {
      const recentMonth = getMostRecentRevenueMonth(allRevenueData);
      setFilters((prev) => ({ ...prev, month: recentMonth }));
      setDefaultMonthSet(true);
    }
  }, [allRevenueData, defaultMonthSet]);

  // ── Available months for dropdown (from full dataset, most-recent-first) ──
  // A row's month can be a single value ("2026-07") or a range
  // ("2026-07 - 2026-09") for a project spanning multiple months. Building
  // this list from the raw string (and deduplicating by that raw string)
  // produced duplicate-looking labels — a plain "2026-07" and a range like
  // "2026-07 - 2026-09" are different raw strings that could both display as
  // "Jul 2026". Instead, collect the start and end of every row into a Set of
  // real "YYYY-MM" values, so each month appears exactly once regardless of
  // how many raw strings reference it.
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    allRevenueData.forEach((r) => {
      const { start, end } = parseMonthRange(r.month);
      if (start) months.add(start);
      if (end) months.add(end);
    });
    return [...months].sort().reverse();
  }, [allRevenueData]);

  // Bug 3a / Fix 1: month/leader filtering happens client-side against the
  // SAME list the default month and dropdown were computed from — no second
  // round trip whose own filter matching could disagree with the client's.
  //
  // Month matching is range-aware (monthIncludes) — a row whose month is
  // "2026-06 - 2026-08" must still match a "2026-07" filter selection, not
  // just an exact string match, consistent with the backend's own
  // range-inclusive filtering in getRevenueData.
  //
  // Category is deliberately NOT filtered here on RevenueItem.category — see
  // categoryProjectIds below for why, and where category filtering actually
  // happens instead.
  const filteredData = useMemo(() => {
    return allRevenueData.filter((r) => {
      if (filters.month && !monthIncludes(r.month, filters.month)) return false;
      if (filters.leader && r.leader !== filters.leader) return false;
      return true;
    });
  }, [allRevenueData, filters.month, filters.leader]);

  // Bug 1: option lists must always show the FULL set of values, never just
  // what's left after the current selection narrows the data — otherwise
  // picking one leader makes every other leader vanish from that same dropdown
  // next time it's opened. Derive from the complete unfiltered dataset, same
  // source the Month dropdown (availableMonths) and Designer dropdown already
  // correctly use.
  const leaders = useMemo(
    () => [...new Set(allRevenueData.map((r) => r.leader).filter(Boolean))].sort(),
    [allRevenueData]
  );
  // Category options come from allTasks, NOT RevenueItem.category — the same
  // fix as the "Revenue by Category" chart: the backend stamps each project
  // with only the first category it saw, so a project spanning multiple
  // categories would silently hide every category but that first one from
  // this dropdown. allTasks has every category actually present, matching
  // what the Dashboard's Category filter already correctly shows.
  const categories = useMemo(
    () => [...new Set(allTasks.map((t) => t.category).filter(Boolean))].sort(),
    [allTasks]
  );
  // Designers come from allTasks (revenue rows don't have per-designer granularity)
  const designers = useMemo(
    () => [...new Set(allTasks.map((t) => t.designerName).filter(Boolean))].sort(),
    [allTasks]
  );

  // Same reasoning as the category dropdown: a project can span multiple
  // categories, so "does this project belong to the selected category" must
  // be answered from Task-level data (any task on the project with that
  // category), not RevenueItem.category — otherwise selecting "IT Operations"
  // would incorrectly exclude a project's ENTIRE revenue row just because the
  // backend happened to stamp it with a different category, even though real
  // IT Operations hours were logged on it. This mirrors designerProjects
  // below: a project-inclusion filter, not a per-category dollar split — the
  // same model Leader/Designer filtering already uses on this page.
  const categoryProjectIds = useMemo(() => {
    if (!filters.category) return null;
    return new Set(
      allTasks
        .filter((t) => t.category === filters.category)
        .map((t) => t.projectId.trim())
    );
  }, [allTasks, filters.category]);

  // ── Apply client-side designer + category filters (both are project-level
  // inclusion filters over revenue rows, since revenue is per-project) ──
  const visibleData = useMemo(() => {
    let data = filteredData;
    if (filters.designer) {
      const designerProjects = new Set(
        allTasks
          .filter((t) => t.designerName === filters.designer)
          .map((t) => t.projectId.trim())
      );
      data = data.filter((r) => designerProjects.has(r.projectId.trim()));
    }
    if (categoryProjectIds) {
      data = data.filter((r) => categoryProjectIds.has(r.projectId.trim()));
    }
    return data;
  }, [filteredData, filters.designer, allTasks, categoryProjectIds]);

  // ── Pre-compute designer revenues ──
  // Revenue rows are scoped to the active month (and now category, via
  // categoryProjectIds — not RevenueItem.category) so the attribution KPIs
  // reconcile with the Total Revenue KPI below. Tasks are deliberately NOT
  // scoped: each project's hours denominator must stay whole, or shares get
  // inflated. Leader/designer filters are excluded here too — they select
  // which rows to DISPLAY, not which hours count toward a project total.
  const scopedRevenueData = useMemo(() => {
    let data = scopeRevenueItems(allRevenueData, { month: filters.month });
    if (categoryProjectIds) {
      data = data.filter((r) => categoryProjectIds.has(r.projectId.trim()));
    }
    return data;
  }, [allRevenueData, filters.month, categoryProjectIds]);

  const designerRevenues = useMemo(
    () => computeDesignerRevenue(allTasks, scopedRevenueData),
    [allTasks, scopedRevenueData]
  );

  // ── KPI calculations ──
  const kpis = useMemo(() => {
    if (!visibleData.length) return null;
    const totalRevenue = visibleData.reduce((s, r) => s + resolveRevenueAmount(r), 0);
    const totalHours = visibleData.reduce((s, r) => s + (r.totalHours ?? 0), 0);
    const hourlyRows = visibleData.filter((r) => r.paymentMode === 'Hourly' && r.hourlyRate > 0);
    const avgHourlyRate = hourlyRows.length > 0
      ? hourlyRows.reduce((s, r) => s + r.hourlyRate, 0) / hourlyRows.length
      : 0;

    const clientRevMap = new Map<string, number>();
    visibleData.forEach((r) => {
      clientRevMap.set(r.clientName, (clientRevMap.get(r.clientName) ?? 0) + resolveRevenueAmount(r));
    });
    let topClient = '';
    let topClientRev = 0;
    clientRevMap.forEach((rev, name) => {
      if (rev > topClientRev) { topClientRev = rev; topClient = name; }
    });

    return { totalRevenue, totalHours, avgHourlyRate, topClient, topClientRev };
  }, [visibleData]);

  // ── Part 6d: Team total via attribution sum (not raw row sum) ──
  const teamBreakdown = useMemo(() => {
    if (!filters.leader) return null;

    // Filter to designers who have tasks under this leader
    const breakdown = designerRevenues
      .filter((dr) => {
        return allTasks.some(
          (t) => t.designerName === dr.designerName && t.teamLeader === filters.leader
        ) && dr.revenueContribution > 0;
      })
      .sort((a, b) => b.revenueContribution - a.revenueContribution);

    // Team total = sum of individual contributions (guarantees leader KPI === sum of table rows)
    const teamTotal = breakdown.reduce((s, dr) => s + dr.revenueContribution, 0);
    const teamHours = breakdown.reduce(
      (s, dr) => s + dr.projects.reduce((h, p) => h + p.designerHours, 0),
      0,
    );

    return { teamTotal, teamHours, breakdown };
  }, [filters.leader, designerRevenues, allTasks]);

  // ── Part 5 / 6c: Single designer breakdown ──
  const designerBreakdown = useMemo(() => {
    if (!filters.designer) return null;
    const drEntry = designerRevenues.find((dr) => dr.designerName === filters.designer);
    const projects = drEntry?.projects ?? [];
    return {
      contribution: drEntry?.revenueContribution ?? 0,
      hours: projects.reduce((h, p) => h + p.designerHours, 0),
      projects,
    };
  }, [filters.designer, designerRevenues]);

  // ── Chart: Revenue by Leader ──
  const leaderChartData = useMemo(() => {
    const map = new Map<string, { revenue: number; hours: number }>();
    visibleData.forEach((r) => {
      const entry = map.get(r.leader) ?? { revenue: 0, hours: 0 };
      entry.revenue += resolveRevenueAmount(r);
      entry.hours += r.totalHours ?? 0;
      map.set(r.leader, entry);
    });
    return Array.from(map.entries())
      .map(([leader, { revenue, hours }]) => ({ leader, revenue, hours }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [visibleData]);

  // ── Chart: Revenue by Category (Fix 2) ──
  // RevenueItem.category can't be trusted: the backend's syncRevenue() stamps
  // each Project ID with only the FIRST task category it saw while summing that
  // project's hours, so a project mixing e.g. "Design cum Development" and
  // "IT Operations" tasks has its whole revenue credited to one category — the
  // other never appears. Recompute each category's true share the same way
  // Part 2 does for designers: proportional hours-share per project, joined by
  // projectId, using the real per-task category from the Task list.
  //
  // Scoped to visibleData's own project set (not a separate task/category
  // filter) so this always sums to exactly the Total Revenue KPI, under any
  // combination of month/leader/category/designer filters.
  const visibleProjectIds = useMemo(
    () => new Set(visibleData.map((r) => r.projectId.trim())),
    [visibleData]
  );
  const categoryChartData = useMemo(() => {
    const relevantTasks = allTasks.filter((t) => visibleProjectIds.has(t.projectId?.trim()));
    const relevantRevenue = allRevenueData.filter((r) => visibleProjectIds.has(r.projectId?.trim()));
    return computeCategoryRevenue(relevantTasks, relevantRevenue)
      .map((c) => ({ name: c.category, value: c.revenueContribution }))
      .sort((a, b) => b.value - a.value);
  }, [allTasks, allRevenueData, visibleProjectIds]);

  // ── Chart: Revenue by Payment Channel (Part 6b) ──
  // Blank paymentChannel → 'Unspecified' (not dropped, so total reconciles)
  const channelChartData = useMemo(() => {
    const map = new Map<string, { revenue: number; count: number; hours: number }>();
    visibleData.forEach((r) => {
      const ch = r.paymentChannel || 'Unspecified';
      const entry = map.get(ch) ?? { revenue: 0, count: 0, hours: 0 };
      entry.revenue += resolveRevenueAmount(r);
      entry.hours += r.totalHours ?? 0;
      entry.count += 1;
      map.set(ch, entry);
    });
    return Array.from(map.entries())
      .map(([channel, { revenue, count, hours }]) => ({ channel, revenue, count, hours }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [visibleData]);

  if (error) {
    return (
      <PageShell title="Revenue Dashboard" subtitle="Financial overview by client and leader">
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center">
            <RefreshCw size={24} className="text-red-400" />
          </div>
          <div className="text-center">
            <p className="text-[#F0F0F5] font-semibold mb-1">Failed to load revenue data</p>
            <p className="text-[#8B8B9E] text-sm mb-4">{error}</p>
            <button
              onClick={refetch}
              className="px-4 py-2 bg-[#6366F1] hover:bg-[#5254CC] text-white text-sm font-medium rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title="Revenue Dashboard" subtitle="Financial overview by client and leader">
      {/* Filter Bar — now uses select dropdowns, no calendar picker */}
      <RevenueFilterBar
        filters={filters}
        onChange={updateFilters}
        availableMonths={availableMonths}
        leaders={leaders}
        categories={categories}
        designers={designers}
      />

      {/* ── Part 6d: Team Total Revenue (leader selected) ── */}
      {filters.leader && teamBreakdown && (
        <div className="mb-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <RevenueKPICard
              title={`Team Total Revenue — ${filters.leader}`}
              value={loading ? '—' : formatCurrency(teamBreakdown.teamTotal)}
              subtitle={`· ${formatHours(teamBreakdown.teamHours)} · sum of ${teamBreakdown.breakdown.length} designer contribution(s)`}
              icon={<Users size={18} />}
              iconColor="text-indigo-400"
              loading={loading}
            />
          </div>

          {teamBreakdown.breakdown.length > 0 && (
            <Card className="fade-in">
              <h2 className="text-sm font-semibold text-[#F0F0F5] mb-1 flex items-center gap-2">
                <Users size={15} className="text-indigo-400" />
                Designer Revenue Breakdown — {filters.leader}'s Team
              </h2>
              <p className="text-xs text-[#8B8B9E] mb-4">
                Leader total = exact sum of rows below (computed via proportional hours-share attribution)
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1E1E2E]">
                      {['Designer', 'Revenue Contribution', '% of Team Total'].map((h) => (
                        <th key={h} className="text-left text-xs font-medium text-[#8B8B9E] uppercase tracking-wider py-3 px-3 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {teamBreakdown.breakdown.map((dr) => (
                      <tr key={dr.designerName} className="border-b border-[#1E1E2E]/50 hover:bg-[#1E1E2E]/40 transition-colors">
                        <td className="py-3 px-3 text-[#F0F0F5] font-medium">{dr.designerName}</td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="text-emerald-400 font-semibold">
                            {formatCurrency(dr.revenueContribution)}
                          </span>
                          <span className="text-[#8B8B9E] text-xs ml-1.5">
                            · {formatHours(dr.projects.reduce((h, p) => h + p.designerHours, 0))}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-[#8B8B9E]">
                          {teamBreakdown.teamTotal > 0
                            ? `${((dr.revenueContribution / teamBreakdown.teamTotal) * 100).toFixed(1)}%`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                    {/* Reconciliation footer */}
                    <tr className="border-t border-[#2E2E3E] bg-[#1E1E2E]/30">
                      <td className="py-2 px-3 text-xs font-semibold text-[#8B8B9E]">Total</td>
                      <td className="py-2 px-3 text-xs font-semibold text-emerald-400 whitespace-nowrap">
                        {formatCurrency(teamBreakdown.teamTotal)}
                        <span className="text-[#8B8B9E] font-normal ml-1.5">
                          · {formatHours(teamBreakdown.teamHours)}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-xs text-[#8B8B9E]">100%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── Part 6c: Single Designer Billing View ── */}
      {filters.designer && designerBreakdown && (
        <div className="mb-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <RevenueKPICard
              title={`Revenue Contribution — ${filters.designer}`}
              value={loading ? '—' : formatCurrency(designerBreakdown.contribution)}
              subtitle={`· ${formatHours(designerBreakdown.hours)} · proportional share across ${designerBreakdown.projects.length} project(s)`}
              icon={<User size={18} />}
              iconColor="text-purple-400"
              loading={loading}
            />
          </div>

          {designerBreakdown.projects.length > 0 && (
            <Card className="fade-in">
              <h2 className="text-sm font-semibold text-[#F0F0F5] mb-1 flex items-center gap-2">
                <User size={15} className="text-purple-400" />
                Project-level Revenue Audit — {filters.designer}
              </h2>
              <p className="text-xs text-[#8B8B9E] mb-4">
                Share = (designer hrs ÷ project total hrs) × project revenue · Verify by hand: rows sum to the KPI above
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
                    {designerBreakdown.projects.map((p) => (
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
                    {/* Reconciliation footer */}
                    <tr className="border-t border-[#2E2E3E] bg-[#1E1E2E]/30">
                      <td colSpan={5} className="py-2 px-3 text-xs font-semibold text-[#8B8B9E]">Total</td>
                      <td className="py-2 px-3 text-xs font-semibold text-emerald-400">
                        {formatCurrency(designerBreakdown.contribution)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <RevenueKPICard
          title="Total Revenue"
          value={loading ? '—' : kpis ? formatCurrency(kpis.totalRevenue) : '$0'}
          subtitle={kpis ? `· ${formatHours(kpis.totalHours)} logged` : undefined}
          icon={<DollarSign size={18} />}
          iconColor="text-emerald-400"
          loading={loading}
        />
        <RevenueKPICard
          title="Total Hours"
          value={loading ? '—' : kpis ? `${kpis.totalHours.toFixed(1)} hrs` : '0 hrs'}
          subtitle={kpis ? `across ${visibleData.length} project(s)` : undefined}
          icon={<Clock size={18} />}
          iconColor="text-indigo-400"
          loading={loading}
        />
        <RevenueKPICard
          title="Avg Hourly Rate"
          value={loading ? '—' : kpis ? `${formatCurrency(kpis.avgHourlyRate)}/hr` : '—'}
          subtitle="Hourly-mode projects only"
          icon={<TrendingUp size={18} />}
          iconColor="text-amber-400"
          loading={loading}
        />
        <RevenueKPICard
          title="Top Client"
          value={loading ? '—' : kpis?.topClient || '—'}
          subtitle={kpis?.topClient ? `${formatCurrency(kpis.topClientRev)} revenue` : undefined}
          icon={<Award size={18} />}
          iconColor="text-yellow-400"
          loading={loading}
        />
      </div>

      {/* Charts Row 1: Revenue by Leader + Revenue by Category */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card className="fade-in">
          <h2 className="text-sm font-semibold text-[#F0F0F5] mb-4">Revenue by Leader</h2>
          {loading ? (
            <div className="skeleton h-60 rounded" />
          ) : leaderChartData.length === 0 ? (
            <p className="text-[#8B8B9E] text-sm py-6 text-center">No data</p>
          ) : (
            <div className="overflow-x-auto">
              <div style={{ minWidth: Math.max(300, leaderChartData.length * 80) }}>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={leaderChartData} margin={{ top: 16, right: 20, left: 0, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2E" vertical={false} />
                    <XAxis
                      dataKey="leader"
                      tick={{ fill: '#8B8B9E', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      angle={-35}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis
                      tickFormatter={(v) => formatCurrencyAxis(v)}
                      tick={{ fill: '#8B8B9E', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
                    <Bar dataKey="revenue" radius={[4, 4, 0, 0]} maxBarSize={40}>
                      {leaderChartData.map((_, i) => (
                        <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </Card>

        <Card className="fade-in">
          <h2 className="text-sm font-semibold text-[#F0F0F5] mb-4">Revenue by Category</h2>
          {loading ? (
            <div className="skeleton h-60 rounded" />
          ) : categoryChartData.length === 0 ? (
            <p className="text-[#8B8B9E] text-sm py-6 text-center">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={categoryChartData}
                  cx="50%"
                  cy="45%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                  labelLine={false}
                  label={renderCategoryLabel}
                >
                  {categoryChartData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => (
                    <span style={{ color: '#8B8B9E', fontSize: 11 }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Fix 3: Payment Channel cards — same Revenue/Hours/Projects numbers the
          chart tooltip shows on hover, always visible without interaction */}
      {!loading && channelChartData.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {channelChartData.map((c) => (
            <RevenueKPICard
              key={c.channel}
              title={c.channel}
              value={formatCurrency(c.revenue)}
              subtitle={`${formatHours(c.hours)} · ${c.count} project${c.count === 1 ? '' : 's'}`}
              icon={<Wallet size={18} />}
              iconColor="text-cyan-400"
            />
          ))}
        </div>
      )}

      {/* Chart: Revenue by Payment Channel (Part 6b) */}
      <div className="mb-6">
        <Card className="fade-in">
          <h2 className="text-sm font-semibold text-[#F0F0F5] mb-1">Revenue by Payment Channel</h2>
          <p className="text-xs text-[#8B8B9E] mb-4">
            Blank channel entries are grouped as "Unspecified" so the total reconciles with the KPI above
          </p>
          {loading ? (
            <div className="skeleton h-60 rounded" />
          ) : channelChartData.length === 0 ? (
            <p className="text-[#8B8B9E] text-sm py-6 text-center">No payment channel data</p>
          ) : (
            <div className="overflow-x-auto">
              <div style={{ minWidth: Math.max(300, channelChartData.length * 100) }}>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={channelChartData} margin={{ top: 16, right: 20, left: 0, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2E" vertical={false} />
                    <XAxis
                      dataKey="channel"
                      tick={{ fill: '#8B8B9E', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      angle={-35}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis
                      tickFormatter={(v) => formatCurrencyAxis(v)}
                      tick={{ fill: '#8B8B9E', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<ChannelTooltip />} cursor={{ fill: 'rgba(6,182,212,0.08)' }} />
                    <Bar dataKey="revenue" radius={[4, 4, 0, 0]} maxBarSize={50}>
                      {channelChartData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Revenue Details Table — Part 5: hours shown inline */}
      <Card className="fade-in">
        <h2 className="text-sm font-semibold text-[#F0F0F5] mb-4">Revenue Details</h2>
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-10 rounded" />)}
          </div>
        ) : visibleData.length === 0 ? (
          <p className="text-[#8B8B9E] text-sm py-6 text-center">
            No revenue data for the selected filters.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1E1E2E]">
                  {['Client', 'Project ID', 'Leader', 'Category', 'Mode', 'Channel', 'Rate / Fee', 'Revenue · Hours'].map((h) => (
                    <th key={h} className="text-left text-xs font-medium text-[#8B8B9E] uppercase tracking-wider py-3 px-3 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleData.map((row, i) => (
                  <tr
                    key={`${row.srNo}-${i}`}
                    className="border-b border-[#1E1E2E]/50 hover:bg-[#1E1E2E]/40 transition-colors"
                  >
                    <td className="py-3 px-3 text-[#F0F0F5] font-medium whitespace-nowrap">{row.clientName || '—'}</td>
                    <td className="py-3 px-3 text-[#8B8B9E] font-mono text-xs whitespace-nowrap">{row.projectId || '—'}</td>
                    <td className="py-3 px-3 text-[#F0F0F5] whitespace-nowrap">{row.leader || '—'}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full text-xs bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 whitespace-nowrap">
                        {row.category || '—'}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs border whitespace-nowrap ${
                        row.paymentMode === 'Hourly'
                          ? 'bg-amber-500/15 text-amber-400 border-amber-500/20'
                          : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
                      }`}>
                        {row.paymentMode || '—'}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {row.paymentChannel ? (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-cyan-500/15 text-cyan-400 border border-cyan-500/20 whitespace-nowrap">
                          {row.paymentChannel}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-[#1E1E2E] text-[#8B8B9E] border border-[#2E2E3E] whitespace-nowrap">
                          Unspecified
                        </span>
                      )}
                    </td>
                    {/* Part 5: for Hourly, rate is per-hour; for Fixed, hourlyRate holds the flat fee */}
                    <td className="py-3 px-3 text-[#8B8B9E] whitespace-nowrap">
                      {row.hourlyRate > 0
                        ? `${formatCurrency(row.hourlyRate)}${row.paymentMode === 'Hourly' ? '/hr' : ' flat'}`
                        : '—'}
                    </td>
                    {/* Part 5: revenue + hours shown together — "$4,500 · 9.0 hrs".
                        Hours render on Fixed rows too (they just don't drive the fee). */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="text-emerald-400 font-semibold">
                        {formatCurrency(resolveRevenueAmount(row))}
                      </span>
                      <span className="text-[#8B8B9E] text-xs ml-1.5">
                        · {formatHours(row.totalHours ?? 0)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </PageShell>
  );
}
