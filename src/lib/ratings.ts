import type { DesignerStats } from '../types';

export type RatingStatus = 'Excellent' | 'Good' | 'Average' | 'Needs Improvement' | 'No Rating';

export function computeAverage(
  r1: number | null,
  r2: number | null,
  r3: number | null
): number | null {
  const values = [r1, r2, r3].filter(
    (v): v is number => v !== null && v !== undefined && !isNaN(Number(v))
  );
  if (values.length === 0) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round((sum / values.length) * 100) / 100;
}

/**
 * True if a task's status marks it Client Lost.
 *
 * Case-insensitive and whitespace-trimmed: the Rating Sheet's Client Status
 * column has been observed with inconsistent casing — e.g. "client lost "
 * (lowercase, trailing space) rather than the canonical "Client Lost" — which
 * a plain `=== 'Client Lost'` comparison silently fails on, hiding the flag
 * everywhere it's checked (Leaderboard badge, DOTM/IT Ops eligibility).
 */
export function isClientLost(status: string | null | undefined): boolean {
  return String(status ?? '').trim().toLowerCase() === 'client lost';
}

export function statusFromRating(avg: number | null): DesignerStats['status'] {
  if (avg === null) return 'No Rating';
  if (avg >= 4.5) return 'Excellent';
  if (avg >= 3.5) return 'Good';
  if (avg >= 2.5) return 'Average';
  return 'Needs Improvement';
}

export function statusColor(status: DesignerStats['status']): string {
  switch (status) {
    case 'Excellent': return 'text-emerald-400';
    case 'Good': return 'text-indigo-400';
    case 'Average': return 'text-amber-400';
    case 'Needs Improvement': return 'text-red-400';
    default: return 'text-[#8B8B9E]';
  }
}

export function statusBgColor(status: DesignerStats['status']): string {
  switch (status) {
    case 'Excellent': return 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20';
    case 'Good': return 'bg-indigo-400/10 text-indigo-400 border-indigo-400/20';
    case 'Average': return 'bg-amber-400/10 text-amber-400 border-amber-400/20';
    case 'Needs Improvement': return 'bg-red-400/10 text-red-400 border-red-400/20';
    default: return 'bg-[#8B8B9E]/10 text-[#8B8B9E] border-[#8B8B9E]/20';
  }
}

export function ratingBarColor(avg: number | null): string {
  if (avg === null) return '#8B8B9E';
  if (avg >= 4.5) return '#10B981';
  if (avg >= 3.5) return '#6366F1';
  if (avg >= 2.5) return '#F59E0B';
  return '#EF4444';
}

/** Minimum tasks a designer must have to be eligible for awards */
export const MIN_TASKS_THRESHOLD = 3;
