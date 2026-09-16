import { useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { computeProductivityMap } from '../../lib/productivity';
import { computeWeightedDesignerScore, PRODUCTIVITY_ELIGIBILITY_FLOOR } from '../../lib/designerOfMonth';
import { isClientLost } from '../../lib/ratings';
import { Card } from '../ui/Card';
import { Monitor, Star, ClipboardList, Users, Gauge } from 'lucide-react';

/** "YYYY-MM" filter value -> a Date anchored to that month, for productivity's period math. */
function monthToDate(month: string): Date {
  if (!month) return new Date();
  const [y, m] = month.split('-').map(Number);
  return new Date(y, (m || 1) - 1, 1);
}

export function ITOperationsChampion() {
  const { tasks, filters, loading } = useAppContext();

  // Stays a MONTHLY award (Part 4), anchored to whichever month the
  // Dashboard's Month filter has selected — same convention as DOTM.
  const reference = useMemo(() => monthToDate(filters.month), [filters.month]);

  const champion = useMemo(() => {
    // 1. Filter to IT Operations tasks only
    const itTasks = tasks.filter((t) => t.category === 'IT Operations');
    if (itTasks.length === 0) return null;

    // 2. Productivity from the FULL filtered task list — a holistic measure
    // of each designer's own capacity utilization, not category-restricted.
    const productivityMap = computeProductivityMap(tasks, 'monthly', reference);

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

    // 4. Build candidates list: category membership (guaranteed by grouping
    // from itTasks), not Client Lost, and Productivity strictly above the
    // eligibility floor. No task-count or rating minimum.
    type Candidate = {
      name: string;
      avgRating: number | null;
      totalTasks: number;
      teamLeader: string;
      productivity: number;
    };
    const candidates: Candidate[] = [];

    designerMap.forEach((data, name) => {
      // Client Lost designers are ineligible for the award, per spec.
      if (data.hasClientLost) return;

      const productivity = productivityMap.get(name) ?? 0;
      if (productivity <= PRODUCTIVITY_ELIGIBILITY_FLOOR) return;

      // A designer may have zero rated tasks — no rating floor anymore, so
      // this doesn't disqualify them; they score with a 0 Rating component.
      const avgRating = data.ratedCount > 0 ? data.ratingSum / data.ratedCount : null;

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
        productivity,
      });
    });

    if (candidates.length === 0) return null;

    // 5. Compute the shared 2-factor weighted score (same formula as DOTM/Leaderboard)
    const maxProductivity = Math.max(...candidates.map((c) => c.productivity));

    let winner: (Candidate & { weightedScore: number }) | null = null;

    candidates.forEach((c) => {
      const weightedScore = computeWeightedDesignerScore(c.avgRating ?? 0, c.productivity, maxProductivity);

      if (!winner || weightedScore > winner.weightedScore) {
        winner = { ...c, weightedScore };
      }
    });

    return winner as (Candidate & { weightedScore: number }) | null;
  }, [tasks, reference]);

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
          No eligible IT Operations Champion
        </p>
        <p className="text-[#8B8B9E] text-xs">
          IT Operations category · Client Lost designers ineligible · Productivity must be above {PRODUCTIVITY_ELIGIBILITY_FLOOR}% · highest Rating + Productivity wins
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
                {champion.avgRating !== null ? `${champion.avgRating.toFixed(2)} / 5` : 'N/A'}
              </span>
              <span className="text-[#8B8B9E] text-xs font-normal">avg</span>
            </div>

            <div className="flex items-center gap-1.5 text-emerald-400">
              <Gauge size={14} />
              <span className="text-sm font-semibold">
                {champion.productivity.toFixed(0)}%
              </span>
              <span className="text-[#8B8B9E] text-xs font-normal">productivity</span>
            </div>

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
