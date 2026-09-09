import { useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import type { DesignerStats } from '../types';
import { statusFromRating } from '../lib/ratings';
import { computeDesignerRevenue, scopeRevenueItems } from '../lib/revenueAttribution';
import { computeWeightedDesignerScore } from '../lib/designerOfMonth';

/** Must match designerOfMonth.ts thresholds */
const ELIGIBLE_MIN_TASKS = 5;
const ELIGIBLE_MIN_RATING = 3.0;

export function useLeaderboard(): DesignerStats[] {
  const { tasks, allTasks, filters, revenueItems } = useAppContext();

  // Same billing-aware attribution DOTM/IT Ops Champion use: hours-denominator
  // comes from the COMPLETE task list (so a project's hours-share math never
  // gets skewed by whatever's currently filtered), while the revenue rows
  // themselves are scoped to the active month/category — matching what those
  // award cards do, for one consistent notion of "revenue right now."
  const scopedRevenue = useMemo(
    () => scopeRevenueItems(revenueItems, { month: filters.month, category: filters.category }),
    [revenueItems, filters.month, filters.category],
  );
  const revenueMap = useMemo(() => {
    const map = new Map<string, number>();
    computeDesignerRevenue(allTasks, scopedRevenue).forEach((r) => {
      map.set(r.designerName, r.revenueContribution);
    });
    return map;
  }, [allTasks, scopedRevenue]);

  return useMemo(() => {
    // ── 1. Aggregate per designer ─────────────────────────────────────────
    const designerMap = new Map<string, {
      totalTasks: number;
      ratingSum: number;
      ratingCount: number;
      teamLeaderCounts: Map<string, number>;
    }>();

    tasks.forEach((task) => {
      const designer = task.designerName;
      if (!designer) return;

      const existing = designerMap.get(designer) ?? {
        totalTasks: 0,
        ratingSum: 0,
        ratingCount: 0,
        teamLeaderCounts: new Map<string, number>(),
      };

      existing.totalTasks += 1;

      if (task.averageRating !== null && task.averageRating !== undefined) {
        existing.ratingSum += Number(task.averageRating);
        existing.ratingCount += 1;
      }

      // Track primary team leader (most frequent)
      if (task.teamLeader) {
        const prev = existing.teamLeaderCounts.get(task.teamLeader) ?? 0;
        existing.teamLeaderCounts.set(task.teamLeader, prev + 1);
      }

      designerMap.set(designer, existing);
    });

    // ── 2. Build DesignerStats array (score filled in after the max is known) ─
    const stats: DesignerStats[] = [];

    designerMap.forEach((data, name) => {
      const avgRating =
        data.ratingCount > 0
          ? Math.round((data.ratingSum / data.ratingCount) * 100) / 100
          : null;

      // Most frequent team leader for this designer
      let primaryLeader = '';
      let maxCount = 0;
      data.teamLeaderCounts.forEach((count, leader) => {
        if (count > maxCount) { maxCount = count; primaryLeader = leader; }
      });

      // Eligible = 5+ tasks AND avgRating >= 3.0 — the Designer-of-the-Month
      // award threshold. Kept as a distinct flag (still meaningful: "would
      // this designer qualify for DOTM"), but no longer gates whether the
      // Leaderboard shows a Score/Rank — a general roster table shouldn't go
      // blank for every designer just because nobody happens to clear DOTM's
      // stricter monthly-award bar yet.
      const eligible =
        data.totalTasks >= ELIGIBLE_MIN_TASKS &&
        avgRating !== null &&
        avgRating >= ELIGIBLE_MIN_RATING;

      stats.push({
        name,
        teamLeader: primaryLeader,
        totalTasks: data.totalTasks,
        averageRating: avgRating,
        weightedScore: null, // computed below, once maxRevenue/maxTasks are known
        eligible,
        status: statusFromRating(avgRating),
      });
    });

    // ── 3. Score every rated designer with the SAME formula as Designer of
    // the Month (rating + revenue + task-count, weighted 0.5/0.3/0.2),
    // normalized against the max among designers actually shown here — i.e.
    // everyone with a rating, NOT gated by DOTM's stricter award threshold.
    // A designer with no rating at all has nothing to score — stays null.
    const scored = stats.filter((d) => d.averageRating !== null);
    const maxRevenue = Math.max(0, ...scored.map((d) => revenueMap.get(d.name) ?? 0));
    const maxTasks = Math.max(0, ...scored.map((d) => d.totalTasks));

    scored.forEach((d) => {
      const rev = revenueMap.get(d.name) ?? 0;
      d.weightedScore = computeWeightedDesignerScore(
        d.averageRating ?? 0, rev, maxRevenue, d.totalTasks, maxTasks,
      );
    });

    // ── 4. Sort: every scored designer by weightedScore desc, unscored last ─
    return stats.sort((a, b) => {
      if (a.weightedScore !== null && b.weightedScore !== null) {
        const diff = b.weightedScore - a.weightedScore;
        if (diff !== 0) return diff;
        return b.totalTasks - a.totalTasks;
      }
      // Any real score outranks no score at all
      if (a.weightedScore !== null && b.weightedScore === null) return -1;
      if (a.weightedScore === null && b.weightedScore !== null) return 1;
      // Both unscored (no rating yet): more tasks first, as a stable fallback
      return b.totalTasks - a.totalTasks;
    });
  }, [tasks, revenueMap]);
}
