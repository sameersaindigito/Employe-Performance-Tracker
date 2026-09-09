import { useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { computeDesignerRevenue, scopeRevenueItems } from '../../lib/revenueAttribution';
import { isClientLost } from '../../lib/ratings';
import { Card } from '../ui/Card';
import { Monitor, Star, ClipboardList, Users, DollarSign } from 'lucide-react';

// ── Scoring weights (tune these without touching the algorithm) ───────────────
const RATING_WEIGHT  = 0.6;
const REVENUE_WEIGHT = 0.4;

const MIN_TASKS = 3;

export function ITOperationsChampion() {
  const { tasks, allTasks, filters, loading, revenueItems } = useAppContext();

  // Revenue scoped to the month/category being awarded; hours denominators come
  // from allTasks so each project's total hours stay whole.
  const scopedRevenue = useMemo(
    () => scopeRevenueItems(revenueItems, { month: filters.month, category: filters.category }),
    [revenueItems, filters.month, filters.category],
  );

  const champion = useMemo(() => {
    // 1. Filter to IT Operations tasks only
    const itTasks = tasks.filter((t) => t.category === 'IT Operations');
    if (itTasks.length === 0) return null;

    // 2. Pre-compute revenue contributions from the FULL task list
    const revenueMap = new Map<string, number>();
    computeDesignerRevenue(allTasks, scopedRevenue).forEach((r) => {
      revenueMap.set(r.designerName, r.revenueContribution);
    });

    // 3. Group by designerName
    const designerMap = new Map<string, {
      totalTasks: number;
      ratingSum: number;
      ratedCount: number;
      leaderCounts: Map<string, number>;
      hasClientLost: boolean;
    }>();

    itTasks.forEach((t) => {
      if (!t.designerName) return;
      const entry = designerMap.get(t.designerName) ?? {
        totalTasks: 0,
        ratingSum: 0,
        ratedCount: 0,
        leaderCounts: new Map<string, number>(),
        hasClientLost: false,
      };
      entry.totalTasks += 1;
      if (t.averageRating !== null && t.averageRating !== undefined) {
        entry.ratingSum += Number(t.averageRating);
        entry.ratedCount += 1;
      }
      if (isClientLost(t.status)) {
        entry.hasClientLost = true;
      }
      if (t.teamLeader) {
        entry.leaderCounts.set(
          t.teamLeader,
          (entry.leaderCounts.get(t.teamLeader) ?? 0) + 1
        );
      }
      designerMap.set(t.designerName, entry);
    });

    // 4. Build candidates list (min tasks + rated)
    type Candidate = {
      name: string;
      avgRating: number;
      totalTasks: number;
      teamLeader: string;
      revenue: number;
    };
    const candidates: Candidate[] = [];

    designerMap.forEach((data, name) => {
      // Client Lost designers are ineligible for the award, per spec.
      if (data.hasClientLost) return;
      if (data.totalTasks < MIN_TASKS) return;
      if (data.ratedCount === 0) return;
      const avgRating = data.ratingSum / data.ratedCount;

      let primaryLeader = '';
      let maxCount = 0;
      data.leaderCounts.forEach((count, leader) => {
        if (count > maxCount) { maxCount = count; primaryLeader = leader; }
      });

      candidates.push({
        name,
        avgRating,
        totalTasks: data.totalTasks,
        teamLeader: primaryLeader,
        revenue: revenueMap.get(name) ?? 0,
      });
    });

    if (candidates.length === 0) return null;

    // 5. Compute 2-factor weighted score
    const maxRevenue = Math.max(...candidates.map((c) => c.revenue));

    let winner: (Candidate & { weightedScore: number }) | null = null;

    candidates.forEach((c) => {
      const normalizedRevenue = maxRevenue > 0 ? (c.revenue / maxRevenue) * 5 : 0;
      const weightedScore =
        c.avgRating  * RATING_WEIGHT +
        normalizedRevenue * REVENUE_WEIGHT;

      if (!winner || weightedScore > winner.weightedScore) {
        winner = { ...c, weightedScore };
      }
    });

    return winner as (Candidate & { weightedScore: number }) | null;
  }, [tasks, allTasks, scopedRevenue]);

  if (loading) {
    return (
      <Card className="fade-in">
        <div className="skeleton h-4 w-36 rounded mb-4" />
        <div className="skeleton h-10 w-48 rounded mb-2" />
        <div className="skeleton h-4 w-24 rounded" />
      </Card>
    );
  }

  if (!champion) {
    return (
      <Card className="fade-in">
        <p className="text-xs font-medium text-[#8B8B9E] uppercase tracking-wider mb-3">
          IT Operations Champion
        </p>
        <p className="text-[#F0F0F5] text-sm font-medium mb-1">
          No eligible IT Operations designer
        </p>
        <p className="text-[#8B8B9E] text-xs">
          Minimum 3 tasks required
        </p>
      </Card>
    );
  }

  return (
    <Card className="fade-in relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center flex-shrink-0">
          <Monitor size={22} className="text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-[#8B8B9E] uppercase tracking-wider mb-1">
            IT Operations Champion 💻
          </p>
          <h3 className="text-xl font-bold text-[#F0F0F5] truncate">{champion.name}</h3>

          {champion.teamLeader && (
            <p className="text-xs text-[#8B8B9E] mt-0.5 flex items-center gap-1">
              <Users size={11} />
              <span>Under {champion.teamLeader}</span>
            </p>
          )}

          <div className="flex items-center flex-wrap gap-4 mt-3">
            <div className="flex items-center gap-1.5 text-amber-400">
              <Star size={14} fill="currentColor" />
              <span className="text-sm font-semibold">
                {champion.avgRating.toFixed(2)} / 5
              </span>
              <span className="text-[#8B8B9E] text-xs font-normal">avg</span>
            </div>

            {champion.revenue > 0 && (
              <div className="flex items-center gap-1.5 text-emerald-400">
                <DollarSign size={14} />
                <span className="text-sm font-semibold">
                  ${champion.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
                <span className="text-[#8B8B9E] text-xs font-normal">contrib.</span>
              </div>
            )}

            <div className="flex items-center gap-1.5 text-[#8B8B9E]">
              <ClipboardList size={14} />
              <span className="text-sm">{champion.totalTasks} tasks</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
