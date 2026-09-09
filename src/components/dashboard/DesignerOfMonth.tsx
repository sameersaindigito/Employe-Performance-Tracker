import { useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { getDesignerOfMonth } from '../../lib/designerOfMonth';
import { scopeRevenueItems } from '../../lib/revenueAttribution';
import { Card } from '../ui/Card';
import { Award, Star, ClipboardList, Users, TrendingUp } from 'lucide-react';

export function DesignerOfMonth() {
  const { tasks, allTasks, filters, loading, revenueItems } = useAppContext();

  // Revenue is scoped to the month/category being awarded; hours denominators
  // come from allTasks so each project's total stays whole.
  const scopedRevenue = useMemo(
    () => scopeRevenueItems(revenueItems, { month: filters.month, category: filters.category }),
    [revenueItems, filters.month, filters.category],
  );

  const winner = useMemo(
    () => getDesignerOfMonth(tasks, scopedRevenue, allTasks),
    [tasks, scopedRevenue, allTasks],
  );

  if (loading) {
    return (
      <Card className="fade-in">
        <div className="skeleton h-4 w-32 rounded mb-4" />
        <div className="skeleton h-10 w-48 rounded mb-2" />
        <div className="skeleton h-4 w-24 rounded" />
      </Card>
    );
  }

  if (!winner) {
    return (
      <Card className="fade-in">
        <p className="text-xs font-medium text-[#8B8B9E] uppercase tracking-wider mb-3">
          Designer of the Month
        </p>
        <p className="text-[#F0F0F5] text-sm font-medium mb-1">
          No eligible designer this month
        </p>
        <p className="text-[#8B8B9E] text-xs">
          Minimum 5 tasks with 3.0+ rating required · Designers with a Client Lost project are ineligible
        </p>
      </Card>
    );
  }

  return (
    <Card className="fade-in relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#6366F1]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
          <Award size={22} className="text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-[#8B8B9E] uppercase tracking-wider mb-1">
            Designer of the Month 🏆
          </p>
          <h3 className="text-xl font-bold text-[#F0F0F5] truncate">{winner.name}</h3>

          {winner.teamLeader && (
            <p className="text-xs text-[#8B8B9E] mt-0.5 flex items-center gap-1">
              <Users size={11} />
              <span>Under {winner.teamLeader}</span>
            </p>
          )}

          <div className="flex items-center flex-wrap gap-4 mt-3">
            <div className="flex items-center gap-1.5 text-amber-400">
              <Star size={14} fill="currentColor" />
              <span className="text-sm font-semibold">
                {winner.averageRating?.toFixed(2)} / 5
              </span>
              <span className="text-[#8B8B9E] text-xs font-normal">avg</span>
            </div>

            {winner.weightedScore !== null && (
              <div className="flex items-center gap-1.5 text-indigo-400">
                <TrendingUp size={14} />
                <span className="text-sm font-semibold">
                  {winner.weightedScore.toFixed(2)}
                </span>
                <span className="text-[#8B8B9E] text-xs font-normal">score</span>
              </div>
            )}

            <div className="flex items-center gap-1.5 text-[#8B8B9E]">
              <ClipboardList size={14} />
              <span className="text-sm">{winner.totalTasks} tasks</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
