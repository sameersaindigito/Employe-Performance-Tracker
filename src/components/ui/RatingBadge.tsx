import type { DesignerStats } from '../../types';
import { statusBgColor } from '../../lib/ratings';
import { Badge } from './Badge';

interface RatingBadgeProps {
  status: DesignerStats['status'];
  rating?: number | null;
  showRating?: boolean;
}

const statusToVariant: Record<DesignerStats['status'], 'success' | 'indigo' | 'amber' | 'danger' | 'muted'> = {
  Excellent: 'success',
  Good: 'indigo',
  Average: 'amber',
  'Needs Improvement': 'danger',
  'No Rating': 'muted',
};

export function RatingBadge({ status, rating, showRating = true }: RatingBadgeProps) {
  return (
    <div className="flex items-center gap-2">
      {showRating && rating !== null && rating !== undefined && (
        <span className="text-sm font-semibold text-[#F0F0F5]">{rating.toFixed(1)}</span>
      )}
      <Badge variant={statusToVariant[status]}>{status}</Badge>
    </div>
  );
}
