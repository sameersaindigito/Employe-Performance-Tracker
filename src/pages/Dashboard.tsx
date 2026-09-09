import { useAppContext } from '../context/AppContext';
import { PageShell } from '../components/layout/PageShell';
import { FilterBar } from '../components/dashboard/FilterBar';
import { KPIGrid } from '../components/dashboard/KPIGrid';
import { DesignerOfMonth } from '../components/dashboard/DesignerOfMonth';
import { ITOperationsChampion } from '../components/dashboard/ITOperationsChampion';
import { Leaderboard } from '../components/dashboard/Leaderboard';
import { RecentTasksTable } from '../components/dashboard/RecentTasksTable';
import { RatingsBarChart } from '../components/charts/RatingsBarChart';
import { TaskPieChart } from '../components/charts/TaskPieChart';
import { MonthlyTrendLine } from '../components/charts/MonthlyTrendLine';
import { LeaderComparison } from '../components/charts/LeaderComparison';
import { RefreshCw } from 'lucide-react';

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center">
        <RefreshCw size={24} className="text-red-400" />
      </div>
      <div className="text-center">
        <p className="text-[#F0F0F5] font-semibold mb-1">Failed to load data</p>
        <p className="text-[#8B8B9E] text-sm mb-4">{message}</p>
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-[#6366F1] hover:bg-[#5254CC] text-white text-sm font-medium rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

export function Dashboard() {
  const { error, refetch, tasks, loading } = useAppContext();

  return (
    <PageShell
      title="Dashboard"
      subtitle="Designer performance overview and metrics"
    >
      <FilterBar />

      {error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (
        <>
          {/* KPI Grid */}
          <KPIGrid />

          {/* Designer of Month + IT Operations Champion banners */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <DesignerOfMonth />
            <ITOperationsChampion />
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <RatingsBarChart />
            <TaskPieChart />
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <MonthlyTrendLine />
            <LeaderComparison />
          </div>

          {/* Leaderboard — only table on the page */}
          <div className="mb-6">
            <Leaderboard />
          </div>

          {/* Recent Tasks */}
          {!loading && tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <p className="text-[#8B8B9E] text-sm">No tasks found for the selected filters.</p>
            </div>
          ) : (
            <RecentTasksTable />
          )}
        </>
      )}
    </PageShell>
  );
}
