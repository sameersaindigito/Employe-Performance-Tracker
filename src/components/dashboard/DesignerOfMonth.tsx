import { useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { getDesignerOfMonth, PRODUCTIVITY_ELIGIBILITY_FLOOR } from '../../lib/designerOfMonth';
import { Card } from '../ui/Card';
import { Award, Star, ClipboardList, Users, Gauge } from 'lucide-react';

/** "YYYY-MM" filter value -> a Date anchored to that month, for productivity's period math. */
function monthToDate(month: string): Date {
  if (!month) return new Date();
  const [y, m] = month.split('-').map(Number);
  return new Date(y, (m || 1) - 1, 1);
}

export function DesignerOfMonth() {
  const { tasks, filters, loading } = useAppContext();

  // Part 4: Designer of the Month stays a MONTHLY award regardless of the
  // Leaderboard's period selector — always 'monthly', anchored to whichever
  // month the Dashboard's Month filter has selected (falling back to the
  // current month if "All Months" is active).
  const reference = useMemo(() => monthToDate(filters.month), [filters.month]);

  const winner = useMemo(
    () => getDesignerOfMonth(tasks, 'monthly', reference),
    [tasks, reference],
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
          Web Design category · Client Lost designers ineligible · Productivity must be above {PRODUCTIVITY_ELIGIBILITY_FLOOR}% · highest Rating + Productivity wins
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
                {winner.averageRating !== null ? `${winner.averageRating.toFixed(2)} / 5` : 'N/A'}
              </span>
              <span className="text-[#8B8B9E] text-xs font-normal">avg</span>
            </div>

            {winner.productivityPct !== null && (
              <div className="flex items-center gap-1.5 text-emerald-400">
                <Gauge size={14} />
                <span className="text-sm font-semibold">
                  {winner.productivityPct.toFixed(0)}%
                </span>
                <span className="text-[#8B8B9E] text-xs font-normal">productivity</span>
              </div>
            )}

            {winner.weightedScore !== null && (
              <div className="flex items-center gap-1.5 text-indigo-400">
                <Award size={14} />
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
