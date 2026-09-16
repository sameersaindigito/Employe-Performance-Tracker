import { useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import type { DesignerStats } from '../types';
import { statusFromRating } from '../lib/ratings';
import { computeProductivityMap } from '../lib/productivity';
import { computeWeightedDesignerScore } from '../lib/designerOfMonth';

/** "YYYY-MM" filter value -> a Date anchored to that month. */
function monthToDate(month: string): Date {
  if (!month) return new Date();
  const [y, m] = month.split('-').map(Number);
  return new Date(y, (m || 1) - 1, 1);
}

export function useLeaderboard(): DesignerStats[] {
  const { tasks, filters } = useAppContext();

  // The Leaderboard's Productivity/Score is always monthly — same as
  // Designer of the Month / IT Ops Champion — anchored to whichever month
  // the top-level Month filter has selected (or "now" for "All Months"). A
  // separate global Daily/Weekly/Yearly selector used to sit alongside the
  // Month filter here, but the two independently controlled the same time
  // dimension and produced inconsistent results; that control has been
  // removed in favor of a "View by" selector shared across the whole
  // designer-detail section (src/components/shared/DesignerDetailSection.tsx),
  // which is fully local and can't collide with this or any other page-level filter.
  const reference = useMemo(() => monthToDate(filters.month), [filters.month]);

  const productivityMap = useMemo(
    () => computeProductivityMap(tasks, 'monthly', reference),
    [tasks, reference],
  );

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

      stats.push({
        name,
        teamLeader: primaryLeader,
        totalTasks: data.totalTasks,
        averageRating: avgRating,
        weightedScore: null, // computed below, once maxProductivity is known
        // Productivity doesn't depend on having a rating at all (it's purely
        // hours ÷ capacity, with a natural zero — unlike a rating, which has
        // no sensible "0" default) — populate it for EVERY designer here,
        // not just the rated ones scoring below, defaulting to 0 for anyone
        // with no hours logged in the period. Otherwise a designer with real
        // logged hours but no rating yet would show "—" for Productivity
        // too, even though it's a perfectly real, checkable number
        // independent of Score — and this also matches what Score itself
        // assumes for a missing lookup (0), so the two numbers never disagree.
        productivityPct: productivityMap.get(name) ?? 0,
        status: statusFromRating(avgRating),
      });
    });

    // ── 3. Score every rated designer with the SAME formula as Designer of
    // the Month (rating + productivity, weighted 0.6/0.4), normalized
    // against the max among designers actually shown here — i.e. everyone
    // with a rating, NOT gated by DOTM's stricter award threshold.
    // A designer with no rating at all has nothing to score — stays null
    // (their Productivity % above still renders, only Score/Rank don't).
    const scored = stats.filter((d) => d.averageRating !== null);
    const maxProductivity = Math.max(0, ...scored.map((d) => productivityMap.get(d.name) ?? 0));

    scored.forEach((d) => {
      const prod = productivityMap.get(d.name) ?? 0;
      d.weightedScore = computeWeightedDesignerScore(d.averageRating ?? 0, prod, maxProductivity);
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
  }, [tasks, productivityMap]);
}
