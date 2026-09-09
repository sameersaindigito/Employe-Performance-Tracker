import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  type ReactNode,
} from 'react';
import type { Task, FilterState, RevenueItem } from '../types';
import { fetchTasks, fetchRevenue, triggerSync } from '../lib/api';
import { applyClientFilters } from '../lib/filters';

interface AppContextValue {
  /** Filtered dataset — used by all display components (charts, KPIs, leaderboard) */
  tasks: Task[];
  /** Complete unfiltered dataset — used ONLY for building dropdown option lists */
  allTasks: Task[];
  /**
   * Complete unfiltered revenue dataset, fetched once here and shared by every
   * Dashboard consumer (Designer of the Month, IT Ops Champion, Leaderboard).
   * Previously each of those fetched independently via useRevenueData(), which
   * meant up to 5 redundant concurrent `getRevenue` requests per page load —
   * against a backend that has been observed returning inconsistent/empty
   * results under concurrent load. One shared fetch removes that redundancy.
   */
  revenueItems: RevenueItem[];
  loading: boolean;
  error: string | null;
  filters: FilterState;
  setFilters: (f: Partial<FilterState>) => void;
  resetFilters: () => void;
  refetch: () => void;
  sync: () => Promise<void>;
  syncing: boolean;
  lastUpdated: Date | null;
}

/** Derive the most recent month present in a task list. Returns '' if list is empty. */
function getMostRecentDataMonth(tasks: Task[]): string {
  let best = '';
  for (const t of tasks) {
    const m = t.date?.slice(0, 7);
    if (m && m > best) best = m;
  }
  return best;
}

const defaultFilters: FilterState = {
  month: '', // will be corrected to the most recent data month after first fetch
  leader: '',
  designer: '',
  deliverable: '',
  category: '',
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  // Full unfiltered dataset — fetched once and only refreshed on sync/refetch
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [revenueItems, setRevenueItems] = useState<RevenueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<FilterState>(defaultFilters);
  const [syncing, setSyncing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Always fetch the COMPLETE dataset with no filter params.
   * Filtering happens client-side via applyClientFilters below.
   * This ensures dropdown options are never built from a subset.
   *
   * Tasks and revenue are fetched together, once, here — the single shared
   * source both the Dashboard's award cards/Leaderboard and anything else
   * app-wide read from, instead of each component fetching revenue on its own.
   */
  const loadAllTasks = useCallback(async (isFirstLoad = false) => {
    setLoading(true);
    setError(null);
    try {
      const [data, revenue] = await Promise.all([
        fetchTasks({}), // no filter params — always fetch all
        fetchRevenue({}),
      ]);
      setAllTasks(data);
      setRevenueItems(revenue);
      setLastUpdated(new Date());
      // Bug 3b: on first load only, set month to most recent month in the data
      // so the dashboard never looks blank because today's calendar month is empty.
      if (isFirstLoad) {
        const recentMonth = getMostRecentDataMonth(data);
        setFiltersState((prev) => ({ ...prev, month: recentMonth }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount only (filter changes no longer trigger API calls)
  useEffect(() => {
    loadAllTasks(true); // isFirstLoad=true → sets default month from data
  }, [loadAllTasks]);

  // Auto-refresh every 5 minutes — re-fetches the complete dataset
  useEffect(() => {
    intervalRef.current = setInterval(loadAllTasks, 5 * 60 * 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadAllTasks]);

  /**
   * Derived filtered view — recomputed instantly when filters change,
   * with zero additional API calls.
   */
  const tasks = useMemo(
    () => applyClientFilters(allTasks, filters),
    [allTasks, filters],
  );

  const setFilters = useCallback(
    (partial: Partial<FilterState>) =>
      setFiltersState((prev) => ({ ...prev, ...partial })),
    [],
  );

  const resetFilters = useCallback(
    () => setFiltersState(defaultFilters),
    [],
  );

  // refetch re-loads the full dataset, not just the filtered slice
  const refetch = useCallback(() => loadAllTasks(), [loadAllTasks]);

  const sync = useCallback(async () => {
    setSyncing(true);
    try {
      await triggerSync();
      await loadAllTasks(); // refresh full dataset after sync
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }, [loadAllTasks]);

  return (
    <AppContext.Provider
      value={{
        tasks,
        allTasks,
        revenueItems,
        loading,
        error,
        filters,
        setFilters,
        resetFilters,
        refetch,
        sync,
        syncing,
        lastUpdated,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}
