import type { Task, DesignerStats } from '../types';
import { statusFromRating, isClientLost } from './ratings';
import { computeProductivityMap, filterTasksByPeriod, type Period } from './productivity';

// ── Scoring weights (tune these without touching the algorithm) ───────────────
//
// Score = avgRating × RATING_WEIGHT + normalizedProductivity × PRODUCTIVITY_WEIGHT
//
// Revenue and task count don't factor into the score at all. Weights match
// IT Operations Champion's pre-existing 0.6/0.4 split, shared by DOTM, IT
// Ops Champion, and the Leaderboard so all three score the same way instead
// of drifting apart again.
const RATING_WEIGHT = 0.6;
const PRODUCTIVITY_WEIGHT = 0.4;

// ── Eligibility (final decision — no task-count or rating minimums) ───────────
//
// Designer of the Month / IT Operations Champion eligibility is exactly
// three checks: category membership (≥1 task in the award's category),
// not Client Lost, and Productivity strictly above this floor (Monthly
// window — the same standard period these awards already use). Whoever
// clears all three with the highest Rating+Productivity score wins; anyone
// who doesn't clear the floor (or is Client Lost) is simply never in the
// candidate pool, so the highest-scoring ELIGIBLE person always wins by
// construction — no separate "skip and retry" step is needed.
export const PRODUCTIVITY_ELIGIBILITY_FLOOR = 50;

/**
 * The single weighted-score formula shared by Designer of the Month, IT
 * Operations Champion, and the Leaderboard's Score/Rank columns — kept in
 * one place so the three views can't drift apart again.
 *
 * normalizedProductivity scales a designer's Productivity % against the max
 * among whatever population the caller is scoring (DOTM: eligible designers
 * only; Leaderboard: every rated designer shown) — same 0-5 normalization
 * pattern the previous revenue/task-count factors used, and the max is
 * passed in rather than computed here so each caller controls its own
 * comparison population.
 */
export function computeWeightedDesignerScore(
  avgRating: number,
  productivityPct: number,
  maxProductivityPct: number,
): number {
  const normalizedProductivity = maxProductivityPct > 0 ? (productivityPct / maxProductivityPct) * 5 : 0;
  return Math.round(
    (avgRating * RATING_WEIGHT + normalizedProductivity * PRODUCTIVITY_WEIGHT) * 100,
  ) / 100;
}

/**
 * @param tasks     The filtered task list — drives eligibility, ratings, AND
 *   the productivity window (each designer's punched hours within `period`).
 * @param period    Always 'monthly' in practice (Part 4: DOTM stays a
 *   monthly award regardless of the Leaderboard's period selector) — kept as
 *   a parameter rather than hardcoded so getThisWeekLeader below can reuse
 *   the exact same eligibility/scoring shape with a different period.
 * @param reference Anchors which specific month/week/etc. `period` resolves
 *   to — pass the currently-selected month (as a Date) so productivity is
 *   computed for the month actually being awarded, not always "this month."
 */
