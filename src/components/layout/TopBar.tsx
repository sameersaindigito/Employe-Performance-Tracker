import { RefreshCw } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';

interface TopBarProps {
  title: string;
  subtitle?: string;
}

export function TopBar({ title, subtitle }: TopBarProps) {
  const { refetch, loading, lastUpdated } = useAppContext();

  return (
    <header className="sticky top-0 z-30 bg-[#0A0A0F]/90 backdrop-blur-md border-b border-[#1E1E2E] px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-[#F0F0F5]">{title}</h1>
          {subtitle && <p className="text-xs text-[#8B8B9E] mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="hidden md:block text-xs text-[#8B8B9E]">
              Last updated: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={refetch}
            disabled={loading}
            className="p-2 rounded-lg text-[#8B8B9E] hover:text-[#F0F0F5] hover:bg-[#1E1E2E] transition-all duration-150 disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>
    </header>
  );
}
