import type { Task, DesignerStats, RevenueItem } from '../types';
import { statusFromRating, isClientLost } from './ratings';
import { computeDesignerRevenue } from './revenueAttribution';

// ── Scoring weights (tune these without touching the algorithm) ───────────────
const RATING_WEIGHT     = 0.5;
const REVENUE_WEIGHT    = 0.3;
const TASK_COUNT_WEIGHT = 0.2;

/** Minimum tasks to be eligible for Designer of the Month */
const MIN_TASKS_FOR_DOTM = 5;

/** Minimum average rating to be eligible for Designer of the Month */
const MIN_RATING_FOR_DOTM = 3.0;

/**
 * The single weighted-score formula shared by Designer of the Month and the
 * Leaderboard's Score/Rank columns — kept in one place so the two views can't
 * drift apart again:
 *
 *   Score = avgRating × RATING_WEIGHT
 *         + normalizedRevenue × REVENUE_WEIGHT
 *         + normalizedTasks × TASK_COUNT_WEIGHT
 *
 * normalizedRevenue/normalizedTasks scale each designer's raw revenue/task
 * count against the max among whatever population the caller is scoring
 * (DOTM: eligible designers only; Leaderboard: every rated designer shown) —
 * the max is passed in rather than computed here so each caller controls its
 * own comparison population.
 */
export function computeWeightedDesignerScore(
  avgRating: number,
  revenueContribution: number,
  maxRevenue: number,
  taskCount: number,
  maxTasks: number,
): number {
  const normalizedRevenue = maxRevenue > 0 ? (revenueContribution / maxRevenue) * 5 : 0;
  const normalizedTasks   = maxTasks   > 0 ? (taskCount / maxTasks) * 5 : 0;

  return Math.round(
    (
      avgRating * RATING_WEIGHT +
      normalizedRevenue * REVENUE_WEIGHT +
      normalizedTasks * TASK_COUNT_WEIGHT
    ) * 100,
  ) / 100;
}

/**
 * @param tasks           The filtered task list — drives eligibility and ratings.
 * @param revenueItems    Revenue rows, already scoped to the month being awarded.
 * @param attributionTasks The COMPLETE unfiltered task list. Revenue attribution
 *   divides each project's revenue by its total hours, so this denominator must
 *   include every designer on the project — passing the filtered list instead
 *   would inflate the shares of whoever survived the filter.
 */
export function getDesignerOfMonth(
  tasks: Task[],
  revenueItems: RevenueItem[] = [],
  attributionTasks: Task[] = tasks,
): DesignerStats | null {
  if (!tasks || tasks.length === 0) return null;

  // ── Filter to Web Design tasks only before eligibility checks ───────────
  const eligibleTasks = tasks.filter(
    (t) => t.category === 'Web Design'
  );
  if (eligibleTasks.length === 0) return null;

  // ── Pre-compute revenue contributions from the FULL task list ───────────
  const revenueMap = new Map<string, number>();
  computeDesignerRevenue(attributionTasks, revenueItems).forEach((r) => {
    revenueMap.set(r.designerName, r.revenueContribution);
  });

  // ── 1. Group tasks by designerName ──────────────────────────────────────
  const designerMap = new Map<string, {
    tasks: Task[];
    leaderCounts: Map<string, number>;
  }>();

  eligibleTasks.forEach((task) => {
    if (!task.designerName) return;
    const existing = designerMap.get(task.designerName) ?? {
      tasks: [],
      leaderCounts: new Map<string, number>(),
    };
    existing.tasks.push(task);
    if (task.teamLeader) {
      existing.leaderCounts.set(
        task.teamLeader,
        (existing.leaderCounts.get(task.teamLeader) ?? 0) + 1,
      );
    }
    designerMap.set(task.designerName, existing);
  });

  // ── 2. Build eligible list (MIN_TASKS_FOR_DOTM+, rated, MIN_RATING+) ────
  const eligible: DesignerStats[] = [];

  designerMap.forEach((data, name) => {
    // Check if designer has any Client Lost task — immediately disqualifies
    const hasClientLost = data.tasks.some((t) => isClientLost(t.status));
    if (hasClientLost) return; // skip this designer

    // Must have minimum number of tasks
    if (data.tasks.length < MIN_TASKS_FOR_DOTM) return;

    const ratedTasks = data.tasks.filter(
      (t) => t.averageRating !== null && t.averageRating !== undefined,
    );
    if (ratedTasks.length === 0) return;

    const avgRating =
      ratedTasks.reduce((sum, t) => sum + (t.averageRating ?? 0), 0) / ratedTasks.length;
    const roundedAvg = Math.round(avgRating * 100) / 100;

    // Must meet minimum rating threshold
    if (roundedAvg < MIN_RATING_FOR_DOTM) return;

    eligible.push({
      name,
      teamLeader: '',       // filled in after scoring pass
      totalTasks: data.tasks.length,
      averageRating: roundedAvg,
      weightedScore: null,  // computed in next step
      eligible: true,
      status: statusFromRating(roundedAvg),
    });
  });

  if (eligible.length === 0) return null;

  // ── 3. Compute 3-factor weighted score ───────────────────────────────────
  const maxRevenue = Math.max(...eligible.map((d) => revenueMap.get(d.name) ?? 0));
  const maxTasks   = Math.max(...eligible.map((d) => d.totalTasks));

  eligible.forEach((d) => {
    const rev = revenueMap.get(d.name) ?? 0;
    d.weightedScore = computeWeightedDesignerScore(
      d.averageRating ?? 0, rev, maxRevenue, d.totalTasks, maxTasks,
    );
  });

  // ── 4. Attach primary team leader ────────────────────────────────────────
  eligible.forEach((d) => {
    const data = designerMap.get(d.name)!;
    let primaryLeader = '';
    let maxCount = 0;
    data.leaderCounts.forEach((count, leader) => {
      if (count > maxCount) { maxCount = count; primaryLeader = leader; }
    });
    d.teamLeader = primaryLeader;
  });

  // ── 5. Winner = highest weightedScore; tiebreaker = fewer tasks ──────────
  eligible.sort((a, b) => {
    const diff = (b.weightedScore ?? 0) - (a.weightedScore ?? 0);
    if (diff !== 0) return diff;
    return a.totalTasks - b.totalTasks;
  });

  return eligible[0];
}
