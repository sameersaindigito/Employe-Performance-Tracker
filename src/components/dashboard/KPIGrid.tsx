import { useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { KPICard } from './KPICard';
import { Card } from '../ui/Card';
import { isClientLost } from '../../lib/ratings';
import { Users, ClipboardList, Star, Trophy, TrendingDown } from 'lucide-react';

export function KPIGrid() {
  const { tasks, allTasks, loading } = useAppContext();

  const stats = useMemo(() => {
    if (!tasks.length) return null;

    const totalTasks = tasks.length;

    // Count unique DESIGNERS (designerName), not leaders
    const uniqueDesigners = new Set(
      tasks.map((t) => t.designerName).filter(Boolean)
    ).size;

    // Average rating across all tasks that have a rating
    const ratedTasks = tasks.filter(
      (t) => t.averageRating !== null && t.averageRating !== undefined
    );
    const avgRating =
      ratedTasks.length > 0
        ? ratedTasks.reduce((s, t) => s + Number(t.averageRating), 0) / ratedTasks.length
        : null;

    // ── Best Performer & Needs Attention ────────────────────────────────────
    // Computed DIRECTLY from tasks grouped by task.designerName.
    // Never uses useLeaderboard to avoid any risk of teamLeader leaking in.
    const designerRatingMap = new Map<string, { sum: number; count: number }>();

    tasks.forEach((t) => {
      if (!t.designerName) return;
      if (t.averageRating === null || t.averageRating === undefined) return;
      const existing = designerRatingMap.get(t.designerName) ?? { sum: 0, count: 0 };
      existing.sum += Number(t.averageRating);
      existing.count += 1;
      designerRatingMap.set(t.designerName, existing);
    });

    // Build array: { designerName, avgRating }
    const designerAvgs: { designerName: string; avgRating: number }[] = [];
    designerRatingMap.forEach(({ sum, count }, designerName) => {
      designerAvgs.push({ designerName, avgRating: sum / count });
    });

    // Sort by avgRating descending
    designerAvgs.sort((a, b) => b.avgRating - a.avgRating);

    const best = designerAvgs[0] ?? null;
    const worst = designerAvgs[designerAvgs.length - 1] ?? null;

    return { totalTasks, uniqueDesigners, avgRating, best, worst };
  }, [tasks]);

  // Client Lost is a standing per-designer flag, not tied to whichever month
  // happens to be selected, so it's read from allTasks (unfiltered) — same
  // fix as the Leaderboard badge. Scoping this to the filtered `tasks` meant
  // the badge could silently vanish whenever the active month didn't happen
  // to include that designer's Client Lost task.
  const clientLostDesigners = useMemo(
    () =>
      new Set(
        allTasks
          .filter((t) => isClientLost(t.status))
          .map((t) => t.designerName)
          .filter(Boolean)
      ),
    [allTasks]
  );

  /** Renders a designer name with optional Client Lost badge */
  function designerValue(name: string | undefined) {
    if (!name) return 'N/A';
    return (
      <span className="flex items-center gap-2 flex-wrap">
        {name}
        {clientLostDesigners.has(name) && (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
            Client Lost
          </span>
        )}
      </span>
    );
  }

  // "Still loading" and "loaded but zero matches" are different states.
  // Conflating them (as isLoading = loading || !stats did) left the grid stuck
  // showing loading skeletons forever whenever a filter combination matched no
  // tasks — never resolving to a real empty state.
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 w-full">
        {[...Array(5)].map((_, i) => (
          <KPICard key={i} title="" value="" icon={<ClipboardList size={18} />} loading />
        ))}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="mb-6">
        <Card>
          <p className="text-[#8B8B9E] text-sm py-6 text-center">
            No data for the selected filters.
          </p>
        </Card>
      </div>
    );
  }

  return (
    // FIX 1: 1 col mobile → 2 col small → 3 col large. No overflow, no cut cards.
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 w-full">
      <KPICard
        title="Total Tasks"
        value={stats.totalTasks.toLocaleString()}
        icon={<ClipboardList size={18} />}
        iconColor="text-indigo-400"
      />
      <KPICard
        title="Total Designers"
        value={stats.uniqueDesigners}
        icon={<Users size={18} />}
        iconColor="text-emerald-400"
      />
      <KPICard
        title="Avg Rating"
        value={stats.avgRating !== null ? `${stats.avgRating.toFixed(2)} / 5` : 'N/A'}
        icon={<Star size={18} />}
        iconColor="text-amber-400"
      />
      <KPICard
        title="Quality Champion"
        value={designerValue(stats.best?.designerName)}
        subtitle={
          stats.best != null
            ? `Avg Rating: ${stats.best.avgRating.toFixed(2)}`
            : undefined
        }
        icon={<Trophy size={18} />}
        iconColor="text-yellow-400"
      />
      <KPICard
        title="Needs Attention"
        value={designerValue(stats.worst?.designerName)}
        subtitle={
          stats.worst != null
            ? `Avg Rating: ${stats.worst.avgRating.toFixed(2)}`
            : undefined
        }
        icon={<TrendingDown size={18} />}
        iconColor="text-red-400"
      />
    </div>
  );
}