export function getDesignerOfMonth(
  tasks: Task[],
  period: Period = 'monthly',
  reference: Date = new Date(),
): DesignerStats | null {
  if (!tasks || tasks.length === 0) return null;

  // ── Filter to Web Design tasks only before eligibility checks ───────────
  const eligibleTasks = tasks.filter(
    (t) => t.category === 'Web Design'
  );
  if (eligibleTasks.length === 0) return null;

  // Productivity computed from the FULL filtered task list (not just Web
  // Design tasks) — it's a holistic measure of a designer's own capacity
  // utilization, not scoped to the award's category restriction.
  const productivityMap = computeProductivityMap(tasks, period, reference);

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

  // ── 2. Build eligible list: category membership (already guaranteed by
  // designerMap being built from eligibleTasks), not Client Lost, and
  // Productivity strictly above the floor. No task-count or rating minimum.
  const eligible: DesignerStats[] = [];

  designerMap.forEach((data, name) => {
    const hasClientLost = data.tasks.some((t) => isClientLost(t.status));
    if (hasClientLost) return;

    const productivityPct = productivityMap.get(name) ?? 0;
    if (productivityPct <= PRODUCTIVITY_ELIGIBILITY_FLOOR) return;

    const ratedTasks = data.tasks.filter(
      (t) => t.averageRating !== null && t.averageRating !== undefined,
    );
    // A designer may have zero rated tasks — no rating floor anymore, so
    // this doesn't disqualify them; they score with a 0 Rating component
    // (computeWeightedDesignerScore's `?? 0`) but stay in the running.
    const roundedAvg = ratedTasks.length > 0
      ? Math.round((ratedTasks.reduce((sum, t) => sum + (t.averageRating ?? 0), 0) / ratedTasks.length) * 100) / 100
      : null;

    eligible.push({
      name,
      teamLeader: '',       // filled in after scoring pass
      totalTasks: data.tasks.length,
      averageRating: roundedAvg,
      weightedScore: null,  // computed in next step
      productivityPct: null,
      status: statusFromRating(roundedAvg),
    });
  });

  if (eligible.length === 0) return null;

  // ── 3. Compute 2-factor weighted score ───────────────────────────────────
  const maxProductivity = Math.max(...eligible.map((d) => productivityMap.get(d.name) ?? 0));

  eligible.forEach((d) => {
    const prod = productivityMap.get(d.name) ?? 0;
    d.productivityPct = prod;
    d.weightedScore = computeWeightedDesignerScore(d.averageRating ?? 0, prod, maxProductivity);
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

/** Minimum tasks this week to appear in the "This Week" live standing. Kept
 *  far below DOTM's monthly bar (5) — a week's volume is naturally small,
 *  and this is a live snapshot, not a formal award. */
const MIN_TASKS_FOR_WEEKLY_LEADER = 1;

/**
 * Part 4: "This Week" — a live, in-progress snapshot of who is CURRENTLY
 * leading on this week's data so far, using the SAME weighted formula as
 * Designer of the Month but scoped to the current week. This is explicitly
 * NOT an award: Designer of the Month / IT Operations Champion remain
 * calculated and awarded monthly, completely unaffected by this function.
 *
 * @param tasks     Ideally the COMPLETE task list (unfiltered by month) —
 *   "this week" may fall outside whichever month the Dashboard's Month
 *   filter currently has selected.
 */
export function getThisWeekLeader(tasks: Task[], reference: Date = new Date()): DesignerStats | null {
  if (!tasks || tasks.length === 0) return null;

  const weekTasks = filterTasksByPeriod(tasks, 'weekly', reference);
  if (weekTasks.length === 0) return null;

  const productivityMap = computeProductivityMap(tasks, 'weekly', reference);

  const designerMap = new Map<string, Task[]>();
  weekTasks.forEach((task) => {
    if (!task.designerName) return;
    const existing = designerMap.get(task.designerName) ?? [];
    existing.push(task);
    designerMap.set(task.designerName, existing);
  });

  const candidates: DesignerStats[] = [];
  designerMap.forEach((designerTasks, name) => {
    if (designerTasks.some((t) => isClientLost(t.status))) return;
    if (designerTasks.length < MIN_TASKS_FOR_WEEKLY_LEADER) return;

    const ratedTasks = designerTasks.filter(
      (t) => t.averageRating !== null && t.averageRating !== undefined,
    );
    if (ratedTasks.length === 0) return; // nothing to rate this week yet

    const avgRating = Math.round(
      (ratedTasks.reduce((sum, t) => sum + (t.averageRating ?? 0), 0) / ratedTasks.length) * 100,
    ) / 100;

    candidates.push({
      name,
      teamLeader: designerTasks.find((t) => t.teamLeader)?.teamLeader ?? '',
      totalTasks: designerTasks.length,
      averageRating: avgRating,
      weightedScore: null,
      productivityPct: null,
      status: statusFromRating(avgRating),
    });
  });

  if (candidates.length === 0) return null;

  const maxProductivity = Math.max(...candidates.map((c) => productivityMap.get(c.name) ?? 0));
  candidates.forEach((c) => {
    const prod = productivityMap.get(c.name) ?? 0;
    c.productivityPct = prod;
    c.weightedScore = computeWeightedDesignerScore(c.averageRating ?? 0, prod, maxProductivity);
  });

  candidates.sort((a, b) => (b.weightedScore ?? 0) - (a.weightedScore ?? 0));
  return candidates[0];
}
