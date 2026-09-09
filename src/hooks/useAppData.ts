import { useAppContext } from '../context/AppContext';

export function useAppData() {
  return useAppContext();
}
