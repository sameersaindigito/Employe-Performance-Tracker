import { useAppContext } from '../../context/AppContext';
import { DesignerDetailSection } from '../shared/DesignerDetailSection';

/**
 * When a specific Designer is selected on the Dashboard, show the shared
 * designer-detail section (Revenue Contribution, Productivity, Average
 * Rating — all following one local "View by" control) — see
 * src/components/shared/DesignerDetailSection.tsx.
 */
export function DesignerDetailCard() {
  const { allTasks, revenueItems, filters, loading } = useAppContext();

  if (!filters.designer) return null;

  return (
    <div className="mb-6">
      <DesignerDetailSection
        designerName={filters.designer}
        allTasks={allTasks}
        revenueItems={revenueItems}
        topLevelMonth={filters.month}
        loading={loading}
        showRating
      />
    </div>
  );
}
