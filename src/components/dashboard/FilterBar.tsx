import { useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useFilters } from '../../hooks/useFilters';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import {
  getUniqueDesigners,
  getUniqueLeaders,
  getUniqueDeliverables,
  getUniqueCategories,
  getAvailableMonths,
} from '../../lib/filters';
import { DELIVERABLES } from '../../constants/deliverables';
import { X } from 'lucide-react';

const STATIC_CATEGORIES = [
  'Web Design',
  'Graphic Design',
  'Design cum Development',
  'IT Operations',
];

export function FilterBar() {
  const { allTasks } = useAppContext();
  const { filters, setFilters, resetFilters } = useFilters();

  // Always build options from the COMPLETE dataset so they never disappear
  const months = useMemo(() => getAvailableMonths(allTasks), [allTasks]);
  const leaders = useMemo(() => getUniqueLeaders(allTasks), [allTasks]);
  const designers = useMemo(() => getUniqueDesigners(allTasks), [allTasks]);
  const deliverables = useMemo(() => getUniqueDeliverables(allTasks), [allTasks]);
  const categories = useMemo(() => getUniqueCategories(allTasks), [allTasks]);

  const hasActiveFilters =
    filters.month ||
    filters.leader ||
    filters.designer ||
    filters.deliverable ||
    filters.category;

  function formatMonth(m: string) {
    if (!m) return m;
    const [y, mo] = m.split('-');
    const date = new Date(+y, +mo - 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      <Select
        value={filters.month}
        onChange={(v) => setFilters({ month: v })}
        placeholder="All Months"
        options={months.map((m) => ({ value: m, label: formatMonth(m) }))}
        className="min-w-[140px]"
      />
      <Select
        value={filters.leader}
        onChange={(v) => setFilters({ leader: v })}
        placeholder="All Leaders"
        options={leaders.map((l) => ({ value: l, label: l }))}
        className="min-w-[150px]"
      />
      <Select
        value={filters.designer}
        onChange={(v) => setFilters({ designer: v })}
        placeholder="All Designers"
        options={designers.map((d) => ({ value: d, label: d }))}
        className="min-w-[150px]"
      />
      <Select
        value={filters.deliverable}
        onChange={(v) => setFilters({ deliverable: v })}
        placeholder="All Deliverables"
        options={(deliverables.length > 0 ? deliverables : DELIVERABLES).map((d) => ({ value: d, label: d }))}
        className="min-w-[150px]"
      />
      <Select
        value={filters.category}
        onChange={(v) => setFilters({ category: v })}
        placeholder="All Categories"
        options={(categories.length > 0 ? categories : STATIC_CATEGORIES).map((c) => ({ value: c, label: c }))}
        className="min-w-[170px]"
      />
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={resetFilters} leftIcon={<X size={14} />}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
