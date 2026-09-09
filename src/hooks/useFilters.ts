import { useAppContext } from '../context/AppContext';

export function useFilters() {
  const { filters, setFilters, resetFilters } = useAppContext();
  return { filters, setFilters, resetFilters };
}
