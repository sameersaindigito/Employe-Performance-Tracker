import { useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { getThisWeekLeader } from '../../lib/designerOfMonth';
import { Card } from '../ui/Card';
import { Zap, Star, Gauge, ClipboardList } from 'lucide-react';

/**
 * Part 4: a LIVE, in-progress snapshot of who is currently ahead on this
 * week's data so far — explicitly NOT an award. Designer of the Month / IT
 * Operations Champion remain the official monthly recognition, computed and
 * displayed entirely separately from this widget; this reads from allTasks
 * (unfiltered by the Dashboard's own Month filter) so "this week" is always
 * the real current week, whatever month happens to be selected elsewhere.
 */
export function ThisWeekLeader() {
  const { allTasks, loading } = useAppContext();

  const leader = useMemo(() => getThisWeekLeader(allTasks), [allTasks]);

  if (loading) {
    return (
      <Card className="fade-in bg-amber-500/5">
        <div className="skeleton h-4 w-40 rounded mb-3" />
        <div className="skeleton h-6 w-32 rounded" />
      </Card>
    );
  }

  return (
    <Card className="fade-in bg-amber-500/5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Zap size={13} className="text-amber-400" />
          <p className="text-xs font-medium text-amber-400 uppercase tracking-wider">
            This Week — Live Standing
          </p>
        </div>
        <span className="text-[10px] text-[#8B8B9E] uppercase tracking-wide border border-[#2E2E3E] rounded-full px-2 py-0.5">
          In progress · not an award
        </span>
      </div>

      {!leader ? (
        <p className="text-[#8B8B9E] text-xs py-1">
          No rated tasks logged yet this week.
        </p>
      ) : (
        <div className="flex items-center flex-wrap gap-x-4 gap-y-1">
          <span className="text-[#F0F0F5] font-semibold text-sm">{leader.name}</span>
          <div className="flex items-center gap-1 text-amber-400 text-xs">
            <Star size={11} fill="currentColor" />
            <span>{leader.averageRating?.toFixed(2)} avg</span>
          </div>
          {leader.productivityPct !== null && (
            <div className="flex items-center gap-1 text-emerald-400 text-xs">
              <Gauge size={11} />
              <span>{leader.productivityPct.toFixed(0)}% productivity</span>
            </div>
          )}
          <div className="flex items-center gap-1 text-[#8B8B9E] text-xs">
            <ClipboardList size={11} />
            <span>{leader.totalTasks} tasks so far</span>
          </div>
        </div>
      )}
    </Card>
  );
}
