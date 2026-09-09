import { useMemo, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { Card } from '../ui/Card';
import { Table, Thead, Tbody, Th, Td } from '../ui/Table';
import { Badge } from '../ui/Badge';
import { ExternalLink } from 'lucide-react';

function formatDate(dateStr: string) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function getMonthKey(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  } catch {
    return '';
  }
}

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function ratingDisplay(r: number | null) {
  if (r === null || r === undefined) return <span className="text-[#8B8B9E]">—</span>;
  return <span className="font-semibold text-[#F0F0F5]">{r.toFixed(1)}</span>;
}

const categoryColors: Record<string, 'indigo' | 'success' | 'amber' | 'default'> = {
  'Web Design': 'indigo',
  'Graphic Design': 'success',
  'Design cum Development': 'amber',
  'IT Operations': 'default',
};

const PAGE_SIZE = 10;
const ALL = 'All';

const selectClassName =
  'px-3 py-1.5 text-xs rounded-md border border-[#2A2A3C] text-[#F0F0F5] bg-[#1E1E2E] hover:bg-[#2A2A3C] transition-colors focus:outline-none focus:ring-1 focus:ring-[#6366F1] cursor-pointer';

export function RecentTasksTable() {
  const { tasks, loading } = useAppContext();
  const [currentPage, setCurrentPage] = useState(1);
  const [teamLeaderFilter, setTeamLeaderFilter] = useState(ALL);
  const [designerFilter, setDesignerFilter] = useState(ALL);
  const [monthFilter, setMonthFilter] = useState(ALL);

  const teamLeaders = useMemo(() => {
    const names = new Set<string>();
    tasks.forEach((task) => {
      if (task.teamLeader) names.add(task.teamLeader);
    });
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [tasks]);

  const designers = useMemo(() => {
    const names = new Set<string>();
    tasks.forEach((task) => {
      if (task.designerName) names.add(task.designerName);
    });
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [tasks]);

  const months = useMemo(() => {
    const keys = new Set<string>();
    tasks.forEach((task) => {
      const key = getMonthKey(task.date);
      if (key) keys.add(key);
    });
    return [...keys].sort((a, b) => b.localeCompare(a));
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (teamLeaderFilter !== ALL && task.teamLeader !== teamLeaderFilter) return false;
      if (designerFilter !== ALL && task.designerName !== designerFilter) return false;
      if (monthFilter !== ALL && getMonthKey(task.date) !== monthFilter) return false;
      return true;
    });
  }, [tasks, teamLeaderFilter, designerFilter, monthFilter]);

  const sortedTasks = useMemo(
    () =>
      [...filteredTasks].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      ),
    [filteredTasks]
  );

  const totalPages = Math.max(1, Math.ceil(sortedTasks.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const paginatedTasks = sortedTasks.slice(startIndex, startIndex + PAGE_SIZE);

  const canGoPrevious = safePage > 1;
  const canGoNext = safePage < totalPages;
  const hasActiveFilters =
    teamLeaderFilter !== ALL || designerFilter !== ALL || monthFilter !== ALL;

  const handleTeamLeaderChange = (value: string) => {
    setTeamLeaderFilter(value);
    setCurrentPage(1);
  };

  const handleDesignerChange = (value: string) => {
    setDesignerFilter(value);
    setCurrentPage(1);
  };

  const handleMonthChange = (value: string) => {
    setMonthFilter(value);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setTeamLeaderFilter(ALL);
    setDesignerFilter(ALL);
    setMonthFilter(ALL);
    setCurrentPage(1);
  };

  return (
    <Card className="fade-in">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-[#F0F0F5]">Recent Tasks</h2>
        <span className="text-xs text-[#8B8B9E]">
          {sortedTasks.length === 0
            ? 'No entries'
            : `${sortedTasks.length} ${sortedTasks.length === 1 ? 'entry' : 'entries'}`}
        </span>
      </div>

      {!loading && tasks.length > 0 && (
        <div className="flex flex-wrap items-end gap-3 mb-4 p-3 rounded-lg border border-[#2A2A3C] bg-[#1E1E2E]/50">
          <div className="flex flex-col gap-1">
            <label htmlFor="team-leader-filter" className="text-xs text-[#8B8B9E]">
              Team Leader
            </label>
            <select
              id="team-leader-filter"
              value={teamLeaderFilter}
              onChange={(e) => handleTeamLeaderChange(e.target.value)}
              className={selectClassName}
            >
              <option value={ALL}>All</option>
              {teamLeaders.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="designer-filter" className="text-xs text-[#8B8B9E]">
              Designer
            </label>
            <select
              id="designer-filter"
              value={designerFilter}
              onChange={(e) => handleDesignerChange(e.target.value)}
              className={selectClassName}
            >
              <option value={ALL}>All</option>
              {designers.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="month-filter" className="text-xs text-[#8B8B9E]">
              Month
            </label>
            <select
              id="month-filter"
              value={monthFilter}
              onChange={(e) => handleMonthChange(e.target.value)}
              className={selectClassName}
            >
              <option value={ALL}>All</option>
              {months.map((key) => (
                <option key={key} value={key}>
                  {formatMonthLabel(key)}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={clearFilters}
            disabled={!hasActiveFilters}
            className="px-3 py-1.5 text-xs font-medium rounded-md border border-[#2A2A3C] text-[#F0F0F5] bg-[#1E1E2E] hover:bg-[#2A2A3C] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#1E1E2E]"
          >
            Clear Filters
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-10 rounded" />)}
        </div>
      ) : sortedTasks.length === 0 ? (
        <p className="text-[#8B8B9E] text-sm py-6 text-center">
          {tasks.length === 0 ? 'No tasks found' : 'No tasks match the selected filters'}
        </p>
      ) : (
        <>
          <Table>
            <Thead>
              <tr>
                <Th>#</Th>
                <Th>Date</Th>
                <Th>Client</Th>
                <Th>Category</Th>
                <Th>Designer</Th>
                <Th>Team Leader</Th>
                <Th>Deliverable</Th>
                <Th>Avg Rating</Th>
                <Th>Link</Th>
              </tr>
            </Thead>
            <Tbody>
              {paginatedTasks.map((task, index) => (
                <tr key={task.srNo} className="hover:bg-[#1E1E2E]/50 transition-colors duration-100">
                  <Td>
                    <span className="text-[#8B8B9E]">{startIndex + index + 1}</span>
                  </Td>
                  <Td>{formatDate(task.date)}</Td>
                  <Td><span className="font-medium">{task.clientName || '—'}</span></Td>
                  <Td>
                    <Badge variant={categoryColors[task.category] ?? 'default'}>
                      {task.category || '—'}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {task.designerName?.charAt(0)?.toUpperCase() ?? '?'}
                      </div>
                      <span>{task.designerName || '—'}</span>
                    </div>
                  </Td>
                  <Td><span className="font-medium">{task.teamLeader || '—'}</span></Td>
                  <Td><span className="text-[#8B8B9E]">{task.deliverable || '—'}</span></Td>
                  <Td>{ratingDisplay(task.averageRating)}</Td>
                  <Td>
                    {task.workLink ? (
                      <a
                        href={task.workLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[#6366F1] hover:text-indigo-300 transition-colors text-xs"
                      >
                        View <ExternalLink size={12} />
                      </a>
                    ) : <span className="text-[#8B8B9E]">—</span>}
                  </Td>
                </tr>
              ))}
            </Tbody>
          </Table>

          <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#2A2A3C]">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={!canGoPrevious}
              className="px-3 py-1.5 text-xs font-medium rounded-md border border-[#2A2A3C] text-[#F0F0F5] bg-[#1E1E2E] hover:bg-[#2A2A3C] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#1E1E2E]"
            >
              Previous
            </button>

            <span className="text-xs text-[#8B8B9E]">
              Page {safePage} of {totalPages}
            </span>

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={!canGoNext}
              className="px-3 py-1.5 text-xs font-medium rounded-md border border-[#2A2A3C] text-[#F0F0F5] bg-[#1E1E2E] hover:bg-[#2A2A3C] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#1E1E2E]"
            >
              Next
            </button>
          </div>
        </>
      )}
    </Card>
  );
}
